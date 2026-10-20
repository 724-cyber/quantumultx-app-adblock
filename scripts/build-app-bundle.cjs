"use strict";
const fs=require('node:fs'),path=require('node:path');
function build(input){
  const bundle='/* Owned multi-app adblock: reviewed static adapters, no external code loading. */\n'+
    '(function(request,response,done){\n"use strict";\nif(typeof done!=="function")return;\n'+
    'var finished=false;var $request=request||{},$response=response;\n'+
    'function $done(value){if(!finished){finished=true;done(value||{});}}\n'+
    'try{\nvar module={exports:{}};\n'+input.douyin+'\n'+
    'var result=module.exports.handle($request,$response);\nif(result!==null){$done(result);return;}\n'+
    input.ali+'\n}catch(error){console.log("[Owned Adblock] unchanged: "+String(error));}'+
    'finally{if(!finished)$done({});}\n'+
    '})(typeof $request==="undefined"?{}:$request,typeof $response==="undefined"?undefined:$response,typeof $done==="function"?$done:undefined);\n';
  const hosts=[],rules=[];
  for(const text of [input.aliSnippet,input.douyinSnippet])for(const line of text.split(/\r?\n/)){
    const host=line.match(/^hostname\s*=\s*(.+)$/);
    if(host)for(const value of host[1].split(',').map(x=>x.trim()))if(!hosts.includes(value))hosts.push(value);
    if(/^\^https?/.test(line)){
      if(!line.includes(' url '))throw new Error('Malformed rewrite');
      new RegExp(line.split(' url ')[0]);
      rules.push(line);
    }
  }
  return {bundle,snippet:'#!name=自有 App 去广告与遥测\n#!desc=闲鱼、淘宝、抖音静态适配；iOS待实测。固定哈希脚本，不运行上游JS。\nhostname = '+hosts.join(', ')+'\n\n'+rules.join('\n')+'\n'};
}
if(require.main===module){
  const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,'curated',name),'utf8');
  const output=build({ali:read('ali-base.js'),douyin:read('douyin-filter.cjs'),aliSnippet:read('ali-rewrite.snippet'),douyinSnippet:read('douyin-rewrite.snippet')});
  fs.writeFileSync(path.join(root,'curated/app-adblock.js'),output.bundle);
  fs.writeFileSync(path.join(root,'curated/rewrite.snippet'),output.snippet);
  console.log('Built owned multi-app bundle and merged rewrite subscription. No network or publication.');
}
module.exports={build};
