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
    const { limit = 20, skip = 0 } = event
    
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
    
    // 获取用户发布的作品（从 images 集合）
    const imagesQuery = await db.collection('images')
      .where({
        userId: userInfo._id
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 获取云存储临时链接
    const images = imagesQuery.data
    if (images.length > 0) {
      const fileList = images.map(img => img.imageUrl).filter(url => url)
      
      if (fileList.length > 0) {
        try {
          const tempUrlRes = await cloud.getTempFileURL({
            fileList: fileList
          })
          
          // 将临时链接映射回图片数据
          const fileMap = {}
          tempUrlRes.fileList.forEach(file => {
            fileMap[file.fileID] = file.tempFileURL
          })
          
          images.forEach(img => {
            if (img.imageUrl && fileMap[img.imageUrl]) {
              img.tempImageUrl = fileMap[img.imageUrl]
            }
          })
        } catch (error) {
          console.error('获取临时链接失败:', error)
        }
      }
    }
    
    return {
      success: true,
      data: images
    }
  } catch (error) {
    console.error('获取用户画廊失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

