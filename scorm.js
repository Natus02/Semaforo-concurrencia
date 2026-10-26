/* Adaptador SCORM 1.2. Todas las escrituras y commits verifican su respuesta. */
(function(root){
'use strict';
function findAPI(start){
 const seen=new Set();let w=start;
 for(let i=0;w&&i<20;i++){
  try{if(seen.has(w))break;seen.add(w);if(w.API)return w.API;if(w.parent===w)break;w=w.parent;}catch(_){break;}
 }
 try{const opener=start.opener;if(opener&&!seen.has(opener)){
  w=opener;for(let i=0;w&&i<20;i++){try{if(seen.has(w))break;seen.add(w);if(w.API)return w.API;if(w.parent===w)break;w=w.parent;}catch(_){break;}}
 }}catch(_){}return null;
}
class Bridge {
 constructor(api){this.api=api;this.active=false;this.started=false;this.finished=false;this.lastError='';this.calls=[];this.onError=()=>{};}
 error(method,detail){this.lastError=method+': '+detail;this.onError(this.lastError);return false;}
 call(method,...args){
  try{
   if(!this.api||typeof this.api[method]!=='function')return this.error(method,'API no disponible');
   const result=this.api[method](...args);this.calls.push({method,args,result});
   const code=String(this.api.LMSGetLastError());
   if(code!=='0'){
    let message=code;try{message+=' '+this.api.LMSGetErrorString(code)+' '+this.api.LMSGetDiagnostic(code);}catch(_){}
    return this.error(method,message);
   }
   if(method!=='LMSGetValue'&&String(result)!=='true')return this.error(method,'La API no confirmó la operación');
   return result;
  }catch(e){return this.error(method,e.message||'Error de acceso');}
 }
 initialize(){if(this.started)return this.active;this.started=true;if(!this.api)return false;this.active=this.call('LMSInitialize','')!==false;return this.active;}
 get(key){return this.active?this.call('LMSGetValue',key):false;}
 save(state,score){
  if(!this.active||this.finished)return false;
  const raw=JSON.stringify(state);
  if(new TextEncoder().encode(raw).length>4096)return this.error('suspend_data','Se excedió el límite de 4096 bytes de resguardo');
  const values={
   'cmi.suspend_data':raw,'cmi.core.lesson_location':String(state.pos+1),
   'cmi.core.lesson_status':state.completed?'completed':'incomplete',
   'cmi.core.score.min':'0','cmi.core.score.max':'100','cmi.core.score.raw':String(score),
   'cmi.core.exit':'suspend'
  };
  let ok=true;for(const [k,v]of Object.entries(values)){if(this.call('LMSSetValue',k,v)===false)ok=false;}
  if(!ok)return false;
  if(this.call('LMSCommit','')===false)return false;
  this.lastError='';return true;
 }
 finish(){if(!this.active||this.finished)return false;const ok=this.call('LMSFinish','')!==false;this.finished=true;this.active=false;return ok;}
}
root.ScormBridge={Bridge,findAPI};if(typeof module!=='undefined')module.exports=root.ScormBridge;
})(typeof window!=='undefined'?window:globalThis);
