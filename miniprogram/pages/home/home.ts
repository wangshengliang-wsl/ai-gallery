// pages/home/home.ts
import Toast from 'tdesign-miniprogram/toast/index';

interface GalleryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  author: {
    name: string;
    avatar: string;
  };
  createdAt: number;
}

Page({
  data: {
    galleryList: [] as GalleryItem[],
    loading: false,
    noMore: false,
    page: 1,
    pageSize: 10,
  },

  onLoad() {
    this.loadGalleryData();
  },

  onShow() {
    // 从创建页面返回时刷新列表
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage.data.shouldRefresh) {
      this.refreshData();
      this.setData({ shouldRefresh: false });
    }
  },

  // 加载画廊数据
  async loadGalleryData() {
    if (this.data.loading || this.data.noMore) return;

    this.setData({ loading: true });

    try {
      // 计算跳过的数量
      const skip = (this.data.page - 1) * this.data.pageSize;

      // 调用云函数获取公共画廊数据
      const res = await wx.cloud.callFunction({
        name: 'getPublicGallery',
        data: {
          limit: this.data.pageSize,
          skip: skip,
        },
      });

      const result = res.result as any;
      
      if (result && result.success) {
        const newData = result.data || [];
        
        // 如果是第一页，直接替换；否则追加
        const newList = this.data.page === 1 ? newData : [...this.data.galleryList, ...newData];
        
        this.setData({
          galleryList: newList,
          loading: false,
          noMore: !result.hasMore,
          page: this.data.page + 1,
        });
      } else {
        throw new Error(result?.errMsg || '加载失败');
      }
    } catch (error: any) {
      console.error('加载画廊数据失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: error.message || '加载失败，请重试',
        theme: 'error',
      });
      this.setData({ loading: false });
    }
  },

  // 刷新数据
  refreshData() {
    this.setData({
      galleryList: [],
      page: 1,
      noMore: false,
    });
    this.loadGalleryData();
  },

  // 加载更多
  onLoadMore() {
    this.loadGalleryData();
  },

  // 点击图片
  onImageTap(e: any) {
    const item = e.currentTarget.dataset.item;
    console.log('点击图片:', item);
    // TODO: 跳转到图片详情页
  },

  // 点击创建按钮
  onCreateClick() {
    wx.switchTab({
      url: '/pages/create/create',
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});

