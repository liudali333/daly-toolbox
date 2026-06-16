// DALY工具箱 - ReviewFetcher 评论获取模块（重构版 v2.0.0）
// 优化项：
//   1. 统一使用 DALY_PlatformDetect 做平台识别，消除重复 host 判断
//   2. 懒加载循环改为 async/await，消除嵌套 setTimeout 回调地狱
//   3. 评论解析逻辑合并到单一 parse 方法，去重处理内置
//   4. 使用 DALY_Utils.getPageHtml() 缓存 outerHTML
//   5. 使用 DALY_Log 统一日志输出

(function(global) {
  'use strict';

  // ========== 工具：sleep ==========
  function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  // ========== 工具：触发懒加载图片 src 替换 ==========
  function triggerLazyImages(container) {
    if (!container) return;
    var imgs = container.querySelectorAll('img[data-src], img[data-original]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var ds = img.getAttribute('data-src') || img.getAttribute('data-original');
      if (ds) {
        if (ds.indexOf('//') === 0) ds = 'https:' + ds;
        img.src = ds;
        img.removeAttribute('data-src');
        img.removeAttribute('data-original');
      }
    }
  }

  // ========== 工具：严格校验图片 URL（排除头像/图标/伪匹配）==============
  function isValidReviewImage(url) {
    if (!url) return false;
    if (url.indexOf('data:image') === 0) return false;
    if (url.indexOf('/avatar') > -1 || url.indexOf('avatar') > -1) return false;
    if (/\/i\/[A-Za-z0-9]+_/.test(url)) return false; // 排除商品主图路径格式
    if (url.indexOf('.css') > -1 || url.indexOf('.svg') > -1) return false;
    return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || url.indexOf('imgextra') > -1;
  }

  // ========== 工具：从元素里提取图片 URL 列表 ==========
  function extractImageUrls(el) {
    if (!el) return [];
    var urls = [];
    var imgs = el.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].src || imgs[i].getAttribute('data-src') || '';
      if (src && src.indexOf('//') === 0) src = 'https:' + src;
      if (isValidReviewImage(src)) urls.push(src);
    }
    return urls;
  }

  // ========== ReviewFetcher 主体 ==========
  var ReviewFetcher = {
    platform: null,
    goodsId: null,
    allReviews: [],
    _noMorePages: false,
    _currentPage: 1,

    // ---------- 初始化 ----------
    init: function() {
      // 统一使用 DALY_PlatformDetect（消除原有自实现的 host 判断）
      if (global.DALY_PlatformDetect) {
        this.platform = DALY_PlatformDetect.detect();
      } else {
        this.platform = 'unknown';
      }

      // 统一平台标识（detect.js 返回长名称，内部使用短名称）
      var platformMap = {
        'taobao': 'tb',
        'douyin-shop': 'dy_shop',
        'douyin-video': 'dy_video',
        'xiaohongshu': 'xhs',
        'kuaishou': 'ks'
      };
      if (platformMap[this.platform]) this.platform = platformMap[this.platform];

      // 商品 ID 提取
      var url = window.location.href;
      var match;
      switch (this.platform) {
        case 'pdd':
          match = url.match(/goods_id=(\d+)/) || url.match(/\/goods\/(\d+)/);
          break;
        case 'tb':
          match = url.match(/id=(\d+)/);
          break;
        case 'jd':
          match = url.match(/\/(\d+)\.html/);
          break;
        case 'dy_shop':
        case 'dy_video':
          match = url.match(/\/(item|video)\/(\d+)/);
          if (match) match = [match[0], match[2]]; // 取第 2 组
          break;
      }
      this.goodsId = match ? match[1] : null;

      if (global.DALY_Log) {
        DALY_Log.info('ReviewFetcher 初始化, platform=' + this.platform + ', goodsId=' + this.goodsId);
      }
    },

    // ---------- 从页面 JSON 数据提取评论（天猫 SSR 2025 优先）----------
    _tryExtractReviewsFromJSON: function() {
      try {
        if (window.__INITIAL_STATE__) {
          var state = window.__INITIAL_STATE__;
          var rateSource = state.rateModule || state.rate || state.rateInfo || state.comment || state.review;
          if (rateSource && rateSource.rateList && rateSource.rateList.length > 0) {
            if (global.DALY_Log) DALY_Log.info('从 __INITIAL_STATE__ 提取评论 ' + rateSource.rateList.length + ' 条');
            return this._parseRateList(rateSource.rateList);
          }
          var itemData = state.item || state.detail || state.data || {};
          if (itemData.rateList && itemData.rateList.length > 0) {
            return this._parseRateList(itemData.rateList);
          }
          if (itemData.rate && itemData.rate.rateList && itemData.rate.rateList.length > 0) {
            return this._parseRateList(itemData.rate.rateList);
          }
        }
        if (window.__INITIAL_DATA__) {
          var initData = window.__INITIAL_DATA__;
          var rateData2 = initData.rate || initData.rateModule || initData.comment || initData;
          if (rateData2 && rateData2.rateList && rateData2.rateList.length > 0) {
            return this._parseRateList(rateData2.rateList);
          }
        }
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('从 JSON 提取评论失败:', e.message);
      }
      return null;
    },

    _parseRateList: function(rateList) {
      var result = [];
      for (var i = 0; i < rateList.length; i++) {
        var item = rateList[i];
        var imgUrls = [];
        if (item.photos && item.photos.length > 0) {
          for (var p = 0; p < item.photos.length; p++) {
            var photoUrl = item.photos[p].url || item.photos[p] || '';
            if (photoUrl && isValidReviewImage(photoUrl)) imgUrls.push(photoUrl);
          }
        }
        if (item.pics && item.pics.length > 0) {
          for (var q = 0; q < item.pics.length; q++) {
            var picUrl = item.pics[q].url || item.pics[q] || '';
            if (picUrl && isValidReviewImage(picUrl)) imgUrls.push(picUrl);
          }
        }
        var content = item.content || item.feedback || item.comment || '';
        var userName = item.nick || item.userName || item.user || item.nickname || '匿名用户';
        var time = item.date || item.time || item.gmtCreate || item.createTime || '';
        var orderInfo = item.specInfo || item.auctionSku || item.skuInfo || item.sku || '';
        var rating = item.rate || item.score || item.rating || 5;
        var reply = item.reply || item.sellerReply || '';
        result.push({
          userName: userName,
          content: content,
          rating: rating,
          time: time,
          reply: reply,
          orderInfo: orderInfo,
          images: imgUrls.join(','),
          imageCount: imgUrls.length,
          type: imgUrls.length > 0 ? '图文' : '文字'
        });
      }
      return result;
    },

    // ---------- 对外主入口：获取评论 ----------
    getReviews: async function(page, pageSize) {
      try {
        // 淘宝/天猫：优先从 JSON 数据提取
        if (this.platform === 'tb') {
          var jsonReviews = this._tryExtractReviewsFromJSON();
          if (jsonReviews && jsonReviews.length > 0) {
            this.allReviews = jsonReviews;
            if (global.DALY_Log) DALY_Log.info('从 JSON 成功提取 ' + jsonReviews.length + ' 条评论');
            return this.allReviews;
          }
          // JSON 无数据则走懒加载 + 弹窗路径
          this.allReviews = await this._lazyLoadReviews();
          return this.allReviews;
        }

        // 京东：直接调官方 API
        if (this.platform === 'jd' && this.goodsId) {
          var jdUrl = 'https://sclub.jd.com/comment/productPageComments.action?productId=' +
            this.goodsId + '&page=' + ((page || 1) - 1) + '&pageSize=' + (pageSize || 50) + '&sortType=5';
          var resp = await fetch(jdUrl, { headers: { 'referer': window.location.href } });
          var data = await resp.json();
          if (data && data.comments) {
            this.allReviews = data.comments.map(function(item) {
              return {
                userName: item.nickname || '匿名用户',
                content: item.content || '',
                rating: item.score || 5,
                time: item.referenceTime || '',
                reply: item.replyContent || '',
                orderInfo: item.referenceName || ''
              };
            });
            return this.allReviews;
          }
        }

        // 默认：DOM 解析
        this.allReviews = this.parseReviewsFromDOM();
        return this.allReviews;
      } catch (e) {
        if (global.DALY_Log) DALY_Log.error('getReviews 异常:', e.message);
        this.allReviews = this.parseReviewsFromDOM();
        return this.allReviews;
      }
    },

    // ---------- 懒加载评论（淘宝/天猫）----------
    _lazyLoadReviews: async function() {
      var maxBatches = DALY_Config ? DALY_Config.LAZY_LOAD.MAX_BATCHES : 20;
      var checkInterval = DALY_Config ? DALY_Config.LAZY_LOAD.CHECK_INTERVAL_MS : 500;

      // 1) 先尝试调天猫评价 API（JSONP）
      try {
        var apiReviews = await this._tryFetchTmallRateAPI();
        if (apiReviews && apiReviews.length > 0) {
          if (global.DALY_Log) DALY_Log.info('从天猫评价 API 获取 ' + apiReviews.length + ' 条评论');
          return apiReviews;
        }
      } catch (e) {}

      // 2) 模拟点击评论 Tab
      var tabBtn = this._findReviewTab();
      if (tabBtn) {
        try { tabBtn.click(); } catch (e) {}
        await sleep(500);
      } else {
        // 兜底：可能 Tab 在页面较下方，滚动到页脚附近
        try {
          var reviewSection = document.querySelector('[class*="review"], [class*="rate"], [class*="evaluation"], [class*="comment"]');
          if (reviewSection) reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
        await sleep(800);
      }

      // 3) 等待评论容器出现
      var container = null;
      var attempts = 0;
      var maxAttempts = 30;
      while (attempts < maxAttempts) {
        container = this._findReviewContainer();
        if (container) break;
        if (attempts % 3 === 0) {
          try { window.scrollBy(0, 400); } catch (e) {}
        }
        await sleep(checkInterval);
        attempts++;
      }

      if (!container) {
        // 兜底：直接解析 DOM
        return this.parseReviewsFromDOM();
      }

      triggerLazyImages(container);
      await sleep(1000);

      var allReviews = this._parseBatchFromContainer(container, []);

      // 4) 尝试点击"查看全部评价"按钮（天猫 SSR 2025 新版）
      var viewAllSelectors = [
        '[class*="ShowButton--"]',
        '[class*="viewAll"]',
        '[class*="showAll"]',
        '[class*="detailBtn"]',
        'button:not([disabled]):not([class*="tab"]):not([class*="close"])'
      ];
      var viewAll = null;
      for (var v = 0; v < viewAllSelectors.length; v++) {
        var candidates = document.querySelectorAll(viewAllSelectors[v]);
        for (var c = 0; c < candidates.length; c++) {
          var txt = (candidates[c].innerText || candidates[c].textContent || '').trim();
          if (/查看全部|全部评价|查看所有/.test(txt) && candidates[c].getBoundingClientRect().width > 0) {
            viewAll = candidates[c];
            break;
          }
        }
        if (viewAll) break;
      }

      if (viewAll) {
        try {
          viewAll.click();
          await sleep(DALY_Config ? DALY_Config.LAZY_LOAD.WAIT_MS : 3000);
          // 在弹窗里再解析一次
          var popupContainer = this._findReviewContainer();
          if (!popupContainer) {
            // 查找弹窗对话框
            popupContainer = document.querySelector('[class*="dialog"], [class*="modal"], [class*="popup"], [class*="overlay"], [role="dialog"]');
          }
          if (popupContainer) {
            triggerLazyImages(popupContainer);
            await sleep(1500);
            // 弹窗内可能有多页，滚动加载更多
            try {
              popupContainer.scrollTop = popupContainer.scrollHeight;
              window.scrollBy(0, 600);
            } catch (e) {}
            await sleep(1000);
            allReviews = this._parseBatchFromContainer(popupContainer, allReviews);
          }
        } catch (e) {
          if (global.DALY_Log) DALY_Log.warn('查看全部评价失败:', e.message);
        }
      }

      return allReviews;
    },

    // ---------- 尝试调天猫评价 API（JSONP）----------
    _tryFetchTmallRateAPI: async function() {
      var itemId = this.goodsId;
      if (!itemId) return null;
      try {
        var url = 'https://rate.tmall.com/list_detail_rate.htm?itemId=' + itemId + '&currentPage=1&pageSize=50&sellerId=&order=3';
        var data = await this.fetchJSONP(url);
        if (data && data.length > 0) return data;
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('天猫评价 API 请求失败:', e.message);
      }
      return null;
    },

    _findReviewTab: function() {
      // 多选择器尝试：新 SSR 2025 + 旧版 + 通用
      var tabSelectors = [
        '[class*="tabTitleItem"]',
        '[class*="TabTitle"]',
        '[class*="tabItem"]',
        '[class*="tab-item"]',
        '[class*="tabsTitle"]',
        '[class*="tab-title"]'
      ];
      for (var s = 0; s < tabSelectors.length; s++) {
        var tabs = document.querySelectorAll(tabSelectors[s]);
        for (var i = 0; i < tabs.length; i++) {
          var txt = (tabs[i].innerText || tabs[i].textContent || '').trim();
          if (/评价/.test(txt) && !/问大家/.test(txt)) {
            return tabs[i];
          }
        }
      }
      // 兜底：找包含"评价"文本的任何可见按钮/tab
      var allPossible = document.querySelectorAll('[class*="tab"], [class*="Tab"], a, button, span');
      for (var j = 0; j < allPossible.length; j++) {
        var el = allPossible[j];
        var txt2 = (el.innerText || el.textContent || '').trim();
        if (/^(评价|用户评价|商品评价)/.test(txt2) && !/问大家/.test(txt2) && el.getBoundingClientRect().width > 0) {
          return el;
        }
      }
      return null;
    },

    _findReviewContainer: function() {
      var selectors = [
        '[class*="comments--"]',
        '[class*="review-list"]',
        '[class*="comment-list"]',
        '[class*="rate-list"]',
        '[class*="review_content"]',
        '[class*="rate-content"]',
        '[class*="rate_"]',
        '[class*="comment_body"]'
      ];
      var bestContainer = null;
      var bestCount = 0;
      for (var i = 0; i < selectors.length; i++) {
        var containers = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < containers.length; j++) {
          var c = containers[j];
          var ancestorTxt = ((c.closest && c.closest('[class*="tabContent--"], [class*="tabContent"], [class*="tab-content"]')) || {}).innerText || '';
          if (ancestorTxt.indexOf('问大家') !== -1) continue;
          var itemSelectors = '[class*="Comment--"], [class*="review-item"], [class*="comment-item"], [class*="rate-item"], [class*="rateItem"], [class*="commentItem"]';
          var count = c.querySelectorAll(itemSelectors).length;
          if (count > bestCount) {
            bestCount = count;
            bestContainer = c;
          }
        }
      }
      return bestContainer;
    },

    _parseBatchFromContainer: function(container, existing) {
      if (!container) return existing || [];
      var itemSelector = '[class*="Comment--"], [class*="review-item"], [class*="comment-item"], [class*="rate-item"], [class*="rateItem"], [class*="commentItem"]';
      var items = container.querySelectorAll(itemSelector);
      var result = (existing || []).slice();
      var existingContents = {};
      for (var k = 0; k < result.length; k++) existingContents[result[k].content] = true;

      for (var i = 0; i < items.length; i++) {
        var el = items[i];

        // 排除"问大家"问答项
        if (el.closest) {
          var qa = el.closest('[class*="ask-"], [class*="qa-"], [class*="question"]');
          if (qa) continue;
        }
        var qaTag = el.querySelector('[class*="askTag"], [class*="qaTag"], [class*="questionTag"]');
        if (qaTag) continue;

        var userEl = el.querySelector('[class*="userName--"] span, [class*="userName--"], [class*="userName"], [class*="user-name"], [class*="nick"]');
        var metaEl = el.querySelector('[class*="meta--"], [class*="meta"], [class*="orderInfo"], [class*="sku"]');
        var contentEl = el.querySelector('[class*="content--"], [class*="content"], [class*="rateContent"], [class*="commentText"]');
        var timeEl = el.querySelector('[class*="time--"], [class*="time"], [class*="date"]');
        var replyEl = el.querySelector('[class*="reply--"], [class*="reply"], [class*="sellerReply"]');
        var ratingEl = el.querySelector('[class*="star--"], [class*="star"], [class*="rating"], [class*="score"]');

        var contentTxt = contentEl ? contentEl.textContent.trim() : '';
        if (!contentTxt) {
          contentTxt = el.textContent.trim().replace(/^\s*[\d]+\s*/, '').substring(0, 500);
          if (!contentTxt || contentTxt.length < 4) continue;
        }
        if (existingContents[contentTxt]) continue;

        var metaTxt = metaEl ? metaEl.textContent.trim() : '';
        var time = '';
        if (timeEl) {
          time = timeEl.textContent.trim();
        } else {
          var timeMatch = metaTxt.match(/^(202\d[-年]\d{1,2}[-月]\d{1,2}[日]?)/);
          if (timeMatch) time = timeMatch[1];
        }
        var reply = replyEl ? replyEl.textContent.trim() : '';
        var rating = 0;
        if (ratingEl) {
          var starMatch = ratingEl.textContent.match(/(\d)/);
          if (starMatch) rating = parseInt(starMatch[1], 10);
        }
        var skuText = '';
        var skuEl = el.querySelector('[class*="sku"], [class*="spec"]');
        if (skuEl) skuText = skuEl.textContent.trim();

        var imgUrls = extractImageUrls(el);

        existingContents[contentTxt] = true;
        result.push({
          userName: userEl ? userEl.textContent.trim() : '匿名用户',
          content: contentTxt,
          rating: rating,
          time: time,
          reply: reply,
          orderInfo: skuText || metaTxt,
          images: imgUrls.join(','),
          imageCount: imgUrls.length,
          type: imgUrls.length > 0 ? '图文' : '文字'
        });
      }
      return result;
    },

    // ---------- DOM 解析兜底 ----------
    parseReviewsFromDOM: function() {
      var html = global.DALY_Utils ? DALY_Utils.getPageHtml() : document.documentElement.outerHTML;

      // 1) 1688
      if (this.platform === '1688') {
        var rows = document.querySelectorAll('.ms-container .evaluate-panel-content [class*="row"], .evaluate-panel-content [class*="item"], [class*="evaluate-panel"] [class*="row"]');
        if (rows.length === 0) {
          rows = document.querySelectorAll('.ant-table-row, tr.ant-table-row, .comment_list tr, .comment_list [class*="row"]');
        }
        if (rows.length > 0) {
          var result = [];
          for (var i = 0; i < Math.min(rows.length, 50); i++) {
            var row = rows[i];
            var user = row.querySelector('[class*="user"], [class*="name"]');
            var content = row.querySelector('[class*="content"], [class*="text"], [class*="comment"]');
            var tm = row.querySelector('[class*="time"], [class*="date"]');
            result.push({
              userName: user ? user.textContent.trim() : '匿名用户',
              content: content ? content.textContent.trim() : '',
              time: tm ? tm.textContent.trim() : '',
              reply: '',
              images: '',
              imageCount: 0,
              type: '文字'
            });
          }
          return result;
        }
        // HTML 全文搜索兜底
        var matches = html.match(/"content"\s*:\s*"([^"]+)"/g);
        if (matches && matches.length > 0) {
          var list = [];
          for (var m = 0; m < Math.min(matches.length, 50); m++) {
            var mm = matches[m].match(/"content"\s*:\s*"([^"]+)"/);
            if (mm) list.push({ userName: '匿名用户', content: mm[1], time: '', reply: '', images: '', imageCount: 0, type: '文字' });
          }
          return list;
        }
        return [];
      }

      // 2) 淘宝 / 天猫 结构化选择器
      if (this.platform === 'tb') {
        // 先尝试 JSON 数据提取（兜底场景下可能 getReviews 没走到 JSON 路径）
        var jsonRev = this._tryExtractReviewsFromJSON();
        if (jsonRev && jsonRev.length > 0) {
          return jsonRev;
        }
        var tbSelectors = '[class*="Comment--"], [class*="comment-item"], [class*="review-item"], [class*="rateItem"], [class*="commentItem"]';
        var items = document.querySelectorAll(tbSelectors);
        if (items.length > 0) {
          return this._parseBatchFromContainer(
            { querySelectorAll: function() { return items; } },
            []
          );
        }
        var tbMatches = html.match(/"content"\s*:\s*"([^"]+)"/g);
        if (tbMatches && tbMatches.length > 0) {
          var tbList = [];
          for (var n = 0; n < Math.min(tbMatches.length, 50); n++) {
            var tm2 = tbMatches[n].match(/"content"\s*:\s*"([^"]+)"/);
            if (tm2) tbList.push({ userName: '匿名用户', content: tm2[1], time: '', reply: '', orderInfo: '', images: '', imageCount: 0, type: '文字' });
          }
          return tbList;
        }
        return [];
      }

      // 3) 通用
      var genericItems = document.querySelectorAll('.review-item, .comment-item, [class*="review"], [class*="comment"]');
      if (genericItems.length === 0) return [];
      var generic = [];
      for (var gi = 0; gi < Math.min(genericItems.length, 50); gi++) {
        var gel = genericItems[gi];
        var userNameEl = gel.querySelector('.user-name, [class*="user"], [class*="nick"]');
        var contentEl2 = gel.querySelector('.review-content, [class*="content"], .comment-text');
        var timeEl = gel.querySelector('.review-time, [class*="time"], .date');
        var orderInfoEl = gel.querySelector('[class*="sku"], [class*="order"]');
        var imgs3 = gel.querySelectorAll('img');
        generic.push({
          userName: userNameEl ? userNameEl.textContent.trim() : '匿名用户',
          content: contentEl2 ? contentEl2.textContent.trim() : '',
          time: timeEl ? timeEl.textContent.trim() : '',
          reply: '',
          orderInfo: orderInfoEl ? orderInfoEl.textContent.trim() : '',
          images: imgs3.length > 0 ? imgs3.length : 0,
          imageCount: imgs3.length || 0,
          type: imgs3.length > 0 ? '图文' : '文字'
        });
      }
      return generic;
    },

    // ---------- JSONP 抓取（保留给拼多多等老路径场景）----------
    fetchJSONP: function(url) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var callbackName = 'jsonp_' + Date.now();
        var script = document.createElement('script');
        script.src = url + '&callback=' + callbackName;
        script.onerror = function() {
          delete window[callbackName];
          if (script.parentNode) document.head.removeChild(script);
          reject(new Error('JSONP 加载失败'));
        };

        window[callbackName] = function(data) {
          delete window[callbackName];
          if (script.parentNode) document.head.removeChild(script);
          var comments = [];
          if (data.rateDetail && data.rateDetail.rateList) {
            comments = data.rateDetail.rateList.map(function(item) {
              var imgList = [];
              if (item.photos && item.photos.length > 0) {
                imgList = item.photos.map(function(p) { return p.url || p; });
              }
              return {
                userName: item.nick || '匿名用户',
                content: item.content || '',
                rating: item.rate || 5,
                time: item.date || '',
                reply: item.reply || '',
                orderInfo: item.specInfo || item.auctionSku || '',
                images: imgList.join(','),
                imageCount: imgList.length,
                type: imgList.length > 0 ? '图文' : '文字'
              };
            });
          } else if (data.comments) {
            comments = data.comments.map(function(item) {
              return {
                userName: item.nick || '匿名用户',
                content: item.content || '',
                rating: item.rate || 5,
                time: item.date || '',
                reply: item.reply || ''
              };
            });
          }
          resolve(comments);
        };

        document.head.appendChild(script);
        var timeoutMs = DALY_Config ? DALY_Config.TIMEOUT.JSONP : 15000;
        setTimeout(function() {
          if (window[callbackName]) {
            delete window[callbackName];
            if (script.parentNode) document.head.removeChild(script);
            resolve([]);
          }
        }, timeoutMs);
      });
    },

    // ---------- 分页：加载更多 ----------
    hasMorePages: function() {
      if (this._noMorePages) return false;
      if (this.allReviews.length === 0) return false;
      if (this.platform === 'tb') {
        var moreBtn = document.querySelector('[class*="moreAnswerBtn"], [class*="headerBtnItem"]');
        if (moreBtn && moreBtn.getBoundingClientRect().width > 0) return true;
        var container = this._findReviewContainer();
        if (container && container.scrollHeight > container.clientHeight + 50) return true;
      }
      return false;
    },

    loadNextPage: async function() {
      if (this._noMorePages) return [];
      if (this.platform !== 'tb') return [];
      try {
        var result = await this._loadTmallNextPage();
        return result || [];
      } catch (e) {
        if (global.DALY_Log) DALY_Log.warn('loadNextPage 异常:', e.message);
        return [];
      }
    },

    _loadTmallNextPage: async function() {
      var container = this._findReviewContainer();
      if (!container) {
        this._noMorePages = true;
        return [];
      }
      var beforeCount = this.allReviews.length;

      // 1) 找并点击"加载更多"按钮（新版 + 旧版选择器）
      var moreBtnSelectors = [
        '[class*="moreAnswerBtn"]',
        '[class*="loadMore"]',
        '[class*="more-reply"]',
        '[class*="headerBtnItem"]',
        '[class*="loadMoreBtn"]',
        '[class*="nextPage"]',
        '[class*="pagination"] button'
      ];
      var moreBtn = null;
      for (var mbs = 0; mbs < moreBtnSelectors.length; mbs++) {
        moreBtn = container.querySelector(moreBtnSelectors[mbs]) || document.querySelector(moreBtnSelectors[mbs]);
        if (moreBtn) {
          var btnText = (moreBtn.innerText || moreBtn.textContent || '').trim();
          if (/加载更多|下一页|更多评价/.test(btnText) || (moreBtn.getBoundingClientRect().width > 0 && !/^\d+$/.test(btnText))) {
            break;
          }
          moreBtn = null;
        }
      }

      if (moreBtn && moreBtn.getBoundingClientRect().width > 0) {
        try { moreBtn.click(); } catch (e) {}
        await sleep(DALY_Config ? DALY_Config.LAZY_LOAD.WAIT_MS : 3000);
        triggerLazyImages(container);
        await sleep(2000);
        var parsed = this._parseBatchFromContainer(container, this.allReviews);
        var newOnes = parsed.slice(beforeCount);
        this.allReviews = parsed;
        if (newOnes.length === 0) this._noMorePages = true;
        return newOnes;
      }

      // 2) 无按钮 → 滚动触发懒加载
      try {
        container.scrollTop = container.scrollHeight;
        window.scrollBy(0, 800);
        var modal = document.querySelector('[class*="rate-dialog"], [class*="review-dialog"], [class*="detail-dialog"], [class*="dialog"], [role="dialog"]');
        if (modal) modal.scrollTop = modal.scrollHeight;
      } catch (e) {}
      triggerLazyImages(container);
      await sleep(2000);

      var parsed2 = this._parseBatchFromContainer(container, this.allReviews);
      var newOnes2 = parsed2.slice(beforeCount);
      this.allReviews = parsed2;
      if (newOnes2.length === 0) this._noMorePages = true;
      return newOnes2;
    },

    // ---------- CSV 导出 ----------
    exportCSV: function() {
      var reviews = this.allReviews;
      if (!reviews || reviews.length === 0) return '';
      var headers = ['序号', '用户名', '评价类型', '评价内容', '图片数', '评价时间', '商家回复', '订单信息'];
      var rows = reviews.map(function(r, idx) {
        return [
          idx + 1,
          '"' + (r.userName || '').replace(/"/g, '""') + '"',
          r.type || '文字',
          '"' + (r.content || '').replace(/"/g, '""') + '"',
          r.imageCount || 0,
          r.time || '',
          '"' + (r.reply || '').replace(/"/g, '""') + '"',
          '"' + (r.orderInfo || '').replace(/"/g, '""') + '"'
        ].join(',');
      });
      return '\uFEFF' + [headers.join(','), rows.join('\n')].join('\r\n');
    }
  };

  ReviewFetcher.init();
  global.ReviewFetcher = ReviewFetcher;
})(window);
