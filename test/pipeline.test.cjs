"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { inspect, compile } = require('../lib/pipeline.cjs');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// These literal fixtures catch publishing a changed/unreviewed source, not a text-template change.
const make = () => ({
  runId: 'review-run-one', fetchedAt: '2026-10-20T04:00:00Z',
  baseUrl: 'https://raw.githubusercontent.com/example/ads/main/dist',
  sources: [{ id:'alpha', url:'https://raw.githubusercontent.com/example/rules/main/ads.list',
    text:'DOMAIN-SUFFIX,ads.example.com,REJECT\nDOMAIN,one.ads.example.com\n',
    license:{spdx:'GPL-3.0',text:'GNU GENERAL PUBLIC LICENSE\nVersion 3\n',url:'https://raw.githubusercontent.com/example/rules/main/LICENSE'} }],
  own: { bundle:'/* local reviewed script */\n$done({});\n',
    snippet:'hostname = api.example.com\n^https:\\/\\/api\\.example\\.com\\/ad url script-response-body app-adblock.js\n',
    filter:'host, metrics.example.net, reject\n' }
});
const approved = inputs => ({status:'approved',subject:inspect(inputs).subject,reviewer:'Codex current session',reviewedAt:'2026-10-20T04:01:00Z',summary:'Read the fixed input snapshots and review the semantic differences and risks.',exclusions:{},excludedRows:{}});

test('missing AI review cannot produce a release',()=>{
  assert.throws(()=>compile(make()),/AI_REVIEW_REQUIRED/);
});
test('normalizes aliases and collapses parent suffix coverage without losing provenance',()=>{
  const i=make();
  i.sources.push({...i.sources[0],id:'beta',text:'HOST-SUFFIX,ADS.EXAMPLE.COM.\nDOMAIN-SUFFIX,deep.ads.example.com\n'});
  const out=compile(i,approved(i));
  const rules=out.files['reject.list'].split('\n').filter(l=>l&&!l.startsWith('#'));
  assert.deepEqual(rules,['host, metrics.example.net, reject','host-suffix, ads.example.com, reject']);
  assert.deepEqual(out.provenance.find(r=>r.key==='host-suffix,ads.example.com').origins.map(o=>o.source),['alpha','beta']);
  assert.equal(out.provenance.find(r=>r.key==='host,one.ads.example.com').coveredBy,'host-suffix,ads.example.com');
  assert.equal(out.provenance.find(r=>r.key==='host-suffix,deep.ads.example.com').coveredBy,'host-suffix,ads.example.com');
});
test('parent collapse respects label boundaries, not string suffixes',()=>{
  const i=make(); i.sources[0].text='DOMAIN-SUFFIX,ads.example.com\nDOMAIN,notads.example.com\n';
  const out=compile(i,approved(i));
  assert.match(out.files['reject.list'],/^host, notads\.example\.com, reject$/m);
});
test('changed source bytes invalidate a previous AI review',()=>{
  const i=make(), review=approved(i); i.sources[0].text+='DOMAIN,new.example.org\n';
  assert.throws(()=>compile(i,review),/STALE_AI_REVIEW/);
});
test('a fresh download run requires a new review even when content is unchanged',()=>{
  const i=make(),review=approved(i); i.runId='review-run-two';
  assert.throws(()=>compile(i,review),/STALE_AI_REVIEW/);
});
test('changing a hosted JS bundle invalidates its review as well',()=>{
  const i=make(),review=approved(i); i.own.bundle+='\n$task.fetch({url:"https://bad.example"});';
  assert.throws(()=>compile(i,review),/STALE_AI_REVIEW/);
});
test('unsupported, malformed and non-reject rows require explicit reasoned exclusions',()=>{
  const i=make();i.sources[0].text='DOMAIN,ads.example.com\nDOMAIN,login.example.com,DIRECT\nURL-REGEX,.*\n';
  assert.throws(()=>compile(i,approved(i)),/UNRESOLVED_INPUT/);
  const review=approved(i);review.excludedRows={'alpha:2':'Routing is not an advertising reject condition.','alpha:3':'URL regex is not a filter subscription condition.'};
  const out=compile(i,review);
  assert(!out.files['reject.list'].includes('login.example.com'));
});
test('review exclusions are enforced and recorded without silently dropping rules',()=>{
  const i=make();i.sources[0].text='DOMAIN,ads.example.com\nDOMAIN,safebrowsing.googleapis.com\n';
  const review=approved(i);review.exclusions={'host,safebrowsing.googleapis.com':'Security check, not an advertisement.'};
  const out=compile(i,review);
  assert(!out.files['reject.list'].includes('safebrowsing'));
  assert.equal(out.report.excluded.length,1);
});
test('remote code actions are rewritten to immutable assets owned by this release',()=>{
  const i=make(),out=compile(i,approved(i));
  const file='scripts/app-adblock-'+sha(i.own.bundle)+'.js';
  assert.equal(out.files[file],i.own.bundle);
  assert(out.files['rewrite.snippet'].includes(i.baseUrl+'/'+file));
  assert(!out.files['rewrite.snippet'].includes(' app-adblock.js'));
  assert.deepEqual(Object.keys(out.importResources),['filter_remote','rewrite_remote']);
  assert.equal(out.importResources.filter_remote.length,1);
  assert.equal(out.importResources.rewrite_remote.length,1);
});
test('an unreviewed foreign script URL cannot be smuggled into a rewrite',()=>{
  const i=make();i.own.snippet+='^https://api.example.com/other url script-response-body https://external.example/unchecked.js\n';
  assert.throws(()=>compile(i,approved(i)),/UNOWNED_SCRIPT/);
});
test('tokenized and non-HTTPS sources are rejected before release',()=>{
  for(const url of ['https://raw.githubusercontent.com/example/rules/main/a?token=secret','http://example.com/list','https://name:pass@example.com/list']){
    const i=make();i.sources[0].url=url;assert.throws(()=>inspect(i),/UNSAFE_SOURCE_URL/);
  }
});
test('sources with unresolved redistribution rights cannot be released',()=>{
  const i=make();i.sources[0].license.spdx='UNKNOWN';
  assert.throws(()=>compile(i,approved(i)),/LICENSE_NOT_APPROVED/);
});
test('upstream text and license are distributed with source attribution',()=>{
  const i=make(),out=compile(i,approved(i));
  assert.equal(out.files['upstream/alpha.list'],i.sources[0].text);
  assert.equal(out.files['licenses/alpha.txt'],i.sources[0].license.text);
  assert(out.files['SOURCES.md'].includes(i.sources[0].url));
  assert(out.files['SOURCES.md'].includes(sha(i.sources[0].text)));
});
test('empty downloaded lists cannot pass a release gate',()=>{
  const i=make();i.sources[0].text='# temporarily empty\n';
  assert.throws(()=>compile(i,approved(i)),/EMPTY_SOURCE/);
});
test('Surge no-resolve CIDR flags are normalized as reject rather than mistaken for a policy',()=>{
  const i=make();i.sources[0].text='IP-CIDR,101.227.97.240/32,no-resolve\nIP-CIDR6,2402:4e00::1/128,REJECT,no-resolve\n';
  const out=compile(i,approved(i));
  assert.match(out.files['reject.list'],/^ip-cidr, 101\.227\.97\.240\/32, reject$/m);
  assert.match(out.files['reject.list'],/^ip6-cidr, 2402:4e00::1\/128, reject$/m);
});
test('legacy underscore DNS labels remain blockable and are not silently discarded',()=>{
  const i=make();i.sources[0].text='DOMAIN-SUFFIX,09_19.supfree.net,REJECT\n';
  const out=compile(i,approved(i));assert.match(out.files['reject.list'],/^host-suffix, 09_19\.supfree\.net, reject$/m);
});
test('misspelled exclusion decisions fail rather than silently retaining the target rule',()=>{
  const i=make(),review=approved(i);review.exclusions={'host,typo.example.com':'Not an advertisement.'};
  assert.throws(()=>compile(i,review),/UNUSED_REVIEW_DECISION/);
});
