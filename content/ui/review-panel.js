// DALY工具箱 - 评论面板 UI 模块
// 功能：打开浮层 / 加载评论 / 渲染列表 / 加载更多 / 导出 CSV
// 依赖: ReviewFetcher, DALY_Log

(function(global) {
  'use strict';

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  var DALY_ReviewPanel = {

    open: async function() {
      var self = this;
      if (document.getElementById('daly-review-overlay')) {
        document.getElementById('daly-review-overlay').style.display = 'flex';
        return;
      }
      if (!global.ReviewFetcher) {
        if (global.DALY_Log) DALY_Log.error('ReviewFetcher 未加载');
        return;
      }

      var overlay = document.createElement('div');
      overlay.id = 'daly-review-overlay';
      overlay.className = 'daly-review-overlay';

      var panel = document.createElement('div');
      panel.className = 'daly-review-panel';

      // --- 表头 ---
      var header = document.createElement('div');
      header.className = 'daly-review-header';
      header.innerHTML =
        '<div><h3>💬 评价详情</h3><small id="daly-review-count">加载中...</small></div>' +
        '<div class="daly-review-actions">' +
          '<button id="daly-btn-loadmore" class="daly-btn daly-btn-secondary">⏩ 加载更多</button>' +
          '<button id="daly-btn-export" class="daly-btn daly-btn-primary">📥 批量导出 CSV</button>' +
          '<button id="daly-close-review" class="daly-btn daly-btn-close">×</button>' +
        '</div>';
      panel.appendChild(header);

      // --- 列头 ---
      var tableHeader = document.createElement('div');
      tableHeader.className = 'daly-review-table-header';
      tableHeader.innerHTML =
        '<div>序号</div><div>用户名</div><div>内容</div>' +
        '<div>图片预览</div><div>SKU</div><div>评论时间</div><div>操作</div>';
      panel.appendChild(tableHeader);

      // --- 列表容器 ---
      var tableBody = document.createElement('div');
      tableBody.id = 'daly-review-list';
      tableBody.className = 'daly-review-list';
      tableBody.innerHTML = '<div class="daly-loading" style="padding:40px;">正在加载评论数据...</div>';
      panel.appendChild(tableBody);

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // --- 事件 ---
      document.getElementById('daly-close-review').addEventListener('click', function() {
        self.close();
      });
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) self.close();
      });

      document.getElementById('daly-btn-export').addEventListener('click', function() {
        var csv = ReviewFetcher.exportCSV();
        if (csv) {
          var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = '评价详情_' + new Date().getTime() + '.csv';
          a.click();
          setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);
          self._toast('✅ 已导出');
        } else {
          self._toast('暂无可导出数据');
        }
      });

      document.getElementById('daly-btn-loadmore').addEventListener('click', async function() {
        var btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ 加载中...';
        try {
          var newReviews = await ReviewFetcher.loadNextPage();
          if (newReviews && newReviews.length > 0) {
            self._renderRows(newReviews);
            document.getElementById('daly-review-count').textContent = '已加载 ' + ReviewFetcher.allReviews.length + ' 条';
            btn.textContent = '⏩ 加载更多';
            btn.disabled = false;
          } else {
            btn.textContent = '✅ 已全部加载';
            btn.disabled = true;
          }
        } catch (e) {
          if (global.DALY_Log) DALY_Log.warn('加载更多异常:', e.message);
          btn.disabled = false;
          btn.textContent = '⏩ 加载更多';
        }
      });

      // --- 首次加载 ---
      try {
        var reviews = await ReviewFetcher.getReviews(1, 50);
        tableBody.innerHTML = '';
        document.getElementById('daly-review-count').textContent = '已加载 ' + (reviews ? reviews.length : 0) + ' 条评价';
        document.getElementById('daly-btn-export').style.display = 'inline-block';
        if (reviews && reviews.length > 0) {
          self._renderRows(reviews);
          if (ReviewFetcher.hasMorePages()) {
            document.getElementById('daly-btn-loadmore').style.display = 'inline-block';
          }
        } else {
          tableBody.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无评论数据</div>';
          document.getElementById('daly-btn-export').style.display = 'none';
        }
      } catch (e) {
        if (global.DALY_Log) DALY_Log.error('评论加载失败:', e.message);
        tableBody.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">加载失败: ' + escapeHtml(e.message) + '</div>';
      }
    },

    close: function() {
      var overlay = document.getElementById('daly-review-overlay');
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },

    _renderRows: function(reviews) {
      var container = document.getElementById('daly-review-list');
      if (!container) return;
      var startIdx = container.querySelectorAll('.daly-review-row').length;
      for (var i = 0; i < reviews.length; i++) {
        var r = reviews[i];
        var row = document.createElement('div');
        row.className = 'daly-review-row';

        var imageHtml = '';
        if (r.images && typeof r.images === 'string' && r.images.length > 0) {
          var urls = r.images.split(',');
          var previews = [];
          for (var j = 0; j < Math.min(urls.length, 3); j++) {
            if (urls[j]) previews.push('<img src="' + escapeHtml(urls[j]) + '" alt="" />');
          }
          imageHtml = previews.join('');
          if (urls.length > 3) imageHtml += '<span>+' + (urls.length - 3) + '</span>';
        } else if (r.imageCount > 0) {
          imageHtml = r.imageCount + '张图片';
        } else {
          imageHtml = '-';
        }

        var shortContent = (r.content || '').substring(0, 100);
        if (r.content && r.content.length > 100) shortContent += '...';

        row.innerHTML =
          '<div style="padding-left:8px;color:#666;">' + (startIdx + i + 1) + '</div>' +
          '<div title="' + escapeHtml(r.userName || '匿名用户') + '">' + escapeHtml(r.userName || '匿名用户') + '</div>' +
          '<div title="' + escapeHtml(r.content || '') + '" style="padding:0 10px;line-height:1.6;">' +
            (r.content ? escapeHtml(shortContent) : '<span style="color:#ccc">空</span>') +
          '</div>' +
          '<div class="daly-review-images">' + imageHtml + '</div>' +
          '<div>' + escapeHtml(r.orderInfo || '-') + '</div>' +
          '<div>' + escapeHtml(r.time || '-') + '</div>' +
          '<div><button class="daly-btn daly-btn-primary daly-btn-small">详情</button></div>';

        // 绑定"详情"按钮
        var detailBtn = row.querySelector('.daly-btn-small');
        if (detailBtn) {
          detailBtn.addEventListener('click', (function(rev) {
            return function() { DALY_ReviewPanel._showDetail(rev); };
          })(r));
        }
        container.appendChild(row);
      }
    },

    _showDetail: function(r) {
      var detail = document.createElement('div');
      detail.className = 'daly-detail-overlay';
      var body =
        '<h3>评论详情</h3>' +
        '<p><strong>用户：</strong>' + escapeHtml(r.userName || '匿名用户') + '</p>' +
        '<p><strong>时间：</strong>' + escapeHtml(r.time || '-') + '</p>' +
        '<p><strong>评分：</strong>' + (r.rating || '-') + ' 星</p>' +
        '<p><strong>内容：</strong></p>' +
        '<div class="daly-detail-content">' + escapeHtml(r.content || '无') + '</div>';

      if (r.images && typeof r.images === 'string' && r.images.length > 0) {
        var urls = r.images.split(',');
        var thumbs = [];
        for (var k = 0; k < urls.length; k++) {
          if (urls[k]) thumbs.push('<img src="' + escapeHtml(urls[k]) + '" onclick="window.open(this.src, \'_blank\')" />');
        }
        body += '<p><strong>图片：</strong></p><div class="daly-detail-images">' + thumbs.join('') + '</div>';
      }
      if (r.reply) {
        body += '<p><strong>商家回复：</strong></p><div class="daly-detail-content">' + escapeHtml(r.reply) + '</div>';
      }
      if (r.orderInfo) {
        body += '<p><strong>订单信息：</strong>' + escapeHtml(r.orderInfo) + '</p>';
      }
      body += '<button class="daly-btn daly-btn-primary" id="daly-detail-close">关闭</button>';

      detail.innerHTML = '<div class="daly-detail-panel">' + body + '</div>';
      document.body.appendChild(detail);
      detail.addEventListener('click', function(e) {
        if (e.target === detail || e.target.id === 'daly-detail-close') detail.remove();
      });
    },

    _toast: function(message) {
      var tooltip = document.createElement('div');
      tooltip.textContent = message;
      tooltip.className = 'daly-toast';
      document.body.appendChild(tooltip);
      setTimeout(function() {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 1500);
    }
  };

  global.DALY_ReviewPanel = DALY_ReviewPanel;
})(window);
