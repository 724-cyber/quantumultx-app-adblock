"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../curated/app-adblock.js'),'utf8');
function run(url,body){
  const calls=[],context={$request:{url,method:'POST'},$done:v=>calls.push(v),console:{log(){}}};
  if(body!==undefined)context.$response={body:typeof body==='string'?body:JSON.stringify(body)};
  vm.runInNewContext(source,context,{timeout:1000});assert.equal(calls.length,1);
  return JSON.parse(JSON.stringify(calls[0]));
}
test('Xianyu explicit ads disappear while ordinary cards and paging remain',()=>{
  const v=run('https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/8.0/',{ret:['SUCCESS::ok'],data:{sections:[{id:'ordinary'},{exContent:{bizType:'mamaAD',isAd:true}}],nextPage:2}});
  assert.deepEqual(JSON.parse(v.body),{ret:['SUCCESS::ok'],data:{sections:[{id:'ordinary'}],nextPage:2}});
});
test('Taobao P4P deletion preserves normal products and filter headers',()=>{
  const v=run('https://acs.m.taobao.com/gw/mtop.taobao.wsearch.appsearch/1.0/',{ret:['SUCCESS::ok'],data:{itemsArray:[{cardType:'item',isP4p:true},{cardType:'item',id:'normal'},{cardType:'item',isP4p:true,isFilterBar:true}]}});
  assert.deepEqual(JSON.parse(v.body).data.itemsArray,[{cardType:'item',id:'normal'},{cardType:'item',isP4p:true,isFilterBar:true}]);
});
test('Xianyu ad failed-batch exposure is answered locally at request stage',()=>{
  const v=run('https://acs.m.goofish.com/gw/mtop.idle.ad.failed.batch.expose/1.0/');
  assert.equal(v.status,'HTTP/1.1 200 OK');assert.equal(JSON.parse(v.body).api,'mtop.idle.ad.failed.batch.expose');
});
test('unrelated trade routes and unsafe large integer responses are not rewritten',()=>{
  assert.deepEqual(run('https://acs.m.taobao.com/gw/mtop.trade.order.create/1.0/',{important:true}),{});
  assert.deepEqual(run('https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/8.0/','{"data":{"items":[{"id":9223372036854775807}]}}'),{});
});
