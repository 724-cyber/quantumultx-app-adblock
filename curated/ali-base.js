/* 闲鱼 + 淘宝去广告：由已复核的独立脚本自动合并。
 * 离线运行；没有下载、更新或外发数据的代码。Android静态适配，iOS待实测。
 */
(function (request, response, done) {
  "use strict";
  if (typeof done !== "function") return;
  var finished = false;
  var $request = request || {}, $response = response;
  function $done(value) { if (!finished) { finished = true; done(value || {}); } }
  var url = $request.url || "";
  try {
    if (new RegExp("^https?:\\/\\/(?:(?:g-)?acs\\.m\\.goofish\\.com|(?:channel-)?acs\\.m\\.taobao\\.com)\\/(?:gw|h5)\\/mtop\\.taobao\\.idlecommerce\\.splash\\.(?:async\\.)?ads\\/\\d+(?:\\.\\d+)*\\/?(?:\\?[^#]*)?$").test(url)) { runXianyuResponse(); return; }
    if (new RegExp("^https?:\\/\\/(?:(?:g-)?acs\\.m\\.goofish\\.com|(?:channel-)?acs\\.m\\.taobao\\.com)\\/(?:gw|h5)\\/(?:mtop\\.taobao\\.idlehome\\.home\\.nextfresh|mtop\\.taobao\\.wireless\\.home\\.xianyu\\.awesome\\.get|mtop\\.taobao\\.idle\\.home\\.(?:myattention|moore\\.section)|mtop\\.taobao\\.idle\\.local\\.(?:home(?:\\.(?:top|feeds))?|flow\\.plat\\.section))\\/\\d+(?:\\.\\d+)*\\/?(?:\\?[^#]*)?$").test(url)) { runXianyuResponse(); return; }
    if (new RegExp("^https?:\\/\\/(?:(?:g-)?acs\\.m\\.goofish\\.com|(?:channel-)?acs\\.m\\.taobao\\.com)\\/(?:gw|h5)\\/mtop\\.idle\\.ad\\.(?:click|expose|failed\\.batch\\.(?:click|expose))\\/1\\.0\\/?(?:\\?[^#]*)?$").test(url)) { runXianyuTelemetry(); return; }
    if (new RegExp("^https?:\\/\\/(?:guide-)?acs\\.m\\.taobao\\.com\\/(?:gw|h5)\\/mtop\\.taobao\\.wireless\\.home\\.splash\\.awesome\\.get\\/1\\.0\\/?(?:\\?[^#]*)?$").test(url)) { runTaobaoResponse(); return; }
    if (new RegExp("^https?:\\/\\/(?:guide-)?acs\\.m\\.taobao\\.com\\/(?:gw|h5)\\/(?:mtop\\.taobao\\.wsearch\\.appsearch|mtop\\.relationrecommend\\.[Mm]top[Rr]ecommend\\.recommend)\\/1\\.0\\/?(?:\\?[^#]*)?$").test(url)) { runTaobaoResponse(); return; }
  } catch (error) {
    console.log("[App Adblock] unchanged: " + String(error));
  } finally { if (!finished) $done({}); }

  function runXianyuResponse() {
/*
 * Xianyu ad response filter for Quantumult X.
 * Static-analysis target: com.taobao.idlefish 7.27.96.6 (versionCode 526).
 *
 * Copy this file to "On My iPhone/Quantumult X/Scripts" or the matching
 * iCloud Drive Scripts directory, then enable xianyu-adblock.conf.
 */

"use strict";

const SPLASH_APIS = new Set([
  "mtop.taobao.idlecommerce.splash.ads",
  "mtop.taobao.idlecommerce.splash.async.ads"
]);
const FEED_APIS = new Set([
  "mtop.taobao.idlehome.home.nextfresh",
  "mtop.taobao.wireless.home.xianyu.awesome.get",
  "mtop.taobao.idle.home.myattention",
  "mtop.taobao.idle.home.moore.section",
  "mtop.taobao.idle.local.home",
  "mtop.taobao.idle.local.home.top",
  "mtop.taobao.idle.local.home.feeds",
  "mtop.taobao.idle.local.flow.plat.section"
]);
const COLLECTION_KEYS = new Set(["components", "sections", "headers", "homeTopList", "items", "itemList", "cards", "list", "feeds", "item"]);
const WRAPPER_KEYS = new Set(["data", "result"]);
const AD_TEMPLATES = new Set([
  "idlefish_home_local_ad_banner_d3",
  "xianyu_home_idlefish_home_local_ad_banner_d3",
  "fish_home_advertise_card_d3",
  "fish_home_advertise_card_d4",
  "fish_local_advertise_card_d4"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requestApi(url) {
  const match = /^https?:\/\/(?:(?:g-)?acs\.m\.goofish\.com|(?:channel-)?acs\.m\.taobao\.com)\/(?:gw|h5)\/([a-z0-9.]+)\/\d+(?:\.\d+)*\/?(?:\?[^#]*)?$/i.exec(url);
  return match ? match[1].toLowerCase() : null;
}

function trueFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function nonzeroId(value) {
  return typeof value === "number" ? value > 0 :
    typeof value === "string" && value.trim() !== "" && value.trim() !== "0";
}

function isAdItem(item) {
  if (!isRecord(item)) return false;
  const content = item.exContent;
  // DXRecommendCardTapEventHandler: both fields are required for its ad branch.
  if (isRecord(content) && content.bizType === "mamaAD" && trueFlag(content.isAd)) return true;
  // FishAdService -> FishADModel.create requires this pair in the event's args.
  return ["clickParam", "exposureParam"].some((key) => {
    const event = item[key];
    const args = isRecord(event) ? event.args : null;
    return isRecord(args) && nonzeroId(args.idle_ad_cid) && nonzeroId(args.idle_ad_track);
  });
}

function isItemMapKey(key) {
  return key === "main" || /^(?:0|[1-9]\d*)$/.test(key);
}

// Called only at a known card/component collection boundary, never on the envelope.
function isAdNode(object) {
  if (!isRecord(object)) return false;
  const views = isRecord(object.data) ? [object, object.data] : [object];
  return views.some((view) => {
    const template = view.template;
    if (isRecord(template) && typeof template.name === "string" && AD_TEMPLATES.has(template.name.toLowerCase())) return true;
    if (isAdItem(view)) return true;
    if (!isRecord(view.item)) return false;
    const keys = Object.keys(view.item);
    // Drop an all-ad wrapper as a unit; retain mixed wrappers and filter their entries.
    return keys.length > 0 && keys.every(isItemMapKey) && keys.every((key) => isAdItem(view.item[key]));
  });
}

function cleanFeed(value, state, depth = 0) {
  if (!isRecord(value) || depth > 30) return value;
  const output = { ...value };
  for (const [key, child] of Object.entries(value)) {
    if (WRAPPER_KEYS.has(key) && isRecord(child)) {
      output[key] = cleanFeed(child, state, depth + 1);
    } else if (COLLECTION_KEYS.has(key) && Array.isArray(child)) {
      output[key] = child.filter((entry) => {
        if (!isAdNode(entry)) return true;
        state.removed += 1;
        return false;
      }).map((entry) => cleanFeed(entry, state, depth + 1));
    } else if (key === "item" && isRecord(child)) {
      // Dynamic templates use numeric/main-keyed maps; preserve surviving keys.
      const items = { ...child };
      for (const [index, entry] of Object.entries(child)) {
        if (!isItemMapKey(index)) continue;
        if (isAdNode(entry)) {
          delete items[index];
          state.removed += 1;
        } else {
          items[index] = cleanFeed(entry, state, depth + 1);
        }
      }
      output[key] = items;
    }
  }
  return output;
}

function filterPayload(payload, url = "") {
  const unchanged = { payload, removed: 0, changed: false, mode: "unchanged" };
  const api = requestApi(url);
  if (!api || !isRecord(payload) || !isRecord(payload.data)) return unchanged;
  if (typeof payload.api === "string" && payload.api.toLowerCase() !== api) return unchanged;
  if (Object.prototype.hasOwnProperty.call(payload, "ret") && !Array.isArray(payload.ret)) return unchanged;
  if (Array.isArray(payload.ret) && !payload.ret.some((code) => /^SUCCESS(?:::|$)/i.test(code))) return unchanged;

  if (SPLASH_APIS.has(api)) {
    const data = { ...payload.data };
    if (data.adMap != null && !isRecord(data.adMap)) return unchanged;
    if (data.dspList != null && !Array.isArray(data.dspList)) return unchanged;
    for (const key of ["cacheAdInfo", "realTimeAd"]) {
      if (data[key] != null && !isRecord(data[key])) return unchanged;
    }
    let changed = false;
    // Keep interval, blacklist, config, serverTime, requestId and other metadata.
    for (const key of ["adMap", "cacheAdInfo", "realTimeAd", "dspList"]) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const empty = key === "adMap" ? {} : key === "dspList" ? [] : null;
      if (JSON.stringify(data[key]) !== JSON.stringify(empty)) changed = true;
      data[key] = empty;
    }
    return { payload: changed ? { ...payload, data } : payload,
      removed: changed ? 1 : 0, changed, mode: "splash" };
  }

  if (!FEED_APIS.has(api)) return unchanged;
  const state = { removed: 0 };
  const data = cleanFeed(payload.data, state);
  return { payload: state.removed ? { ...payload, data } : payload,
    removed: state.removed, changed: state.removed > 0, mode: "feed-filter" };
}

function hasUnsafeInteger(body) {
  // Skip quoted strings when scanning JSON number tokens. Do not round product IDs.
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let match;
  while ((match = tokens.exec(body)) !== null) {
    if (match[0][0] === '"') continue;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) return true;
  }
  return false;
}

function runQuantumultX() {
  let output = {};
  try {
    const body = $response.body;
    if (typeof body !== "string" || hasUnsafeInteger(body)) {
      console.log("[Xianyu Ad Filter] unchanged: unsupported body or unsafe integer");
    } else {
      const result = filterPayload(JSON.parse(body), $request.url || "");
      console.log(`[Xianyu Ad Filter] mode=${result.mode}, changed=${result.changed}, removed=${result.removed}`);
      if (result.changed) output = { body: JSON.stringify(result.payload) };
    }
  } catch (error) {
    console.log(`[Xianyu Ad Filter] unchanged: ${String(error)}`);
  }
  $done(output);
}

if (typeof $response !== "undefined" && typeof $done === "function") {
  runQuantumultX();
}

if (typeof module !== "undefined") {
  module.exports = { filterPayload, isAdNode };
}

  }

  function runXianyuTelemetry() {
/*
 * Quantumult X script-echo-response: stop the four statically confirmed Xianyu
 * ad reporting requests before forwarding, including persistent batch retries.
 * The Android business callbacks ignore response data after MTop SUCCESS.
 * Acceptance by a real iOS MTop client remains unverified.
 */
"use strict";

function telemetryResponse(url) {
  const match = /^https?:\/\/(?:(?:g-)?acs\.m\.goofish\.com|(?:channel-)?acs\.m\.taobao\.com)\/(?:gw|h5)\/(mtop\.idle\.ad\.(?:click|expose|failed\.batch\.(?:click|expose)))\/1\.0\/?(?:\?[^#]*)?$/i.exec(url);
  if (!match) return {};
  return {
    status: "HTTP/1.1 200 OK",
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify({ api: match[1].toLowerCase(), v: "1.0", ret: ["SUCCESS::LOCAL_AD_TELEMETRY_BLOCKED"], data: {} })
  };
}

if (typeof $request !== "undefined" && typeof $done === "function") {
  const response = telemetryResponse($request.url || "");
  console.log("[Xianyu Ad Telemetry] " + (response.status ? "local response" : "out of scope"));
  $done(response);
}

if (typeof module !== "undefined") module.exports = { telemetryResponse };

  }

  function runTaobaoResponse() {
/* 淘宝 10.66.40 Android 静态适配；未经过 iOS/Quantumult X 实机验证。
 * REA: shj.t/w/A/y + mh1.a; lh2.c/H/h + ph2.m/C.
 */
(function () {
  "use strict";
  var original = typeof $response !== "undefined" && $response.body;
  var url = typeof $request !== "undefined" ? $request.url || "" : "";
  function finish(body) { $done(body === undefined ? {} : { body: body }); }
  try {
    var match = /^https?:\/\/(?:guide-)?acs\.m\.taobao\.com\/(?:gw|h5)\/(mtop\.taobao\.wsearch\.appsearch|mtop\.relationrecommend\.mtoprecommend\.recommend|mtop\.taobao\.wireless\.home\.splash\.awesome\.get)\/1\.0\/?(?:\?[^#]*)?$/i.exec(url);
    if (!match || typeof original !== "string" || original.length > 2097152) return finish();
    var unsafe = false;
    original.replace(/"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, function (token, number) {
      if (number && (!isFinite(Number(number)) || Math.abs(Number(number)) > 9007199254740991)) unsafe = true;
      return token;
    });
    if (unsafe) return finish();
    var response = JSON.parse(original);
    if (!response || !Array.isArray(response.ret) || !response.ret.some(function (code) { return typeof code === "string" && /^SUCCESS::/.test(code); })) return finish();
    if (response.api && String(response.api).toLowerCase() !== match[1].toLowerCase()) return finish();
    var data = response.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return finish();
    var changed = false;
    if (match[1].toLowerCase() === "mtop.taobao.wireless.home.splash.awesome.get") {
      var container = data.containers && data.containers.splash_home_base;
      var top = container && container.base && container.base.topViewSplashSection;
      if (top && Array.isArray(top.sections)) {
        var sections = top.sections.filter(function (section) {
          var remove = section && section.ext && section.ext.businessCode === "taobaoSplashAdv";
          if (remove) changed = true;
          return !remove;
        });
        if (changed) top.sections = sections;
      }
      return finish(changed ? JSON.stringify(response) : undefined);
    }
    function yes(value) { return value === true || value === "true"; }
    function headerFlag(value) { return yes(value) || value === 1 || value === "1"; }
    function clean(group) {
      if (!group || !Array.isArray(group.itemsArray)) return;
      var kept = group.itemsArray.filter(function (card) {
        var remove = card && typeof card === "object" && !headerFlag(card.isFilterBar) && card.cardType === "item" && yes(card.isP4p);
        if (remove) changed = true;
        return !remove;
      });
      if (kept.length !== group.itemsArray.length) group.itemsArray = kept;
    }
    if (data.singleCombo == null) clean(data);
    else if (typeof data.singleCombo === "object" && !Array.isArray(data.singleCombo)) clean(data.singleCombo);
    ["newSearchHeader", "newSearchFooter"].forEach(function (key) {
      if (Array.isArray(data[key])) data[key].forEach(clean);
    });
    return finish(changed ? JSON.stringify(response) : undefined);
  } catch (error) {
    return finish();
  }
}());

  }

})(typeof $request === "undefined" ? {} : $request, typeof $response === "undefined" ? undefined : $response, typeof $done === "function" ? $done : undefined);
