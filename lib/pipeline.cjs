"use strict";
const crypto = require('node:crypto');
const net = require('node:net');
const fs = require('node:fs');
const { domainToASCII } = require('node:url');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const json = value => JSON.stringify(value,null,2)+'\n';
const fail = (code, detail='') => { throw new Error(code+(detail?': '+detail:'')); };
function publicUrl(value) {
  let u; try { u=new URL(value); } catch { fail('UNSAFE_SOURCE_URL'); }
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||!['raw.githubusercontent.com'].includes(u.hostname)) fail('UNSAFE_SOURCE_URL');
  return u.href;
}
const types = {'domain':'host','domain-suffix':'host-suffix','domain-keyword':'host-keyword','ip-cidr6':'ip6-cidr'};
function parse(text,source) {
  const rules=[], issues=[];
  text.split(/\r?\n/).forEach((raw,index)=>{
    const value=raw.trim();
    if(!value||/^(?:#|;|\/\/)/.test(value)) return;
    const row=source+':'+(index+1), fields=value.split(',').map(x=>x.trim());
    try {
      let type=fields[0].toLowerCase();type=types[type]||type;
      let match=fields[1];
      if(!['host','host-suffix','host-keyword','ip-cidr','ip6-cidr','user-agent'].includes(type)||!match) throw new Error('Unsupported or malformed condition');
      const cidr=type==='ip-cidr'||type==='ip6-cidr';
      const params=fields.slice(2).map(x=>x.toLowerCase());
      if(params.some(x=>x!=='reject'&&!(cidr&&x==='no-resolve'))) throw new Error('Non-reject policy or unreviewed parameter');
      if(fields.length>(cidr?4:3)) throw new Error('Unreviewed extra parameters');
      if(['host','host-suffix'].includes(type)) {
        match=domainToASCII(match.toLowerCase().replace(/\.$/,''));
        if(!match||!match.includes('.')||match.length>253||!match.split('.').every(x=>/^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(x))||net.isIP(match)) throw new Error('Invalid domain');
      } else if(type==='host-keyword') {
        match=match.toLowerCase();if(!/^[a-z0-9._-]{3,80}$/.test(match)) throw new Error('Overbroad or invalid keyword');
      } else if(type==='ip-cidr'||type==='ip6-cidr') {
        const [address,prefix,...extra]=match.split('/'),version=type==='ip-cidr'?4:6,max=version===4?32:128;
        if(extra.length||net.isIP(address)!==version||!/^\d+$/.test(prefix)||+prefix<1||+prefix>max) throw new Error('Invalid or catch-all CIDR');
      } else if(/\s/.test(match)) throw new Error('Invalid user-agent');
      rules.push({key:type+','+match,type,value:match,origins:[{source,line:index+1}]});
    } catch(error) { issues.push({row,text:value,reason:error.message}); }
  });
  return {rules,issues};
}
function inspect(input) {
  if(!input?.runId||!input.fetchedAt||!input.sources?.length||!input.own?.bundle||!input.own.snippet) fail('INCOMPLETE_INPUT');
  publicUrl(input.baseUrl);
  const ids=new Set(), snapshots=[],rules=[],issues=[];
  for(const s of input.sources) {
    if(!/^[a-z0-9-]+$/.test(s.id)||ids.has(s.id)) fail('INVALID_SOURCE_ID');ids.add(s.id);
    publicUrl(s.url);publicUrl(s.license.url);
    snapshots.push({id:s.id,url:s.url,sha256:sha(s.text),license:s.license.spdx,licenseUrl:s.license.url,licenseSha256:sha(s.license.text)});
    const p=parse(s.text,s.id);rules.push(...p.rules);issues.push(...p.issues);
  }
  const own=parse(input.own.filter||'','curated');rules.push(...own.rules);issues.push(...own.issues);
  const compilerSha256=sha(fs.readFileSync(__filename));
  const subject=sha(JSON.stringify({runId:input.runId,fetchedAt:input.fetchedAt,baseUrl:input.baseUrl,compilerSha256,snapshots,own:{bundle:sha(input.own.bundle),snippet:sha(input.own.snippet),filter:sha(input.own.filter||'')}}));
  return {subject,compilerSha256,runId:input.runId,fetchedAt:input.fetchedAt,snapshots,rules,issues};
}
function compile(input,review) {
  if(review?.status!=='approved'||!review.reviewer||!review.reviewedAt||!review.summary) fail('AI_REVIEW_REQUIRED');
  const plan=inspect(input);
  if(review.subject!==plan.subject) fail('STALE_AI_REVIEW');
  for(const s of input.sources) {
    if(s.license.spdx!=='GPL-3.0'||!s.license.text.includes('GNU GENERAL PUBLIC LICENSE')) fail('LICENSE_NOT_APPROVED',s.id);
    if(!plan.rules.some(r=>r.origins[0].source===s.id)) fail('EMPTY_SOURCE',s.id);
  }
  for(const issue of plan.issues) if(!review.excludedRows?.[issue.row]?.trim()) fail('UNRESOLVED_INPUT',issue.row);
  for(const [key,reason] of Object.entries(review.exclusions||{})) if(!reason.trim()||!plan.rules.some(r=>r.key===key)) fail('UNUSED_REVIEW_DECISION',key);
  for(const [row,reason] of Object.entries(review.excludedRows||{})) if(!reason.trim()||!plan.issues.some(r=>r.row===row)) fail('UNUSED_REVIEW_DECISION',row);
  const excluded=[], merged=new Map();
  for(const r of plan.rules) {
    const reason=review.exclusions?.[r.key];
    if(reason?.trim()) {excluded.push({...r,reason});continue;}
    if(merged.has(r.key)) merged.get(r.key).origins.push(...r.origins);
    else merged.set(r.key,{...r,origins:[...r.origins]});
  }
  const suffixes=new Set([...merged.values()].filter(r=>r.type==='host-suffix').map(r=>r.value));
  const order=['host','host-suffix','host-keyword','user-agent','ip-cidr','ip6-cidr'];
  const provenance=[...merged.values()].sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)||a.value.localeCompare(b.value,'en'));
  for(const r of provenance) {
    if(r.type!=='host'&&r.type!=='host-suffix') continue;
    const parts=r.value.split('.');
    for(let n=r.type==='host'?0:1;n<parts.length-1;n++) {
      const parent=parts.slice(n).join('.');
      if(suffixes.has(parent)) {r.coveredBy='host-suffix,'+parent;break;}
    }
  }
  const effective=provenance.filter(r=>!r.coveredBy);
  if(!effective.length) fail('EMPTY_RELEASE');
  const scriptFile='scripts/app-adblock-'+sha(input.own.bundle)+'.js';
  const rewritten=input.own.snippet.split(/\r?\n/).map(line=>{
    if(!line.trim()||/^(#|;|\/\/)/.test(line.trim())) return line;
    const match=line.match(/\surl(?:-and-header)?\s+(script-\S+)\s+(\S+)\s*$/);
    if(match) {
      if(match[2]!=='app-adblock.js') fail('UNOWNED_SCRIPT');
      return line.slice(0,line.lastIndexOf('app-adblock.js'))+input.baseUrl+'/'+scriptFile;
    }
    if(/\sscript-/.test(line)) fail('UNOWNED_SCRIPT');
    return line;
  }).join('\n');
  const importResources={
    filter_remote:[input.baseUrl+'/reject.list, tag=Own-Adblock, force-policy=reject, update-interval=86400, opt-parser=false, enabled=true'],
    rewrite_remote:[input.baseUrl+'/rewrite.snippet, tag=Own-App-Ads, update-interval=86400, opt-parser=false, enabled=true']
  };
  const importUrl='https://quantumult.app/x/open-app/add-resource?remote-resource='+encodeURIComponent(JSON.stringify(importResources));
  const report={subject:plan.subject,compilerSha256:plan.compilerSha256,runId:input.runId,fetchedAt:input.fetchedAt,policy:'aggressive-ad-and-telemetry-blocking',iosDeviceTested:false,inputRules:plan.rules.length,uniqueRules:provenance.length,effectiveRules:effective.length,coveredRules:provenance.filter(r=>r.coveredBy).length,excluded,excludedRows:plan.issues.map(i=>({...i,decision:review.excludedRows[i.row]})),snapshots:plan.snapshots,review,importUrl};
  const attribution='# 来源与变更\n\n本发布将已审查快照规范化为 QX reject 条件并去重、折叠父后缀覆盖；原始来源、许可及审查保留。未将来源中的注释作为指令执行。\n\n'+plan.snapshots.map(s=>'- '+s.id+': '+s.url+'\n  - SHA-256: `'+s.sha256+'`\n  - License: '+s.license+' ('+s.licenseUrl+')').join('\n')+'\n\n自有 App 响应规则来自本项目 REA 静态研究；手机侧只引用本仓库固定内容哈希脚本，不执行上游 JS。\n';
  const files={
    'reject.list':'# Own Adblock aggressive; reviewed input '+plan.subject+'\n'+effective.map(r=>r.type+', '+r.value+', reject').join('\n')+'\n',
    'rewrite.snippet':rewritten,
    [scriptFile]:input.own.bundle,
    'SOURCES.md':attribution,
    'provenance.json':json(provenance),
    'release.json':json(report),
    'import.json':json(importResources)
  };
  for(const s of input.sources) {files['upstream/'+s.id+'.list']=s.text;files['licenses/'+s.id+'.txt']=s.license.text;}
  files['SHA256SUMS']=Object.entries(files).map(([file,body])=>sha(body)+'  '+file).join('\n')+'\n';
  return {files,report,provenance,importResources};
}
module.exports={inspect,compile};
