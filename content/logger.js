// DALY工具箱 - 统一日志工具
// 替代散落各处的 console.log / console.error / 空 catch

(function(global) {
  'use strict';

  var DALY_Log = {
    _prefix: '[DALY]',
    _enabled: global.DALY_Config ? global.DALY_Config.LOG.ENABLED : true,

    info: function() {
      if (!this._enabled) return;
      var args = Array.prototype.slice.call(arguments);
      console.log.apply(console, [this._prefix].concat(args));
    },

    warn: function() {
      var args = Array.prototype.slice.call(arguments);
      console.warn.apply(console, [this._prefix].concat(args));
    },

    error: function() {
      var args = Array.prototype.slice.call(arguments);
      console.error.apply(console, [this._prefix].concat(args));
    },

    // 带静默保护的 try-catch
    safe: function(fn, context) {
      try {
        return fn.call(context || null);
      } catch (e) {
        this.error('safe 调用异常:', e && e.message ? e.message : e);
        return null;
      }
    },

    // 统计执行时间（用于性能调优）
    time: function(label, fn) {
      var start = Date.now();
      try {
        var result = fn();
        this.info(label + ' 耗时:', (Date.now() - start) + 'ms');
        return result;
      } catch (e) {
        this.error(label + ' 异常:', e.message, '耗时:', (Date.now() - start) + 'ms');
        throw e;
      }
    }
  };

  global.DALY_Log = DALY_Log;
})(window);
