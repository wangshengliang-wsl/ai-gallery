// pages/profile/profile.ts
import Toast from 'tdesign-miniprogram/toast/index';

interface UserInfo {
  nickname: string;
  avatar: string;
  worksCount: number;
  favoritesCount: number;
  viewsCount: number;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
}

interface UserData {
  _id: string;
  openid?: string;
  nickname: string;
  avatar: string;
  worksCount: number;
  favoritesCount: number;
  viewsCount: number;
}

Page({
  data: {
    isLoggedIn: false,
    userInfo: {
      nickname: '',
      avatar: '',
      worksCount: 0,
      favoritesCount: 0,
      viewsCount: 0,
    } as UserInfo,
    personalGallery: [] as GalleryItem[],
    userId: '', // 存储用户ID，用于上传头像
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  async checkLoginStatus() {
    try {
      const openid = wx.getStorageSync('openid');
      
      if (openid) {
        this.setData({ isLoggedIn: true });
        await this.loadUserInfo();
      } else {
        this.setData({ isLoggedIn: false });
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      this.setData({ isLoggedIn: false });
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      wx.showLoading({ title: '加载中...' });

      // 调用云函数获取用户信息
      const userInfoRes = await wx.cloud.callFunction({
        name: 'getUserInfo',
      });

      if (userInfoRes.result.success) {
        const userData = userInfoRes.result.data;
        this.setData({
          userId: userData._id, // 保存用户ID
          userInfo: {
            nickname: userData.nickname || '微信用户',
            avatar: userData.avatar || '',
            worksCount: userData.worksCount || 0,
            favoritesCount: userData.favoritesCount || 0,
            viewsCount: userData.viewsCount || 0,
          },
        });

        // 加载用户画廊
        await this.loadUserGallery();
      } else {
        throw new Error(userInfoRes.result.errMsg || '获取用户信息失败');
      }

      wx.hideLoading();
    } catch (error: any) {
      wx.hideLoading();
      console.error('加载用户信息失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '加载失败，请重试',
        theme: 'error',
      });
    }
  },

  // 加载用户画廊
  async loadUserGallery() {
    try {
      const galleryRes = await wx.cloud.callFunction({
        name: 'getUserGallery',
        data: {
          limit: 6,
          skip: 0,
        },
      });

      if (galleryRes.result.success) {
        const galleryData = galleryRes.result.data || [];
        const personalGallery = galleryData.map((item: any) => ({
          id: item._id,
          imageUrl: item.tempImageUrl || item.imageUrl || '',
          prompt: item.prompt || '',
        }));

        this.setData({
          personalGallery,
        });
      }
    } catch (error) {
      console.error('加载用户画廊失败:', error);
      // 画廊加载失败不影响主流程，只记录日志
    }
  },

  // 登录
  async onLogin() {
    try {
      // 获取用户信息
      const userProfile = await wx.getUserProfile({
        desc: '用于完善用户资料',
      });

      console.log('获取用户信息成功', userProfile.userInfo);

      wx.showLoading({ title: '登录中...' });

      // 调用云函数进行登录
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          nickName: userProfile.userInfo.nickName,
          avatarUrl: userProfile.userInfo.avatarUrl,
        },
      });

      wx.hideLoading();

      if (loginRes.result.success) {
        const { openid, userInfo } = loginRes.result.data;

        // 保存登录状态
        wx.setStorageSync('openid', openid);
        wx.setStorageSync('userInfo', userInfo);

        Toast({
          context: this,
          selector: '#t-toast',
          message: '登录成功',
          theme: 'success',
        });

        this.setData({
          isLoggedIn: true,
          userId: userInfo._id, // 保存用户ID
          userInfo: {
            nickname: userInfo.nickname || userProfile.userInfo.nickName,
            avatar: userInfo.avatar || userProfile.userInfo.avatarUrl,
            worksCount: userInfo.worksCount || 0,
            favoritesCount: userInfo.favoritesCount || 0,
            viewsCount: userInfo.viewsCount || 0,
          },
        });

        // 加载完整的用户信息和画廊
        await this.loadUserInfo();
      } else {
        throw new Error(loginRes.result.errMsg || '登录失败');
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('登录失败', error);
      
      // 判断是否是用户取消
      if (error.errMsg && error.errMsg.includes('cancel')) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '登录取消',
          theme: 'info',
        });
      } else {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '登录失败，请重试',
          theme: 'error',
        });
      }
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.removeStorageSync('openid');
          wx.removeStorageSync('userInfo');

          this.setData({
            isLoggedIn: false,
            userId: '',
            userInfo: {
              nickname: '',
              avatar: '',
              worksCount: 0,
              favoritesCount: 0,
              viewsCount: 0,
            },
            personalGallery: [],
          });

          Toast({
            context: this,
            selector: '#t-toast',
            message: '已退出登录',
            theme: 'success',
          });
        }
      },
    });
  },

  // 编辑头像
  async onEditAvatar() {
    try {
      // 选择图片
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      if (res.tempFilePaths.length === 0) {
        return;
      }

      const tempFilePath = res.tempFilePaths[0];
      
      wx.showLoading({ title: '上传中...' });

      // 上传到云存储
      const userId = this.data.userId;
      const fileExtension = tempFilePath.split('.').pop();
      const cloudPath = `avatars/${userId}.${fileExtension}`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
      });

      console.log('上传成功:', uploadRes.fileID);

      // 获取临时链接（后续可以改成永久链接）
      const tempUrlRes = await wx.cloud.getTempFileURL({
        fileList: [uploadRes.fileID],
      });

      const avatarUrl = tempUrlRes.fileList[0].tempFileURL;

      // 调用云函数更新用户头像
      const updateRes = await wx.cloud.callFunction({
        name: 'updateUserAvatar',
        data: {
          avatarUrl: uploadRes.fileID, // 存储 fileID，不是临时URL
        },
      });

      wx.hideLoading();

      if (updateRes.result.success) {
        // 更新本地显示
        this.setData({
          'userInfo.avatar': avatarUrl,
        });

        // 更新本地存储
        const userInfo = wx.getStorageSync('userInfo');
        userInfo.avatar = uploadRes.fileID;
        wx.setStorageSync('userInfo', userInfo);

        Toast({
          context: this,
          selector: '#t-toast',
          message: '头像更新成功',
          theme: 'success',
        });
      } else {
        throw new Error(updateRes.result.errMsg || '更新头像失败');
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('编辑头像失败:', error);
      
      // 判断是否是用户取消
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      Toast({
        context: this,
        selector: '#t-toast',
        message: '更新头像失败，请重试',
        theme: 'error',
      });
    }
  },

  // 编辑昵称
  onEditNickname() {
    const currentNickname = this.data.userInfo.nickname;
    
    wx.showModal({
      title: '修改昵称',
      content: '',
      editable: true,
      placeholderText: currentNickname,
      success: async (res) => {
        if (res.confirm && res.content) {
          const newNickname = res.content.trim();
          
          if (!newNickname) {
            Toast({
              context: this,
              selector: '#t-toast',
              message: '昵称不能为空',
              theme: 'warning',
            });
            return;
          }

          if (newNickname === currentNickname) {
            return;
          }

          if (newNickname.length > 20) {
            Toast({
              context: this,
              selector: '#t-toast',
              message: '昵称不能超过20个字符',
              theme: 'warning',
            });
            return;
          }

          await this.updateNickname(newNickname);
        }
      },
    });
  },

  // 更新昵称
  async updateNickname(newNickname: string) {
    wx.showLoading({ title: '更新中...' });

    try {
      // 调用云函数更新昵称
      const updateRes = await wx.cloud.callFunction({
        name: 'updateUserAvatar',
        data: {
          nickname: newNickname,
        },
      });

      wx.hideLoading();

      const result = updateRes.result as any;
      if (result && result.success) {
        // 更新本地显示
        this.setData({
          'userInfo.nickname': newNickname,
        });

        // 更新本地存储
        const userInfo = wx.getStorageSync('userInfo');
        userInfo.nickname = newNickname;
        wx.setStorageSync('userInfo', userInfo);

        Toast({
          context: this,
          selector: '#t-toast',
          message: '昵称更新成功',
          theme: 'success',
        });
      } else {
        throw new Error((result && result.errMsg) || '更新昵称失败');
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('更新昵称失败:', error);
      
      Toast({
        context: this,
        selector: '#t-toast',
        message: error.message || '更新昵称失败，请重试',
        theme: 'error',
      });
    }
  },

  // 查看全部画廊
  onViewAllGallery() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '画廊详情页即将上线',
      theme: 'info',
    });
  },

  // 点击画廊作品
  onGalleryItemTap(e: any) {
    const item = e.currentTarget.dataset.item;
    console.log('点击作品:', item);
    // TODO: 跳转到作品详情页
  },

  // 个人画廊
  onGalleryClick() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }
    Toast({
      context: this,
      selector: '#t-toast',
      message: '个人画廊页面即将上线',
      theme: 'info',
    });
  },

  // 创作历史
  onHistoryClick() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }
    Toast({
      context: this,
      selector: '#t-toast',
      message: '创作历史页面即将上线',
      theme: 'info',
    });
  },

  // 我的收藏
  onFavoritesClick() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }
    Toast({
      context: this,
      selector: '#t-toast',
      message: '我的收藏页面即将上线',
      theme: 'info',
    });
  },

  // 设置
  onSettingsClick() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '设置页面即将上线',
      theme: 'info',
    });
  },

  // 显示登录提示
  showLoginTip() {
    wx.showModal({
      title: '提示',
      content: '请先登录',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          this.onLogin();
        }
      },
    });
  },
});

