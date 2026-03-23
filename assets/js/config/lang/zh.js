export default {
  intro: {
    languages: '界面语言',
    language: {
      zh: '中文',
      en: 'English'
    },
    welcome: '韶关公交 PIDS 模拟屏',
    description_1: '这个项目Fork自 HKTSS/MTR PIDS Simulator，将数据源改成了韶关公交接口。',
    description_2: '操作方式保持同一套逻辑：先选线路，再选站点，再决定看单方向、混排或双方向分屏。',
    description_3: 'GitHub Pages 版本需要额外配置一个代理地址才能读取实时数据。目前可选择 CzWorks 提供的API',
    disclaimer: '本项目仅供学习和个人研究使用，请不要高频抓取或用于任何违规用途。',
    enquiries: '如果只想先看界面效果，可以切到离线模式，手动填入终点、方向圆标和到站时间。',
    oss: '参考项目',
    oss1: '源码说明'
  },
  settings: {
    title: '屏幕设置',
    sections: {
      data: {
        title: '数据设置',
        source: {
          name: '数据来源',
          online: '在线实时',
          onlineCzworks: '在线实时(CzWorks)',
          offline: '离线自定义'
        },
        route: '公交线路',
        station: '停靠车站',
        direction: {
          name: '显示方向'
        },
        proxy: {
          name: '实时代理地址',
          placeholder: '例如 https://your-worker.example.com',
          hint: '这里填你部署好的代理地址，页面会优先请求 /api/station-detail。'
        },
        custom: {
          name: '离线演示数据',
          tips_1: '离线模式不会请求实时接口，适合先调样式、截图或录屏。',
          tips_2: '方向圆标建议填“上”“下”或你自己想显示的 1 个字。',
          destination: '终点站',
          platform: '圆标',
          eta: '分钟',
          route_color: '线路主色'
        }
      },
      display: {
        title: '显示设置',
        adhoc: {
          name: '插播提示',
          NONE: '关闭',
          CIVILIZED: '文明乘车',
          QUEUE: '排队上车',
          SAFETY: '候车安全',
          EMERGENCY: '应急提示'
        },
        mode: {
          name: '显示模式',
          NORMAL: '广告与到站轮播',
          AD: '只显示提示页',
          ADNT1: '提示页加下一班',
          NT4: '只显示下四班',
          NT4_CT: '只显示下四班（时刻）'
        },
        first_train_cutoff: {
          name: '首班超过多少分钟时隐藏列表'
        },
        platform_number: '显示方向圆标',
        line: '顶部显示线路标题'
      },
      generic: {
        fullscreen: {
          entered: '退出全屏',
          exited: '进入全屏'
        },
        start: '开始显示'
      }
    }
  }
};
