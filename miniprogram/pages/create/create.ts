// pages/create/create.ts
import Toast from 'tdesign-miniprogram/toast/index';

interface TaskInfo {
  taskId: string;
  recordId: string;
  status: string;
}

Page({
  data: {
    prompt: '',
    negativePrompt: '',
    selectedStyle: '',
    styleOptions: ['写实', '动漫', '电影感', '梦幻', '水彩', '油画', '赛博朋克', '极简'],
    examplePrompts: [
      '一只可爱的柴犬，在樱花树下奔跑，动漫风格，温暖的春天氛围',
      '未来城市的夜景，飞行汽车穿梭，赛博朋克风格，霓虹灯光效果',
      '一间有着精致窗户的花店，漂亮的木质门，摆放着花朵',
      '雪山之巅的孤独旅人，背着登山包，俯瞰云海，壮丽的自然风光',
    ],
    generatedImage: '',
    generating: false,
    taskInfo: null as TaskInfo | null,
    pollingTimer: null as number | null,
    generationStatus: '', // PENDING, RUNNING, SUCCEEDED, FAILED
  },

  onLoad() {
    // 页面加载
    this.checkLoginStatus();
  },

  onUnload() {
    // 页面卸载时清除轮询
    this.clearPolling();
  },

  // 检查登录状态
  checkLoginStatus() {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用AI创作功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/profile/profile',
            });
          }
        },
      });
    }
  },

  // 清除轮询定时器
  clearPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
    // 清除 loading 标记
    wx.removeStorageSync('isShowingLoading');
  },

  // 提示词输入变化
  onPromptChange(e: any) {
    this.setData({
      prompt: e.detail.value,
    });
  },

  // 反向提示词变化
  onNegativePromptChange(e: any) {
    this.setData({
      negativePrompt: e.detail.value,
    });
  },

  // 选择风格
  onStyleSelect(e: any) {
    const style = e.currentTarget.dataset.style;
    const selectedStyle = this.data.selectedStyle === style ? '' : style;

    this.setData({
      selectedStyle: selectedStyle,
    });

    // 如果选择了风格，自动添加到提示词中
    if (selectedStyle && this.data.prompt && !this.data.prompt.includes(selectedStyle)) {
      this.setData({
        prompt: `${this.data.prompt}，${selectedStyle}风格`,
      });
    }
  },

  // 选择示例提示词
  onExampleSelect(e: any) {
    const prompt = e.currentTarget.dataset.prompt;
    this.setData({
      prompt: prompt,
    });
    Toast({
      context: this,
      selector: '#t-toast',
      message: '已应用示例',
      theme: 'success',
      duration: 1500,
    });
  },

  // 查看更多示例
  onViewMoreExamples() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '更多示例即将上线',
    });
  },

  // 生成图片
  async onGenerate() {
    if (!this.data.prompt.trim()) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请输入提示词',
        theme: 'warning',
      });
      return;
    }

    // 检查登录状态
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      this.checkLoginStatus();
      return;
    }

    this.setData({
      generating: true,
      generationStatus: 'PENDING',
    });

    wx.showLoading({ title: '创建任务中...' });

    try {
      // 调用云函数创建任务
      const createRes = await wx.cloud.callFunction({
        name: 'textToImage',
        data: {
          action: 'createTask',
          prompt: this.data.prompt,
          negativePrompt: this.data.negativePrompt || undefined,
          size: '1024*1024',
          n: 1,
        },
      });

      wx.hideLoading();

      const result = createRes.result as any;
      if (result && result.success) {
        const taskInfo: TaskInfo = {
          taskId: result.data.taskId,
          recordId: result.data.recordId,
          status: result.data.status,
        };

        this.setData({
          taskInfo: taskInfo,
          generationStatus: taskInfo.status,
        });

        Toast({
          context: this,
          selector: '#t-toast',
          message: '任务创建成功，正在生成...',
          theme: 'success',
          duration: 2000,
        });

        // 开始轮询查询结果
        this.startPolling();
      } else {
        throw new Error((result && result.errMsg) || '创建任务失败');
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('生成失败:', error);

      Toast({
        context: this,
        selector: '#t-toast',
        message: error.message || '生成失败，请重试',
        theme: 'error',
      });

      this.setData({
        generating: false,
        generationStatus: '',
      });
    }
  },

  // 开始轮询查询结果
  startPolling() {
    // 清除之前的轮询
    this.clearPolling();

    // 立即查询一次
    this.queryTaskResult();

    // 每10秒查询一次
    const timer = setInterval(() => {
      this.queryTaskResult();
    }, 10000) as unknown as number;

    this.setData({ pollingTimer: timer });
  },

  // 查询任务结果
  async queryTaskResult() {
    if (!this.data.taskInfo) {
      return;
    }

    try {
      const resultRes = await wx.cloud.callFunction({
        name: 'textToImage',
        data: {
          action: 'getResult',
          taskId: this.data.taskInfo.taskId,
          recordId: this.data.taskInfo.recordId,
        },
      });

      const result = resultRes.result as any;
      if (result && result.success) {
        const { status, results } = result.data;

        this.setData({
          generationStatus: status,
        });

        if (status === 'SUCCEEDED') {
          // 生成成功
          this.clearPolling();
          wx.hideLoading(); // 隐藏加载提示

          if (results && results.length > 0) {
            // 直接使用阿里云返回的图片URL（24小时有效）
            const imageUrl = results[0].url;

            this.setData({
              generatedImage: imageUrl,
              generating: false,
            });

            Toast({
              context: this,
              selector: '#t-toast',
              message: '生成成功！',
              theme: 'success',
            });

            // 滚动到顶部查看生成结果
            wx.pageScrollTo({
              scrollTop: 0,
              duration: 300,
            });
          }
        } else if (status === 'FAILED') {
          // 生成失败
          this.clearPolling();
          wx.hideLoading(); // 隐藏加载提示

          this.setData({
            generating: false,
          });

          Toast({
            context: this,
            selector: '#t-toast',
            message: '生成失败，请重试',
            theme: 'error',
          });
        } else if (status === 'RUNNING') {
          // 正在生成 - 只在第一次显示 loading
          if (!wx.getStorageSync('isShowingLoading')) {
            wx.setStorageSync('isShowingLoading', true);
            wx.showLoading({ title: '正在生成中...' });
          }
        } else if (status === 'PENDING') {
          // 排队中
          if (!wx.getStorageSync('isShowingLoading')) {
            wx.setStorageSync('isShowingLoading', true);
            wx.showLoading({ title: '排队中...' });
          }
        }
      } else {
        console.error('查询结果失败:', result && result.errMsg);
      }
    } catch (error) {
      console.error('查询任务结果失败:', error);
      // 继续轮询，不中断
    }
  },

  // 重新生成
  onRegenerate() {
    wx.showModal({
      title: '提示',
      content: '确定要重新生成吗？当前图片将被替换',
      success: (res) => {
        if (res.confirm) {
          // 清除轮询和当前结果
          this.clearPolling();

          this.setData({
            generatedImage: '',
            taskInfo: null,
            generationStatus: '',
          });

          // 重新生成
          this.onGenerate();
        }
      },
    });
  },

  // 发布到画廊
  async onPublish() {
    if (!this.data.generatedImage) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请先生成图片',
        theme: 'warning',
      });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    try {
      // 调用云函数发布作品
      const publishRes = await wx.cloud.callFunction({
        name: 'textToImage',
        data: {
          action: 'publishWork',
          imageUrl: this.data.generatedImage,
          prompt: this.data.prompt,
          taskId: this.data.taskInfo?.taskId || '',
        },
      });

      wx.hideLoading();

      const result = publishRes.result as any;
      if (result && result.success) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '发布成功！',
          theme: 'success',
          duration: 2000,
        });

        // 清空当前生成的图片和状态
        this.setData({
          generatedImage: '',
          prompt: '',
          negativePrompt: '',
          selectedStyle: '',
          taskInfo: null,
          generationStatus: '',
        });

        // 延迟跳转到【我的】页面查看作品
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/profile/profile',
          });
        }, 1000);
      } else {
        throw new Error((result && result.errMsg) || '发布失败');
      }
    } catch (error: any) {
      wx.hideLoading();
      console.error('发布失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: error.message || '发布失败，请重试',
        theme: 'error',
      });
    }
  },
});

