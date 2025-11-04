// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { limit = 10, skip = 0 } = event
    
    // 获取所有公开发布的作品（从 images 集合）
    const imagesQuery = await db.collection('images')
      .where({
        isPublic: true
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    const images = imagesQuery.data
    
    if (images.length === 0) {
      return {
        success: true,
        data: [],
        hasMore: false
      }
    }

    // 获取所有相关用户的ID
    const userIds = [...new Set(images.map(img => img.userId))]
    
    // 批量查询用户信息
    const usersQuery = await db.collection('users')
      .where({
        _id: _.in(userIds)
      })
      .field({
        _id: true,
        nickname: true,
        avatar: true
      })
      .get()
    
    // 创建用户信息映射
    const userMap = {}
    usersQuery.data.forEach(user => {
      userMap[user._id] = {
        name: user.nickname || '匿名用户',
        avatar: user.avatar || ''
      }
    })

    // 获取云存储临时链接
    const fileList = images.map(img => img.imageUrl).filter(url => url)
    let fileMap = {}
    
    if (fileList.length > 0) {
      try {
        const tempUrlRes = await cloud.getTempFileURL({
          fileList: fileList
        })
        
        tempUrlRes.fileList.forEach(file => {
          fileMap[file.fileID] = file.tempFileURL
        })
      } catch (error) {
        console.error('获取临时链接失败:', error)
      }
    }
    
    // 同时获取用户头像的临时链接
    const avatarFileList = usersQuery.data
      .map(user => user.avatar)
      .filter(avatar => avatar && avatar.startsWith('cloud://'))
    
    let avatarFileMap = {}
    if (avatarFileList.length > 0) {
      try {
        const avatarTempUrlRes = await cloud.getTempFileURL({
          fileList: avatarFileList
        })
        
        avatarTempUrlRes.fileList.forEach(file => {
          avatarFileMap[file.fileID] = file.tempFileURL
        })
      } catch (error) {
        console.error('获取头像临时链接失败:', error)
      }
    }

    // 组合数据
    const galleryList = images.map(img => {
      const user = userMap[img.userId] || { name: '匿名用户', avatar: '' }
      
      return {
        id: img._id,
        imageUrl: fileMap[img.imageUrl] || img.imageUrl || '',
        prompt: img.prompt || '',
        author: {
          name: user.name,
          avatar: avatarFileMap[user.avatar] || user.avatar || ''
        },
        likeCount: img.likeCount || 0,
        viewCount: img.viewCount || 0,
        createdAt: img.createdAt
      }
    })
    
    return {
      success: true,
      data: galleryList,
      hasMore: images.length >= limit
    }
  } catch (error) {
    console.error('获取公共画廊失败:', error)
    return {
      success: false,
      errMsg: error.message || '获取画廊数据失败'
    }
  }
}

