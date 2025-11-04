// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { OPENID } = wxContext
    const { avatarUrl, nickname } = event
    
    // 验证至少有一个要更新的字段
    if (!avatarUrl && !nickname) {
      return {
        success: false,
        errMsg: '请提供要更新的信息'
      }
    }
    
    // 查询用户信息
    const userQuery = await db.collection('users').where({
      openid: OPENID
    }).get()
    
    if (userQuery.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      }
    }
    
    const userInfo = userQuery.data[0]
    const now = new Date()
    
    // 构建更新数据
    const updateData = {
      updatedAt: now
    }
    
    if (avatarUrl) {
      updateData.avatar = avatarUrl
    }
    
    if (nickname) {
      // 验证昵称长度
      if (nickname.length > 20) {
        return {
          success: false,
          errMsg: '昵称不能超过20个字符'
        }
      }
      updateData.nickname = nickname
    }
    
    // 更新用户信息
    await db.collection('users').doc(userInfo._id).update({
      data: updateData
    })
    
    return {
      success: true,
      data: updateData
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

