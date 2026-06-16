// DALY工具箱 - 媒体提取：天猫/淘宝
// 提取主图、详情图、视频、SKU图（带规格名）

(function(global) {
  'use strict';

  var MediaTmall = {
    extract: function(data, toOriginalUrl) {
      // 主图：新版缩略图
      try {
        document.querySelectorAll('.thumbnailItem--WQyauvvr img, [class*="thumbnailItem"] img').forEach(function(img) {
          var src = toOriginalUrl(img.src || img.getAttribute('data-src') || img.dataset.src || '');
          if (src && data.mainImages.indexOf(src) === -1) data.mainImages.push(src);
        });
      } catch(e) { console.warn('DALY - 天猫新版主图提取失败:', e); }

      // 主图：旧版左侧缩略图列表 #J_UlThumb
      if (data.mainImages.length === 0) {
        try {
          var thumbList = document.querySelector('#J_UlThumb');
          if (thumbList) {
            thumbList.querySelectorAll('img').forEach(function(img) {
              var src = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
              if (src && data.mainImages.indexOf(src) === -1) data.mainImages.push(src);
            });
          }
        } catch(e) {}
      }

      // 详情图：新版 descV8 区域（按元素加载布局）
      try {
        // 优先按 descV8-singleImage 容器提取（每个容器代表一张详情图布局）
        document.querySelectorAll('.descV8-singleImage, .deseVB-singleImage').forEach(function(container) {
          var imgEl = container.querySelector('img');
          if (imgEl) {
            var ds = toOriginalUrl(imgEl.src || imgEl.getAttribute('data-src') || '');
            if (ds && data.detailImages.indexOf(ds) === -1) data.detailImages.push(ds);
          } else {
            // 没有 img 标签，可能是 CSS background 或其他布局
            // 通过 getComputedStyle 获取背景图
            var bgUrl = window.getComputedStyle(container).backgroundImage;
            if (bgUrl && bgUrl !== 'none' && bgUrl !== 'url("")') {
              var urlMatch = bgUrl.match(/url\(["']?([^"')]+)["']?\)/);
              if (urlMatch && urlMatch[1]) {
                var bgDs = toOriginalUrl(urlMatch[1]);
                if (bgDs && data.detailImages.indexOf(bgDs) === -1) data.detailImages.push(bgDs);
              }
            }
          }
        });

        // 兜底：从其他详情区域提取
        document.querySelectorAll('.descVB-container img, .imageTextInfo-content img, [class*="descV8"] img, #J_DivItemDesc img').forEach(function(img) {
          var ds = toOriginalUrl(img.src || img.getAttribute('data-src') || '');
          if (ds && data.detailImages.indexOf(ds) === -1) data.detailImages.push(ds);
        });
      } catch(e) { console.warn('DALY - 天猫详情图提取失败:', e); }

      // 旧版详情图 #J_DivItemDesc
      try {
        var oldDesc = document.querySelector('#J_DivItemDesc');
        if (oldDesc) {
          oldDesc.querySelectorAll('img').forEach(function(img) {
            var od = toOriginalUrl(img.src || '');
            if (od && data.detailImages.indexOf(od) === -1) data.detailImages.push(od);
          });
        }
      } catch(e) {}

      // 视频
      try {
        document.querySelectorAll('video').forEach(function(v) {
          var vs = v.src || v.currentSrc || '';
          if (v.querySelector('source')) vs = v.querySelector('source').src || vs;
          if (vs && vs.startsWith('http') && data.videos.indexOf(vs) === -1) data.videos.push(vs);
        });
      } catch(e) {}

      // SKU 图：属性选择区域的小图，带规格名
      try {
        document.querySelectorAll('[class*="valueItemImgWrap"], [class*="valueItemImg"], [class*="skuItem"]').forEach(function(skuEl) {
          var img = skuEl.querySelector('img');
          if (!img) return;
          var ss = toOriginalUrl(img.src || '');
          if (!ss || !ss.startsWith('http')) return;
          if (ss.indexOf('avatar') > -1 || ss.indexOf('icon') > -1) return;
          // 找规格名：同级或父级的文本元素
          var label = '';
          var textEl = skuEl.querySelector('[class*="text"], [class*="label"], [class*="name"], span');
          if (textEl) label = textEl.textContent.trim();
          if (!label) label = skuEl.textContent.trim().replace(/\s+/g, ' ').substring(0, 30);
          label = label.replace(/[\\/:*?"<>|]/g, '_');
          var exists = data.skuImages.some(function(item) { return item.url === ss; });
          if (!exists) data.skuImages.push({url: ss, label: label || ('SKU_' + (data.skuImages.length + 1))});
        });
      } catch(e) {}

      return data;
    }
  };

  global.MediaTmall = MediaTmall;
})(window);
