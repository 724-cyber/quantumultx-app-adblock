"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {inspect}=require('../lib/pipeline.cjs');
const cli=path.resolve(__dirname,'../cli.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function setup(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'own-adblock-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const input={runId:'test-run',fetchedAt:'2026-10-20T04:00:00Z',baseUrl:'https://raw.githubusercontent.com/example/ads/main/dist',sources:[{id:'test',url:'https://raw.githubusercontent.com/example/rules/main/ads.list',text:'DOMAIN,ads.example.com\n',license:{spdx:'GPL-3.0',text:'GNU GENERAL PUBLIC LICENSE\nVersion 3',url:'https://raw.githubusercontent.com/example/rules/main/LICENSE'}}],own:{bundle:'$done({});\n',snippet:'hostname = api.example.com\n^https://api.example.com/ads url script-response-body app-adblock.js\n',filter:''}};
  fs.mkdirSync(path.join(root,'.work'));
  const save=()=>fs.writeFileSync(path.join(root,'.work/input.json'),JSON.stringify(input));save();
  const review=()=>fs.writeFileSync(path.join(root,'review.json'),JSON.stringify({status:'approved',subject:inspect(input).subject,reviewer:'AI test fixture',reviewedAt:'2026-10-20T04:01:00Z',summary:'Controlled input review',exclusions:{},excludedRows:{}}));
  const run=(...args)=>spawnSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8'});
  return {root,input,save,review,run};
}
test('build without review leaves an existing stable release untouched',t=>{
  const x=setup(t);fs.mkdirSync(path.join(x.root,'dist'));fs.writeFileSync(path.join(x.root,'dist/reject.list'),'existing stable release');
  const result=x.run('build','review.json');assert.notEqual(result.status,0);
  assert.equal(fs.readFileSync(path.join(x.root,'dist/reject.list'),'utf8'),'existing stable release');
});
test('reviewed build is reproducible and verification detects modified delivery bytes',t=>{
  const x=setup(t);x.review();let result=x.run('build','review.json');assert.equal(result.status,0,result.stderr);
  assert.match(fs.readFileSync(path.join(x.root,'dist/reject.list'),'utf8'),/^host, ads.example.com, reject$/m);
  result=x.run('verify');assert.equal(result.status,0,result.stderr);
  fs.appendFileSync(path.join(x.root,'dist/reject.list'),'host, login.example.com, reject\n');
  result=x.run('verify');assert.notEqual(result.status,0);assert.match(result.stderr,/DELIVERY_MISMATCH/);
});
test('a changed snapshot cannot overwrite an already built release with an old review',t=>{
  const x=setup(t);x.review();let r=x.run('build','review.json');assert.equal(r.status,0,r.stderr);
  const old=fs.readFileSync(path.join(x.root,'dist/reject.list'),'utf8');x.input.sources[0].text+='DOMAIN,new.example.com\n';x.save();
  r=x.run('build','review.json');assert.notEqual(r.status,0);assert.match(r.stderr,/STALE_AI_REVIEW/);
  assert.equal(fs.readFileSync(path.join(x.root,'dist/reject.list'),'utf8'),old);
});
test('old hashed JS assets remain available for clients with cached rewrite subscriptions',t=>{
  const x=setup(t);x.review();let r=x.run('build','review.json');assert.equal(r.status,0,r.stderr);
  const oldFile='app-adblock-'+hash(x.input.own.bundle)+'.js';
  x.input.runId='new-run';x.input.own.bundle='/* new version */\n$done({});\n';x.save();x.review();
  r=x.run('build','review.json');assert.equal(r.status,0,r.stderr);
  assert.equal(fs.readFileSync(path.join(x.root,'dist/scripts',oldFile),'utf8'),'$done({});\n');
  assert(fs.existsSync(path.join(x.root,'dist/scripts','app-adblock-'+hash(x.input.own.bundle)+'.js')));
  r=x.run('verify');assert.equal(r.status,0,r.stderr);
});
