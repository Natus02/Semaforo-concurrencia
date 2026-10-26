/* Modelo pedagógico de permisos. No ejecuta JavaScript suministrado por el alumno. */
(function (root) {
  'use strict';
  const IDS = ['A','B','C','D'];
  function create(capacity=1) {
    return {capacity, free:capacity, holders:[], blocked:[], ready:[], log:[`I${capacity}`]};
  }
  function valid(m) {
    if(!m || ![0,1,3].includes(m.capacity) || !Number.isInteger(m.free) || m.free<0) return false;
    if(!['holders','blocked','ready','log'].every(k=>Array.isArray(m[k])))return false;
    const allowed=m.capacity===3?IDS:IDS.slice(0,2);
    if(![...m.holders,...m.blocked,...m.ready].every(p=>allowed.includes(p)))return false;
    if([m.holders,m.blocked,m.ready].some(a=>new Set(a).size!==a.length))return false;
    if(m.holders.some(p=>m.blocked.includes(p))||m.ready.some(p=>!m.holders.includes(p)))return false;
    return m.free+m.holders.length===m.capacity && (!m.blocked.length||m.free===0);
  }
  function record(m,entry){m.log.push(entry);m.log=m.log.slice(-24);}
  function act(m,op,p) {
    if(!valid(m))return {ok:false,text:'Estado inválido. Se requiere reiniciar el modelo.'};
    const allowed=m.capacity===3?IDS:IDS.slice(0,2);
    if(!allowed.includes(p))return {ok:false,text:'En esta modalidad solo participan '+allowed.join(', ')+'.'};
    if(op==='P'){
      if(m.holders.includes(p))return {ok:false,text:`${p} ya tiene autorización; no puede adquirirla otra vez.`};
      if(m.blocked.includes(p))return {ok:false,text:`${p} ya está bloqueado en P(S); no debe repetir la solicitud.`};
      if(m.free){m.free--;m.holders.push(p);record(m,'P'+p+'+');return{ok:true,text:`${p} completa P(S) y obtiene una autorización. Puede realizar su actividad protegida.`};}
      m.blocked.push(p);record(m,'P'+p+'-');return{ok:true,text:`${p} invoca P(S) y queda bloqueado: no existen permisos libres. No consume CPU en espera activa.`};
    }
    if(op==='V'){
      if(!m.holders.includes(p))return{ok:false,text:`${p} no posee una autorización. No puede ejecutar esta liberación en el modelo de recursos.`};
      m.holders=m.holders.filter(x=>x!==p);m.ready=m.ready.filter(x=>x!==p);
      const next=m.blocked.shift();record(m,'V'+p+(next||'_'));
      if(next){m.holders.push(next);m.ready.push(next);return{ok:true,text:`${p} ejecuta V(S). La autorización se asigna a ${next}, que pasa de bloqueado a listo; su ejecución depende del planificador. No queda un permiso libre.`};}
      m.free++;return{ok:true,text:`${p} ejecuta V(S). Queda ${m.free} autorización(es) libre(s).`};
    }
    return{ok:false,text:'Operación no reconocida.'};
  }
  function describe(m){return `Capacidad: ${m.capacity}. Permisos libres: ${m.free}. Autorizados: ${m.holders.join(', ')||'ninguno'}. Bloqueados: ${m.blocked.join(', ')||'ninguno'}. Listos con autorización: ${m.ready.join(', ')||'ninguno'}.`;}
  function execute(m,raw){
    const cmd=String(raw).trim().toUpperCase().replace(/\s+/g,'');
    let hit=/^INIT\(S,([013])\)$/.exec(cmd);
    if(hit)return{ok:true,model:create(Number(hit[1])),text:`INIT(S,${hit[1]}). Se reinicia todo el escenario; no se reinicializa un semáforo real en uso.`};
    if(cmd==='ESTADO'){record(m,'E');return{ok:true,model:m,text:describe(m)};}
    hit=/^([PV])\(([ABCD])\)$/.exec(cmd);
    if(hit){const r=act(m,hit[1],hit[2]);return{...r,model:m};}
    return{ok:false,model:m,text:'Instrucción inválida. Se admite INIT(S,0), INIT(S,1), INIT(S,3), P(A), V(A) y sus variantes para los procesos del modo elegido, o ESTADO. Se ejecuta una instrucción por vez.'};
  }
  function logText(entry){
    if(/^I[013]$/.test(entry))return `INIT(S,${entry[1]}) — Escenario reiniciado.`;
    if(entry==='E')return 'ESTADO — Consulta del estado del modelo.';
    if(entry[0]==='P')return `P(S) de ${entry[1]} — ${entry[2]==='+'?'Obtiene autorización y puede realizar la actividad.':'Queda bloqueado sin autorización.'}`;
    return `V(S) de ${entry[1]} — ${entry[2]==='_'?'Aumenta en uno la disponibilidad.':`La autorización pasa a ${entry[2]}, que queda listo; no se transfiere la CPU.`}`;
  }
  const api={create,valid,act,execute,describe,logText};root.SemModel=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
