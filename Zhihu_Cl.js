
/*
引用地址 https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/zhihu.js
增强版：集成自定义广告接口白名单/黑名单
生成时间：2025-11-08 21:02:25
*/

// 若响应体为空，直接放行
if (!$response?.body) $done({});

const url = $request.url;
let obj;
try { obj = JSON.parse($response.body); } catch { $done({}); }

// 未来时间常量（2090-12-31），避免误触发灰度/黑白模式、活动等
const FUTURE_TS_S = { start: 3818332800, end: 3818419199 };
const FUTURE_TS = { start: String(FUTURE_TS_S.start), end: String(FUTURE_TS_S.end) };

// —— 新增：广告/广告位接口匹配表 ——
// 说明：这些路径片段来自你抓取的候选列表，我们仅做了轻微规范化（最多保留前三段路径），避免过度匹配。
const AD_ENDPOINT_PATTERNS = ["/topstory/recommend","/next-render","generic:/commercial(_api)?","weak:token-presence","generic:/ad or /ads","adtech:/ssp|/dsp|/adx|/adserver","generic:/brand.*(ad|sponsor|promo)","domain:adsrvr.org","/commercial_api/app_float_layer, generic:/commercial(_api)?","/topstory/hot-lists/*"]
// 简易包含判断（兼容数组/字符串）
function includesStr(hay, needle) {
  if (hay == null) return false;
  if (Array.isArray(hay)) return hay.some((v) => String(v).includes(needle));
  return String(hay).includes(needle);
}

// 通用广告元素清理器（保证幂等、尽量不破坏结构）
function sanitizeAdPayload(root) {
  if (root == null) return root;

  // 1) 常见广告字段清理（仅删除“看起来就是广告”的键，避免误伤）
  const AD_KEYS = [
    "ad", "ad_info", "adjson", "ads", "advert", "advert_info", "promotion_extra",
    "recommend_info", "metrics_area", "market_card", "feed_advert"
  ];
  for (const k of AD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(root, k)) {
      try { delete root[k]; } catch (_e) {}
    }
  }

  // 2) 常见集合字段中过滤广告项
  const maybeArrays = [root?.data, root?.list, root?.items, root?.results];
  for (const arr of maybeArrays) {
    if (!Array.isArray(arr)) continue;
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      const isAdLike =
        includesStr(it?.type, "ad") ||
        includesStr(it?.origin_data?.type, "ad") ||
        includesStr(it?.origin_data?.resource_type, "ad") ||
        includesStr(it?.business_type, "paid") ||
        includesStr(it?.common_card?.footline?.elements?.[0]?.text?.panel_text, "广告") ||
        (it && Object.prototype.hasOwnProperty.call(it, "ad")) ||
        (it && it.promotion_extra != null);
      if (isAdLike) arr.splice(i, 1);
    }
  }
  return root;
}

// 是否匹配任何你抓取到的广告接口
function matchesAdEndpoint(u) {
  try { return AD_ENDPOINT_PATTERNS.some((p) => u.includes(p)); }
  catch (_e) { return false; }
}

// —— 以下为原有逻辑（不改变既有效果的逻辑，保持次序与语义） ——
if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
  // 回答/文章列表中的“相关提问”
  if (obj?.third_business?.related_queries?.queries?.length) {
    obj.third_business.related_queries.queries = [];
  }
} else if (url.includes("/api/cloud/zhihu/config/all")) {
  // 全局配置：屏蔽灰度主题 & 顶部背景限时
  if (Array.isArray(obj?.data?.configs)) {
    for (const i of obj.data.configs) {
      if (i?.configKey === "feed_gray_theme" && i?.configValue) {
        i.configValue.start_time = FUTURE_TS_S.start;
        i.configValue.end_time = FUTURE_TS_S.end;
        i.status = false;
      } else if (i?.configKey === "feed_top_res" && i?.configValue) {
        i.configValue.start_time = FUTURE_TS_S.start;
        i.configValue.end_time = FUTURE_TS_S.end;
      }
    }
  }
} else if (url.includes("/api/v4/answers")) {
  // answers v4：删除 data/paging（常见广告/推荐容器）
  delete obj?.data;
  delete obj?.paging;
} else if (url.includes("/api/v4/articles")) {
  // articles v4：移除广告、翻页、推荐信息
  ["ad_info", "paging", "recommend_info"].forEach((k) => delete obj?.[k]);
} else if (url.includes("/appcloud2.zhihu.com/v3/config")) {
  // appcloud 配置调整：收敛 Tab，禁用灰度/僵尸粉等
  if (obj?.config?.hp_channel_tab) delete obj.config.hp_channel_tab;
  if (obj?.config) {
    if (obj.config?.homepage_feed_tab?.tab_infos) {
      obj.config.homepage_feed_tab.tab_infos = obj.config.homepage_feed_tab.tab_infos.filter((t) => {
        if (t?.tab_type === "activity_tab") {
          t.start_time = String(FUTURE_TS_S.start);
          t.end_time = String(FUTURE_TS_S.end);
          return true;
        }
        return false;
      });
    }
    if (obj.config?.zombie_conf) obj.config.zombie_conf.zombieEnable = false;
    if (obj.config?.gray_mode) {
      // 修正：确保是 enable 字段
      obj.config.gray_mode.enable = false;
      obj.config.gray_mode.start_time = String(FUTURE_TS_S.start);
      obj.config.gray_mode.end_time = String(FUTURE_TS_S.end);
    }
    if (obj.config?.zhcnh_thread_sync) {
      const sync = obj.config.zhcnh_thread_sync;
      sync.LocalDNSSetHostWhiteList = [];
      sync.isOpenLocalDNS = "0";
      sync.ZHBackUpIP_Switch_Open = "0";
      sync.dns_ip_detector_operation_lock = "1";
      sync.ZHHTTPSessionManager_setupZHHTTPHeaderField = "1";
    }
    obj.config.zvideo_max_number = 1;
    obj.config.is_show_followguide_alert = false;
  }
} else if (url.includes("/commercial_api/app_float_layer")) {
  // 悬浮图标：直接置空对象
  obj = {}
} else if (url.includes("/feed/render/tab/config")) {
  // 首页二级标签：仅保留 recommend/section
  if (Array.isArray(obj?.selected_sections)) {
    obj.selected_sections = obj.selected_sections.filter((i) => ["recommend", "section"].includes(i?.tab_type));
  }
} else if (url.includes("/moments_v3")) {
  // 屏蔽“为您推荐”类目
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !String(i?.title || "").includes("为您推荐"));
  }
} else if (url.includes("/next-bff")) {
  // next-bff 信息流：过滤广告/推荐导流
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => {
      const o = i?.origin_data;
      const nextGuideTitle = o?.next_guide?.title || "";
      return !(
        includesStr(o?.type, "ad") ||
        includesStr(o?.resource_type, "ad") ||
        String(nextGuideTitle).includes("推荐")
      );
    });
  }
} else if (url.includes("/next-data")) {
  // next-data：过滤广告/盐选
  if (Array.isArray(obj?.data?.data)) {
    obj.data.data = obj.data.data.filter((i) => !(includesStr(i?.type, "ad") || includesStr(i?.data?.answer_type, "PAID")));
  }
} else if (url.includes("/next-render")) {
  // next-render：过滤多种业务类型与广告
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !(
      i?.adjson ||
      includesStr(i?.biz_type_list, "article") ||
      includesStr(i?.biz_type_list, "content") ||
      includesStr(i?.business_type, "paid") ||
      i?.section_info ||
      i?.tips ||
      includesStr(i?.type, "ad")
    ));
  }
} else if (url.includes("/questions/")) {
  // 问题详情页：清理广告与付费答案
  delete obj?.ad_info;
  delete obj?.data?.ad_info;
  delete obj?.query_info;
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !includesStr(i?.target?.answer_type, "paid"));
  }
} else if (url.includes("/root/tab")) {
  // 首页一级标签：仅保留关注/热榜/推荐
  if (Array.isArray(obj?.tab_list)) {
    obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
  }
} else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
  // 热榜信息流：去“合作推广”
  if (Array.isArray(obj?.data?.data)) {
    obj.data.data = obj.data.data.filter((i) => !String(i?.target?.metrics_area?.text || "").includes("合作推广"));
  }
} else if (url.includes("/topstory/hot-lists/total")) {
  // 热榜排行榜：去“品牌甄选”
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !Object.prototype.hasOwnProperty.call(i, "ad"));
  }
} else if (url.includes("/topstory/recommend")) {
  // 推荐信息流：修正视频 ID、移除直播/广告/营销位
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => {
      if (i?.type === "market_card" && i?.fields?.header?.url && i?.fields?.body?.video) {
        const videoID = getUrlParamValue(i.fields.header.url, "videoID");
        if (videoID) i.fields.body.video.id = videoID;
        return true;
      }
      if (i?.type === "common_card") {
        if (i?.extra?.type === "drama") return false; // 直播
        if (i?.extra?.type === "zvideo") {
          const videoUrl = i?.common_card?.feed_content?.video?.customized_page_url || "";
          const vid = getUrlParamValue(videoUrl, "videoID");
          if (vid) i.common_card.feed_content.video.id = vid;
        }
        if (i?.common_card?.footline?.elements?.[0]?.text?.panel_text?.includes?.("广告")) return false;
        if (i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return false;
        if (i?.promotion_extra) return false;
        return true;
      }
      if (includesStr(i?.type, "aggregation_card")) return false; // 横排热榜卡
      if (i?.type === "feed_advert") return false; // 伪装广告
      return true;
    });
    fixPos(obj.data);
  }
} else if (matchesAdEndpoint(url)) {
  // —— 新增通用兜底：命中你抓取的广告接口 ——
  // 尽量只做“广告字段清理与广告项过滤”，不改变其他业务数据结构。
  obj = sanitizeAdPayload(obj);
}

// 输出
$done({ body: JSON.stringify(obj ?? {}, null, 0) });

// —— 辅助函数 ——
function fixPos(arr) { for (let i = 0; i < arr.length; i++) arr[i].offset = i + 1; }

function getUrlParamValue(u, key) {
  if (!u || u.indexOf("?") === -1 || !key) return "";
  const q = u.slice(u.indexOf("?") + 1).split("&");
  for (const pair of q) {
    const [k, v = ""] = pair.split("=");
    if (decodeURIComponent(k) === key) return decodeURIComponent(v);
  }
  return "";
}
