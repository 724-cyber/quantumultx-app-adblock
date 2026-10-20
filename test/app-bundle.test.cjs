"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {build}=require('../scripts/build-app-bundle.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'../curated',name),'utf8');
const inputs=()=>({ali:read('ali-base.js'),douyin:read('douyin-filter.cjs'),aliSnippet:read('ali-rewrite.snippet'),douyinSnippet:read('douyin-rewrite.snippet')});
function run(source,url,body){const calls=[];vm.runInNewContext(source,{$request:{url,method:'POST'},$response:body===undefined?undefined:{body:typeof body==='string'?body:JSON.stringify(body)},$done:v=>calls.push(JSON.parse(JSON.stringify(v))),console:{log(){}}},{timeout:1000});assert.equal(calls.length,1);return calls[0];}
test('merged module filters Douyin ads without double completion or changing large IDs',()=>{
  const {bundle}=build(inputs());const out=run(bundle,'https://aweme.snssdk.com/aweme/v2/feed/','{"status_code":0,"aweme_list":[{"id":9223372036854775807},{"is_ads":true,"raw_ad_data":{}}],"has_more":1}');
  assert(out.body.includes('9223372036854775807'));assert.equal(JSON.parse(out.body).aweme_list.length,1);
});
test('merged module still routes Ali response and request-stage telemetry handlers',()=>{
  const {bundle}=build(inputs());
  const xy=run(bundle,'https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/8.0/',{ret:['SUCCESS::ok'],data:{sections:[{id:'normal'},{exContent:{bizType:'mamaAD',isAd:true}}]}});
  assert.deepEqual(JSON.parse(xy.body).data.sections,[{id:'normal'}]);
  const ad=run(bundle,'https://acs.m.goofish.com/gw/mtop.idle.ad.expose/1.0/');assert.equal(ad.status,'HTTP/1.1 200 OK');
});
test('unknown trade requests and Douyin invalid JSON finish unchanged once',()=>{
  const {bundle}=build(inputs());assert.deepEqual(run(bundle,'https://aweme.snssdk.com/aweme/v2/feed/','bad-json'),{});assert.deepEqual(run(bundle,'https://acs.m.taobao.com/gw/mtop.trade.order.create/1.0/',{}),{});
});
test('merged subscriptions include each required hostname once and one handler per target request',()=>{
  const {snippet}=build(inputs());const hosts=snippet.match(/^hostname = (.+)$/m)?.[1]?.split(',').map(x=>x.trim());assert(hosts?.includes('aweme.snssdk.com'));assert.equal(new Set(hosts).size,hosts.length);
  const rules=snippet.split('\n').filter(x=>/^\^https?/.test(x)).map(x=>new RegExp(x.split(' url ')[0]));
  for(const url of ['https://aweme.snssdk.com/aweme/v2/feed/','https://aweme.snssdk.com/api/ad/splash/aweme/v14/','https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/8.0/'])assert.equal(rules.filter(r=>r.test(url)).length,1,url);
});
test('checked-in deliverables are reproducible from the reviewed adapter sources',()=>{
  const output=build(inputs());
  assert.equal(read('app-adblock.js'),output.bundle,'rebuild the bundle after changing an adapter');
  assert.equal(read('rewrite.snippet'),output.snippet,'rebuild the merged subscription after changing routes');
});
