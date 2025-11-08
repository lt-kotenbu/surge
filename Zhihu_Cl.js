/*
  Zhihu Strict Cleaner (Surge)
  严格净化知乎广告/广告位（Web & App 常见端点）
  适用：Surge http-response (requires-body=true)
  更新：2025-11-09
*/

if (!$response || typeof $response.body === "undefined") {
  $done({});
}

const url = ($request && $request.url) || "";
const headers = ($response && $response.headers) || {};
const ct = String(headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
let bodyText = $response.body;

// ---------- JSON 解析与早退 ----------
let obj = null;
let isJSON = false;
try {
  if (ct.includes("application/json") || /^\s*[\[{]/.test(bodyText)) {
    obj = JSON.parse(bodyText);
    isJSON = true;
  }
} catch (e) {}
if (!isJSON) {
  // 仅处理 JSON，其他类型不变更，避免误伤
  $done({});
  return;
}

// ---------- 工具 ----------
const AD_KEYS = new Set([
  "ad", "ads", "ad_info", "adjson", "advert", "advert_info",
  "promotion", "promotion_extra", "feed_advert", "brand_select"
]);
const AD_TEXTS = ["广告", "推广", "合作推广", "品牌甄选"];
const PAID_TEXTS = ["盐选", "paid", "PAID"];

// 安全取值
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
const includes = (s, kw) => typeof s === "string" && s.includes(kw);
const strHasAny = (s, list) => typeof s === "string" && list.some((kw) => s.includes(kw));
const arr = (x) => (Array.isArray(x) ? x : []);

// 修复 offset
function fixPos(list) {
  if (!Array.isArray(list)) return;
  for (let i = 0; i < list.length; i++) {
    try { list[i].offset = i + 1; } catch {}
  }
}

// 提取 URL 参数
function getUrlParamValue(href, key) {
  try {
    const qs = href.split("?")[1] || "";
    const pairs = qs.split("&").map((p) => p.split("="));
    const map = Object.fromEntries(pairs);
    return map[key];
  } catch { return undefined; }
}

// 识别“广告样式的 item”
function isAdLikeItem(i) {
  try {
    if (!i || typeof i !== "object") return false;
    // 类型字段
    const t = String(i.type || i.biz_type || i.business_type || i.card_type || i.cell_type || "").toLowerCase();
    if (t.includes("ad") || t.includes("advert") || t.includes("feed_advert") || t.includes("promotion") || t.includes("paid")) return true;

    // 明确字段
    if (i.ad || i.ad_info || i.adjson || i.promotion_extra || i.brand_select) return true;

    // 卡片脚注/提示中的“广告/推广/合作推广/品牌甄选”
    if (strHasAny(i?.common_card?.footline?.elements?.[0]?.text?.panel_text, AD_TEXTS)) return true;
    if (strHasAny(i?.tips, AD_TEXTS)) return true;
    if (strHasAny(i?.target?.metrics_area?.text, ["合作推广"])) return true;

    // 盐选/付费
    if (strHasAny(i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text, PAID_TEXTS)) return true;

    // 聚合/榜卡（常含运营或广告聚合）
    if (typeof i.type === "string" && i.type.includes("aggregation_card")) return true;

    return false;
  } catch { return false; }
}

// 递归删除广告相关字段，并过滤数组中广告 item
function stripAdsDeep(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    const cleaned = [];
    for (const it of node) {
      const v = stripAdsDeep(it);
      if (!isAdLikeItem(v)) cleaned.push(v);
    }
    return cleaned;
  } else {
    for (const k of Object.keys(node)) {
      // 删除明确广告 key
      if (AD_KEYS.has(k)) { delete node[k]; continue; }
      // 删除包含文案“广告/推广/合作推广/品牌甄选”的字段
      if (typeof node[k] === "string" && strHasAny(node[k], AD_TEXTS)) { delete node[k]; continue; }
      // 递归
      node[k] = stripAdsDeep(node[k]);
    }
    return node;
  }
}

// 尝试回填视频 id（减少推广视频误混）
function tryFillVideoId(card) {
  try {
    if (card?.type === "market_card" && card?.fields?.header?.url && card?.fields?.body?.video) {
      const vid = getUrlParamValue(card.fields.header.url, "videoID");
      if (vid) card.fields.body.video.id = vid;
    }
    if (card?.type === "common_card") {
      if (card?.extra?.type === "zvideo") {
        const u = card?.common_card?.feed_content?.video?.customized_page_url;
        const vid = u ? getUrlParamValue(u, "videoID") : undefined;
        if (vid) card.common_card.feed_content.video.id = vid;
      } else if (card?.common_card?.feed_content?.video?.id) {
        // 兜底，尽量少用
        const search = '"feed_content":{"video":{"id":';
        const idx = bodyText.indexOf(search);
        if (idx > 0) {
          const seg = bodyText.substring(idx + search.length);
          const vid = seg.substring(0, seg.indexOf(","));
          if (vid) card.common_card.feed_content.video.id = String(vid).replace(/["']/g, "");
        }
      }
    }
  } catch {}
}

// ---------- 端点定制处理（严格模式） ----------
try {
  // 新版回答/文章：去“相关提问”
  if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
    if (obj?.third_business?.related_queries?.queries?.length > 0) {
      obj.third_business.related_queries.queries = [];
    }
    obj = stripAdsDeep(obj);
  }

  // 全局配置（App）——去灰/去顶部图/关闭僵尸/引导等
  else if (url.includes("/api/cloud/zhihu/config/all")) {
    if (arr(obj?.data?.configs).length > 0) {
      for (const c of obj.data.configs) {
        if (c?.configKey === "feed_gray_theme" && c?.configValue) {
          c.configValue.start_time = 3818332800; // 2090-12-31 00:00:00
          c.configValue.end_time = 3818419199;   // 2090-12-31 23:59:59
          c.status = false;
        } else if (c?.configKey === "feed_top_res" && c?.configValue) {
          c.configValue.start_time = 3818332800;
          c.configValue.end_time = 3818419199;
        }
      }
    }
    obj = stripAdsDeep(obj);
  }

  // V4 旧接口：去广告/分页
  else if (url.includes("/api/v4/answers")) {
    if (obj?.data) delete obj.data;
    if (obj?.paging) delete obj.paging;
  } else if (url.includes("/api/v4/articles")) {
    ["ad_info", "paging", "recommend_info"].forEach((k) => delete obj[k]);
  }

  // App 全局配置（老域名）
  else if (/appcloud2\.zhihu\.com\/v3\/config|appcloud2\.in\.zhihu\.com\/v3\/config/.test(url)) {
    if (obj?.config?.hp_channel_tab) delete obj.config.hp_channel_tab;

    if (obj?.config) {
      if (obj.config?.homepage_feed_tab?.tab_infos) {
        obj.config.homepage_feed_tab.tab_infos = obj.config.homepage_feed_tab.tab_infos.filter((tab) => {
          if (tab.tab_type === "activity_tab") {
            tab.start_time = "3818332800";
            tab.end_time = "3818419199";
            return true;
          } else {
            return false;
          }
        });
      }
      if (obj.config?.zombie_conf) obj.config.zombie_conf.zombieEnable = false;

      if (obj.config?.gray_mode) {
        obj.config.gray_mode.enable = false;
        obj.config.gray_mode.start_time = "3818332800";
        obj.config.gray_mode.end_time = "3818419199";
      }

      if (obj.config?.zhcnh_thread_sync) {
        obj.config.zhcnh_thread_sync.LocalDNSSetHostWhiteList = [];
        obj.config.zhcnh_thread_sync.isOpenLocalDNS = "0";
        obj.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = "0";
        obj.config.zhcnh_thread_sync.dns_ip_detector_operation_lock = "1";
        obj.config.zhcnh_thread_sync.ZHHTTPSessionManager_setupZHHTTPHeaderField = "1";
      }

      // 严格模式：限制首页视频/关闭关注引导
      obj.config.zvideo_max_number = 1;
      obj.config.is_show_followguide_alert = false;
    }
    obj = stripAdsDeep(obj);
  }

  // 悬浮浮层
  else if (url.includes("/commercial_api/app_float_layer")) {
    if (obj && typeof obj === "object") {
      // 常见字段 feed_egg
      if (has(obj, "feed_egg")) delete obj.feed_egg;
    }
  }

  // 首页二级标签：仅留 recommend/section
  else if (url.includes("/feed/render/tab/config")) {
    if (arr(obj?.selected_sections).length > 0) {
      obj.selected_sections = obj.selected_sections.filter((i) => ["recommend", "section"].includes(i?.tab_type));
    }
  }

  // 时刻流：去“为您推荐”
  else if (url.includes("/moments_v3")) {
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => !includes(i?.title, "为您推荐"));
    }
    obj = stripAdsDeep(obj);
  }

  // Web BFF/数据/渲染：统一严清
  else if (url.includes("/next-bff")) {
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => !(
        includes(i?.origin_data?.type, "ad") ||
        includes(i?.origin_data?.resource_type, "ad") ||
        includes(i?.origin_data?.next_guide?.title, "推荐")
      ));
      for (const card of obj.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-data")) {
    if (arr(obj?.data?.data).length > 0) {
      obj.data.data = obj.data.data.filter((i) => !(includes(i?.type, "ad") || includes(i?.data?.answer_type, "PAID")));
      for (const card of obj.data.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-render")) {
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => !(
        i?.adjson ||
        arr(i?.biz_type_list).includes("article") ||
        arr(i?.biz_type_list).includes("content") ||
        includes(i?.business_type, "paid") ||
        i?.section_info ||
        i?.tips ||
        includes(i?.type, "ad")
      ));
      for (const card of obj.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  }

  // 问题回答列表：去广告/盐选/付费
  else if (url.includes("/questions/")) {
    if (obj?.ad_info) delete obj.ad_info;
    if (obj?.data?.ad_info) delete obj.data.ad_info;
    if (obj?.query_info) delete obj.query_info;
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => !includes(i?.target?.answer_type, "paid"));
    }
    obj = stripAdsDeep(obj);
  }

  // 首页一级标签：仅留 follow/hot/recommend
  else if (url.includes("/root/tab")) {
    if (arr(obj?.tab_list).length > 0) {
      obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
    }
  }

  // 热榜（信息流/榜单）
  else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
    if (arr(obj?.data?.data).length > 0) {
      obj.data.data = obj.data.data.filter((i) => !strHasAny(i?.target?.metrics_area?.text, ["合作推广"]));
    }
  } else if (url.includes("/topstory/hot-lists/total")) {
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => !has(i, "ad"));
    }
  }

  // 推荐信息流（最严格）
  else if (url.includes("/topstory/recommend")) {
    if (arr(obj?.data).length > 0) {
      obj.data = obj.data.filter((i) => {
        // 市场卡：保留但回填视频 id（若为推广/广告则 drop）
        if (i.type === "market_card") {
          if (i.fields?.header?.url && i.fields?.body?.video) {
            const vid = getUrlParamValue(i.fields.header.url, "videoID");
            if (vid) i.fields.body.video.id = vid;
          }
          // 市场卡经常用于运营，若含推广痕迹则直接丢弃
          if (isAdLikeItem(i)) return false;
          return true;
        }
        // 通用卡：去直播/推广/盐选，回填视频 id
        if (i.type === "common_card") {
          if (i.extra?.type === "drama") return false; // 直播
          if (i.extra?.type === "zvideo") {
            const u = i.common_card?.feed_content?.video?.customized_page_url;
            const vid = u ? getUrlParamValue(u, "videoID") : undefined;
            if (vid) i.common_card.feed_content.video.id = vid;
          } else if (i.common_card?.feed_content?.video?.id) {
            const search = '"feed_content":{"video":{"id":';
            const idx = bodyText.indexOf(search);
            if (idx > 0) {
              const seg = bodyText.substring(idx + search.length);
              const vid = seg.substring(0, seg.indexOf(","));
              if (vid) i.common_card.feed_content.video.id = String(vid).replace(/["']/g, "");
            }
          }
          if (strHasAny(i?.common_card?.footline?.elements?.[0]?.text?.panel_text, ["广告"])) return false;
          if (strHasAny(i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text, PAID_TEXTS)) return false;
          if (i?.promotion_extra) return false;
          // 若仍被识别为广告样式，丢弃
          if (isAdLikeItem(i)) return false;
          return true;
        }
        // 横排聚合/伪装广告
        if (typeof i.type === "string" && i.type.includes("aggregation_card")) return false;
        if (i.type === "feed_advert") return false;

        // 兜底：只保留非广告样式
        return !isAdLikeItem(i);
      });
      fixPos(obj.data);
    }
    obj = stripAdsDeep(obj);
  }

  // 兜底：所有 JSON 结果轻度净化（删除广告相关字段/对象）
  else {
    obj = stripAdsDeep(obj);
  }
} catch (e) {
  // 安全保护：不阻断返回
}

$done({ body: JSON.stringify(obj) });
