// Runs only when the user taps an event-interaction task. No uploads/fetches.
try {
  var action='status';
  var environment=typeof $environment==='undefined'?{}:$environment;
  var match=String(environment.sourcePath||'').match(/[#&]action=(start|export|status|clear)(?:&|$)/);
  if(match)action=match[1];
  if(environment.variables&&['start','export','status','clear'].indexOf(environment.variables.action)>=0)action=environment.variables.action;
  if(['start','export','clear'].indexOf(action)>=0){
    $prefs.setValueForKey('off',GATE_KEY);
    if($prefs.valueForKey(GATE_KEY)!=='off')throw new Error('storage unavailable');
  }
  var result=module.exports.control(action,$prefs.valueForKey(STORE_KEY),Date.now());
  if(action==='status'&&result.state&&$prefs.valueForKey(GATE_KEY)!==String(result.state.startedAt))result.state.active=false;
  if(result.state===null){
    if(action==='clear'){$prefs.removeValueForKey(STORE_KEY);if($prefs.valueForKey(STORE_KEY))throw new Error('storage unavailable');}
  } else {
    var serialized=JSON.stringify(result.state);
    $prefs.setValueForKey(serialized,STORE_KEY);
    if($prefs.valueForKey(STORE_KEY)!==serialized)throw new Error('storage unavailable');
  }
  if(action==='start'){
    $prefs.setValueForKey(String(result.state.startedAt),GATE_KEY);
    if($prefs.valueForKey(GATE_KEY)!==String(result.state.startedAt))throw new Error('storage unavailable');
  }
  if(action==='clear'){$prefs.removeValueForKey(GATE_KEY);if($prefs.valueForKey(GATE_KEY))throw new Error('storage unavailable');}
  if(action==='export'){
    var json=JSON.stringify(result.report,null,2),saved=false;
    var file='wechat-capture/wx-capture-'+Date.now()+'.json';
    try {if(typeof $iCloud!=='undefined'&&typeof TextEncoder!=='undefined')saved=$iCloud.writeFile(new TextEncoder().encode(json),file)===true;}catch(_){}
    if(saved)$notify('微信临时采集','已停止并导出到你的 iCloud Drive','Quantumult X/Data/'+file+'；发送前请人工检查。');
    else {console.log('WX_CAPTURE_EXPORT_BEGIN\n'+json+'\nWX_CAPTURE_EXPORT_END');$notify('微信临时采集','已停止，iCloud 文件导出未成功','仅复制日志中 WX_CAPTURE_EXPORT_BEGIN/END 之间的 JSON，不要分享整份 QX 日志。');}
  } else if(action==='start')$notify('微信临时采集','新采样已开始，旧采样已清空','最多 5 分钟或 64 条摘要；不新增 MITM，不修改流量。');
  else if(action==='clear')$notify('微信临时采集','仅已清除本工具的本地采样','已经导出的 iCloud 文件需自行管理；其他脚本数据未改动。');
  else $notify('微信临时采集',result.state&&result.state.active?'采集中':'未采集',String(result.state?result.state.records.length:0)+' 条摘要；未解密、已拒绝或专有通道可能没有记录。');
} catch (_) {
  $notify('微信临时采集','操作失败','未输出原始请求。请手动停用临时重写，并检查 QX 版本、脚本下载及存储权限。');
} finally {
  $done({});
}
