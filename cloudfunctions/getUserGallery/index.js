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
    
    // 获取用户的作品
    const worksQuery = await db.collection('works')
      .where({
        userId: userInfo._id
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    return {
      success: true,
      data: worksQuery.data
    }
  } catch (error) {
    console.error('获取用户画廊失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

