"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../curated/douyin-rewrite.snippet'),'utf8');
const rules=text.split(/\r?\n/).filter(x=>/^\^https?/.test(x)).map(line=>{const[pattern,rest]=line.split(' url ');return {regex:new RegExp(pattern),action:rest.split(' ')[0]};});
const matches=url=>rules.filter(r=>r.regex.test(url));
const positives=[
  'https://log.zijieapi.com/service/2/app_log/','https://applog.zijieapi.com/service/2/app_log?x=1','https://rtlog.zijieapi.com/service/2/app_log/',
  'https://log.snssdk.com/service/2/app_log/','https://rtlog.snssdk.com/service/2/app_log/','https://rtapplog.snssdk.com/service/2/app_log/',
  'https://log.zijieapi.com/service/2/app_log_monitor/',
  'https://mon.snssdk.com/monitor/collect/','https://mon.zijieapi.com/monitor/collect?x=1'
];
test('only confirmed exact telemetry routes are rejected, never answered with invented protocol success',()=>{
  for(const url of positives){const r=matches(url);assert.equal(r.length,1,url);assert.equal(r[0].action,'reject',url);}
});
test('same-host registration, settings and feedback routes are preserved',()=>{
  for(const url of ['https://log.snssdk.com/service/2/device_register/','https://log.zijieapi.com/service/2/log_settings/','https://log.snssdk.com/service/2/app_alert_check/','https://mon.zijieapi.com/monitor/appmonitor/settings','https://aweme.snssdk.com/api/ad/v1/dislike/','https://aweme.snssdk.com/api/ad/v1/report/feedback/','https://aweme.snssdk.com/api/ad/personality_switch/'])assert.equal(matches(url).length,0,url);
});
test('unclosed batch and ack business paths do not silently become blocked',()=>{
  for(const url of ['https://mon.snssdk.com/monitor/collect/batch/','https://mon.zijieapi.com/monitor/collect/c/','https://aweme.snssdk.com/api/ad/v1/ack_action/','https://aweme.snssdk.com/api/ad/v2/ack/splash/','https://aweme.snssdk.com/aweme/track/report','https://aweme.snssdk.com/ecom/cf/track/report'])assert.equal(matches(url).length,0,url);
});
test('lookalike hosts, extra path segments and unconfirmed additional log hosts never match',()=>{
  for(const url of ['https://log.zijieapi.com.evil.example/service/2/app_log/','https://logXzijieapiXcom/service/2/app_log/','https://log.snssdk.com/service/2/app_log/extra','https://log.snssdk.com/service/2/app_logevil/','https://applog.snssdk.com/service/2/app_log/'])assert.equal(matches(url).length,0,url);
});
test('the combined snippet supplies precise MITM hostnames without whole-domain wildcards',()=>{
  const hosts=text.match(/^hostname = (.+)$/m)?.[1]?.split(',').map(x=>x.trim());assert(hosts);
  for(const url of positives)assert(hosts.includes(new URL(url).hostname),url);
  assert(!hosts.includes('*.snssdk.com'));assert(!hosts.includes('*.zijieapi.com'));
});
