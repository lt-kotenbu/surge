/*********************************************************
 * Zhihu 去广告（增强重构版）
 * 引用基础脚本： https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/zhihu.js
 * 说明：
 *  - 在不改变“已有去广告效果”的前提下，统一了流程与结构，只保留一次 $done 调用；
 *  - 修复了多处潜在 BUG（见注释），增强容错，提升可维护性与可读性；
 *  - 新增可选“白名单/黑名单”与“兜底匹配规则（正则）”；
 *  - 默认仅对已知广告相关接口进行修改，其他接口一律放行。
 *
 * 适用环境：Quantumult X / Surge（脚本-响应类）
 * 最后生成：2025-11-08 21:02:25
 **********************************************************/

/* ----------------------- 可配置区（按需调整） ----------------------- */

/** 是否用 204 空响应替换开屏/冷启动广告（默认 false：返回最小安全 JSON） */
const RETURN_204_FOR_LAUNCH = false;

/** 开屏/冷启动广告接口（命中后触发“最小安全返回”或 204） */
const LAUNCH_URL_RULES = [
  /https?:\/\/api\.zhihu\.com\/commercial_api\/real_time_launch_v2\b/i,
  // 如需扩展变体，可解注下一行：
  // /https?:\/\/api\.zhihu\.com\/commercial_api\/real_time_launch_v\d+\b/i,
];

/** 自定义“白名单/黑名单”。白名单优先级高于黑名单 */
const CUSTOM_ALLOWLIST = [
  // 例：/https?:\/\/api\.zhihu\.com\/some\/safe\/endpoint\b/i,
];
const CUSTOM_BLOCKLIST = [
  // 例：/https?:\/\/api\.zhihu\.com\/maybe\/ad\b/i,
];

/** 兜底“广告/广告位”接口正则（仅在未命中具体分支时用于轻度清理 payload） */
const AD_ENDPOINT_REGEXPS = [
  /\/topstory\/recommend\b/i,
  /\/next-render\b/i,
  /\/commercial(?:_api)?\b/i,
  /\b(?:\/ssp|\/dsp|\/adx|\/adserver)\b/i,
  /\/brand.*?(ad|sponsor|promo)/i,
  /adsrvr\.org/i,
  /\/commercial_api\/app_float_layer\b/i,
  /\/topstory\/hot-lists\//i,
];

/** 最小、通用的“无内容”JSON 结构，尽量不引发客户端错误 */
const MIN_SAFE_JSON = {
  code: 0,
  message: "ok",
  data: [],
  paging: { is_end: true, next: null },
};

/** “未来时间”常量（2090-12-31），用于规避灰度/黑白主题等 */
const FUTURE_TS_S = { start: 3818332800, end: 3818419199 }; // 秒
const FUTURE_TS = { start: String(FUTURE_TS_S.start), end: String(FUTURE_TS_S.end) };

/* ----------------------- 工具方法 ----------------------- */

/** 是否 JSON 字符串 */
function isLikelyJSON(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t.startsWith("{") || t.startsWith("[");
}

/** 安全解析 JSON（失败返回 null） */
function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 统一设置 JSON 响应头 */
function ensureJSONHeaders(headers) {
  const out = Object.assign({}, headers || {});
  out["Content-Type"] = "application/json; charset=utf-8";
  return out;
}

/** 包装一次性完成响应 */
function respond(payload) {
  // 约束：始终只调用一次 $done
  $done(payload || {});
}

/** URL 是否匹配任一正则 */
function matchAny(url, reList) {
  try {
    return reList.some((re) => re.test(url));
  } catch {
    return false;
  }
}

/** 兼容 includes（允许数组/空值） */
function includesStr(hay, needle) {
  if (hay == null || needle == null) return false;
  if (Array.isArray(hay)) return hay.some((v) => String(v).includes(needle));
  return String(hay).includes(needle);
}

/** 仅用于“开屏/冷启动”方案：在保形前提下广泛清空广告相关字段与数组 */
function deepCleanForLaunch(obj) {
  if (obj == null) return MIN_SAFE_JSON;

  const AD_KEYS = [
    "ad", "ads", "adInfo", "ad_info", "adverts", "advertisements", "advert",
    "banners", "banner", "launch", "splash", "promotion", "promotions",
    "creative", "creatives", "materials", "slots", "slot", "items", "list"
  ];

  const clean = (o) => {
    if (Array.isArray(o)) return []; // 数组直接置空（开屏接口通常全是广告）
    if (o && typeof o === "object") {
      const ret = {};
      for (const [k, v] of Object.entries(o)) {
        if (AD_KEYS.includes(k)) {
          ret[k] = Array.isArray(v) ? [] : (v && typeof v === "object" ? {} : null);
        } else {
          ret[k] = clean(v);
        }
      }
      return ret;
    }
    return o;
  };

  const cleaned = clean(obj);
  // 补齐最小安全字段，避免客户端因缺失字段报错
  return Object.assign({}, MIN_SAFE_JSON, cleaned);
}

/** 通用广告元素轻度清理器（幂等） */
function sanitizeAdPayload(root) {
  if (root == null) return root;

  // 1) 删除“明显是广告”的键，避免误伤
  const AD_KEYS = [
    "ad", "ad_info", "adjson", "ads", "advert", "advert_info",
    "promotion_extra", "recommend_info", "metrics_area",
    "market_card", "feed_advert"
  ];
  try {
    for (const k of AD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(root, k)) delete root[k];
    }
  } catch (_) {}

  // 2) 常见集合中过滤广告项
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

/** 修正 feed item 的 offset 顺序（1 起始） */
function fixPos(arr) {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) {
    try { arr[i].offset = i + 1; } catch (_) {}
  }
}

/** 提取 URL 查询参数（容错） */
function getUrlParamValue(u, key) {
  if (!u || !key) return "";
  const qIndex = u.indexOf("?");
  if (qIndex === -1) return "";
  const q = u.slice(qIndex + 1).split("&");
  for (const pair of q) {
    const [k, v = ""] = pair.split("=");
    try {
      if (decodeURIComponent(k) === key) return decodeURIComponent(v);
    } catch (_) {
      // 逐步降级
      if (k === key) return v;
    }
  }
  return "";
}

/* ----------------------- 主流程（只调用一次 $done） ----------------------- */

(function main() {
  const url = ($request && $request.url) || "";
  const rawBody = ($response && $response.body) || "";

  // 1) 没有响应体 → 放行
  if (!rawBody) return respond({});

  // 2) 白名单优先：命中直接放行
  if (matchAny(url, CUSTOM_ALLOWLIST)) return respond({});

  // 3) “开屏/冷启动”或自定义黑名单：最小安全返回 或 204
  if (matchAny(url, LAUNCH_URL_RULES) || matchAny(url, CUSTOM_BLOCKLIST)) {
    if (RETURN_204_FOR_LAUNCH) {
      return respond({
        status: 204,
        headers: ensureJSONHeaders($response && $response.headers),
        body: ""
      });
    }
    const parsed = isLikelyJSON(rawBody) ? safeParseJSON(rawBody) : null;
    const out = parsed ? deepCleanForLaunch(parsed) : MIN_SAFE_JSON;
    return respond({
      status: 200,
      headers: ensureJSONHeaders($response && $response.headers),
      body: JSON.stringify(out)
    });
  }

  // 4) 非 JSON → 放行（避免破坏非 JSON 资源）
  if (!isLikelyJSON(rawBody)) return respond({});

  // 5) 解析 JSON，失败则放行
  let obj = safeParseJSON(rawBody);
  if (!obj) return respond({});

  // 6) 逐类接口精细处理（保持原有效果，修复若干判断 BUG）

  // 回答/文章列表中的“相关提问”
  if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
    if (obj?.third_business?.related_queries?.queries?.length) {
      obj.third_business.related_queries.queries = [];
    }

  // 全局配置：屏蔽灰度主题 & 顶部背景限时
  } else if (url.includes("/api/cloud/zhihu/config/all")) {
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

  // answers v4：删除 data/paging（常见广告/推荐容器）
  } else if (url.includes("/api/v4/answers")) {
    delete obj?.data;
    delete obj?.paging;

  // articles v4：移除广告、翻页、推荐信息
  } else if (url.includes("/api/v4/articles")) {
    ["ad_info", "paging", "recommend_info"].forEach((k) => { try { delete obj[k]; } catch (_) {} });

  // ⚠ 修复 BUG：原判断写成了 "/appcloud2.zhihu.com/v3/config"（带前导斜杠）永远不命中
  } else if (url.includes("appcloud2.zhihu.com/v3/config")) {
    if (obj?.config?.hp_channel_tab) delete obj.config.hp_channel_tab;
    if (obj?.config) {
      // 收敛 Tab，仅保留 activity_tab（并推迟到未来）
      if (obj.config?.homepage_feed_tab?.tab_infos) {
        obj.config.homepage_feed_tab.tab_infos = obj.config.homepage_feed_tab.tab_infos.filter((t) => {
          if (t?.tab_type === "activity_tab") {
            t.start_time = FUTURE_TS.start;
            t.end_time = FUTURE_TS.end;
            return true;
          }
          return false;
        });
      }
      if (obj.config?.zombie_conf) obj.config.zombie_conf.zombieEnable = false;
      if (obj.config?.gray_mode) {
        obj.config.gray_mode.enable = false;
        obj.config.gray_mode.start_time = FUTURE_TS.start;
        obj.config.gray_mode.end_time = FUTURE_TS.end;
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

  // 悬浮图标：直接置空对象
  } else if (url.includes("/commercial_api/app_float_layer")) {
    obj = {};

  // 首页二级标签：仅保留 recommend/section
  } else if (url.includes("/feed/render/tab/config")) {
    if (Array.isArray(obj?.selected_sections)) {
      obj.selected_sections = obj.selected_sections.filter((i) => ["recommend", "section"].includes(i?.tab_type));
    }

  // moments：屏蔽“为您推荐”
  } else if (url.includes("/moments_v3")) {
    if (Array.isArray(obj?.data)) {
      obj.data = obj.data.filter((i) => !String(i?.title || "").includes("为您推荐"));
    }

  // next-bff 信息流：过滤广告/推荐导流
  } else if (url.includes("/next-bff")) {
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

  // next-data：过滤广告/盐选
  } else if (url.includes("/next-data")) {
    if (Array.isArray(obj?.data?.data)) {
      obj.data.data = obj.data.data.filter((i) => !(includesStr(i?.type, "ad") || includesStr(i?.data?.answer_type, "PAID")));
    }

  // next-render：过滤多种业务类型与广告
  } else if (url.includes("/next-render")) {
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

  // 问题详情页：清理广告与付费答案
  } else if (url.includes("/questions/")) {
    try { delete obj.ad_info; } catch (_) {}
    try { delete obj?.data?.ad_info; } catch (_) {}
    try { delete obj.query_info; } catch (_) {}
    if (Array.isArray(obj?.data)) {
      obj.data = obj.data.filter((i) => !includesStr(i?.target?.answer_type, "paid"));
    }

  // 首页一级标签：仅保留关注/热榜/推荐
  } else if (url.includes("/root/tab")) {
    if (Array.isArray(obj?.tab_list)) {
      obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
    }

  // 热榜信息流：去“合作推广”
  } else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
    if (Array.isArray(obj?.data?.data)) {
      obj.data.data = obj.data.data.filter((i) => !String(i?.target?.metrics_area?.text || "").includes("合作推广"));
   
