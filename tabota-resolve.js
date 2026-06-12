/* ============================================================
   tabota-resolve.js  —  the shared Tabota v2 resolver
   ------------------------------------------------------------
   ONE source of truth. index.html (read-only renderer), TaboTa Roll
   (interactive realizer), and any verifier all import resolve() and
   read the same neutral output; each page's "receptors" decide which
   nodes it keeps.

   resolve(doc) -> {
     nodes:       Node[],          // drawables
     frames:      FrameTerritory[],// regime backgrounds
     totalSec:    number,          // illustrative timeline length
     datum:       0,               // the score datum z, in seconds
     diagnostics: Diagnostic[]     // the verifier's 100%: never throws
   }

   Node = {
     id, kind: 'pitch'|'point'|'tempo'|'lane'|'text'|'frame',
     depth, frame: ResolvedFrame, payload,
     start: Endpoint, end: Endpoint|null,   // end null for point/instant
     pitch: PitchRecord|null,
     lane: string|null, text: string|null,
     tags: string[]   // determinate | relational | indeterminate | ordinal
                      // | unpegged | in-cycle | dangling | point | open | tempo-ramp
   }
   Endpoint = {
     sec: number|null,                 // seconds from datum z (illustrative for ordinal)
     mode: 'measured'|'relational'|'ordinal'|'unplaced',
     coords: [ {frame, lens, value, in} ],  // sec re-expressed in every chart it touches
     rel: {type, of, offset, offsetIn}|null
   }
   PitchRecord = { mode:'hz'|'glide'|'band'|'relative'|'named'|'none',
                   hz, from, to, band:[lo,hi], rel, axis, label }
   ============================================================ */

const NOMINAL_INDEX_SEC = 0.6;   // illustrative spacing for achronous/ordinal layout

/* ---------------- pitch + tuning engine ---------------- */
const PITCH_CLASS={C:0,'C#':1,DB:1,D:2,'D#':3,EB:3,E:4,F:5,'F#':6,GB:6,G:7,'G#':8,AB:8,A:9,'A#':10,BB:10,B:11};
function noteNameToMidi(name){
  const m=String(name).trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/); if(!m) return null;
  const pc=PITCH_CLASS[m[1].toUpperCase()+(m[2]==='b'?'B':m[2])]; if(pc===undefined) return null;
  return (parseInt(m[3],10)+1)*12+pc;
}
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiToFreq(midi,a4=440){ return a4*Math.pow(2,(midi-69)/12); }
function freqToMidi(freq,a4=440){ return 69+12*Math.log2(freq/a4); }
const PYTH=[1,256/243,9/8,32/27,81/64,4/3,729/512,3/2,128/81,27/16,16/9,243/128];
const JUST=[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8];
function temperament(ratios,tonicPc,a4){
  const base=midiToFreq((4+1)*12+tonicPc,a4),map={};
  for(let o=0;o<=9;o++) for(let pc=0;pc<12;pc++){ const s=((pc-tonicPc)+12)%12; map[NOTE_NAMES[pc]+o]=base*ratios[s]*Math.pow(2,o-4); }
  return map;
}
function resolveNoteFreq(name,tuning){
  const a4=tuning.a4||440;
  if(tuning.system==='custom'&&tuning.map&&tuning.map[name]!=null) return tuning.map[name];
  if(tuning.system==='pythagorean'||tuning.system==='just'){
    if(!tuning._m){ const pc=PITCH_CLASS[(tuning.tonic||'C').toUpperCase()]||0; tuning._m=temperament(tuning.system==='pythagorean'?PYTH:JUST,pc,a4); }
    if(tuning._m[name]!=null) return tuning._m[name];
  }
  const midi=noteNameToMidi(name); return midi==null?null:midiToFreq(midi,a4);
}

/* ---------------- frame helpers ---------------- */
const ROOT={ temporal:null, bpm:null, beatsPerMeasure:4, offset:0, axis:null, a4:440,
             tuning:'12-TET', categories:null, secPerUnit:1, unit:'second', O:0, id:null, lenses:[] };

function unitName(temporal){ return temporal==='metered'?'beat':temporal==='achronous'?'index':'second'; }
function chronFactor(u){ return u==='milliseconds'?0.001:u==='minutes'?60:1; }

// seconds-per-unit for a chart; null = unpegged (no path to the time currency)
function secPerUnit(temporal,ts,inheritedBpm){
  if(temporal==='metered'){ const bpm=(ts&&ts.bpm!=null)?+ts.bpm:inheritedBpm; return bpm?60/bpm:null; }
  if(temporal==='chronological') return chronFactor(ts&&ts.units);
  if(temporal==='achronous') return NOMINAL_INDEX_SEC;   // nominal; nodes are tagged 'ordinal'
  return null;
}
function tuningSpec(axis,as){
  const a4=(as&&as.a4)||440;
  let sys='12-TET', tonic='C', map=null;
  const t=as&&as.tuning;
  if(t && typeof t==='object' && t.system==='custom'){ sys='custom'; if(t.notes) map=t.notes; }
  else if(typeof t==='string' && (t==='pythagorean'||t==='just')){ sys=t; }
  return {system:sys,a4,tonic,map};
}

// Build the chart a frame-bearing Event hands its children.
function buildChart(ev, inh, spanStartSec){
  const f=ev.frame||{}; const ts=f.temporalSettings||{}, as=f.axisSettings||{};
  const temporal=f.temporal||inh.temporal;
  const inheritedBpm = inh.temporal==='metered'?inh.bpm:null;
  const bpm = ts.bpm!=null?+ts.bpm:(f.temporal? inheritedBpm : inh.bpm);
  const bpmsr = ts.timeSignature?parseInt(String(ts.timeSignature).split('/')[0],10):(inh.beatsPerMeasure||4);
  const off = ts.offset!=null?+ts.offset:0;
  const spu = f.temporal? secPerUnit(f.temporal,ts,inheritedBpm) : inh.secPerUnit;
  const axis = f.axis||inh.axis;
  const tun  = f.axis? tuningSpec(f.axis,as) : {system:'12-TET',a4:inh.a4};
  const cats = (f.axis && as.categories)?as.categories:(f.axis?null:inh.categories);
  const O = (spu!=null) ? spanStartSec + off*spu : null;   // coordinate zero in absolute seconds
  const chart={ temporal, bpm, beatsPerMeasure:bpmsr, offset:off, axis, a4:tun.a4,
                tuning:tun, categories:cats, secPerUnit:spu, unit:unitName(temporal),
                O, id:ev.id||inh.id||null, lenses:[] };
  // secondary lenses (named charts over the same span)
  (ev.lenses||[]).forEach(L=>{
    const lf=L.frame||{}; const lts=lf.temporalSettings||{}, las=lf.axisSettings||{};
    const ltemp=lf.temporal||temporal;
    let lspu = lf.temporal? secPerUnit(lf.temporal,lts,bpm) : spu;
    if(lspu==null && L.ratioToPrimary!=null && spu!=null) lspu = spu*L.ratioToPrimary; // peg by ratio
    const loff=lts.offset!=null?+lts.offset:0;
    const lO = (lspu!=null)? spanStartSec + loff*lspu : null;
    chart.lenses.push({ id:L.id, temporal:ltemp, secPerUnit:lspu, offset:loff, O:lO,
                        unit:unitName(ltemp), bpm:lts.bpm!=null?+lts.bpm:bpm,
                        beatsPerMeasure:lts.timeSignature?parseInt(String(lts.timeSignature).split('/')[0],10):bpmsr,
                        axis:lf.axis||axis, tuning:lf.axis?tuningSpec(lf.axis,las):tun });
  });
  return chart;
}

// local coordinate (in a chart, possibly a named lens) -> absolute seconds
function localToSec(chart, value, lensId){
  const c = lensId? chart.lenses.find(l=>l.id===lensId) : chart;
  if(!c || c.O==null || c.secPerUnit==null) return null;
  return c.O + value*c.secPerUnit;
}
// absolute seconds -> local coordinate in a chart/lens
function secToLocal(chart, sec, lensId){
  const c = lensId? chart.lenses.find(l=>l.id===lensId) : chart;
  if(!c || c.O==null || c.secPerUnit==null || sec==null) return null;
  return (sec - c.O)/c.secPerUnit;
}
function meterToBeats(m,bpmsr){ return ((m.measure-1)*(bpmsr||4))+(+m.beat||0); }

// Re-express an absolute second in a chart and all its lenses -> coords[]
function coordsFor(sec, chart){
  if(sec==null || !chart) return [];
  const out=[];
  if(chart.O!=null && chart.secPerUnit!=null) out.push({frame:chart.id, lens:null, value:+secToLocal(chart,sec).toFixed(6), in:chart.unit});
  (chart.lenses||[]).forEach(l=>{ if(l.O!=null && l.secPerUnit!=null) out.push({frame:chart.id, lens:l.id, value:+((sec-l.O)/l.secPerUnit).toFixed(6), in:l.unit}); });
  return out;
}

/* ---------------- pitch record ---------------- */
function pitchRecord(value, chart){
  if(!value) return null;
  if(value.lane!=null) return {mode:'none',axis:'categorical',hz:null,label:typeof value.lane==='string'?value.lane:'(lane set)'};
  if(value.text!=null && !value.pitch) return {mode:'none',axis:'instructional',hz:null,label:value.text};
  if(value.tempo) return null;
  const pv=value.pitch; if(!pv) return null;
  const axis=chart.axis||(pv.note!=null?'symbolic':'frequency');
  const tun=chart.tuning||{system:'12-TET',a4:chart.a4||440};
  const toHz=x=> typeof x==='number'?x:resolveNoteFreq(x,tun);
  if(pv.hz!=null) return {mode:'hz',axis,hz:pv.hz,label:pv.hz.toFixed(2)+'Hz'};
  if(pv.note!=null){ const h=toHz(pv.note); return {mode:'named',axis,hz:h,label:pv.note,unresolved:h==null}; }
  if(pv.from!=null||pv.to!=null){ const a=toHz(pv.from!=null?pv.from:pv.to),b=toHz(pv.to!=null?pv.to:pv.from);
    return {mode:'glide',axis,from:a,to:b,label:(pv.from!=null?pv.from:'')+'→'+(pv.to!=null?pv.to:'')}; }
  if(pv.between){ const lo=toHz(pv.between.low),hi=toHz(pv.between.high); return {mode:'band',axis,band:[lo,hi],label:'['+pv.between.low+'–'+pv.between.high+']'}; }
  if(pv.relativeTo) return {mode:'relative',axis,hz:null,rel:{of:pv.relativeTo,relation:pv.relation,cents:pv.offsetCents},label:(pv.relation||'rel')+' '+pv.relativeTo};
  return {mode:'none',axis,hz:null,label:''};
}

/* ============================================================
   resolve
   ============================================================ */
export function resolve(doc){
  const nodes=[], frames=[], diagnostics=[];
  const sym=Object.create(null);     // id -> {startSec,endSec,chart}  (grounded landmarks)
  const declared=new Set();          // every id in the doc (dangling vs cyclic)
  const deferred=[];                  // {endpoint, ev, kind, target ids} to resolve in pass 2
  let primaryAxis=null;

  function diag(level,code,who,message){ diagnostics.push({level,code,who,message}); }
  function name(ev,depth,i){ return ev.id || (ev.role||'event')+'@'+depth+'.'+i; }

  // ---------- landmark -> absolute seconds (if target grounded) ----------
  function landmarkSec(lm){
    if(!lm) return null;
    if(lm.origin==='score-start') return 0;
    const t=sym[lm.event]; if(!t) return undefined;            // undefined = target not (yet) known
    if(lm.coord!=null){
      if(!t.chart) return null;
      const v = (typeof lm.coord==='object')? meterToBeats(lm.coord,(lm.lens?(t.chart.lenses.find(l=>l.id===lm.lens)||{}).beatsPerMeasure:t.chart.beatsPerMeasure)) : lm.coord;
      return localToSec(t.chart, v, lm.lens||null);
    }
    const p=lm.point||'end';
    return p==='start'||p==='onset'?t.startSec : p==='middle'?((t.startSec+t.endSec)/2) : t.endSec;
  }
  // ---------- relation onset from a landmark ----------
  function relationSec(rel, governing){
    const base=landmarkSec(rel.of);
    if(base===undefined) return undefined;     // target unknown
    if(base==null) return null;                // target known but unpegged
    let off=0;
    if(rel.offset!=null){
      const oin=rel.offsetIn||'second';
      off = oin==='second'||oin==='seconds' ? rel.offset
          : (governing && governing.secPerUnit!=null ? rel.offset*governing.secPerUnit : null);
      if(off==null) return null;
    }
    // m/s/=/d/o/f/si/fi/di → start at landmark; b/bi(after) → at landmark (+offset); inverses symmetric enough for placement
    return base + off;
  }

  // ---------- start endpoint of an Event in its governing chart ----------
  function placeStart(ev, governing, seqCursor){
    const p=ev.position||{};
    const lensId=p.lens||null;
    // value-determined onset
    let cLocal=null, unit=null, ordinal=null;
    if(p.at!=null){ cLocal=p.at; }
    else if(p.meter){ const c=lensId?(governing.lenses.find(l=>l.id===lensId)||governing):governing; cLocal=meterToBeats(p.meter,c.beatsPerMeasure); }
    else if(p.index!=null){ cLocal=p.index; ordinal=p.index; }
    if(cLocal!=null){
      const sec=localToSec(governing,cLocal,lensId);
      const isOrd = governing.temporal==='achronous' || ordinal!=null;
      if(sec==null) return {sec:null,mode:'unplaced',coords:[],rel:null,_unpegged:true};
      return {sec, mode:isOrd?'ordinal':'measured', ordinal, coords:coordsFor(sec,governing), rel:null};
    }
    // relational
    if(p.relations && p.relations.length){
      const r=p.relations[0];
      const ep={sec:null,mode:'relational',coords:[],rel:{type:r.type,of:r.of,offset:r.offset,offsetIn:r.offsetIn}};
      return ep; // resolved (or not) in pass 2
    }
    if(p.between){
      const ep={sec:null,mode:'unplaced',coords:[],rel:null,_between:p.between};
      return ep;
    }
    // positionless: sequential at this level
    return {sec:seqCursor, mode:'measured', coords:coordsFor(seqCursor,governing), rel:null, _positionless:true};
  }

  // ---------- end endpoint from extent ----------
  function placeEnd(ev, governing, startSec, extentChart){
    const x=ev.extent||{}; const lensId=(ev.position&&ev.position.lens)||null;
    const inUnit=x.in; const ec=extentChart||governing;
    function asSec(val){ // val quoted in x.in (or the extent chart's unit) -> seconds length
      if(inUnit==='seconds') return val; if(inUnit==='milliseconds') return val/1000; if(inUnit==='minutes') return val*60;
      if(inUnit==='measures'){ return ec.secPerUnit!=null? val*(ec.beatsPerMeasure||4)*ec.secPerUnit : null; }
      if(inUnit==='beats') return ec.secPerUnit!=null?val*ec.secPerUnit:null;
      return ec.secPerUnit!=null?val*ec.secPerUnit:null;   // default: the extent chart's own unit
    }
    if(x.duration!=null){ const len=asSec(x.duration); return len==null?null:{sec:startSec==null?null:startSec+len, mode:'measured', coords:[], rel:null, _len:len}; }
    if(x.endAt!=null){ const e=localToSec(governing,x.endAt,lensId); return e==null?null:{sec:e,mode:'measured',coords:coordsFor(e,governing),rel:null}; }
    if(x.endMeter){ const b=meterToBeats(x.endMeter,governing.beatsPerMeasure); const e=localToSec(governing,b,lensId); return e==null?null:{sec:e,mode:'measured',coords:coordsFor(e,governing),rel:null}; }
    if(x.until){ return {sec:null,mode:'relational',coords:[],rel:{type:'until',of:x.until,offset:0}}; }
    if(x.end==='open') return {sec:null,mode:'measured',coords:[],rel:null,_open:true};
    if(x.between) return {sec:null,mode:'unplaced',coords:[],rel:null,_between:x.between};
    return null; // no extent -> point (caller decides)
  }

  // ---------- recursive walk (pass 1) ----------
  function walk(list, ctx){
    let cursor = ctx.seqStartSec;
    let spanMax = ctx.seqStartSec;
    (list||[]).forEach((ev,i)=>{
      if(!ev||typeof ev!=='object') return;
      const gov=ctx.chart;
      if(gov.axis && !primaryAxis) primaryAxis=gov.axis;

      const start=placeStart(ev, gov, cursor);
      const startSec = start.sec;

      // a frame's self-extent ('measures'/'beats') is measured in its OWN meter, not the parent's
      let selfChart=null;
      if(ev.frame){
        const ts=(ev.frame.temporalSettings)||{};
        const inhBpm = gov.temporal==='metered'?gov.bpm:null;
        selfChart={ secPerUnit: ev.frame.temporal? secPerUnit(ev.frame.temporal,ts,inhBpm) : gov.secPerUnit,
                    beatsPerMeasure: ts.timeSignature?parseInt(String(ts.timeSignature).split('/')[0],10):(gov.beatsPerMeasure||4) };
      }
      // extent / end
      let end = placeEnd(ev, gov, startSec, ev.frame?selfChart:gov);
      // tags
      const tags=[];
      const hasPitch = ev.value && ev.value.pitch;
      const isTempo  = ev.value && ev.value.tempo;
      const isLane   = ev.value && ev.value.lane!=null;
      const isText   = ev.value && ev.value.text!=null && !hasPitch;
      const isFrame  = !!ev.frame;
      const isPoint  = (!ev.extent) && hasPitch;     // value, no extent -> instant
      let kind = isTempo?'tempo' : isPoint?'point' : hasPitch?'pitch' : isLane?'lane' : isText?'text' : isFrame?'frame':'event';

      if(start.mode==='ordinal' || gov.temporal==='achronous') tags.push('ordinal');
      if(start.mode==='relational') tags.push('relational');
      if(start.mode==='unplaced' || start._unpegged){ tags.push(start._unpegged?'unpegged':'unplaced'); }
      if(start._between) tags.push('indeterminate');
      if(end && end._open) tags.push('open');
      if(isTempo && (ev.value.tempo.from!=null||ev.value.tempo.to!=null)) tags.push('tempo-ramp');
      if(isPoint) tags.push('point');
      const pr=pitchRecord(ev.value, gov);
      if(pr && (pr.mode==='band'||pr.mode==='relative'||pr.unresolved)) tags.push('indeterminate');

      // endpoints' coords (start)
      if(startSec!=null && !start.coords.length) start.coords=coordsFor(startSec,gov);

      // record node now; relational endpoints get patched in pass 2
      const node={ id:ev.id||null, kind, depth:ctx.depth, frame:gov, payload:ev.payload||null,
                   start, end:(isPoint?null:end), pitch:pr, lane:isLane?ev.value.lane:null, text:isText?ev.value.text:(ev.value&&ev.value.text)||null,
                   tags };
      nodes.push(node);

      // span extent for default container length
      let endSec = end && end.sec!=null ? end.sec : startSec;
      if(end && end._open) endSec = startSec; // bounded later by totalSec

      // child frame / container
      let childChart=gov, childSpanStart = startSec!=null?startSec:ctx.seqStartSec;
      if(isFrame){
        childChart = buildChart(ev, gov, childSpanStart);
        if(childChart.secPerUnit==null) diag('error','unpegged-frame',name(ev,ctx.depth,i),'frame has no path to the time currency (e.g. meter without bpm); contents cannot be placed in seconds.');
        if((ev.events||[]).some(c=>c.value&&c.value.tempo&&(c.value.tempo.from!=null||c.value.tempo.to!=null)))
          diag('info','tempo-ramp',name(ev,ctx.depth,i),'tempo ramp present; child positions placed at base bpm — exact ramp warping pending.');
      } else if(ev.events && ev.events.length){
        childChart = Object.assign({}, gov, {O:childSpanStart, id:ev.id||gov.id});
      }
      // declare every id; only GROUNDED ones become landmarks
      if(ev.id) declared.add(ev.id);
      if(ev.id && startSec!=null) sym[ev.id]={ startSec, endSec, chart:isFrame?childChart:gov };

      // recurse
      let childMax=childSpanStart;
      if(ev.events && ev.events.length){
        const r=walk(ev.events, {chart:childChart, seqStartSec:childSpanStart, depth:ctx.depth+1});
        childMax=r;
      }
      // default container extent = children bound (only when NO extent was given)
      if(!isPoint && node.end==null && isFinite(childMax) && childMax>(startSec||0)){
        node.end={sec:childMax,mode:'measured',coords:coordsFor(childMax,gov),rel:null}; endSec=childMax;
      }
      // frame territory
      if(isFrame && startSec!=null){
        const fe = (node.end&&node.end.sec!=null)?node.end.sec:Math.max(endSec,childMax);
        frames.push({id:ev.id||('frame'+frames.length), startSec, endSec:fe, axis:childChart.axis, temporal:childChart.temporal, ordinal:childChart.temporal==='achronous', tags:node.tags.slice()});
        node.end=node.end||{sec:fe,mode:'measured',coords:coordsFor(fe,gov),rel:null};
        if(ev.id && sym[ev.id]) sym[ev.id].endSec=fe;
      }

      // queue relational endpoints for pass 2
      if(node.start.mode==='relational') deferred.push({slot:'start', node, ev, gov});
      if(node.end && node.end.mode==='relational') deferred.push({slot:'end', node, ev, gov});

      const myMax=Math.max(endSec||0, childMax||0, startSec||0);
      cursor=Math.max(cursor, isFinite(myMax)?myMax:cursor);
      spanMax=Math.max(spanMax, cursor);
    });
    return spanMax;
  }

  walk(doc.score||[], {chart:ROOT, seqStartSec:0, depth:0});

  // ---------- pass 2: fixpoint resolve relational endpoints ----------
  let changed=true, guard=0;
  while(changed && guard++<64){
    changed=false;
    for(const d of deferred){
      const ep=d.slot==='start'?d.node.start:d.node.end;
      if(ep.mode!=='relational' || ep.sec!=null) continue;
      const sec = ep.rel.type==='until' ? landmarkSec(ep.rel.of) : relationSec(ep.rel, d.gov);
      if(sec===undefined) continue;        // target still unknown
      if(sec==null){ ep.mode='unplaced'; if(!d.node.tags.includes('unpegged')) d.node.tags.push('unpegged'); changed=true; continue; }
      ep.sec=sec; ep.mode='measured';
      ep.coords=coordsFor(sec, d.gov);
      const lm=ep.rel.of; const t=lm&&sym[lm.event];
      if(t && t.chart && t.chart!==d.gov){ ep.coords=ep.coords.concat(coordsFor(sec,t.chart)); }
      if(d.node.id) sym[d.node.id]=sym[d.node.id]||{chart:d.gov};
      if(d.slot==='start'){
        if(d.node.id) sym[d.node.id].startSec=sec;
        const e=d.node.end;     // patch a duration-based end that was waiting on this start
        if(e && e.sec==null && e._len!=null){ e.sec=sec+e._len; e.mode='measured'; e.coords=coordsFor(e.sec,d.gov); if(d.node.id) sym[d.node.id].endSec=e.sec; }
        else if(d.node.id) sym[d.node.id].endSec=(e&&e.sec!=null)?e.sec:sec;
      } else if(d.slot==='end' && d.node.id){ sym[d.node.id].endSec=sec; }
      // a relational node is no longer "relational"-tagged once grounded
      const ix=d.node.tags.indexOf('relational'); if(ix>=0) d.node.tags.splice(ix,1);
      if(!d.node.tags.includes('determinate')) d.node.tags.push('determinate');
      changed=true;
    }
  }
  // anything still relational is part of a cycle or dangles
  for(const d of deferred){
    const ep=d.slot==='start'?d.node.start:d.node.end;
    if(ep.mode==='relational' && ep.sec==null){
      const lm=ep.rel.of; const missing = lm && lm.event && !declared.has(lm.event);
      ep.mode='unplaced';
      if(missing){ if(!d.node.tags.includes('dangling')) d.node.tags.push('dangling'); diag('error','dangling-ref',d.node.id||'?',`references "${lm.event}", which does not exist.`); }
      else { if(!d.node.tags.includes('in-cycle')) d.node.tags.push('in-cycle'); diag('info','cycle',d.node.id||'?','part of a relational cycle: well-formed, but has no linearization (valid Tabota; unschedulable).'); }
    }
  }

  // ---------- finalize: tags + totalSec + open extents ----------
  let totalSec=0;
  nodes.forEach(n=>{ [n.start,n.end].forEach(e=>{ if(e&&e.sec!=null&&isFinite(e.sec)) totalSec=Math.max(totalSec,e.sec); }); });
  frames.forEach(f=>{ if(isFinite(f.endSec)) totalSec=Math.max(totalSec,f.endSec); });
  totalSec=Math.max(totalSec,0.001);
  nodes.forEach(n=>{
    if(n.end && n.end._open && n.end.sec==null){ n.end.sec=totalSec; n.end.coords=coordsFor(totalSec,n.frame); }
    // determinacy tag: a node whose start (and end if present) are measured is determinate
    const grounded = n.start.mode==='measured' && (!n.end || n.end.mode==='measured');
    if(grounded && !n.tags.some(t=>['relational','indeterminate','ordinal','unpegged','unplaced','in-cycle','dangling'].includes(t)) && !n.tags.includes('determinate'))
      n.tags.push('determinate');
    n.tags=[...new Set(n.tags)];
  });

  // reference integrity sweep (refs/landmarks not already flagged)
  function checkRef(id,where){ if(id && !declared.has(id) && id!=='score-start') diag('error','dangling-ref',where,`references "${id}", which does not exist.`); }
  (function sweep(list){ (list||[]).forEach(ev=>{ if(!ev||typeof ev!=='object')return;
    if(ev.ref && ev.ref.target) checkRef(ev.ref.target, ev.id||'(ref)');
    if(ev.events) sweep(ev.events); }); })(doc.score);

  return { nodes, frames, totalSec, datum:0, diagnostics, primaryAxis };
}

/* Convenience for non-module consumers loaded via plain <script>. */
if (typeof window !== 'undefined') { window.TabotaResolve = { resolve }; }
