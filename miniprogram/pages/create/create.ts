// pages/create/create.ts
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    prompt: '',
    negativePrompt: '',
    selectedStyle: '',
    styleOptions: ['写实', '动漫', '电影感', '梦幻', '水彩', '油画', '赛博朋克', '极简'],
    examplePrompts: [
      '一只可爱的柴犬，在樱花树下奔跑，动漫风格，温暖的春天氛围',
      '未来城市的夜景，飞行汽车穿梭，赛博朋克风格，霓虹灯光效果',
    ],
    generatedImage: '',
    generating: false,
  },

  onLoad() {
    // 页面加载
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
    this.setData({
      selectedStyle: this.data.selectedStyle === style ? '' : style,
    });
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
      theme: 'info',
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

    this.setData({ generating: true });

    try {
      // TODO: 调用实际的 AI 生成 API
      // 模拟生成延迟
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 模拟生成的图片（实际应该是 API 返回的图片 URL）
      const mockImageUrl = 'https://via.placeholder.com/800';

      this.setData({
        generatedImage: mockImageUrl,
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
    } catch (error) {
      console.error('生成失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '生成失败，请重试',
        theme: 'error',
      });
      this.setData({ generating: false });
    }
  },

  // 重新生成
  onRegenerate() {
    wx.showModal({
      title: '提示',
      content: '确定要重新生成吗？当前图片将被替换',
      success: (res) => {
        if (res.confirm) {
          this.setData({ generatedImage: '' });
          this.onGenerate();
        }
      },
    });
  },

  // 发布到画廊
  async onPublish() {
    wx.showLoading({ title: '发布中...' });

    try {
      // TODO: 调用发布 API
      // 模拟发布延迟
      await new Promise(resolve => setTimeout(resolve, 1500));

      wx.hideLoading();
      
      Toast({
        context: this,
        selector: '#t-toast',
        message: '发布成功！',
        theme: 'success',
        duration: 2000,
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        // 返回首页并刷新
        wx.switchTab({
          url: '/pages/home/home',
          success: () => {
            // 通知首页刷新数据
            const pages = getCurrentPages();
            const homePage = pages.find(page => page.route === 'pages/home/home');
            if (homePage) {
              (homePage as any).setData({ shouldRefresh: true });
            }
          },
        });
      }, 1000);
    } catch (error) {
      wx.hideLoading();
      console.error('发布失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '发布失败，请重试',
        theme: 'error',
      });
    }
  },
});

