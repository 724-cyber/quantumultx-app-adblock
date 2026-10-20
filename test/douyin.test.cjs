"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {handle}=require('../curated/douyin-filter.cjs');
const feed='https://aweme.snssdk.com/aweme/v2/feed/?count=20';
const preload='https://aweme.snssdk.com/api/ad/splash/aweme/v14/';
const realtime='https://aweme.snssdk.com/api/ad/splash/realtime/aweme/v14/';
function run(url,body){return handle({url},{body:typeof body==='string'?body:JSON.stringify(body)});}
test('drops explicit video and game ads without deleting organic game content or changing paging',()=>{
  const body={status_code:0,aweme_list:[{aweme_id:'ordinary',video:{cover:{url_list:['cover']}}},{aweme_id:'ad',is_ads:true,raw_ad_data:{}},{aweme_id:'game-ad',is_ads:true,raw_ad_data:{game_info:{}}},{aweme_id:'game-creator',is_ads:false,game_info:{game_id:'1'},anchor_info:{type:13017}}],has_more:1,max_cursor:123};
  const out=run(feed,body);assert(out?.body);
  assert.deepEqual(JSON.parse(out.body),{status_code:0,aweme_list:[body.aweme_list[0],body.aweme_list[3]],has_more:1,max_cursor:123});
});
test('picture and multi-image types are preserved unless the actual ad joint condition is met',()=>{
  const rows=[{aweme_type:2,images:[{}]},{aweme_type:68,images:[{}]},{aweme_type:68,images:[{}],is_ads:true,raw_ad_data:{}}];
  const out=run(feed,{status_code:0,aweme_list:rows});assert.deepEqual(JSON.parse(out.body).aweme_list,rows.slice(0,2));
});
test('raw_ad_data alone, null data, generic flags and title keywords never delete a row',()=>{
  const body=JSON.stringify({status_code:0,aweme_list:[{raw_ad_data:{}},{is_ads:true,raw_ad_data:null},{is_ads:true},{is_ads:false,raw_ad_data:{}},{is_ad:true,ad_info:{}},{desc:'广告 游戏 领取福利',aweme_type:68}]});
  assert.deepEqual(run(feed,body),{});
});
test('feed preload_ads are filtered using the same joint predicate rather than entirely cleared',()=>{
  const out=run(feed,{status_code:0,aweme_list:[],preload_ads:[{aweme_id:'organic'},{is_ads:true,raw_ad_data:{}}],has_more:1});
  assert.deepEqual(JSON.parse(out.body),{status_code:0,aweme_list:[],preload_ads:[{aweme_id:'organic'}],has_more:1});
});
test('large integers, exponent notation and escaping outside deleted rows retain their exact bytes',()=>{
  const body='{ "status_code":0, "aweme_list" : [ {"id":9223372036854775807,"s":"brace } quote \\\" \\u6e38","n":1.2300e+27}, {"is_ads":true,"raw_ad_data":{"ad_id":9223372036854775806}} ], "cursor":9223372036854775805,"extra":"comma , [ ]" }';
  const out=run(feed,body);assert(out?.body);assert(out.body.includes('"id":9223372036854775807'));assert(out.body.includes('"n":1.2300e+27'));assert(out.body.includes('"cursor":9223372036854775805'));assert(out.body.includes('\\u6e38'));assert(!out.body.includes('"ad_id"'));assert.equal(JSON.parse(out.body).aweme_list.length,1);
});
test('unknown nested lists are not recursively hunted',()=>{
  const body=JSON.stringify({status_code:0,data:{aweme_list:[{is_ads:true,raw_ad_data:{}}]},other:[{is_ads:true,raw_ad_data:{}}]});
  assert.deepEqual(run(feed,body),{});
});
test('error responses, non-JSON, binary-shaped body and malformed structures remain unchanged',()=>{
  const cases=['not-json','{"status_code":0,"aweme_list":',JSON.stringify({status_code:8,aweme_list:[{is_ads:true,raw_ad_data:{}}]}),JSON.stringify({aweme_list:[{is_ads:true,raw_ad_data:{}}]}),JSON.stringify({status_code:0,aweme_list:{item:{is_ads:true,raw_ad_data:{}}}})];
  for(const b of cases)assert.deepEqual(run(feed,b),{});
  assert.deepEqual(handle({url:feed},{body:new Uint8Array([1,2,3])}),{});
});
test('duplicate target properties are treated as an ambiguous schema',()=>{
  const body='{"status_code":0,"aweme_list":[],"aweme_list":[{"is_ads":true,"raw_ad_data":{}}]}';assert.deepEqual(run(feed,body),{});
});
test('duplicate ad-decision fields, including escaped key aliases, never rely on JS last-key semantics',()=>{
  const rows=['{"is_ads":false,"is_ads":true,"raw_ad_data":{}}','{"is_ads":true,"is_ads":false,"raw_ad_data":{}}','{"is_ads":false,"is_\\u0061ds":true,"raw_ad_data":{}}','{"is_ads":true,"raw_ad_data":null,"raw_ad_data":{}}'];
  for(const row of rows)assert.deepEqual(run(feed,'{"status_code":0,"aweme_list":['+row+',{ "is_ads":true,"raw_ad_data":{} }]}'),{});
});
test('duplicate status and cache-control decisions remain unchanged rather than guessing client parsing',()=>{
  assert.deepEqual(run(feed,'{"status_code":1,"status_code":0,"aweme_list":[{"is_ads":true,"raw_ad_data":{}}]}'),{});
  assert.deepEqual(run(preload,'{"code":1,"code":0,"data":{"splash":[{}]}}'),{});
  assert.deepEqual(run(preload,'{"code":0,"data":{"splash":[{}],"no_change_show_list":true,"no_change_show_list":false}}'),{});
});
test('duplicate splash arrays are ambiguous even when the last value is not an array',()=>{
  assert.deepEqual(run(preload,'{"code":0,"data":{"splash":[{}],"splash":null,"preload_feed_ads":[],"no_change_show_list":true}}'),{});
  assert.deepEqual(run(preload,'{"code":0,"data":{"splash":[],"preload_feed_ads":[{}],"preload_feed_ads":null,"no_change_show_list":true}}'),{});
});
test('canonical v1, v2 and preview feed routes are supported; lookalike and business routes are not',()=>{
  const data={status_code:0,aweme_list:[{is_ads:true,raw_ad_data:{}}]};
  for(const url of ['https://aweme.snssdk.com/aweme/v1/feed/','https://aweme.snssdk.com/aweme/v2/feed/','https://aweme.snssdk.com/aweme/v2/preview/feed/'])assert(run(url,data)?.body,url);
  for(const url of ['https://aweme.snssdk.com.evil.example/aweme/v2/feed/','https://other.example/aweme/v2/feed/','https://aweme.snssdk.com/aweme/v2/feed/extra','https://aweme.snssdk.com/aweme/v1/user/profile/','https://aweme.snssdk.com/aweme/v1/commit/item/digg/'])assert.equal(run(url,data),null,url);
});
test('all confirmed splash ad lists clear while interval, expiry and marketing controls remain intact',()=>{
  const data={splash:[{id:1}],preload_feed_ads:[{id:2}],realtime_preload_splash:[{id:3}],marketing_splash:[{id:4}],leave_interval:30,splash_interval:60,expire_ads:[1],no_change_show_list:true};
  const out=run(preload,{code:0,data});assert(out?.body);
  assert.deepEqual(JSON.parse(out.body),{code:0,data:{...data,splash:[],preload_feed_ads:[],marketing_splash:[],realtime_preload_splash:[],no_change_show_list:false}});
});
test('empty splash arrays still reset the no-change flag to let the primary cache clear',()=>{
  const out=run(preload,{code:0,data:{splash:[],no_change_show_list:true,penalty_period:10}});
  assert.deepEqual(JSON.parse(out.body),{code:0,data:{splash:[],no_change_show_list:false,penalty_period:10}});
});
test('realtime splash uses splash_ads, retaining the fallback policy rather than guessing a new action type',()=>{
  const out=run(realtime,{code:0,data:{splash_ads:[{id:1}],action_type:1,other:'keep'}});
  assert.deepEqual(JSON.parse(out.body),{code:0,data:{splash_ads:[],action_type:1,other:'keep'}});
});
test('unknown splash schema and failure statuses do not mutate cached-control flags',()=>{
  for(const data of [{code:1,data:{splash:[{}],no_change_show_list:true}},{code:0,data:{other:[{}],no_change_show_list:true}}])assert.deepEqual(run(preload,data),{});
});
test('the observed dynamic appName segment is bounded to one safe path component',()=>{
  const body={code:0,data:{splash:[{}],no_change_show_list:true}};
  assert(run('https://aweme.snssdk.com/api/ad/splash/aweme_mobile/v14/',body)?.body);
  for(const url of ['https://aweme.snssdk.com/api/ad/splash/a%2Fb/v14/','https://aweme.snssdk.com/api/ad/splash/a/b/v14/','https://aweme.snssdk.com/api/ad/v1/splash/stock/'])assert.equal(run(url,body),null);
});
test('preload can use a known HTTP success with no JSON code, unlike realtime which requires code zero',()=>{
  const body=JSON.stringify({data:{splash:[{}],no_change_show_list:true}});
  const out=handle({url:preload},{statusCode:200,body});assert(out?.body);assert.deepEqual(JSON.parse(out.body).data,{splash:[],no_change_show_list:false});
  assert.deepEqual(handle({url:preload},{body}),{});
  assert.deepEqual(handle({url:realtime},{statusCode:200,body:JSON.stringify({data:{splash_ads:[{}]}})}),{});
});
test('known HTTP failures never rewrite response data even with a success-shaped JSON code',()=>{
  assert.deepEqual(handle({url:preload},{statusCode:503,body:JSON.stringify({code:0,data:{splash:[{}]}})}),{});
  assert.deepEqual(handle({url:feed},{statusCode:403,body:JSON.stringify({status_code:0,aweme_list:[{is_ads:true,raw_ad_data:{}}]})}),{});
});
