// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 阿里云 DashScope API 配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'createTask':
        return await createTask(event, wxContext)
      case 'getResult':
        return await getResult(event, wxContext)
      case 'publishWork':
        return await publishWork(event, wxContext)
      default:
        return {
          success: false,
          errMsg: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      success: false,
      errMsg: error.message || '服务异常，请稍后重试'
    }
  }
}

/**
 * 创建文生图任务
 */
async function createTask(event, wxContext) {
  const { OPENID } = wxContext
  const { prompt, negativePrompt, size = '1024*1024', n = 1 } = event

  if (!prompt) {
    return {
      success: false,
      errMsg: '提示词不能为空'
    }
  }

  if (!DASHSCOPE_API_KEY) {
    return {
      success: false,
      errMsg: '服务配置错误，请联系管理员'
    }
  }

  try {
    // 构建请求参数
    const requestData = {
      model: 'wanx2.1-t2i-plus',
      input: {
        prompt: prompt
      },
      parameters: {
        size: size,
        n: n
      }
    }

    // 如果有反向提示词，添加到请求中
    if (negativePrompt) {
      requestData.input.negative_prompt = negativePrompt
    }

    // 调用阿里云 API 创建任务
    const response = await axios.post(
      `${API_BASE_URL}/services/aigc/text2image/image-synthesis`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable'
        }
      }
    )

    const { output, request_id } = response.data

    if (!output || !output.task_id) {
      throw new Error('创建任务失败，未获取到任务ID')
    }

    // 查询用户信息
    const userQuery = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userQuery.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在，请先登录'
      }
    }

    const userInfo = userQuery.data[0]
    const now = new Date()

    // 保存任务记录到数据库
    const taskRecord = {
      userId: userInfo._id,
      openid: OPENID,
      taskId: output.task_id,
      prompt: prompt,
      negativePrompt: negativePrompt || '',
      size: size,
      n: n,
      model: 'wanx2.1-t2i-plus',
      status: output.task_status || 'PENDING',
      requestId: request_id,
      createdAt: now,
      updatedAt: now
    }

    const result = await db.collection('ai_tasks').add({
      data: taskRecord
    })

    return {
      success: true,
      data: {
        taskId: output.task_id,
        recordId: result._id,
        status: output.task_status
      }
    }
  } catch (error) {
    console.error('创建任务失败:', error)
    
    // 处理阿里云 API 错误
    if (error.response) {
      const { code, message } = error.response.data || {}
      return {
        success: false,
        errMsg: message || '创建任务失败',
        code: code
      }
    }

    return {
      success: false,
      errMsg: error.message || '创建任务失败，请重试'
    }
  }
}

/**
 * 查询任务结果
 */
async function getResult(event, wxContext) {
  const { OPENID } = wxContext
  const { taskId, recordId } = event

  if (!taskId) {
    return {
      success: false,
      errMsg: '任务ID不能为空'
    }
  }

  if (!DASHSCOPE_API_KEY) {
    return {
      success: false,
      errMsg: '服务配置错误，请联系管理员'
    }
  }

  try {
    // 查询阿里云任务状态
    const response = await axios.get(
      `${API_BASE_URL}/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
        }
      }
    )

    const { output, usage } = response.data

    if (!output) {
      throw new Error('获取任务结果失败')
    }

    const now = new Date()
    const updateData = {
      status: output.task_status,
      updatedAt: now
    }

    // 如果任务成功，保存结果
    if (output.task_status === 'SUCCEEDED' && output.results) {
      updateData.results = output.results
      updateData.taskMetrics = output.task_metrics
      updateData.usage = usage
      updateData.submitTime = output.submit_time
      updateData.scheduledTime = output.scheduled_time
      updateData.endTime = output.end_time

      // 保存图片到 works 集合
      if (recordId) {
        const taskRecord = await db.collection('ai_tasks').doc(recordId).get()
        if (taskRecord.data) {
          const userQuery = await db.collection('users').where({
            openid: OPENID
          }).get()

          if (userQuery.data.length > 0) {
            const userInfo = userQuery.data[0]

            // 为每个生成的图片创建作品记录
            for (let i = 0; i < output.results.length; i++) {
              const result = output.results[i]
              
              // 下载图片并上传到云存储
              let cloudFileId = ''
              try {
                // 下载图片
                const imageResponse = await axios.get(result.url, {
                  responseType: 'arraybuffer'
                })
                
                // 上传到云存储
                const fileName = `works/${userInfo._id}_${taskId}_${i}.png`
                const uploadResult = await cloud.uploadFile({
                  cloudPath: fileName,
                  fileContent: Buffer.from(imageResponse.data)
                })
                
                cloudFileId = uploadResult.fileID
              } catch (uploadError) {
                console.error('上传图片到云存储失败:', uploadError)
                cloudFileId = result.url // 如果上传失败，使用原始URL
              }

              await db.collection('works').add({
                data: {
                  userId: userInfo._id,
                  openid: OPENID,
                  taskId: taskId,
                  imageUrl: cloudFileId,
                  originalUrl: result.url,
                  prompt: result.orig_prompt,
                  actualPrompt: result.actual_prompt || '',
                  model: 'wanx2.1-t2i-plus',
                  width: parseInt(taskRecord.data.size.split('*')[0]),
                  height: parseInt(taskRecord.data.size.split('*')[1]),
                  isPublic: false,
                  likeCount: 0,
                  viewCount: 0,
                  createdAt: now,
                  updatedAt: now
                }
              })
            }

            // 更新用户作品数量
            await db.collection('users').doc(userInfo._id).update({
              data: {
                worksCount: db.command.inc(output.results.length)
              }
            })
          }
        }
      }
    } else if (output.task_status === 'FAILED') {
      // 保存失败信息
      if (output.code) {
        updateData.errorCode = output.code
        updateData.errorMessage = output.message
      }
    }

    // 更新任务记录
    if (recordId) {
      await db.collection('ai_tasks').doc(recordId).update({
        data: updateData
      })
    }

    return {
      success: true,
      data: {
        taskId: output.task_id,
        status: output.task_status,
        results: output.results || [],
        taskMetrics: output.task_metrics,
        submitTime: output.submit_time,
        scheduledTime: output.scheduled_time,
        endTime: output.end_time
      }
    }
  } catch (error) {
    console.error('查询任务结果失败:', error)

    // 处理阿里云 API 错误
    if (error.response) {
      const { code, message } = error.response.data || {}
      return {
        success: false,
        errMsg: message || '查询任务失败',
        code: code
      }
    }

    return {
      success: false,
      errMsg: error.message || '查询任务失败，请重试'
    }
  }
}

/**
 * 发布作品
 */
async function publishWork(event, wxContext) {
  const { OPENID } = wxContext
  const { imageUrl, prompt, taskId } = event

  if (!imageUrl || !prompt) {
    return {
      success: false,
      errMsg: '图片地址和提示词不能为空'
    }
  }

  try {
    // 查询用户信息
    const userQuery = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userQuery.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在，请先登录'
      }
    }

    const userInfo = userQuery.data[0]
    const now = new Date()

    // 下载图片
    let cloudFileId = ''
    try {
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      })

      // 生成唯一文件名
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const fileName = `images/${userInfo._id}_${timestamp}_${randomStr}.png`

      // 上传到云存储
      const uploadResult = await cloud.uploadFile({
        cloudPath: fileName,
        fileContent: Buffer.from(imageResponse.data)
      })

      cloudFileId = uploadResult.fileID
    } catch (uploadError) {
      console.error('下载或上传图片失败:', uploadError)
      return {
        success: false,
        errMsg: '图片保存失败，请重试'
      }
    }

    // 保存到 images 集合
    const imageRecord = {
      userId: userInfo._id,
      openid: OPENID,
      userName: userInfo.nickname,
      userAvatar: userInfo.avatar,
      taskId: taskId || '',
      imageUrl: cloudFileId,
      originalUrl: imageUrl,
      prompt: prompt,
      likeCount: 0,
      viewCount: 0,
      isPublic: true,
      createdAt: now,
      updatedAt: now
    }

    const result = await db.collection('images').add({
      data: imageRecord
    })

    // 更新用户作品数量
    await db.collection('users').doc(userInfo._id).update({
      data: {
        worksCount: db.command.inc(1)
      }
    })

    return {
      success: true,
      data: {
        imageId: result._id,
        imageUrl: cloudFileId
      }
    }
  } catch (error) {
    console.error('发布作品失败:', error)
    return {
      success: false,
      errMsg: error.message || '发布失败，请重试'
    }
  }
}

