// app.ts

// 初始化云开发环境
if (!wx.cloud) {
  console.error('请使用 2.2.3 或以上的基础库以使用云能力')
} else {
  wx.cloud.init({
    env: 'wsl-cloud-0gwasy7f2d9bbd87',
    traceUser: true,
  })
}

App<IAppOption>({
  globalData: {
    openid: '',
    userInfo: null,
  },
  
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 获取云开发环境
    console.log('云开发环境初始化完成')
  },
})
