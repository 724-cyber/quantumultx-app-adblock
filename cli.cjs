"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspect,compile}=require('./lib/pipeline.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const argv=process.argv.slice(2),rootAt=argv.indexOf('--root');
const root=rootAt<0?__dirname:path.resolve(argv[rootAt+1]);
if(rootAt>=0) argv.splice(rootAt,2);
const [command,argument]=argv;
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const load=f=>JSON.parse(read(f));
function write(file,body){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);}
function allFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?allFiles(path.join(dir,d.name)):[path.join(dir,d.name)]);}
async function fetchPublic(url){
  // Redirects are not followed. Registry hosts are validated by inspect before any requests.
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Owned-QX-Source-Review/1.0'}});
  if(!response.ok)throw new Error('DOWNLOAD_FAILED: HTTP '+response.status);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw new Error('DOWNLOAD_TOO_LARGE');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
function checkedAssets(compiled){
  const files={...compiled.files},dir=path.join(root,'dist/scripts');
  if(fs.existsSync(dir))for(const name of fs.readdirSync(dir)){
    const m=name.match(/^app-adblock-([a-f0-9]{64})\.js$/);if(!m)throw new Error('UNEXPECTED_SCRIPT_ASSET');
    const body=fs.readFileSync(path.join(dir,name),'utf8');if(sha(body)!==m[1])throw new Error('CORRUPTED_OLD_SCRIPT');
    files['scripts/'+name]??=body;
  }
  files.SHA256SUMS=Object.entries(files).filter(([f])=>f!=='SHA256SUMS').map(([f,b])=>sha(b)+'  '+f).join('\n')+'\n';
  return files;
}
async function main(){
  if(command==='seed'){
    if(!argument)throw new Error('seed needs a reviewed local quantumultx directory');
    const from=path.resolve(argument);
    write('curated/app-adblock.js',fs.readFileSync(path.join(from,'app-adblock.js'),'utf8'));
    write('curated/rewrite.snippet',fs.readFileSync(path.join(from,'adblock-rewrite.snippet'),'utf8'));
    console.log('Copied existing reviewed local App rules; no network, no publication.');return;
  }
  if(command==='fetch'){
    const registry=load('sources.json');
    const input={runId:crypto.randomUUID(),fetchedAt:new Date().toISOString(),baseUrl:registry.baseUrl,
      own:{bundle:read('curated/app-adblock.js'),snippet:read('curated/rewrite.snippet'),filter:read('curated/reject.list')},
      sources:registry.sources.map(s=>({...s,text:'# pending',license:{...s.license,text:'# pending'}}))};
    inspect(input); // Validates every URL before fetching any source.
    const downloaded=new Map();
    for(const s of input.sources){
      for(const url of [s.url,s.license.url])if(!downloaded.has(url))downloaded.set(url,await fetchPublic(url));
      s.text=downloaded.get(s.url);s.license.text=downloaded.get(s.license.url);
    }
    const plan=inspect(input);
    write('.work/input.json',json(input));write('.work/inspection.json',json(plan));
    console.log(json({status:'AI_REVIEW_REQUIRED',runId:input.runId,subject:plan.subject,rules:plan.rules.length,issues:plan.issues,snapshots:plan.snapshots}));return;
  }
  if(command==='inspect'){
    const plan=inspect(load('.work/input.json'));write('.work/inspection.json',json(plan));
    console.log(json({subject:plan.subject,runId:plan.runId,rules:plan.rules.length,issues:plan.issues,snapshots:plan.snapshots}));return;
  }
  if(command==='build'){
    if(!argument)throw new Error('AI_REVIEW_REQUIRED: give a review file');
    const input=load('.work/input.json'),review=load(argument),compiled=compile(input,review),files=checkedAssets(compiled);
    const staging=fs.mkdtempSync(path.join(root,'.work/stage-'));
    for(const [file,body]of Object.entries(files)){
      const dest=path.join(staging,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);
      if(sha(fs.readFileSync(dest))!==sha(body))throw new Error('STAGING_WRITE_FAILED');
    }
    const dist=path.join(root,'dist'),backup=path.join(root,'.work/previous-'+crypto.randomUUID());
    if(fs.existsSync(dist))fs.renameSync(dist,backup);
    try{fs.renameSync(staging,dist);}catch(error){if(fs.existsSync(backup))fs.renameSync(backup,dist);throw error;}
    write('inputs/current.json',json(input));write('reviews/current.json',json(review));
    write('reviews/'+input.runId+'.json',json(review));
    console.log(json({status:'BUILT_NOT_PUBLISHED',subject:compiled.report.subject,effectiveRules:compiled.report.effectiveRules,coveredRules:compiled.report.coveredRules,excludedRules:compiled.report.excluded.length,importUrl:compiled.report.importUrl}));return;
  }
  if(command==='verify'){
    const compiled=compile(load('inputs/current.json'),load('reviews/current.json'));
    const files=checkedAssets(compiled);
    for(const [file,body]of Object.entries(files))if(read('dist/'+file)!==body)throw new Error('DELIVERY_MISMATCH: '+file);
    const expected=new Set(Object.keys(files));
    for(const file of allFiles(path.join(root,'dist')))if(!expected.has(path.relative(path.join(root,'dist'),file)))throw new Error('UNEXPECTED_DELIVERY_FILE');
    console.log(json({status:'VERIFIED',subject:compiled.report.subject,effectiveRules:compiled.report.effectiveRules,files:expected.size}));return;
  }
  throw new Error('Usage: node cli.cjs seed PATH | fetch | inspect | build REVIEW.json | verify');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
