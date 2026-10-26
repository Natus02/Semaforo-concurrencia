/* Controlador de las doce pantallas. La puntuación se deriva de respuestas comprobadas. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const M=window.SemModel;
const KEY='inet_semaforos_final_2026_v3';
const correct={q1:'b',q1b:'a',qerr:'b',q2:'a'};
const keys=Object.keys(correct);
const table1=[['1','-','N'],['0','X','N'],['0','X','B'],['0','X','B'],['0','Y','L']];
const table2=[['3','0','-'],['2','1','A'],['1','2','AB'],['0','3','ABC'],['0','3','ABC'],['0','3','ACD'],['1','2','CD']];
const prompts=[
 ['Se identifica la sección crítica y se explica el bloqueo de Y.','Se analiza la omisión de V(S): ¿qué ocurre con el acceso exclusivo y con el avance de Y?','Se propone una corrección mínima y se indica dónde debe ubicarse.'],
 ['Se explica el bloqueo de D y el efecto de la liberación de B.','Se comprueba la relación permisos libres + autorizaciones asignadas = 3 y se explica su conservación.','Se justifica qué cambiaría con un semáforo binario inicializado en 1 y quién debería esperar primero.']
];
function fresh(){return{v:3,pos:0,visited:0,answers:{},completed:false,g:M.create(1),l:M.create(1),mode:'g',pg:'',pl:'',ug:false,ul:false,e1:{t:Array(15).fill(''),o:['','',''],attempted:false,shown:false},e2:{t:Array(21).fill(''),o:['','',''],attempted:false,shown:false}};}
// Validación de tipos y límites, también para datos procedentes de un LMS.
function normalize(raw){
 const s=fresh();if(!raw||typeof raw!=='object')return s;
 if(raw.v!==3){ // Compatibilidad con el paquete original cuando el LMS conserva el intento.
  if(['A','B'].includes(raw.owner)){s.g.holders=[raw.owner];s.g.free=0;s.g.blocked=Array.isArray(raw.queue)?raw.queue.filter(x=>['A','B'].includes(x)&&x!==raw.owner).slice(0,1):[];}
  for(const k of keys)if(['a','b','c'].includes(raw.answers?.[k]))s.answers[k]={s:raw.answers[k],e:true};
 }else{
  s.visited=Number.isInteger(raw.visited)?raw.visited&4095:0;
  for(const k of keys){const a=raw.answers?.[k];if(a&&['a','b','c'].includes(a.s))s.answers[k]={s:a.s,e:a.e===true};}
  for(const k of ['g','l'])if(M.valid(raw[k])){s[k]={capacity:raw[k].capacity,free:raw[k].free,holders:raw[k].holders.slice(),blocked:raw[k].blocked.slice(),ready:raw[k].ready.slice(),log:raw[k].log.filter(x=>/^(I[013]|E|P[ABCD][+-]|V[ABCD][ABCD_])$/.test(x)).slice(-24)};}
  if(s.g.capacity!==1)s.g=M.create(1);
  for(const k of ['pg','pl'])s[k]=String(raw[k]||'').slice(0,100);
  for(const k of ['ug','ul'])s[k]=raw[k]===true;
  s.mode=raw.mode==='l'?'l':'g';
  for(const [k,n]of [['e1',15],['e2',21]]){
   const e=raw[k];if(e&&typeof e==='object'){
    s[k].t=Array.from({length:n},(_,i)=>String(e.t?.[i]||'').slice(0,3));
    s[k].o=Array.from({length:3},(_,i)=>String(e.o?.[i]||'').slice(0,120));
    s[k].attempted=e.attempted===true;s[k].shown=s[k].attempted&&e.shown===true;
   }
  }
 }
 s.pos=Number.isInteger(raw.pos)&&raw.pos>=0&&raw.pos<12?raw.pos:0;s.completed=raw.completed===true;return s;
}
const bridge=new window.ScormBridge.Bridge(window.ScormBridge.findAPI(window));
let warning='',localOK=true,saveTimer=null,state=fresh(),inRestore=true;
function transport(text){if($('resume'))$('resume').textContent=text;}
bridge.onError=()=>transport('Atención: el aula no confirmó el guardado. Se conserva una copia local si el navegador lo permite.');
function parse(raw){try{const d=JSON.parse(raw);return d&&typeof d==='object'?d:null;}catch(_){return null;}}
if(bridge.initialize()){
 const raw=bridge.get('cmi.suspend_data');const location=bridge.get('cmi.core.lesson_location');const status=bridge.get('cmi.core.lesson_status');
 if(raw===false||location===false||status===false){warning='No se pudo recuperar todo el estado del aula. Se evita sobrescribirlo; se requiere recargar o consultar al docente.';}
 else{
  const restored=raw?parse(raw):null;
  if(raw&&!restored)warning='El estado guardado en el aula no se puede interpretar. Se evita sobrescribirlo; se requiere consultar al docente.';
  else if(restored){state=normalize(restored);if(restored.v&&restored.v!==3)warning='Versión de estado no compatible. Se evita sobrescribirla; se requiere consultar al docente.';}
  const loc=Number(location);if(Number.isInteger(loc)&&loc>=1&&loc<=12)state.pos=loc-1;
  if(['completed','passed'].includes(status))state.completed=true;
 }
}else{
 try{const raw=localStorage.getItem(KEY);if(raw)state=normalize(parse(raw));}catch(_){localOK=false;}
}
inRestore=false;
function score(){return keys.filter(k=>state.answers[k]?.e&&state.answers[k].s===correct[k]).length*25;}
function done(){return keys.filter(k=>state.answers[k]?.e).length;}
function visited(){return state.visited.toString(2).replace(/0/g,'').length;}
function ready(){return visited()===12&&done()===4&&state.e1.attempted&&state.e2.attempted;}
function save(){
 if(inRestore)return false;
 try{localStorage.setItem(KEY,JSON.stringify(state));localOK=true;}catch(_){localOK=false;}
 if(warning){transport(warning);return false;}
 if(bridge.active){
  const ok=bridge.save(state,score());transport(ok?'Conexión SCORM: último guardado confirmado por el aula.':'Atención: el aula no confirmó el guardado. Se puede reintentar en la pantalla 12.');return ok;
 }
 transport(bridge.api?'API detectada, pero la sesión SCORM no pudo iniciarse. Práctica sin registro confirmado en el aula.':localOK?'Modo local de práctica. Guardado en este navegador; no se envían datos al aula.':'Modo local de práctica sin almacenamiento disponible. El estado se conserva solo mientras la página permanezca abierta.');return localOK;
}
function later(){clearTimeout(saveTimer);saveTimer=setTimeout(save,250);}
function feedback(id,text,good){const e=$(id);if(e){e.textContent=text;e.className='feedback '+(good?'good':'bad');}}
function go(pos){state.pos=Math.max(0,Math.min(11,pos));render(true);window.scrollTo(0,0);}
function render(focus=false){
 state.visited|=1<<state.pos;$('screen').innerHTML=window.SLIDES[state.pos];
 $('counter').textContent=`Pantalla ${state.pos+1} de 12`;$('prog').value=visited();$('progressText').textContent=`Visitadas: ${visited()} de 12 · Comprobadas: ${done()} de 4 · Puntaje automático: ${score()}/100`;
 $('jump').value=String(state.pos);$('back').disabled=state.pos===0;$('next').disabled=state.pos===11;
 if(state.pos===5)setupSimulation();
 if(state.pos===8){exercise(1);question('q1');question('q1b');}
 if(state.pos===9)question('qerr');
 if(state.pos===10){exercise(2);question('q2');}
 if(state.pos===11)finish();
 const heading=$('screen').querySelector('h2');if(heading){heading.tabIndex=-1;if(focus)heading.focus();}
 save();
}
const explanations={
 q1:{a:'La única autorización ya fue asignada a X; Y no puede ingresar a la vez.',b:'X posee el permiso. Y se bloquea y, cuando X libera, recibe autorización y pasa a listo.',c:'El semáforo no se reinicia automáticamente; se modifica con P y V.'},
 q1b:{a:'Sin V(S) ni otra liberación, el permiso no vuelve a estar disponible y Y permanece bloqueado.',b:'Terminar la tarea no libera por sí mismo el permiso. Sin V(S), Y no ingresa automáticamente.'},
 qerr:{a:'INIT(S,0) no concede autorizaciones iniciales, por lo que P no permite ingresar.',b:'Ambos pueden bloquearse: no existe permiso inicial y ninguno alcanza una V. El valor 0 sí es válido para señalización cuando otro proceso puede emitir la señal.',c:'La inicialización no se corrige sola. Para este acceso exclusivo se requiere un permiso inicial y un protocolo correcto.'},
 q2:{a:'Las tres autorizaciones están asignadas a A, B y C. D espera; al liberar B, D recibe la autorización y queda listo.',b:'Un semáforo de conteo puede admitir varias autorizaciones. Aquí el límite es tres.',c:'El número de permisos libres cambia al adquirir y liberar. El valor inicial 3 no permanece constante.'}
};
function question(k){
 const inputs=Array.from(document.querySelectorAll(`input[name="${k}"]`));
 for(const input of inputs){input.checked=state.answers[k]?.s===input.value;input.addEventListener('change',()=>{
  state.answers[k]={s:input.value,e:false};$('progressText').textContent=`Visitadas: ${visited()} de 12 · Comprobadas: ${done()} de 4 · Puntaje automático: ${score()}/100`;feedback('fb_'+k,'Selección modificada. Se debe comprobar para que cuente en el puntaje.',false);later();
 });}
 function show(){const a=state.answers[k];if(a?.e)feedback('fb_'+k,(a.s===correct[k]?'Correcto. ':'Revisar. ')+explanations[k][a.s],a.s===correct[k]);}
 $('check_'+k).onclick=()=>{
  const selected=inputs.find(x=>x.checked);if(!selected){feedback('fb_'+k,'Se debe seleccionar una respuesta antes de comprobar.',false);return;}
  state.answers[k]={s:selected.value,e:true};show();save();
  $('progressText').textContent=`Visitadas: ${visited()} de 12 · Comprobadas: ${done()} de 4 · Puntaje automático: ${score()}/100`;
 };show();
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function modelView(m,target){
 const area=$(target);area.replaceChildren();if(target!=='simdiagram')area.append(el('p',M.describe(m),'box'));
 const diagram=el('div',undefined,'simdiagram');
 for(const id of (m.capacity===3?['A','B','C','D']:['A','B'])){
  const status=m.blocked.includes(id)?'Bloqueado en P(S), sin autorización':m.ready.includes(id)?'Listo con autorización; aún no se representa su ejecución':m.holders.includes(id)?'Autorizado para realizar la actividad protegida':'Fuera, sin autorización';
  const item=el('div',undefined,'simitem '+(m.blocked.includes(id)?'waiting':m.ready.includes(id)?'ready':m.holders.includes(id)?'active':''));item.append(el('strong','Proceso '+id),el('span',status));diagram.append(item);
 }area.append(diagram);
}
function logs(m,id){const list=$(id);list.replaceChildren();list.tabIndex=0;list.setAttribute('aria-label','Registro cronológico de las últimas operaciones');for(const entry of m.log)list.append(el('li',M.logText(entry)));}
function setupSimulation(){
 function panels(){const g=state.mode==='g';$('guidedPanel').hidden=!g;$('labPanel').hidden=g;$('guidedMode').setAttribute('aria-pressed',String(g));$('labMode').setAttribute('aria-pressed',String(!g));}
 $('guidedMode').onclick=()=>{state.mode='g';panels();save();};$('labMode').onclick=()=>{state.mode='l';panels();save();};panels();
 for(const [suffix,key,unlock]of [['G','pg','ug'],['L','pl','ul']]){
  $('predict'+suffix).value=state[key];$('predict'+suffix).oninput=e=>{state[key]=e.target.value.slice(0,100);later();};
  $('start'+suffix).onclick=()=>{if(!state[key].trim()){$('prediction'+suffix).textContent='Se escribe una predicción breve para comenzar.';return;}state[unlock]=true;update();save();};
 }
 function update(){
  $('guidedControls').hidden=!state.ug;$('labControls').hidden=!state.ul;
  $('predictionG').textContent=state.ug?'Predicción guardada. Se puede contrastar con el registro.':'';
  $('predictionL').textContent=state.ul?'Predicción guardada. Se puede contrastar con cada resultado.':'';
  $('status').textContent=M.describe(state.g);modelView(state.g,'simdiagram');logs(state.g,'guidedLog');
  for(const [id,who]of [['a','A'],['b','B']])$(id).disabled=state.g.holders.includes(who)||state.g.blocked.includes(who);
  $('releaseA').disabled=!state.g.holders.includes('A');$('releaseB').disabled=!state.g.holders.includes('B');
  modelView(state.l,'labState');logs(state.l,'labLog');
  $('labKind').textContent=state.l.capacity===3?'Modo de conteo · Capacidad 3 · Procesos A, B, C y D':state.l.capacity===0?'Modo sin autorizaciones iniciales · Capacidad 0 · Procesos A y B':'Modo binario de recursos · Capacidad 1 · Procesos A y B';
 }
 for(const [id,op,who]of [['a','P','A'],['b','P','B'],['releaseA','V','A'],['releaseB','V','B']])$(id).onclick=()=>{const r=M.act(state.g,op,who);update();feedback('message',r.text,r.ok);save();};
 $('reset').onclick=()=>{state.g=M.create(1);update();feedback('message','INIT(S,1). Simulación reiniciada completamente.',true);save();};
 $('console').onsubmit=e=>{e.preventDefault();const r=M.execute(state.l,$('command').value);state.l=r.model;update();feedback('labMessage',r.text,r.ok);save();};
 $('resetLab').onclick=()=>{state.l=M.create(state.l.capacity);$('command').value='';update();feedback('labMessage','Escenario reiniciado: '+M.describe(state.l),true);save();};
 const examples=['INIT(S,1)','INIT(S,0)','INIT(S,3)','P(A)','P(B)','P(C)','P(D)','V(A)','V(B)','V(C)','V(D)','ESTADO'];
 for(const cmd of examples){const b=el('button',cmd,'secondary');b.type='button';b.onclick=()=>{$('command').value=cmd;$('command').focus();};$('commandExamples').append(b);}
 update();
}
const solution1='La sección crítica es la modificación del archivo. X adquiere el único permiso y Y queda bloqueado. Al terminar de modificar, X todavía lo posee: debe ejecutar V(S). V asigna la autorización a Y, que pasa a listo y continúa la P pendiente cuando sea planificado. Si X omite V y nadie libera, Y espera indefinidamente aunque no se produzca acceso simultáneo. La corrección es ejecutar V(S) después de la modificación, sin reinicializar el semáforo en uso.';
const solution2='A, B y C obtienen las tres autorizaciones. D queda bloqueado sin consumir una cuarta. B libera y el permiso se asigna a D, que queda listo: continúan tres asignadas, a A, C y D. Cuando A libera quedan una libre y dos asignadas, a C y D. En cada fila, libres más asignadas suma 3. Con un binario inicializado en 1, B ya debería esperar después de la adquisición de A: la secuencia de tres adquisiciones no podría ocurrir. El límite de una autorización desaprovecharía la capacidad disponible.';
function exercise(n){
 const key='e'+n,e=state[key],root=$('exercise'+n);
 const rows=n===1?['INIT(S,1)','X completa P(S)','Y invoca P(S)','X termina de modificar','X ejecuta V(S)']:['INIT(conexiones,3)','A completa P','B completa P','C completa P','D invoca P','B ejecuta V; se atiende a D','A ejecuta V'];
 const headers=n===1?['Evento','Permisos libres','Asignada a','Situación de Y']:['Evento','Permisos libres','Autorizaciones asignadas','Titulares'];
 const options=n===1?[[['0','0'],['1','1']],[['-','Nadie'],['X','X'],['Y','Y']],[['N','Aún no solicita'],['B','Bloqueado'],['L','Listo con autorización'],['E','Ejecutando']]]:[['0','1','2','3'].map(x=>[x,x]),['0','1','2','3'].map(x=>[x,x]),[['-','Ninguno'],['A','A'],['AB','A y B'],['ABC','A, B y C'],['ACD','A, C y D'],['CD','C y D'],['D','Solo D']]];
 const wrap=el('div',undefined,'tablewrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Tabla de seguimiento del ejercicio '+n);
 const table=el('table'),cap=el('caption','Seguimiento para completar · ejercicio '+n);table.append(cap);
 const thead=el('thead'),tr=el('tr');for(const h of headers){const th=el('th',h);th.scope='col';tr.append(th);}thead.append(tr);table.append(thead);
 const body=el('tbody');
 rows.forEach((r,i)=>{const tr=el('tr'),th=el('th',r);th.scope='row';tr.append(th);
  for(let j=0;j<3;j++){const td=el('td'),select=el('select');select.id=`${key}_${i}_${j}`;select.setAttribute('aria-label',r+' · '+headers[j+1]);
   const blank=el('option','Elegir');blank.value='';select.append(blank);
   for(const [v,label]of options[j]){const opt=el('option',label);opt.value=v;select.append(opt);}select.value=e.t[i*3+j];
   select.onchange=()=>{e.t[i*3+j]=select.value;later();};td.append(select);tr.append(td);
  }body.append(tr);
 });table.append(body);wrap.append(table);root.append(wrap);
 prompts[n-1].forEach((text,i)=>{
  const label=el('label',String.fromCharCode(98+i)+') '+text);label.htmlFor=key+'o'+i;const a=el('textarea');a.id=label.htmlFor;a.maxLength=120;a.rows=3;a.value=e.o[i];a.placeholder='Respuesta breve · hasta 120 caracteres';a.oninput=()=>{e.o[i]=a.value.slice(0,120);later();};root.append(label,a);
 });
 const controls=el('div',undefined,'controls'),attempt=el('button','Guardar intento y revisar'),show=el('button','Mostrar solución explicada','secondary');show.disabled=!e.attempted;controls.append(attempt,show);root.append(controls);
 const fb=el('div',undefined,'feedback');fb.id=key+'feedback';fb.setAttribute('role','status');fb.setAttribute('aria-live','polite');root.append(fb);
 const solution=el('div',undefined,'solution');solution.hidden=!e.shown;root.append(solution);
 function fillSolution(){solution.replaceChildren();solution.append(el('h4','Solución modelo · ejercicio '+n),el('p',n===1?solution1:solution2));
  const t=el('table'),caption=el('caption','Seguimiento resuelto');t.append(caption);const h=el('tr');headers.forEach(x=>{const th=el('th',x);th.scope='col';h.append(th);});t.append(h);
  (n===1?table1:table2).forEach((expected,i)=>{const r=el('tr');r.append(el('th',rows[i]));expected.forEach((v,j)=>r.append(el('td',options[j].find(x=>x[0]===v)?.[1]||v)));t.append(r);});const w=el('div',undefined,'tablewrap');w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label','Solución tabulada del ejercicio '+n);w.append(t);solution.append(w);
  solution.append(el('p','Autoevaluación: se compara cada respuesta breve con la explicación. Se revisan la relación entre eventos y estados, la causa de la espera y la justificación de la corrección o comparación. El sistema no interpreta ni califica semánticamente el texto.'));
 }
 attempt.onclick=()=>{
  if(e.t.some(x=>!x)||e.o.some(x=>!x.trim())){feedback(fb.id,'Se completan todas las celdas y las tres respuestas breves antes de guardar el intento.',false);return;}
  e.attempted=true;show.disabled=false;const expected=(n===1?table1:table2).flat(),hits=e.t.filter((x,i)=>x===expected[i]).length;
  feedback(fb.id,`Intento guardado. Tabla: ${hits} de ${expected.length} celdas coinciden con el modelo. Las respuestas breves se revisan mediante autoevaluación. Estos resultados no suman puntos SCORM.`,hits===expected.length);save();
 };
 show.onclick=()=>{if(!e.attempted)return;e.shown=!e.shown;solution.hidden=!e.shown;show.textContent=e.shown?'Ocultar solución explicada':'Mostrar solución explicada';fillSolution();save();};
 if(e.attempted)feedback(fb.id,'Existe un intento guardado. Se puede revisar la solución y modificar las respuestas.',true);
 if(e.shown){fillSolution();show.textContent='Ocultar solución explicada';}
}
function finish(){
 $('summary').textContent=`Recorrido: ${visited()}/12 pantallas. Preguntas comprobadas: ${done()}/4. Puntaje automático: ${score()}/100. Ejercicio 1 intentado: ${state.e1.attempted?'sí':'no'}. Ejercicio 2 intentado: ${state.e2.attempted?'sí':'no'}. Finalización pedagógica: ${state.completed?'completada':'pendiente'}.`;
 $('finish').disabled=!state.completed&&!ready();
 if(state.completed)feedback('finishmessage','El módulo conserva su condición de completado. Las respuestas pueden revisarse; el puntaje vigente se actualiza al comprobarlas.',true);
 else if(!ready())feedback('finishmessage','Para finalizar se requiere completar el recorrido, comprobar las cuatro preguntas e intentar los dos ejercicios. Se puede navegar libremente para completar lo pendiente.',false);
 $('finish').onclick=()=>{
  if(!state.completed&&!ready())return;state.completed=true;const ok=save();
  feedback('finishmessage',bridge.active?(ok?'Finalización y puntaje confirmados por la API del aula.':'Finalización conservada en el recurso, pero el aula no confirmó el guardado. Se requiere reintentar.'):localOK?'Módulo completado en práctica local. No se enviaron datos a un aula.':'Módulo completado en esta página, sin almacenamiento disponible ni comunicación con un aula.',ok);$('summary').textContent=`Módulo completado · Puntaje automático vigente: ${score()}/100.`;
 };
 $('retrySave').onclick=()=>{const ok=save();feedback('finishmessage',ok?(bridge.active?'Guardado confirmado por el aula.':'Guardado local; no se enviaron datos al aula.'):'No se confirmó el guardado. Se requiere mantener abierta la página y consultar al docente.',ok);};
}
const titles=window.SLIDES.map(html=>{const m=/<h2>(.*?)<\/h2>/.exec(html);return m?m[1]:'Pantalla';});
for(let i=0;i<12;i++){const opt=el('option',titles[i]);opt.value=String(i);$('jump').append(opt);}
$('go').onclick=()=>go(Number($('jump').value));$('back').onclick=()=>go(state.pos-1);$('next').onclick=()=>go(state.pos+1);
window.addEventListener('pagehide',e=>{clearTimeout(saveTimer);save();if(!e.persisted)bridge.finish();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
render();
// Superficie de inspección solo lectura para pruebas reproducibles, sin mutaciones de estado.
window.SemaforosInspect=Object.freeze({snapshot:()=>JSON.parse(JSON.stringify(state)),score,ready});
})();
