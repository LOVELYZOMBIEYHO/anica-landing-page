// =========================================
// =========================================
// tests/mesh-edit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshTargets, rewriteVertices, project, dragDelta } from '../src/scripts/motionloom-mesh-core.ts';
const source = `<!-- <MeshAsset id="fake"><Vertex position={[7,7,7]} /></MeshAsset> -->
<HeadAsset id="head"><HeadCage><Vertex position={[9,9,9]} /></HeadCage></HeadAsset>
<MeshAsset id="mesh"><Vertex position={[0,0,0]} uv={[0.2,0.3]} pinned="true" /><Vertex position={[1,0,0]} /><Face indices={[0,1,2]} /></MeshAsset>
<Model id="one" asset="mesh" /><Model id="two" asset="mesh" /><Model id="head_model" asset="head" />`;
test('only explicit mesh models are targets; shared instances are disclosed',()=>{
 assert.deepEqual(meshTargets(source),[{modelId:'one',assetId:'mesh',users:2},{modelId:'two',assetId:'mesh',users:2}]);
});
test('rewrite changes only chosen positions and preserves other source byte for byte',()=>{
 const next=rewriteVertices(source,'mesh',new Map([[0,[0.1,0.2,0.3]]]));
 assert.equal(next,source.replace('position={[0,0,0]}','position={[0.1,0.2,0.3]}'));
 assert.throws(()=>rewriteVertices(source,'head',new Map([[0,[1,2,3]]])));
 assert.throws(()=>rewriteVertices(source,'mesh',new Map([[999,[1,2,3]]])));
});
test('rotated scaled camera basis maps view-plane drag back to source coordinates',()=>{
 const s={origin:[0,0,5],basis:[[0,2,0],[-2,0,0],[0,0,2]],center:[100,100],size:[200,200],focal:100,near:0.1};
 const p=[0.1,0.2,0];const before=project(s,p);const d=dragDelta(s,p,20,-10,'free');const after=project(s,p.map((n,i)=>n+d[i]));
 assert.ok(Math.abs(after[0]-before[0]-20)<1e-7);assert.ok(Math.abs(after[1]-before[1]+10)<1e-7);
 assert.equal(project(s,[0,0,-3]),null);
});
