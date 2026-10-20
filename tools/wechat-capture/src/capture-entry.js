// QX rewrite adapter: never return any modified request/response field.
try {
  var gate=$prefs.valueForKey(GATE_KEY);
  if(typeof gate!=='string'||!/^\d+$/.test(gate))return;
  var next=module.exports.capture($prefs.valueForKey(STORE_KEY),typeof $request==='undefined'?{}:$request,typeof $response==='undefined'?undefined:$response,Date.now());
  if(next&&String(next.startedAt)===gate&&$prefs.valueForKey(GATE_KEY)===gate)$prefs.setValueForKey(JSON.stringify(next),STORE_KEY);
} catch (_) {
  // Do not log raw URLs, headers, body or exception messages.
} finally {
  $done({});
}
