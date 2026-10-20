"use strict";
// SPDX-License-Identifier: GPL-3.0-only
// Protocol design from bounded static REA evidence; not an iOS traffic capture.
// Only raw JSON ranges are replaced, so unrelated numbers/strings retain bytes.
const feedPaths=['/aweme/v1/feed/','/aweme/v2/feed/','/aweme/v2/preview/feed/'];
const preloadPath=/^\/api\/ad\/splash\/[a-zA-Z0-9_-]{1,40}\/v14\/$/;
const realtimePath='/api/ad/splash/realtime/aweme/v14/';
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function ad(row){return object(row)&&row.is_ads===true&&object(row.raw_ad_data);}
function route(url){
  const m=typeof url==='string'&&url.match(/^https:\/\/([^\/?#:\s]+)(?::443)?(\/[^?#\s]*)(?:\?[^#\s]*)?$/);
  if(!m||m[1].toLowerCase()!=='aweme.snssdk.com')return null;
  if(feedPaths.indexOf(m[2])>=0)return 'feed';
  return preloadPath.test(m[2])?'preload':m[2]===realtimePath?'realtime':null;
}
function ranges(text){
  function ws(p){while(p<text.length&&/\s/.test(text[p]))p++;return p;}
  function stringEnd(p){
    p++;
    for(;p<text.length;p++){
      if(text[p]==='\\')p++;
      else if(text[p]==='"')return p+1;
    }
    throw new Error('Unterminated string');
  }
  function valueEnd(p){
    if(text[p]==='"')return stringEnd(p);
    if(text[p]==='['||text[p]==='{'){
      let depth=0;
      for(;p<text.length;p++){
        const c=text[p];
        if(c==='"')p=stringEnd(p)-1;
        else if(c==='['||c==='{'){if(++depth>128)throw new Error('Depth limit');}
        else if(c===']'||c==='}')if(--depth===0)return p+1;
      }
      throw new Error('Unterminated container');
    }
    for(;p<text.length&&!/[\s,}\]]/.test(text[p]);p++);
    return p;
  }
  function property(start,key){
    let p=ws(start),found=null;
    if(text[p++]!=='{')throw new Error('Object expected');
    p=ws(p);
    while(text[p]!=='}'){
      if(text[p]!=='"')throw new Error('Key expected');
      const end=stringEnd(p),name=JSON.parse(text.slice(p,end));p=ws(end);
      if(text[p++]!==':')throw new Error('Colon expected');
      p=ws(p);const begin=p;const finish=valueEnd(p);
      if(name===key){if(found)throw new Error('Duplicate target key');found={start:begin,end:finish};}
      p=ws(finish);if(text[p]==='}')break;
      if(text[p++]!==',')throw new Error('Comma expected');p=ws(p);
    }
    return found;
  }
  function elements(node){
    if(text[node.start]!=='[')throw new Error('Array expected');
    let p=ws(node.start+1);const result=[];
    while(text[p]!==']'){
      const end=valueEnd(p);result.push({start:p,end});
      if(result.length>10000)throw new Error('Element limit');
      p=ws(end);if(text[p]===']')break;
      if(text[p++]!==',')throw new Error('Comma expected');p=ws(p);
    }
    return result;
  }
  return {property,elements};
}
function handle(request,response){
  const kind=route(request&&request.url);if(!kind)return null;
  const text=response&&response.body;
  if(typeof text!=='string'||text.length>2097152)return {};
  const http=response.statusCode;
  if(typeof http==='number'&&(http<200||http>=300))return {};
  try{
    const parsed=JSON.parse(text);if(!object(parsed))return {};
    const scanner=ranges(text),root=text.search(/\S/),edits=[];
    function filterArray(name,values){
      const node=scanner.property(root,name);if(!node)return;
      if(!Array.isArray(values))return;
      const entries=scanner.elements(node);if(entries.length!==values.length)throw new Error('Array shape mismatch');
      const kept=[];let changed=false;
      values.forEach((row,index)=>{
        if(object(row)){
          scanner.property(entries[index].start,'is_ads');
          scanner.property(entries[index].start,'raw_ad_data');
        }
        if(ad(row))changed=true;else kept.push(text.slice(entries[index].start,entries[index].end));
      });
      if(changed)edits.push({...node,value:'['+kept.join(',')+']'});
    }
    if(kind==='feed'){
      scanner.property(root,'status_code');
      if(parsed.status_code!==0)return {};
      filterArray('aweme_list',parsed.aweme_list);filterArray('preload_ads',parsed.preload_ads);
    }else{
      scanner.property(root,'code');
      if(!object(parsed.data))return {};
      if(kind==='realtime'&&parsed.code!==0)return {};
      if(kind==='preload'&&parsed.code!==0&&!(parsed.code===undefined&&typeof http==='number'&&http>=200&&http<300))return {};
      const dataNode=scanner.property(root,'data');if(!dataNode)return {};
      const names=kind==='realtime'?['splash_ads']:['splash','preload_feed_ads','marketing_splash','realtime_preload_splash'];
      let knownArray=false;
      names.forEach(name=>{
        const node=scanner.property(dataNode.start,name);
        if(!Array.isArray(parsed.data[name]))return;
        knownArray=true;if(!node)return;
        if(parsed.data[name].length)edits.push({...node,value:'[]'});
      });
      if(kind==='preload'&&knownArray){
        const node=scanner.property(dataNode.start,'no_change_show_list');
        if(node&&(parsed.data.no_change_show_list===true||parsed.data.no_change_show_list==='true'))edits.push({...node,value:'false'});
      }
    }
    if(!edits.length)return {};
    edits.sort((a,b)=>b.start-a.start);let output=text,last=text.length;
    for(const edit of edits){if(edit.end>last)throw new Error('Overlapping edit');output=output.slice(0,edit.start)+edit.value+output.slice(edit.end);last=edit.start;}
    return {body:output};
  }catch{return {};}
}
module.exports={handle};
