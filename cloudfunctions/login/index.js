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
    const { OPENID, APPID, UNIONID } = wxContext
    
    // 查询用户是否已存在
    const userQuery = await db.collection('users').where({
      openid: OPENID
    }).get()
    
    let userInfo = null
    const now = new Date()
    
    if (userQuery.data.length === 0) {
      // 新用户，创建用户记录
      const result = await db.collection('users').add({
        data: {
          openid: OPENID,
          appid: APPID,
          unionid: UNIONID,
          nickname: event.nickName || '微信用户',
          avatar: event.avatarUrl || '',
          worksCount: 0,
          favoritesCount: 0,
          viewsCount: 0,
          createdAt: now,
          updatedAt: now
        }
      })
      
      // 获取刚创建的用户信息
      const newUser = await db.collection('users').doc(result._id).get()
      userInfo = newUser.data
    } else {
      // 老用户，更新登录时间
      userInfo = userQuery.data[0]
      
      // 如果有新的昵称和头像，更新用户信息
      const updateData = {
        updatedAt: now,
        lastLoginAt: now
      }
      
      if (event.nickName) {
        updateData.nickname = event.nickName
      }
      if (event.avatarUrl) {
        updateData.avatar = event.avatarUrl
      }
      
      await db.collection('users').doc(userInfo._id).update({
        data: updateData
      })
      
      // 重新获取用户信息
      const updatedUser = await db.collection('users').doc(userInfo._id).get()
      userInfo = updatedUser.data
    }
    
    return {
      success: true,
      data: {
        userInfo,
        openid: OPENID
      }
    }
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      errMsg: error.message
    }
  }
}

