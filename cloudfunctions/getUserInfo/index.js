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
    
    // 获取用户的作品数量（从 works 集合）
    const worksCount = await db.collection('works').where({
      userId: userInfo._id
    }).count()
    
    // 获取用户的收藏数量（从 favorites 集合）
    const favoritesCount = await db.collection('favorites').where({
      userId: userInfo._id
    }).count()
    
    // 更新用户信息中的统计数据
    await db.collection('users').doc(userInfo._id).update({
      data: {
        worksCount: worksCount.total,
        favoritesCount: favoritesCount.total
      }
    })
    
    return {
      success: true,
      data: {
        ...userInfo,
        worksCount: worksCount.total,
        favoritesCount: favoritesCount.total
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

