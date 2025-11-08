
/*
  Zhihu Cleaner for Surge
  来源/思路参考： https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/zhihu.js
  在你的 HAR（2025-11-09 分析）中出现的知乎相关域名与端点基础上做适配与稳健性增强
  适配环境：Surge (http-response 脚本，requires-body=true)
  更新时间：2025-11-09
  作者：ChatGPT (GPT-5 Thinking)
*/

/* --------------------- 基础安全检查 --------------------- */
if (!$response || typeof $response.body === "undefined") {
  $done({});
}

const url = ($request && $request.url) || "";
const headers = ($response && $response.headers) || {};
const ct = (headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
const bodyText = String($response.body ?? "");

/* 只处理 JSON 响应，其他类型直接放行，避免误伤（HTML/图片/视频等） */
let obj = null;
let isJSON = false;
try {
  if (ct.includes("application/json") || bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
    obj = JSON.parse(bodyText);
    isJSON = true;
  }
} catch (e) {
  // 不是合法 JSON，不处理
}
if (!isJSON) {
  $done({});
  return;
}

/* --------------------- 通用工具 --------------------- */
function getHost(href) {
  try { return href.replace(/^https?:\/\/([^\/?#]+).*/i, "$1"); } catch { return ""; }
}
const host = getHost(url);
const isZhihuDomain = /(^|\.)zhihu\.com$|(^|\.)zhimg\.com$|(^|\.)appcloud2\.zhihu\.com$/.test(host);

/* 若你的规则已限制 host，可关闭此判断。这里多一道保险，避免误处理其它站点。 */
if (!isZhihuDomain) {
  $done({ body: JSON.stringify(obj) });
  return;
}

function getUrlParamValue(href, key) {
  try {
    const qIndex = href.indexOf("?");
    if (qIndex < 0) return undefined;
    const qs = href.substring(qIndex + 1);
    const pairs = qs.split("&").map((p) => {
      const [k, v=""] = p.split("=");
      return [decodeURIComponent(k), decodeURIComponent(v)];
    });
    const map = Object.fromEntries(pairs);
    return map[key];
  } catch {
    return undefined;
  }
}

function fixPos(arr) {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    try { if (arr[i]) arr[i].offset = i + 1; } catch {}
  }
}

/* --------------------- 广告判定/清理 --------------------- */
const AD_KEYS = new Set([
  "ad","ads","ad_info","adjson","adJson","ad_extra","adExtra","extra_ad","mix_ad",
  "advert","advert_info","advertising","advertisement","advertisements",
  "promotion","promotion_extra","promotions","brand_select","brandPromotion",
  "is_ad","ad_type","adType","ad_data","adData","adslot","ad_unit","adUnit"
]);

const AD_FLAG_TEXTS = [
  "广告","推广","合作推广","品牌甄选","品牌推广","商业推广","赞助",
  "sponsor","sponsored","promotion","promoted","advertisement","ad "
];

function hasAdFlagText(v) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return false;
    return AD_FLAG_TEXTS.some((kw) => s.includes && s.includes(kw));
  } catch {
    return false;
  }
}

function shouldDropItem(i) {
  try {
    if (!i || typeof i !== "object") return false;

    // 常见类型命中（ad/paid/aggregation/advert 等）
    const t = (i.type || i.biz_type || i.business_type || i.card_type || i.cell_type || "");
    if (typeof t === "string") {
      const ts = t.toLowerCase();
      if (ts.includes("ad") || ts.includes("advert") || ts.includes("paid") || ts.includes("aggregation") || ts.includes("feed_advert")) return true;
    }

    // 明确广告字段
    for (const k of Object.keys(i)) {
      if (AD_KEYS.has(k)) return true;
    }

    // 文案带广告提示
    if (hasAdFlagText(i?.common_card?.footline?.elements?.[0]?.text?.panel_text)) return true;
    if (hasAdFlagText(i?.tips)) return true;
    if (hasAdFlagText(i?.target?.metrics_area?.text)) return true;
    if (hasAdFlagText(i?.title) || hasAdFlagText(i?.sub_title)) return true;

    // 盐选/付费
    if (i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return true;
    if (i?.target?.answer_type?.includes?.("paid")) return true;

    // 直播/戏剧类
    if (i?.extra?.type === "drama" || i?.extra?.type === "live") return true;
  } catch {}
  return false;
}

function stripAdsDeep(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node)) {
    const cleaned = [];
    for (const item of node) {
      const newItem = stripAdsDeep(item);
      if (shouldDropItem(newItem)) continue;
      cleaned.push(newItem);
    }
    return cleaned;
  } else {
    for (const k of Object.keys(node)) {
      if (AD_KEYS.has(k)) { delete node[k]; continue; }
      const v = node[k];
      if (typeof v === "string" && hasAdFlagText(v)) { delete node[k]; continue; }
      node[k] = stripAdsDeep(v);
    }
    return node;
  }
}

/* 针对视频卡片补充 videoID，减少因推广卡结构异常导致的播放失败 */
function tryFillVideoId(card) {
  try {
    // market_card
    if (card?.type === "market_card" && card?.fields?.header?.url && card?.fields?.body?.video) {
      const vid = getUrlParamValue(card.fields.header.url, "videoID");
      if (vid) card.fields.body.video.id = vid;
    }
    // common_card（zvideo）
    if (card?.type === "common_card") {
      if (card?.extra?.type === "zvideo") {
        const videoUrl = card?.common_card?.feed_content?.video?.customized_page_url;
        if (videoUrl) {
          const vid = getUrlParamValue(videoUrl, "videoID");
          if (vid) card.common_card.feed_content.video.id = vid;
        }
      }
    }
  } catch {}
}

/* 小工具：对常见列表字段做“温和净化” */
function lightCleanList(container, keys = ["data","list","items","cards"]) {
  try {
    for (const k of keys) {
      if (Array.isArray(container?.[k]) && container[k].length) {
        container[k] = container[k].filter((i) => !shouldDropItem(i));
        // 尝试修正 video ID
        for (const it of container[k]) tryFillVideoId(it);
        fixPos(container[k]);
      }
      // 二级 data.data
      if (container?.[k]?.data && Array.isArray(container[k].data)) {
        container[k].data = container[k].data.filter((i) => !shouldDropItem(i));
        for (const it of container[k].data) tryFillVideoId(it);
        fixPos(container[k].data);
      }
    }
  } catch {}
}

/* --------------------- 各端点定制处理 --------------------- */
try {
  // 1) 新版回答/文章列表：隐藏“相关提问”
  if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
    if (obj?.third_business?.related_queries?.queries?.length > 0) {
      obj.third_business.related_queries.queries = [];
    }
    obj = stripAdsDeep(obj);
  }

  // 2) 全站配置
  else if (url.includes("/api/cloud/zhihu/config/all")) {
    if (obj?.data?.configs?.length > 0) {
      for (const i of obj.data.configs) {
        if (i?.configKey === "feed_gray_theme" && i?.configValue) {
          // 将灰度期“移到未来”，并标记关闭
          if (typeof i.configValue.start_time === "string") {
            i.configValue.start_time = "3818332800";
            i.configValue.end_time = "3818419199";
          } else {
            i.configValue.start_time = 3818332800;
            i.configValue.end_time = 3818419199;
          }
          i.status = false;
        } else if (i?.configKey === "feed_top_res" && i?.configValue) {
          if (typeof i.configValue.start_time === "string") {
            i.configValue.start_time = "3818332800";
            i.configValue.end_time = "3818419199";
          } else {
            i.configValue.start_time = 3818332800;
            i.configValue.end_time = 3818419199;
          }
        }
      }
    }
    obj = stripAdsDeep(obj);
  }

  // 3) 旧版 v4 answers/articles（仅清理广告字段，不直接清空数据以免影响正常使用）
  else if (url.includes("/api/v4/answers")) {
    lightCleanList(obj, ["data"]);
    if (obj?.paging) delete obj.paging; // 可视情况保留/删除
    obj = stripAdsDeep(obj);
  } else if (url.includes("/api/v4/articles")) {
    if (obj) {
      delete obj.ad_info;
      delete obj.recommend_info;
      lightCleanList(obj, ["data"]);
      obj = stripAdsDeep(obj);
    }
  }

  // 4) appcloud 全局配置
  else if (url.includes("/appcloud2.zhihu.com/v3/config")) {
    if (obj?.config) {
      if (obj.config?.homepage_feed_tab?.tab_infos) {
        obj.config.homepage_feed_tab.tab_infos = obj.config.homepage_feed_tab.tab_infos.filter((tab) => {
          if (tab.tab_type === "activity_tab") {
            // 仅保留 activity_tab，其它移除
            if (typeof tab.start_time === "string") {
              tab.start_time = "3818332800"; tab.end_time = "3818419199";
            } else {
              tab.start_time = 3818332800; tab.end_time = 3818419199;
            }
            return true;
          }
          return false;
        });
      }
      if (obj.config?.zombie_conf) obj.config.zombie_conf.zombieEnable = false;

      if (obj.config?.gray_mode) {
        obj.config.gray_mode.enable = false;
        if (typeof obj.config.gray_mode.start_time === "string") {
          obj.config.gray_mode.start_time = "3818332800";
          obj.config.gray_mode.end_time = "3818419199";
        } else {
          obj.config.gray_mode.start_time = 3818332800;
          obj.config.gray_mode.end_time = 3818419199;
        }
      }

      if (obj.config?.zhcnh_thread_sync) {
        obj.config.zhcnh_thread_sync.LocalDNSSetHostWhiteList = [];
        obj.config.zhcnh_thread_sync.isOpenLocalDNS = "0";
        obj.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open = "0";
        obj.config.zhcnh_thread_sync.dns_ip_detector_operation_lock = "1";
        obj.config.zhcnh_thread_sync.ZHHTTPSessionManager_setupZHHTTPHeaderField = "1";
      }

      obj.config.zvideo_max_number = 1;
      obj.config.is_show_followguide_alert = false;
    }
    obj = stripAdsDeep(obj);
  }

  // 5) 悬浮层/浮标
  else if (url.includes("/commercial_api/app_float_layer")) {
    if (obj && typeof obj === "object") {
      delete obj.feed_egg;
      delete obj.ad;
      delete obj.ad_info;
    }
  }

  // 6) 首页二级标签：仅留推荐/section
  else if (url.includes("/feed/render/tab/config")) {
    if (Array.isArray(obj?.selected_sections) && obj.selected_sections.length > 0) {
      obj.selected_sections = obj.selected_sections.filter((i) =>
        ["recommend", "section"].includes(i?.tab_type)
      );
    }
    obj = stripAdsDeep(obj);
  }

  // 7) 关注/时刻流：去“为您推荐”等
  else if (url.includes("/moments") || url.includes("/moments_v3")) {
    lightCleanList(obj, ["data","list","items"]);
    if (Array.isArray(obj?.data)) {
      obj.data = obj.data.filter((i) => !(i?.title?.includes?.("为您推荐")));
    }
    obj = stripAdsDeep(obj);
  }

  // 8) Web Next 系列（BFF / data / render）：统一净化
  else if (url.includes("/next-bff")) {
    lightCleanList(obj, ["data","items","list","cards"]);
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !(
        i?.origin_data?.type?.toLowerCase?.().includes?.("ad") ||
        i?.origin_data?.resource_type?.toLowerCase?.().includes?.("ad") ||
        i?.origin_data?.next_guide?.title?.includes?.("推荐")
      ));
      for (const card of obj.data) tryFillVideoId(card);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-data")) {
    lightCleanList(obj?.data || obj, ["data","items"]);
    if (obj?.data?.data?.length > 0) {
      obj.data.data = obj.data.data.filter((i) => !(String(i?.type || "").toLowerCase().includes("ad") || String(i?.data?.answer_type || "").includes("PAID")));
      for (const card of obj.data.data) tryFillVideoId(card);
      fixPos(obj.data.data);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/next-render")) {
    lightCleanList(obj, ["data","items","list","cards"]);
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !(
        i?.adjson ||
        i?.biz_type_list?.includes?.("article") ||
        i?.biz_type_list?.includes?.("content") ||
        String(i?.business_type || "").toLowerCase().includes("paid") ||
        i?.section_info ||
        i?.tips ||
        String(i?.type || "").toLowerCase().includes("ad")
      ));
      for (const card of obj.data) tryFillVideoId(card);
      fixPos(obj.data);
    }
    obj = stripAdsDeep(obj);
  }

  // 9) 问题回答列表：去广告/盐选/付费
  else if (url.includes("/questions/")) {
    delete obj?.ad_info;
    if (obj?.data?.ad_info) delete obj.data.ad_info;
    if (obj?.query_info) delete obj.query_info;
    lightCleanList(obj, ["data","items"]);
    obj = stripAdsDeep(obj);
  }

  // 10) 首页一级标签：仅留关注/热榜/推荐
  else if (url.includes("/root/tab")) {
    if (Array.isArray(obj?.tab_list) && obj.tab_list.length > 0) {
      obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
    }
    obj = stripAdsDeep(obj);
  }

  // 11) 热榜信息流/榜单
  else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
    if (obj?.data?.data?.length > 0) {
      obj.data.data = obj.data.data.filter((i) => !i.target?.metrics_area?.text?.includes?.("合作推广"));
      fixPos(obj.data.data);
    }
    obj = stripAdsDeep(obj);
  } else if (url.includes("/topstory/hot-lists/total")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => !Object.prototype.hasOwnProperty.call(i, "ad"));
      fixPos(obj.data);
    }
    obj = stripAdsDeep(obj);
  }

  // 12) 推荐信息流：去直播/聚合/伪装广告 + 修复视频 ID
  else if (url.includes("/topstory/recommend")) {
    if (Array.isArray(obj?.data) && obj.data.length > 0) {
      obj.data = obj.data.filter((i) => {
        // market_card：回填 videoID
        if (i?.type === "market_card" && i?.fields?.header?.url && i?.fields?.body?.video) {
          const videoID = getUrlParamValue(i.fields.header.url, "videoID");
          if (videoID) i.fields.body.video.id = videoID;
          return true;
        }
        // common_card：去直播/推广/盐选，尽量回填视频 id
        if (i?.type === "common_card") {
          if (i?.extra?.type === "drama" || i?.extra?.type === "live") return false;
          if (i?.extra?.type === "zvideo") {
            const videoUrl = i?.common_card?.feed_content?.video?.customized_page_url;
            const videoID = videoUrl ? getUrlParamValue(videoUrl, "videoID") : undefined;
            if (videoID) i.common_card.feed_content.video.id = videoID;
          }
          if (i?.common_card?.footline?.elements?.[0]?.text?.panel_text?.includes?.("广告")) return false;
          if (i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return false;
          if (i?.promotion_extra) return false;
          return true;
        }
        // 横排卡片/热榜聚合/伪装广告
        const t = String(i?.type || "").toLowerCase();
        if (t.includes("aggregation_card") || t.includes("feed_advert")) return false;
        return !shouldDropItem(i);
      });
      fixPos(obj.data);
    }
    obj = stripAdsDeep(obj);
  }

  // —— 兜底：对所有 JSON 做一次轻度净化（避免接口遗漏）——
  else {
    lightCleanList(obj, ["data","list","items","cards"]);
    obj = stripAdsDeep(obj);
  }
} catch (e) {
  // 最小可见性保护：任意异常不影响返回
  // $notification.post("Zhihu Cleaner", "处理异常", String(e));
}

/* --------------------- 结束返回 --------------------- */
$done({ body: JSON.stringify(obj) });
