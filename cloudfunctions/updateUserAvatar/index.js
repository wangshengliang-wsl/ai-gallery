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
    const { avatarUrl } = event
    
    if (!avatarUrl) {
      return {
        success: false,
        errMsg: '头像URL不能为空'
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
    
    // 更新用户头像
    await db.collection('users').doc(userInfo._id).update({
      data: {
        avatar: avatarUrl,
        updatedAt: now
      }
    })
    
    return {
      success: true,
      data: {
        avatar: avatarUrl
      }
    }
  } catch (error) {
    console.error('更新用户头像失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

