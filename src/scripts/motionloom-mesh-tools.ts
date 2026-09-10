// =========================================
// =========================================
// src/scripts/motionloom-mesh-tools.ts

import { meshTargets, project, dragDelta, rewriteVertices, type Snapshot, type V3 } from './motionloom-mesh-core';

type Host = { snapshot: (source: string, model: string) => Promise<Snapshot>;
  pause: () => void; changed: (commit: boolean) => void; history: (source: string) => void;
  undo: () => void; redo: () => void };
export function installMeshEditing(host: Host) {
  const panel = document.querySelector<HTMLElement>('#model-editing-content')!;
  const overlay = document.querySelector<SVGSVGElement>('#motionloom-mesh-overlay')!;
  const editor = document.querySelector<HTMLTextAreaElement>('#dsl-editor')!;
  const mode = document.querySelector<HTMLSelectElement>('#scene-tool-panel-select')!;
  panel.innerHTML = `<div class="mesh-tools">
    <label>MeshAsset model <select data-mesh="target" aria-label="MeshAsset model"></select></label>
    <div class="mesh-buttons"><button data-mesh="refresh">Edit / Refresh</button><button data-mesh="exit">Exit mesh</button><button data-mesh="undo">Undo</button><button data-mesh="redo">Redo</button></div>
    <label>Drag axis <select data-mesh="axis"><option value="free">View plane</option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
    <div class="mesh-coordinates">${['x','y','z'].map(a=>`<label>${a.toUpperCase()}<input data-mesh="${a}" type="number" step="0.01" aria-label="Selected vertex ${a.toUpperCase()}" /></label>`).join('')}</div>
    <div class="mesh-buttons"><button data-mesh="all">Select all</button><button data-mesh="none">Clear selection</button><button data-mesh="apply">Apply XYZ</button></div>
    <label><input data-mesh="xray" type="checkbox" checked disabled /> X-ray control cage</label>
    <p>Click a point; Shift adds or removes. Drag empty space to box-select. Drag selected points to move. XYZ sets the selection center in asset coordinates.</p>
    <output data-mesh="status" aria-live="polite">Choose a MeshAsset model. HeadAsset is not editable here.</output>
  </div>`;
  const q = <T extends HTMLElement>(key: string) => panel.querySelector<T>(`[data-mesh="${key}"]`)!;
  const target = q<HTMLSelectElement>('target'); const status = q<HTMLOutputElement>('status');
  let snapshot: Snapshot | null = null; let revision = ''; let selected = new Set<number>(); let generation = 0;
  let drag: { start: [number,number]; source: string; snapshot: Snapshot; center: V3; moved: boolean; box: boolean; additive: boolean; before: Set<number> } | null = null;
  const say = (text: string) => status.textContent = text;
  function populate() {
    const previous = target.value; target.replaceChildren();
    for (const t of meshTargets(editor.value)) {
      const option = document.createElement('option'); option.value = t.modelId;
      option.textContent = `${t.modelId} → ${t.assetId}${t.users > 1 ? ` (${t.users} shared instances)` : ''}`; target.append(option);
    }
    if ([...target.options].some(o=>o.value===previous)) target.value=previous;
    if (!target.options.length) say('No named Model referencing MeshAsset in this DSL. HeadAsset and HairAsset stay parametric.');
  }
  function exit() { drag=null; generation++; snapshot=null; selected.clear(); overlay.replaceChildren(); overlay.classList.add('hidden'); target.disabled=false; }
  function center(): V3 {
    if (!snapshot || !selected.size) return [0,0,0];
    return [0,1,2].map(a=>[...selected].reduce((sum,i)=>sum+snapshot!.positions[i][a],0)/selected.size) as V3;
  }
  function inputs() { const c=center(); ['x','y','z'].forEach((a,i)=>q<HTMLInputElement>(a).value=String(Number(c[i].toFixed(7)))); }
  function svg(name: string, attrs: Record<string,string>) { const el=document.createElementNS('http://www.w3.org/2000/svg',name); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); return el; }
  function draw() {
    overlay.replaceChildren(); if(!snapshot || mode.value!=='model-editing') return;
    overlay.classList.remove('hidden'); overlay.setAttribute('viewBox',`0 0 ${snapshot.size.join(' ')}`);
    const points=snapshot.positions.map(p=>project(snapshot!,p)); const edges=new Set<string>(); const paths:string[]=[];
    for(const face of snapshot.faces) for(let j=0;j<face.length;j++) { const a=face[j],b=face[(j+1)%face.length]; const key=[Math.min(a,b),Math.max(a,b)].join(':'); if(edges.has(key)) continue; edges.add(key); const p=points[a],n=points[b]; if(p&&n) paths.push(`M${p[0]},${p[1]}L${n[0]},${n[1]}`); }
    overlay.append(svg('path',{d:paths.join(' '),stroke:'#b9ff3980','stroke-width':'0.8',fill:'none','pointer-events':'none'}));
    points.forEach((p,i)=>{if(p) overlay.append(svg('circle',{cx:String(p[0]),cy:String(p[1]),r:selected.has(i)?'5':'3.5',fill:selected.has(i)?'#b9ff39':'#11120d',stroke:'#b9ff39','stroke-width':'1','data-vertex':String(i)}));}); inputs();
  }
  async function refresh() {
    host.pause(); populate(); if(!target.value) return;
    const token=++generation; const source=editor.value; say('Resolving cage and camera…');
    try { const next=await host.snapshot(source,target.value); if(token!==generation || source!==editor.value) return;
      snapshot=next; revision=source; selected=new Set([...selected].filter(i=>i<next.positions.length)); target.disabled=true; draw();
      say(`${next.assetId}: ${next.positions.length} control vertices. X-ray selection includes hidden points. Shared instances update together.`);
    } catch(e) { if(token!==generation)return; exit(); say(String(e)); }
  }
  function write(source:string, snap:Snapshot, delta:V3, commit:boolean) {
    const changes=new Map<number,V3>(); for(const i of selected) changes.set(i,snap.positions[i].map((n,a)=>n+delta[a]) as V3);
    const next=rewriteVertices(source,snap.assetId,changes); editor.value=next; revision=next;
    snapshot={...snap,positions:snap.positions.map((p,i)=>changes.get(i)||p)}; host.changed(commit); draw();
  }
  q('refresh').addEventListener('click',()=>void refresh()); q('exit').addEventListener('click',exit);
  q('undo').addEventListener('click',()=>{exit();host.undo();populate();}); q('redo').addEventListener('click',()=>{exit();host.redo();populate();});
  q('all').addEventListener('click',()=>{if(snapshot) selected=new Set(snapshot.positions.map((_,i)=>i));draw();});
  q('none').addEventListener('click',()=>{selected.clear();draw();});
  q('apply').addEventListener('click',()=>{ if(!snapshot||!selected.size){say('Refresh the mesh and select vertices first.');return;} if(editor.value!==revision){exit();say('DSL changed; refresh mesh first.');return;}
    const p=['x','y','z'].map(a=>Number(q<HTMLInputElement>(a).value)) as V3; if(!p.every(Number.isFinite))return;
    const c=center(); host.history(editor.value); write(editor.value,snapshot,p.map((n,i)=>n-c[i]) as V3,true); void refresh(); });
  function point(event:PointerEvent):[number,number] { const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(overlay.getScreenCTM()!.inverse()); return [p.x,p.y]; }
  overlay.addEventListener('pointerdown',(e)=>{if(!snapshot||e.button!==0)return; if(revision!==editor.value){exit();say('DSL changed; refresh mesh first.');return;} host.pause();
    const index=(e.target as Element).getAttribute('data-vertex'); const before=new Set(selected);
    if(index!==null){const i=Number(index); if(e.shiftKey&&selected.has(i)){selected.delete(i);draw();return;} if(!e.shiftKey&&!selected.has(i))selected.clear(); selected.add(i);}
    drag={start:point(e),source:editor.value,snapshot,center:center(),moved:false,box:index===null,additive:e.shiftKey,before};
    overlay.setPointerCapture(e.pointerId); e.preventDefault();draw();
  });
  overlay.addEventListener('pointermove',(e)=>{if(!drag||!snapshot)return; const end=point(e); const dx=end[0]-drag.start[0],dy=end[1]-drag.start[1]; if(Math.hypot(dx,dy)<2&&!drag.moved)return;
    if(drag.box){selected=drag.additive?new Set(drag.before):new Set(); snapshot.positions.forEach((p,i)=>{const v=project(snapshot!,p); if(v&&v[0]>=Math.min(end[0],drag!.start[0])&&v[0]<=Math.max(end[0],drag!.start[0])&&v[1]>=Math.min(end[1],drag!.start[1])&&v[1]<=Math.max(end[1],drag!.start[1]))selected.add(i);}); draw(); overlay.append(svg('rect',{x:String(Math.min(end[0],drag.start[0])),y:String(Math.min(end[1],drag.start[1])),width:String(Math.abs(dx)),height:String(Math.abs(dy)),fill:'#b9ff3910',stroke:'#b9ff39','pointer-events':'none'}));drag.moved=true;return;}
    try {const d=dragDelta(drag.snapshot,drag.center,dx,dy,q<HTMLSelectElement>('axis').value); if(!drag.moved)host.history(drag.source); drag.moved=true; write(drag.source,drag.snapshot,d,false);}catch(error){say(String(error));}
  });
  overlay.addEventListener('pointerup',()=>{if(!drag)return; const moved=drag.moved&&!drag.box; if(drag.box&&!drag.moved)selected.clear();drag=null;draw();if(moved){host.changed(true);void refresh();}});
  overlay.addEventListener('pointercancel',()=>{if(drag&&!drag.box&&drag.moved){editor.value=drag.source;host.changed(true);}drag=null;exit();});
  window.addEventListener('motionloom:tool-panel-change',()=>{exit();if(mode.value==='model-editing')populate();});
  // External edits and scrubbing invalidate projections; never apply a stale vertex index.
  editor.addEventListener('input',()=>{exit();if(mode.value==='model-editing')populate();});
  window.addEventListener('motionloom:dsl-source-change',()=>{
    // A compile notification for our own revision must not clear the active selection.
    if(editor.value===revision)return;
    exit();if(mode.value==='model-editing')populate();
  });
  window.addEventListener('motionloom:mesh-frame-change',()=>{if(mode.value==='model-editing'&&!drag){exit();say('Frame changed. Refresh the cage before editing.');}});
  populate();
}
