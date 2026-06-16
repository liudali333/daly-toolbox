// DALY工具箱 - 媒体提取：抖店（抖音电商）
// 提取主图、SKU图（带规格名）

(function(global) {
  'use strict';

  var MediaDouyin = {
    extract: function(data, toOriginalUrl) {
      try {
        // 主图
        document.querySelectorAll('[class*="swiper"] img, [class*="gallery"] img, [class*="cover"] img').forEach(function(img) {
          var s = toOriginalUrl(img.src || '');
          if (s && data.mainImages.indexOf(s) === -1) data.mainImages.push(s);
        });
        // SKU 图：带规格名
        document.querySelectorAll('[class*="sku"] img, [class*="spec"] img').forEach(function(skuImg) {
          var s = toOriginalUrl(skuImg.src || '');
          if (!s || !s.startsWith('http')) return;
          var label = '';
          var parent = skuImg.closest ? skuImg.closest('[class*="sku"], [class*="spec"], [class*="attribute"]') : null;
          if (parent) {
            var textEl = parent.querySelector('[class*="text"], [class*="name"], [class*="label"], span');
            if (textEl) label = textEl.textContent.trim();
            else label = parent.textContent.trim().replace(/\s+/g, ' ').substring(0, 30);
          }
          label = label.replace(/[\\/:*?"<>|]/g, '_');
          var exists = data.skuImages.some(function(item) { return item.url === s; });
          if (!exists) data.skuImages.push({url: s, label: label || ('SKU_' + (data.skuImages.length + 1))});
        });
      } catch(e) { console.warn('DALY - 抖店媒体提取失败:', e); }
      return data;
    }
  };

  global.MediaDouyin = MediaDouyin;
})(window);
