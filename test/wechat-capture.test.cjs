'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../tools/wechat-capture');
function core(){const p=path.join(dir,'src/core.cjs');assert(fs.existsSync(p),'capture core has not been implemented');return require(p);}
function build(){const p=path.join(dir,'build.cjs');assert(fs.existsSync(p),'capture package builder has not been implemented');return require(p).build();}
const now=1000000;
function started(){return core().control('start',null,now).state;}
const raw=s=>JSON.stringify(s);
const req=(extra={})=>({url:'https://mp.weixin.qq.com/cgi-bin/mmbiz-bin/js-operatewxdata?api_name=webapi_getadvert&access_token=TOP_SECRET',method:'POST',headers:{Cookie:'COOKIE_SECRET',Authorization:'AUTH_SECRET',Referer:'https://servicewechat.com/wx1234567890abcdef/3/page-frame.html'},...extra});
test('capture remains idle until the user starts a new session',()=>{
 assert.equal(core().capture(null,req(),undefined,now),null);
 const s=started();assert.equal(s.active,true);assert.deepEqual(s.records,[]);assert.equal(s.until,now+300000);
});
test('the collector keeps only approved URL fields and never retains request headers or body',()=>{
 const r=req();Object.defineProperty(r,'body',{get(){throw Error('request body must not be read');}});
 const out=core().capture(raw(started()),r,undefined,now+123);
 assert.equal(out.records[0].host,'mp.weixin.qq.com');assert.equal(out.records[0].path,'/cgi-bin/mmbiz-bin/js-operatewxdata');
 assert.equal(out.records[0].query.api_name,'webapi_getadvert');assert.equal(out.records[0].miniProgramReferer,true);
 for(const x of ['TOP_SECRET','COOKIE_SECRET','AUTH_SECRET','wx1234567890abcdef','access_token'])assert(!raw(out).includes(x),x);
 assert.equal(out.records[0].headers,undefined);assert.equal(out.records[0].referer,undefined);
});
test('unknown URL segments, parameter names and free text are removed rather than copied',()=>{
 const r=req({url:'https://mp.weixin.qq.com/user/SECRET_PATH/13912345678?SECRET_KEY=SECRET_VALUE&ad_unit_id=SECRET_UNIT&api_name=SECRET_API'});
 const s=core().capture(raw(started()),r,undefined,now+1);const text=raw(s);
 assert.equal(s.records[0].path,'/[segment]/[segment]/[segment]');
 for(const x of ['SECRET_PATH','13912345678','SECRET_KEY','SECRET_VALUE','SECRET_UNIT','SECRET_API'])assert(!text.includes(x),x);
});
test('lookalike hosts, userinfo URLs and unrelated traffic do not enter the store',()=>{
 for(const url of ['https://mp.weixin.qq.com.evil.example/ad','https://user:pass@mp.weixin.qq.com/ad','https://api.mch.weixin.qq.com/pay','https://acs.m.taobao.com/gw/api','https://SECRET_HOST.weixin.qq.com/ad'])assert.equal(core().capture(raw(started()),req({url}),undefined,now+1),null,url);
});
test('response summaries preserve ad decisions but redact identifiers, URLs and unknown keys at all nesting levels',()=>{
 const response={statusCode:200,headers:{'Content-Type':'application/json; secret=HEADER_SECRET','Set-Cookie':'SESSION_SECRET','Content-Encoding':'gzip'},body:JSON.stringify({data:JSON.stringify({advertisement_num:1,advertisement_info:[{is_ads:true,ad_unit_id:'SECRET_AD_UNIT',image_url:'https://cdn.example/SECRET_IMAGE?token=SECRET_TOKEN',SECRET_KEY:'SECRET_VALUE'}]}),openid:'SECRET_OPENID',errMsg:'SECRET_ERROR'})};
 const out=core().capture(raw(started()),req(),response,now+10);const r=out.records[0];
 assert.equal(r.http.status,200);assert.equal(r.http.mime,'application/json');assert.equal(r.body.json.data.advertisement_num,1);assert.equal(r.body.json.data.advertisement_info[0].is_ads,true);
 for(const x of ['HEADER_SECRET','SESSION_SECRET','SECRET_AD_UNIT','SECRET_IMAGE','SECRET_TOKEN','SECRET_KEY','SECRET_VALUE','SECRET_OPENID','SECRET_ERROR'])assert(!raw(out).includes(x),x);
});
test('binary, non-JSON, oversized and malformed response bodies are never retained',()=>{
 for(const body of ['SECRET_HTML','{"data":"SECRET_BROKEN"',new Uint8Array([1,2,3]),'SECRET_OVERSIZED'.repeat(10000)]){
  const s=core().capture(raw(started()),req(),{statusCode:200,headers:{},body},now+1);
  assert(!raw(s).includes('SECRET'));assert.equal(s.records[0].body.json,undefined);
 }
});
test('expiry and backwards clocks stop capture; size limits stop without unbounded preference growth',()=>{
 for(const t of [now+300000,now-1]){const s=core().capture(raw(started()),req(),undefined,t);assert.equal(s.active,false);assert.equal(s.records.length,0);}
 let s=started();for(let i=0;i<300;i++)s=core().capture(raw(s),req(),undefined,now+i+1)||s;
 assert.equal(s.active,false);assert(s.records.length<=64);assert(raw(s).length<=49152);
});
test('export reconstructs stored data through the allowlist and clear removes only this tool state',()=>{
 const s=started();s.records=[{t:1,stage:'request',method:'POST',host:'mp.weixin.qq.com',path:'/SECRET_PATH',query:{token:'SECRET_TOKEN',api_name:'SECRET_API'},miniProgramReferer:false,SECRET_ROOT:'SECRET_TEXT'}];s.SECRET_STATE='SECRET_STATE';
 const out=core().control('export',raw(s),now+2);assert.equal(out.state.active,false);assert.equal(out.report.format,'wx-capture-v1');assert(!raw(out).includes('SECRET'));
 assert.equal(core().control('clear',raw(s),now+3).state,null);
});
function runtime(source,extra={}){
 const store=new Map(),writes=[],files=[],logs=[],calls=[],notifications=[],network=[];
 const context={Date:class extends Date{static now(){return now+100;}},TextEncoder,Uint8Array,console:{log:x=>logs.push(String(x))},$prefs:{valueForKey:k=>store.get(k)||null,setValueForKey:(v,k)=>{writes.push(k);store.set(k,v);return true;},removeValueForKey:k=>{writes.push(k);store.delete(k);return true;}},$notify:(...x)=>notifications.push(x),$done:x=>calls.push(x),$iCloud:{writeFile:(bytes,p)=>{files.push({bytes:Buffer.from(bytes),path:p});return true;}},...extra};
 context.$task={fetch:x=>{network.push(x);throw Error('network forbidden');}};context.fetch=x=>{network.push(x);throw Error('network forbidden');};
 return {store,writes,files,logs,calls,notifications,network,run(){vm.runInNewContext(source,context,{timeout:1000});},context};
}
test('generated capture always completes once unchanged and never uploads or alters traffic',()=>{
 const p=build(),source=p.captureSource,r=req(),response={statusCode:200,headers:{'Content-Type':'application/json'},body:'{"data":{"advertisement_num":0}}'};
 const before=raw({r,response});const rt=runtime(source,{$request:r,$response:response});rt.store.set(p.storeKey,raw(started()));if(p.gateKey)rt.store.set(p.gateKey,String(now));rt.run();
 assert.equal(rt.calls.length,1);assert.deepEqual(Object.keys(rt.calls[0]),[]);assert.equal(raw({r,response}),before);assert.equal(rt.files.length,0);assert.equal(rt.logs.length,0);assert.equal(rt.writes.length,1);assert.equal(rt.writes[0],p.storeKey);assert.equal(rt.network.length,0);
 const broken=runtime(source,{$request:r,$prefs:{valueForKey(){throw Error('SECRET_EXCEPTION');}}});broken.run();assert.equal(broken.calls.length,1);assert.deepEqual(Object.keys(broken.calls[0]),[]);assert(!raw(broken.logs).includes('SECRET'));
});
test('manual export stops collection and writes only minimized JSON to an explicit iCloud file',()=>{
 const p=build(),rt=runtime(p.controlSource,{$environment:{sourcePath:'https://example.invalid/control.js#action=export'}});rt.store.set(p.storeKey,raw(started()));rt.run();
 assert.equal(rt.calls.length,1);assert.equal(rt.files.length,1);assert(rt.files[0].path.startsWith('wechat-capture/'));assert.equal(JSON.parse(rt.files[0].bytes).format,'wx-capture-v1');assert.equal(JSON.parse(rt.store.get(p.storeKey)).active,false);assert.equal(rt.network.length,0);
});
test('export failures use sanitized log fallback; start, status and clear never write iCloud or other preference namespaces',()=>{
 const p=build();for(const action of ['start','status','clear']){const rt=runtime(p.controlSource,{$environment:{variables:{action}}});rt.store.set(p.storeKey,raw(started()));rt.store.set('UNRELATED_PREF','KEEP');rt.run();assert.equal(rt.files.length,0);assert.equal(rt.calls.length,1);assert.equal(rt.store.get('UNRELATED_PREF'),'KEEP');assert(rt.writes.every(k=>k===p.storeKey||k===p.gateKey));}
 const rt=runtime(p.controlSource,{$environment:{variables:{action:'export'}},$iCloud:{writeFile(){throw Error('SECRET_ERROR');}}});rt.store.set(p.storeKey,raw(started()));rt.run();assert.equal(rt.calls.length,1);assert(rt.logs.some(x=>x.includes('wx-capture-v1')));assert(!raw(rt.logs).includes('SECRET_ERROR'));
});
test('failed preference writes do not announce a successful start or export while capture could still be active',()=>{
 const p=build();for(const action of ['start','export','clear']){
  const rt=runtime(p.controlSource,{$environment:{variables:{action}}});rt.store.set(p.storeKey,raw(started()));
  rt.context.$prefs.setValueForKey=()=>false;rt.context.$prefs.removeValueForKey=()=>false;rt.run();
  assert.equal(rt.files.length,0);assert.equal(rt.calls.length,1);
  assert(rt.notifications.some(n=>n[1]==='操作失败'));assert(!raw(rt.notifications).includes('新采样已开始'));
 }
});
test('control verifies stored state instead of depending on a preference return value',()=>{
 const p=build(),rt=runtime(p.controlSource,{$environment:{variables:{action:'start'}}});
 rt.context.$prefs.setValueForKey=(v,k)=>{rt.store.set(k,v);};rt.run();
 assert.equal(JSON.parse(rt.store.get(p.storeKey)).active,true);assert(rt.notifications.some(n=>n[1].includes('新采样已开始')));
});
test('an independent stop gate defeats late active-state writes from concurrent requests',()=>{
 const p=build();assert.equal(typeof p.gateKey,'string');
 const rt=runtime(p.captureSource,{$request:req()});rt.store.set(p.storeKey,raw(started()));rt.store.set(p.gateKey,'off');rt.run();assert.equal(rt.writes.length,0);
 const stop=runtime(p.controlSource,{$environment:{variables:{action:'export'}}});stop.store.set(p.storeKey,raw(started()));stop.store.set(p.gateKey,String(now));stop.run();assert.equal(stop.store.get(p.gateKey),'off');
 stop.store.set(p.storeKey,raw(started()));const stale=runtime(p.captureSource,{$request:req()});for(const [k,v] of stop.store)stale.store.set(k,v);stale.run();assert.equal(stale.writes.length,0);
});
test('minimization does not leak adversarial secrets placed in approved fields, nested strings or property names',()=>{
 const c=core();for(let i=0;i<250;i++){
  const secret='PRIVATE_SENTINEL_'+i+'@example.invalid';
  const response={statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({data:JSON.stringify({api_name:secret,ad_unit_id:secret,advertisement_info:[{is_ads:secret,ret:secret,data:JSON.stringify({advertisement_num:secret,[secret]:secret})}]}),[secret]:secret})};
  const s=c.capture(raw(started()),req({url:'https://mp.weixin.qq.com/'+encodeURIComponent(secret)+'?api_name='+encodeURIComponent(secret)}),response,now+1);
  assert(!raw(c.control('export',raw(s),now+2)).includes('PRIVATE_SENTINEL'));
 }
});
test('installation is an additive task gallery with rewrite addon, no filter/server replacement, schedule or added MITM hosts',()=>{
 const p=build(),u=new URL(p.importUrl);assert.equal(u.pathname,'/x/open-app/ui');assert.equal(u.searchParams.get('module'),'gallery');assert.equal(u.searchParams.get('type'),'task');
 assert.deepEqual(JSON.parse(u.searchParams.get('content')),[p.baseUrl+'/gallery.json']);assert.equal(p.gallery.task.length,4);
 for(const task of p.gallery.task){assert(task.config.startsWith('event-interaction '));assert(task.config.includes('enabled=true'));}
 assert.equal(p.gallery.task[0].addons,p.baseUrl+'/capture.snippet');assert(!/^hostname\s*=/m.test(p.snippet));
 const rules=p.snippet.split('\n').filter(x=>x.startsWith('^')).map(x=>{const [pattern,tail]=x.split(' url ');return {regex:new RegExp(pattern),tail};});
 assert(rules.some(x=>x.tail.startsWith('script-request-header ')&&x.regex.test('http://short.weixin.qq.com/mmtls/SECRET_SESSION')));
 assert(rules.some(x=>x.tail.startsWith('script-response-body ')&&x.regex.test('https://mp.weixin.qq.com/cgi-bin/mmbiz-bin/js-operatewxdata')));
 assert(!rules.some(x=>x.tail.startsWith('script-response-body ')&&x.regex.test('https://mp.weixin.qq.com/video/movie.mp4')));
 for(const url of ['https://acs.m.goofish.com/gw/a','https://aweme.snssdk.com/aweme/v2/feed/','https://mp.weixin.qq.com.evil.example/ad'])assert(!rules.some(x=>x.regex.test(url)),url);
 const {createHash}=require('node:crypto');assert(p.captureAsset.includes(createHash('sha256').update(p.captureSource).digest('hex')));assert(p.controlAsset.includes(createHash('sha256').update(p.controlSource).digest('hex')));
});
