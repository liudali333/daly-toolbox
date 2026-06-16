# 天猫评论"加载更多"功能 - 修改说明

## 日期: 2026-06-12 08:51 (更新)

## 核心问题
天猫/淘宝评价弹窗 **没有分页按钮**，使用 **滚动加载 + "更多回答"按钮** 的无限加载模式。

## 解决方案

### 行为变化
**之前**: 首次打开评论详情 → 自动循环点击"更多回答" → 一次性加载全部（可能很慢）
**现在**: 首次打开评论详情 → 只加载首批（~20条）→ 显示 **"⏩ 加载更多"** 按钮 → 用户按需逐步加载

### review-fetcher.js 改动

#### 1. `_lazyLoadReviews` 首次加载逻辑修改
- 点击"查看全部评价"打开弹窗后 → 解析第一批 → **直接返回**（不再调用 `tryLoadMore()` 循环）
- 用户通过 `loadNextPage()` 手动触发后续加载

#### 2. 新增方法

| 方法 | 功能 |
|------|------|
| `hasMorePages()` | 检测"更多回答"按钮是否存在 或 容器是否可滚动 |
| `loadNextPage()` | 公开接口，被 content.js 的按钮调用 |
| `_loadTmallNextPage()` | 核心逻辑：**两步策略** |
| `_parseAndDedupe()` | 解析+去重工具方法 |

#### 3. `_loadTmallNextPage()` 两步策略

```
Step 1: 查找"更多回答"按钮 (moreAnswerBtn / headerBtnItem)
  ├─ 找到 → click() → 等1.5秒 → 解析新评论 → 返回
  └─ 未找到 ↓

Step 2: 尝试滚动触发懒加载
  ├─ 滚动容器到底部 + 页面下滑 + 弹窗滚动
  ├─ 等2秒 → 解析新评论
  ├─ 有新数据 → 返回
  └─ 无新数据 → 再找一次按钮（滚动后可能出现）
       ├─ 有 → click → 返回
       └─ 无 → _noMorePages = true, 返回空数组
```

### content.js 改动

- 头部新增 **"⏩ 加载更多"** 按钮 (`daly-btn-loadmore`)
- 提取 `renderReviewRows()` 通用函数（首次+追加共用）
- `allLoadedReviews[]` 累加数组
- 按钮状态：`⏩ 加载更多` → `⏳ 加载中...` → `⏩ 加载更多(N条)` → `✅ 已全部加载`

## 文件大小

| 文件 | 大小 |
|------|------|
| `review-fetcher.js` | 26,285 chars (~130行分页逻辑) |
| `content.js` | ~44,500 chars (提取重复渲染代码) |

## 2026-06-12 优化 (10:36)

### 清理
- 4 个过期文件归档至 `_archive/`: review-fetcher.fixed.js, .backup, _lazyload.js, _tmall_new.js
- 9 个 Python 补丁脚本归档至 `_archive/`: apply_fix.py, fix_*.py, integrate_lazyload.py, update_selector.py

### review-fetcher.js 修复
- **天猫 O1CN 图片提取**: 3 处 `isValidImageUrl` 过滤器增加 `|| src.indexOf('imgextra') > -1` 条件，接受无扩展名的天猫评论实拍图 URL
- 移除旧的 imgextra 拒绝调试日志（`过滤非标准图片URL`）

### content.js 优化
- **DALY_MMS 工具栏**: 5 个功能按钮从"弹窗→再点击→跳转"改为直接操作
  - 差评申诉/批量退款/多多视频/数据分析 → 直接 `window.open`
  - AI防比价 → 内联 tip 提示"功能开发中"
  - 移除 ~120 行冗余 modal HTML（`handleComplaint/handleVideo/handleRefund/handleAnalysis` 原实现）

### content.css 清理
- 移除未使用样式: `.daly-collapsed-body` (7 行)

## 测试步骤

1. 刷新天猫商品页 → F12 控制台无报错
2. 点击 **"💬 评论详情"**
3. 应显示 **~20条评论** + 头部出现 **"⏩ 加载更多"** 按钮
4. 点击"加载更多":
   - 按钮变 `⏳ 加载中...`
   - 表格追加新评论行
   - 计数更新: "已加载 N 条评价"
5. 重复直到 `✅ 已全部加载`
