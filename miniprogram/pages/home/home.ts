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
      // TODO: 替换为实际的 API 调用
      const mockData = this.getMockGalleryData();
      
      const newList = this.data.page === 1 ? mockData : [...this.data.galleryList, ...mockData];
      
      this.setData({
        galleryList: newList,
        loading: false,
        noMore: mockData.length < this.data.pageSize,
        page: this.data.page + 1,
      });
    } catch (error) {
      console.error('加载画廊数据失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '加载失败，请重试',
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
    wx.navigateTo({
      url: '/pages/create/create',
    });
  },

  // 模拟数据（开发阶段使用）
  getMockGalleryData(): GalleryItem[] {
    const styles = [
      { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', prompt: '一只可爱的橘猫，坐在窗台上看着窗外的雨景，温馨的室内光线' },
      { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', prompt: '未来城市的夜景，赛博朋克风格，霓虹灯闪烁' },
      { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', prompt: '宁静的海边日落，海鸥在天空飞翔，写实风格' },
      { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', prompt: '梦幻的森林场景，萤火虫飞舞，月光透过树叶' },
      { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', prompt: '动漫风格的少女，站在樱花树下，春天的气息' },
      { gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', prompt: '宇宙星空，流星划过，科幻电影感' },
    ];

    const names = ['小明', '小红', '小刚', '小美', '小花', '小李'];
    
    return Array.from({ length: this.data.pageSize }, (_, i) => {
      const index = (this.data.page - 1) * this.data.pageSize + i;
      const styleIndex = index % styles.length;
      const nameIndex = index % names.length;
      
      return {
        id: `gallery-${Date.now()}-${i}`,
        imageUrl: 'https://via.placeholder.com/400', // 占位图
        prompt: styles[styleIndex].prompt,
        author: {
          name: names[nameIndex],
          avatar: 'https://via.placeholder.com/100',
        },
        createdAt: Date.now() - i * 1000000,
      };
    });
  },
});

