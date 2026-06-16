// DALY工具箱 - 全局配置
// 所有魔法数字集中管理，便于调优

var DALY_Config = {
  VERSION: '2.0.0',

  // ========== 重试 & 延迟 ==========
  RETRY: {
    MAX_ATTEMPTS: 5,
    INTERVAL_MS: 1000
  },

  LAZY_LOAD: {
    MAX_BATCHES: 20,
    WAIT_MS: 3000,
    CHECK_INTERVAL_MS: 500
  },

  TIMEOUT: {
    JSONP: 15000,
    PAGE_LOAD: 15000,
    TOOLTIP: 1500
  },

  SCROLL: {
    STEP_PX: 800,
    WAIT_MS: 300
  },

  // ========== 日志 ==========
  LOG: {
    ENABLED: true
  },

  // ========== 颜色 / 主题 ==========
  COLORS: {
    PRIMARY: '#667eea',
    SECONDARY: '#764ba2',
    SUCCESS: '#22c55e',
    WARNING: '#f59e0b',
    DANGER: '#ef4444',
    INFO: '#3b82f6'
  }
};

window.DALY_Config = DALY_Config;
