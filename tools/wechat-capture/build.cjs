'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,storeKey='owned.wx-capture.v1',gateKey=storeKey+'.gate';
const baseUrl='https://raw.githubusercontent.com/724-cyber/quantumultx-app-adblock/main/tools/wechat-capture';
function build(){
 const core=fs.readFileSync(path.join(root,'src/core.cjs'),'utf8');
 const wrap=file=>'/* Temporary WeChat minimized collector. GPL-3.0-only. */\n(function(){\nvar module={exports:{}};var STORE_KEY='+JSON.stringify(storeKey)+';var GATE_KEY='+JSON.stringify(gateKey)+';\n'+core+'\n'+fs.readFileSync(path.join(root,'src',file),'utf8')+'\n})();\n';
 const captureSource=wrap('capture-entry.js'),controlSource=wrap('control-entry.js'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const captureAsset='assets/capture-'+hash(captureSource)+'.js',controlAsset='assets/control-'+hash(controlSource)+'.js';
 const hosts=require('./src/core.cjs').hosts.map(h=>h.replace(/\./g,'\\.')).join('|');
 const prefix='^https?://(?:'+hosts+')(?:\\:[0-9]{1,5})?';
 const script=baseUrl+'/'+captureAsset;
 const snippet='#!name=微信临时脱敏采集\n#!desc=手动开始后最多5分钟；不新增MITM，不改分流。未解密流量可能无记录。\n; No hostname directive: existing MITM settings are preserved.\n'+
  prefix+'/ url script-request-header '+script+'\n'+
  prefix+'/(?:cgi-bin/mmbiz-bin/js-operatewxdata(?:-vip|-keepalive|-quic)?|cgi-bin/mmoc-bin/ad/addatareport)(?:[?]|$) url script-response-body '+script+'\n';
 const actions=[['start','微信采集 开始新采样 清空旧采样'],['export','微信采集 停止并导出到iCloud'],['status','微信采集 查看状态'],['clear','微信采集 清除本地采样']];
 const gallery={name:'微信临时脱敏采集',description:'手动开始后采集最小摘要；最多5分钟/64条。默认不新增MITM、不放行广告、不改已有订阅；导出按钮写入自己的iCloud Drive。iPhone尚待验证。',task:actions.map(([action,tag],i)=>({config:'event-interaction '+baseUrl+'/'+controlAsset+'#action='+action+', tag='+tag+', enabled=true',...(i===0?{addons:baseUrl+'/capture.snippet'}:{})}))};
 const importUrl='https://quantumult.app/x/open-app/ui?module=gallery&type=task&action=add&content='+encodeURIComponent(JSON.stringify([baseUrl+'/gallery.json']));
 const nativeImportUrl=importUrl.replace('https://quantumult.app/x/open-app/','quantumult-x:///');
 return {baseUrl,storeKey,gateKey,captureSource,controlSource,captureAsset,controlAsset,snippet,gallery,importUrl,nativeImportUrl};
}
if(require.main===module){
 const p=build(),files={[p.captureAsset]:p.captureSource,[p.controlAsset]:p.controlSource,'capture.snippet':p.snippet,'gallery.json':JSON.stringify(p.gallery,null,2)+'\n','install.json':JSON.stringify({importUrl:p.importUrl,nativeImportUrl:p.nativeImportUrl,storeKey:p.storeKey,gateKey:p.gateKey,captureAsset:p.captureAsset,controlAsset:p.controlAsset,iosDeviceTested:false},null,2)+'\n'};
 if(process.argv.includes('--check')){for(const [name,data] of Object.entries(files))if(!fs.existsSync(path.join(root,name))||fs.readFileSync(path.join(root,name),'utf8')!==data)throw Error('Rebuild temporary capture package: '+name);console.log('Temporary capture package is reproducible.');}
 else {for(const [name,data] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),data);}console.log('Built temporary capture package; main adblock resources untouched.');}
}
module.exports={build};
