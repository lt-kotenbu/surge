/*
  Zhihu Cleaner for Surge
  来源参考/思路借鉴：https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/zhihu.js
  结合你的 HAR（2025-11-09 分析）中出现的知乎相关域名与端点做了适配与稳健性增强
  适配环境：Surge (http-response 脚本，requires-body=true)
  更新时间：2025-11-09
*/

if (!$response || typeof $response.body === "undefined") {
  $done({});
}

const url = $request && $request.url ? $request.url : "";
const headers = ($response && $response.headers) || {};
const ct = (headers["Content-Type"] || headers["content-type"] || "").toLowerCase();

// —— 安全解析 JSON（容错 HTML/空体/非 JSON） ——
let bodyText = $response.body;
let obj = null;
let isJSON = false;
try {
  if (ct.includes("application/json") || bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
    obj = JSON.parse(bodyText);
    isJSON = true;
  }
} catch (e) {
  // 不是 JSON，直接跳出
}

if (!isJSON) {
  // 非 JSON 响应不处理，避免误伤（例如 HTML、视频、图片等）
  $done({});
  return;
}

// ========= 工具方法 =========
function getUrlParamValue(href, key) {
  try {
    const qs = href.substring(href.indexOf("?") + 1);
    const pairs = qs.split("&").map((p) => p.split("="));
    const map = Object.fromEntries(pairs);
    return map[key];
  } catch {
    return undefined;
  }
}

function fixPos(arr) {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    try {
      arr[i].offset = i + 1;
    } catch {}
  }
}

// 递归删除对象中的广告相关字段/节点（保守规则，尽量不误伤）
const AD_KEYS = new Set([
  "ad", "ads", "ad_info", "adjson", "advert", "advert_info", "advertising",
  "adJson", "adExtra", "promotion_extra", "promotion", "brand_select"
]);
const AD_FLAG_TEXTS = ["广告", "推广", "合作推广", "品牌甄选"];

function hasAdFlagText(v) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return AD_FLAG_TEXTS.some((kw) => s && s.includes && s.includes(kw));
  } catch {
    return false;
  }
}

function stripAdsDeep(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    const cleaned = [];
    for (const item of node) {
      const newItem = stripAdsDeep(item);
      // 过滤典型的广告/营销/付费/直播/聚合/横排卡
      if (shouldDropItem(newItem)) continue;
      cleaned.push(newItem);
    }
    return cleaned;
  } else {
    for (const k of Object.keys(node)) {
      // 字段名命中广告关键词，直接丢弃
      if (AD_KEYS.has(k)) {
        delete node[k];
        continue;
      }
      // 文案里带“广告/推广”等
      if (typeof node[k] === "string" && hasAdFlagText(node[k])) {
        delete node[k];
        continue;
      }
      // 递归
      node[k] = stripAdsDeep(node[k]);
    }
    return node;
  }
}

function shouldDropItem(i) {
  try {
    if (!i || typeof i !== "object") return false;

    // 类型字段包含广告或付费、聚合等
    const t = (i.type || i.biz_type || i.business_type || i.card_type || i.cell_type || "");
    if (typeof t === "string") {
      const ts = t.toLowerCase();
      if (ts.includes("ad") || ts.includes("advert") || ts.includes("paid") || ts.includes("aggregation")) return true;
    }

    // 常见字段命中
    if (i.ad || i.ad_info || i.adjson || i.promotion_extra || i.brand_select) return true;

    // 脚部或提示里出现“广告/推广/合作推广/品牌甄选”
    if (hasAdFlagText(i?.common_card?.footline?.elements?.[0]?.text?.panel_text)) return true;
    if (hasAdFlagText(i?.tips)) return true;
    if (hasAdFlagText(i?.target?.metrics_area?.text)) return true;

    // 盐选/付费
    if (i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return true;
  } catch {}
  return false;
}

// —— 针对视频卡片，尽可能回填/规范 videoID ——
// （部分来源：HAR 中 mp4 请求较多，优先减少出错与误触发推广）
function tryFillVideoId(card) {
  try {
    // market_card
    if (card?.type === "market_card" && card?.fields?.header?.url && card?.fields?.body?.video) {
      const vid = getUrlParamValue(card.fields.header.url, "videoID");
      if (vid) card.fields.body.video.id = vid;
    }

    // common_card（推广视频）
    if (card?.type === "common_card") {
      if (card?.extra?.type === "zvideo") {
        const videoUrl = card?.common_card?.feed_content?.video?.customized_page_url;
        if (videoUrl) {
          const vid = getUrlParamValue(videoUrl, "videoID");
          if (vid) card.common_card.feed_content.video.id = vid;
        }
      } else if (card?.common_card?.feed_content?.video?.id) {
        // 回退：从 body 文本粗略提取（尽量不用，但保留逻辑兼容旧接口）
        const search = '"feed_content":{"video":{"id":';
        const idx = bodyText.indexOf(search);
        if (idx > 0) {
          const s = bodyText.substring(idx + search.length);
          const vid = s.substring(0, s.indexOf(","));
          if (vid) card.common_card.feed_content.video.id = vid.replace(/["']/g, "");
        }
      }
    }
  } catch {}
}

// ========= 各接口精准处理 =========
// 说明：以下分支覆盖了 HAR 与常见版本中出现的知乎端点。
// 若接口结构变化，仍有 stripAdsDeep 的兜底净化。

try {
  // 1) 新版回答/文章列表：隐藏“相关提问”
  if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
    if (obj?.third_business?.related_queries?.queries?.length > 0) {
      obj.third_business.related_queries.queries = [];
    }
  }

  // 2) 全局配置：灰度/顶部图等
  else if (url.includes("/api/cloud/zhihu/config/all")) {
    if (obj?.data?.configs?.length > 0) {
      for (const i of obj.data.configs) {
        if (i?.configKey === "feed_gray_theme" && i?.configValue) {
          i.configValue.start_time = 3818332800; // 2090-12-31 00:00:00
          i.configValue.end_time = 3818419199;   // 2090-12-31 23:59:59
          i.status = false;
        } else if (i?.configKey === "feed_top_res" && i?.configValue) {
          i.configValue.start_time = 3818332800;
          i.configValue.end_time = 3818419199;
        }
      }
    }
    obj = stripAdsDeep(obj);
  }

  // 3) 旧版 v4 answers/articles
  else if (url.includes("/api/v4/answers")) {
    if (obj?.data) delete obj.data;
    if (obj?.paging) delete obj.paging;
  } else if (url.includes("/api/v4/articles")) {
    ["ad_info", "paging", "recommend_info"].forEach((k) => delete obj[k]);
  }

  // 4) appcloud 全局配置
  else if (url.includes("/appcloud2.zhihu.com/v3/config")) {
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
        // 修正原脚本的属性名问题
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

      // 基于 HAR 中视频请求较多，控制首页视频数量/弹框等
      obj.config.zvideo_max_number = 1;
      obj.config.is_show_followguide_alert = false;
    }
    obj = stripAdsDeep(obj);
  }

  // 5) 悬浮图标/浮层
  else if (url.includes("/commercial_api/app_float_layer")) {
    if (obj && typeof obj === "object" && "feed_egg" in obj) {
      delete obj.feed_egg;
    }
  }

  // 6) 首页二级标签：仅留推荐/section
  else if (url.includes("/feed/render/tab/config")) {
    if (Array.isArray(obj?.selected_sections) && obj.selected_sections.length > 0) {
      obj.selected_sections = obj.selected_sections.filter((i) =>
        ["recommend", "section"].includes(i?.tab_type)
      );
    }
  }

  // 7) 关注/时刻流：去“为您推荐”
  else if (url.includes("/moments_v3")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !i?.title?.includes("为您推荐"));
    }
    obj = stripAdsDeep(obj);
  }

  // 8) Web Next 系列（BFF / data / render）：统一净化
  else if (url.includes("/next-bff")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !(
        i?.origin_data?.type?.includes?.("ad") ||
        i?.origin_data?.resource_type?.includes?.("ad") ||
        i?.origin_data?.next_guide?.title?.includes?.("推荐")
      ));
      for (const card of obj.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-data")) {
    if (obj?.data?.data?.length > 0) {
      obj.data.data = obj.data.data.filter((i) => !(i?.type?.includes?.("ad") || i?.data?.answer_type?.includes?.("PAID")));
      for (const card of obj.data.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-render")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !(
        i?.adjson ||
        i?.biz_type_list?.includes?.("article") ||
        i?.biz_type_list?.includes?.("content") ||
        i?.business_type?.includes?.("paid") ||
        i?.section_info ||
        i?.tips ||
        i?.type?.includes?.("ad")
      ));
      for (const card of obj.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  }

  // 9) 问题回答列表：去广告/盐选/付费
  else if (url.includes("/questions/")) {
    if (obj?.ad_info) delete obj.ad_info;
    if (obj?.data?.ad_info) delete obj.data.ad_info;
    if (obj?.query_info) delete obj.query_info;

    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !i?.target?.answer_type?.includes?.("paid"));
    }
    obj = stripAdsDeep(obj);
  }

  // 10) 首页一级标签：仅留关注/热榜/推荐
  else if (url.includes("/root/tab")) {
    if (Array.isArray(obj?.tab_list) && obj.tab_list.length > 0) {
      obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
    }
  }

  // 11) 热榜信息流/榜单：去“合作推广/品牌甄选”
  else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
    if (obj?.data?.data?.length > 0) {
      obj.data.data = obj.data.data.filter((i) => !i.target?.metrics_area?.text?.includes?.("合作推广"));
    }
  } else if (url.includes("/topstory/hot-lists/total")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !Object.prototype.hasOwnProperty.call(i, "ad"));
    }
  }

  // 12) 推荐信息流：统一净化 + 修复视频 ID + 去直播/聚合/伪装广告
  else if (url.includes("/topstory/recommend")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => {
        // 市场卡：回填 videoID
        if (i.type === "market_card" && i.fields?.header?.url && i.fields?.body?.video?.id !== undefined) {
          const videoID = getUrlParamValue(i.fields.header.url, "videoID");
          if (videoID) i.fields.body.video.id = videoID;
          return true;
        }
        // 通用卡：去直播/推广/盐选，回填视频 id
        if (i.type === "common_card") {
          if (i.extra?.type === "drama") return false; // 直播
          if (i.extra?.type === "zvideo") {
            const videoUrl = i.common_card?.feed_content?.video?.customized_page_url;
            const videoID = videoUrl ? getUrlParamValue(videoUrl, "videoID") : undefined;
            if (videoID) i.common_card.feed_content.video.id = videoID;
          } else if (i.common_card?.feed_content?.video?.id) {
            // 回退提取
            const search = '"feed_content":{"video":{"id":';
            const sidx = bodyText.indexOf(search);
            if (sidx > 0) {
              const seg = bodyText.substring(sidx + search.length);
              const vid = seg.substring(0, seg.indexOf(","));
              if (vid) i.common_card.feed_content.video.id = vid.replace(/["']/g, "");
            }
          }
          if (i.common_card?.footline?.elements?.[0]?.text?.panel_text?.includes?.("广告")) return false;
          if (i.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return false;
          if (i?.promotion_extra) return false;
          return true;
        }
        // 横排卡片/热榜聚合/伪装广告
        if (typeof i.type === "string" && i.type.includes("aggregation_card")) return false;
        if (i.type === "feed_advert") return false;

        // 其他：交给兜底清理
        return !shouldDropItem(i);
      });

      // 统一修复 offset
      fixPos(obj.data);
    }
    obj = stripAdsDeep(obj);
  }

  // —— 兜底：对所有 JSON 结果做一次轻度净化（避免接口遗漏）——
  else {
    obj = stripAdsDeep(obj);
  }
} catch (e) {
  // 最小可见性失败保护，不影响正常返回
  // $notification.post("Zhihu Cleaner", "处理异常", String(e));
}

// —— 结束 —— 
$done({ body: JSON.stringify(obj) });
