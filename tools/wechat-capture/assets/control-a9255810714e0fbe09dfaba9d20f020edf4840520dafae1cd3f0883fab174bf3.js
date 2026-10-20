/* Temporary WeChat minimized collector. GPL-3.0-only. */
(function(){
var module={exports:{}};var STORE_KEY="owned.wx-capture.v1";var GATE_KEY="owned.wx-capture.v1.gate";
'use strict';
// Minimized observation only. This module never returns a network rewrite.
const TTL=300000,MAX_RECORDS=64,MAX_STORE=49152,MAX_BODY=65536;
const hosts=['mp.weixin.qq.com','api.weixin.qq.com','wxaapi.weixin.qq.com','ad.weixin.qq.com','wxad.weixin.qq.com','short.weixin.qq.com','long.weixin.qq.com','szshort.weixin.qq.com','szlong.weixin.qq.com','servicewechat.com','wxsnsdy.wxs.qq.com','wxsnsdythumb.wxs.qq.com','c.gdt.qq.com','d.gdt.qq.com','v.gdt.qq.com','canvas.gdt.qq.com','sdk.e.qq.com','pgdt.gtimg.cn'];
const segments=['cgi-bin','mmbiz-bin','mmoc-bin','ad','ads','api','v1','v2','report','getad','getadinfo','advert','addatareport','js-operatewxdata','js-operatewxdata-vip','js-operatewxdata-keepalive','js-operatewxdata-quic','mmtls'];
const methods=['GET','POST','HEAD','OPTIONS','PUT','PATCH','DELETE'];
const selectors=['webapi_getadvert','advert_report','webapi_advideo_report','webapi_adfollow_report','webapi_game_ad_report'];
const enums=selectors.concat(['banner','video','grid','custom','interstitial','interstitialAd','rewardedVideo','rewardedVideoAd','rewardAd','playable','directGame','show','hide','getad','report','weapp_comm']);
const containers=['data','result','request_data','response_data','advertisement_info','raw_ad_data'];
const ids=['ad_unit_id','adUnitId','unit-id','pos_id','appid','orig_weapp_id','image_url','click_url','ad_encrypted_data_list'];
const bools=['is_ads','is_ad','isAd','isEnded'];
const counts=['advertisement_num','report_type','pos_type','scene','scene_type','version_type','_omitted'];
const codes=['status','status_code','errcode','err_code','errno','ret','code'];
const enumKeys=['api_name','ad_type','adType','eventName','action','type'];
const queryKeys=ids.concat(enumKeys,counts);
const mimeTypes=['application/json','text/json','text/plain','application/octet-stream','application/x-protobuf','application/protobuf','text/html'];
function small(n,max){return Number.isSafeInteger(n)&&n>=0&&n<=max;}
function header(headers,name){if(!headers||typeof headers!=='object')return '';const k=Object.keys(headers).slice(0,128).find(x=>x.toLowerCase()===name);return k&&typeof headers[k]==='string'?headers[k]:'';}
function mime(value){const s=typeof value==='string'?value.split(';')[0].trim().toLowerCase():'';return mimeTypes.includes(s)?s:'other';}
function encoding(value){return ['gzip','br','deflate','identity'].includes(value)?value:'other';}
function bucket(value){const n=typeof value==='number'?value:typeof value==='string'&&/^\d{1,12}$/.test(value)?Number(value):0;return n<=0?0:n<=1024?1024:n<=4096?4096:n<=16384?16384:n<=65536?65536:262144;}
function safePath(value){if(typeof value!=='string')return '/[segment]';return '/'+value.split('/').filter(Boolean).slice(0,16).map(x=>{try{x=decodeURIComponent(x);}catch(_){return '[segment]';}return segments.includes(x)?x:'[segment]';}).join('/');}
function scalar(key,value){
 if(ids.includes(key))return '[redacted]';
 if(bools.includes(key))return typeof value==='boolean'?value:'[redacted]';
 if(counts.includes(key))return small(value,1000)?value:'[redacted]';
 if(codes.includes(key))return Number.isInteger(value)&&value>=-10&&value<=1008?value:'[redacted]';
 if(enumKeys.includes(key))return enums.includes(value)?value:'[redacted]';
 return '[redacted]';
}
function jsonSummary(value,depth){
 if(depth>6)return '[redacted]';
 if(typeof value==='string'){
  if(value.length>MAX_BODY)return '[redacted]';
  if(/^\s*[\[{]/.test(value))try{return jsonSummary(JSON.parse(value),depth+1);}catch(_){}
  return '[redacted]';
 }
 if(Array.isArray(value))return value.slice(0,5).map(x=>jsonSummary(x,depth+1));
 if(!value||typeof value!=='object')return '[redacted]';
 const out=Object.create(null);let omitted=0;
 for(const key of Object.keys(value).slice(0,128)){
  if(containers.includes(key))out[key]=jsonSummary(value[key],depth+1);
  else if(ids.includes(key)||bools.includes(key)||counts.includes(key)||codes.includes(key)||enumKeys.includes(key))out[key]=scalar(key,value[key]);
  else omitted++;
 }
 if(omitted)out._omitted=Math.min(omitted,1000);
 return out;
}
function safeQuery(value){const out=Object.create(null);if(value&&typeof value==='object')for(const key of queryKeys)if(Object.prototype.hasOwnProperty.call(value,key))out[key]=scalar(key,value[key]);return out;}
function urlInfo(value){
 if(typeof value!=='string'||value.length>16384)return null;
 const m=value.match(/^https?:\/\/([a-z0-9.-]+)(?::[0-9]{1,5})?(\/[^?#]*)?(?:\?([^#]*))?(?:#.*)?$/i);
 if(!m||!hosts.includes(m[1].toLowerCase()))return null;
 const query=Object.create(null);
 for(const pair of (m[3]||'').split('&').slice(0,128)){
  const at=pair.indexOf('=');let key=at<0?pair:pair.slice(0,at),value=at<0?'':pair.slice(at+1);
  try{key=decodeURIComponent(key);if(!queryKeys.includes(key))continue;value=decodeURIComponent(value.replace(/\+/g,' '));}catch(_){continue;}
  if(counts.includes(key)&&/^\d{1,4}$/.test(value))value=Number(value);
  query[key]=scalar(key,value);
 }
 return {host:m[1].toLowerCase(),path:safePath(m[2]||'/'),query};
}
function bodySummary(response){
 const value=response.body;
 if(typeof value!=='string')return {format:value===undefined?'unavailable':'binary'};
 if(value.length>MAX_BODY)return {format:'oversized'};
 if(!/^\s*[\[{]/.test(value))return {format:'opaque'};
 try{return {format:'json',json:jsonSummary(JSON.parse(value),0)};}catch(_){return {format:'malformed'};}
}
function storedRecord(r){
 if(!r||!hosts.includes(r.host)||!['request','response'].includes(r.stage))return null;
 const out={t:small(r.t,TTL)?r.t:0,stage:r.stage,method:methods.includes(r.method)?r.method:'OTHER',host:r.host,path:safePath(r.path),query:safeQuery(r.query),miniProgramReferer:r.miniProgramReferer===true};
 if(r.stage==='response'){
  const h=r.http||{},b=r.body||{};
  out.http={status:Number.isInteger(h.status)&&h.status>=100&&h.status<=599?h.status:0,mime:mime(h.mime),encoding:encoding(h.encoding),sizeBucket:bucket(h.sizeBucket)};
  out.body={format:['json','unavailable','binary','oversized','opaque','malformed'].includes(b.format)?b.format:'unavailable'};
  if(b.format==='json')out.body.json=jsonSummary(b.json,0);
 }
 return out;
}
function readState(raw){
 if(typeof raw!=='string'||raw.length>MAX_STORE*2)return null;
 let s;try{s=JSON.parse(raw);}catch(_){return null;}
 if(!s||s.schema!==1||!small(s.startedAt,9007199254000000)||!Array.isArray(s.records))return null;
 return {schema:1,startedAt:s.startedAt,until:s.startedAt+TTL,active:s.active===true,dropped:small(s.dropped,100000)?s.dropped:0,records:s.records.slice(0,MAX_RECORDS).map(storedRecord).filter(Boolean)};
}
function capture(raw,request,response,now){
 const state=readState(raw);if(!state||!state.active)return null;
 if(!Number.isSafeInteger(now)||now<state.startedAt||now>=state.until){state.active=false;return state;}
 const u=urlInfo(request&&request.url);if(!u)return null;
 const r={t:now-state.startedAt,stage:response===undefined?'request':'response',method:methods.includes(request.method)?request.method:'OTHER',host:u.host,path:u.path,query:u.query,miniProgramReferer:/^https:\/\/servicewechat\.com\/wx[0-9a-f]{16}\//i.test(header(request.headers,'referer'))};
 if(response!==undefined){r.http={status:Number.isInteger(response.statusCode)&&response.statusCode>=100&&response.statusCode<=599?response.statusCode:0,mime:mime(header(response.headers,'content-type')),encoding:encoding(header(response.headers,'content-encoding')),sizeBucket:bucket(header(response.headers,'content-length'))};r.body=bodySummary(response);}
 if(state.records.length>=MAX_RECORDS){state.active=false;state.dropped++;return state;}
 state.records.push(r);
 if(JSON.stringify(state).length>MAX_STORE){state.records.pop();state.active=false;state.dropped++;}
 if(state.records.length>=MAX_RECORDS)state.active=false;
 return state;
}
function control(action,raw,now){
 if(action==='clear')return {state:null,kind:'clear'};
 if(action==='start')return {state:{schema:1,startedAt:now,until:now+TTL,active:true,dropped:0,records:[]},kind:'start'};
 const state=readState(raw);
 if(state&&(now<state.startedAt||now>=state.until||action==='export'))state.active=false;
 const out={state,kind:action==='export'?'export':'status'};
 if(action==='export')out.report={format:'wx-capture-v1',privacy:'allowlist-summary-not-raw-traffic',duration_ms:state?Math.max(0,Math.min(TTL,now-state.startedAt)):0,records:state?state.records:[],dropped:state?state.dropped:0,limitations:['No app/process attribution; exact-host candidates only.','No added MITM, no request bodies, no raw headers or identifiers.','Unknown path segments redacted; opaque/binary bodies omitted.','Concurrent preference writes can lose records; this is not a complete packet capture.','No new network requests are made by these scripts.']};
 return out;
}
module.exports={capture,control,hosts};

// Runs only when the user taps an event-interaction task. No uploads/fetches.
try {
  var action='status';
  var environment=typeof $environment==='undefined'?{}:$environment;
  var match=String(environment.sourcePath||'').match(/[#&]action=(start|export|status|clear)(?:&|$)/);
  if(match)action=match[1];
  if(environment.variables&&['start','export','status','clear'].indexOf(environment.variables.action)>=0)action=environment.variables.action;
  if(['start','export','clear'].indexOf(action)>=0){
    $prefs.setValueForKey('off',GATE_KEY);
    if($prefs.valueForKey(GATE_KEY)!=='off')throw new Error('storage unavailable');
  }
  var result=module.exports.control(action,$prefs.valueForKey(STORE_KEY),Date.now());
  if(action==='status'&&result.state&&$prefs.valueForKey(GATE_KEY)!==String(result.state.startedAt))result.state.active=false;
  if(result.state===null){
    if(action==='clear'){$prefs.removeValueForKey(STORE_KEY);if($prefs.valueForKey(STORE_KEY))throw new Error('storage unavailable');}
  } else {
    var serialized=JSON.stringify(result.state);
    $prefs.setValueForKey(serialized,STORE_KEY);
    if($prefs.valueForKey(STORE_KEY)!==serialized)throw new Error('storage unavailable');
  }
  if(action==='start'){
    $prefs.setValueForKey(String(result.state.startedAt),GATE_KEY);
    if($prefs.valueForKey(GATE_KEY)!==String(result.state.startedAt))throw new Error('storage unavailable');
  }
  if(action==='clear'){$prefs.removeValueForKey(GATE_KEY);if($prefs.valueForKey(GATE_KEY))throw new Error('storage unavailable');}
  if(action==='export'){
    var json=JSON.stringify(result.report,null,2),saved=false;
    var file='wechat-capture/wx-capture-'+Date.now()+'.json';
    try {if(typeof $iCloud!=='undefined'&&typeof TextEncoder!=='undefined')saved=$iCloud.writeFile(new TextEncoder().encode(json),file)===true;}catch(_){}
    if(saved)$notify('微信临时采集','已停止并导出到你的 iCloud Drive','Quantumult X/Data/'+file+'；发送前请人工检查。');
    else {console.log('WX_CAPTURE_EXPORT_BEGIN\n'+json+'\nWX_CAPTURE_EXPORT_END');$notify('微信临时采集','已停止，iCloud 文件导出未成功','仅复制日志中 WX_CAPTURE_EXPORT_BEGIN/END 之间的 JSON，不要分享整份 QX 日志。');}
  } else if(action==='start')$notify('微信临时采集','新采样已开始，旧采样已清空','最多 5 分钟或 64 条摘要；不新增 MITM，不修改流量。');
  else if(action==='clear')$notify('微信临时采集','仅已清除本工具的本地采样','已经导出的 iCloud 文件需自行管理；其他脚本数据未改动。');
  else $notify('微信临时采集',result.state&&result.state.active?'采集中':'未采集',String(result.state?result.state.records.length:0)+' 条摘要；未解密、已拒绝或专有通道可能没有记录。');
} catch (_) {
  $notify('微信临时采集','操作失败','未输出原始请求。请手动停用临时重写，并检查 QX 版本、脚本下载及存储权限。');
} finally {
  $done({});
}

})();
