import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page = fs.readFileSync(new URL('../src/pages/motionloom.astro', import.meta.url), 'utf8');
const functions = ['freeWasmRenderer','readWasm3DProfile','tryRenderSceneWithWasm'].map(name => {
  const start = page.search(new RegExp(`      (?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const next = page.slice(start + 1).search(/\n      (?:async )?function /);
  return page.slice(start, next < 0 ? undefined : start + 1 + next);
}).join('\n');

function setup(webgpu = true) {
  const profiles = [];
  const played = [];
  class Renderer {
    constructor(_script, profile) { profiles.push(profile); this.total_frames = 24; }
    async render_frame_to_canvas() { throw new Error('reflection HDR is missing'); }
    async render_frame() { return new Uint8Array(4); }
    free() {}
  }
  const context = vm.createContext({
    navigator:{gpu:webgpu ? {} : undefined}, window:{}, console,
    webgpuStatus:{textContent:''}, compileRunToken:1, gpuCanvas:{},
    withTimeout:async promise => promise,
    loadMotionLoomWasm:async () => ({WasmSceneRenderer:Renderer}),
    addImportedSvgAssets() {}, attachGraphAssets:async () => {}, attachMotionLoomFonts:async () => {},
    collectWasmWarmupFrames:() => [], formatWasmError:error => error.message || String(error),
    showCanvas2dPreview() {}, showWebGpuPreview() {}, drawRgbaBuffer() {},
    startWasmSceneLoop:(_renderer,_graph,_size,mode) => played.push(mode),
  });
  vm.runInContext(functions,context);
  return {context,profiles,played};
}

const graph = {size:[128,128],duration:1,fps:24};
const scene3d = '<Graph><CompositeGroup space = "3d"><Model asset="house" /></CompositeGroup></Graph>';

test('failed 3D WebGPU rendering stops with the real cause instead of playing CPU overlays', async () => {
  const {context,profiles,played} = setup();
  await assert.rejects(context.tryRenderSceneWithWasm(scene3d,graph),
    /3D preview requires WebGPU: reflection HDR is missing/);
  assert.deepEqual(profiles,['gpu']);
  assert.deepEqual(played,[]);
  assert.match(context.webgpuStatus.textContent,/reflection HDR is missing/);
});

test('a browser without WebGPU gets an explicit 3D capability error', async () => {
  const {context,profiles,played} = setup(false);
  await assert.rejects(context.tryRenderSceneWithWasm(scene3d,graph),/requires a browser with WebGPU enabled/);
  assert.deepEqual(profiles,[]);
  assert.deepEqual(played,[]);
});

test('2D scenes retain WASM CPU fallback and commented-out 3D tags do not block it', async () => {
  const {context,profiles,played} = setup();
  await context.tryRenderSceneWithWasm('<!-- <CompositeGroup space="3d" /> --><Graph><Rect /></Graph>',graph);
  assert.deepEqual(profiles,['gpu','cpu']);
  assert.deepEqual(played,['cpu']);
});
