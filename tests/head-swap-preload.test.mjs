import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the production inline preloader against deterministic URL responses.
const source = fs.readFileSync(new URL('../src/pages/motionloom.astro', import.meta.url), 'utf8');
const functions = ['resolveGraphAssetUrl', 'collectGraphAssetReferences', 'collectGraphEnvironmentSources', 'attachGraphAssets'].map((name) => {
  const start = source.search(new RegExp(`      (?:async )?function ${name}\\(`));
  const next = source.slice(start + 1).search(/\n      (?:async )?function /);
  return source.slice(start, next < 0 ? undefined : start + 1 + next);
}).join('\n');

test('head scenes preload scoped assets without replacing outer assets or fetching IDs', async () => {
  const base = 'https://raw.githubusercontent.com/example/repo/main/showcase/s100/';
  const responses = new Map([
    [base + 'body.glb', new Uint8Array([1])],
    [base + 'face.png', new Uint8Array([2])],
    [new URL('../s86/main.motionloom', base).href, new TextEncoder().encode('<Assets><ImageAsset id="face" src="face.png" /></Assets>')],
    [new URL('../s86/face.png', base).href, new Uint8Array([3])],
    [base + 'direct.glb', new Uint8Array([4])],
  ]);
  const fetched = [];
  const context = vm.createContext({URL, TextDecoder, Uint8Array,
    currentGraphAssetBaseUrl: base, graphAssetByteCache: new Map(),
    inlineGltfDependencies: async (bytes) => bytes,
    fetch: async (url) => {
      fetched.push(url);
      const bytes = responses.get(url);
      assert.ok(bytes, `unexpected fetch: ${url}`);
      return {ok:true,arrayBuffer:async () => bytes.buffer};
    },
  });
  vm.runInContext(functions, context);
  const assets = new Map();
  await context.attachGraphAssets({add_asset:(key, bytes) => assets.set(key, bytes)},
    `<Assets><ModelAsset id="body" src="body.glb" /><ImageAsset id="face" src="face.png" />
    <HeadSwapAsset id="hero" body="body" headScene="../s86/main.motionloom" />
    <ModelAsset id="head" src="direct.glb" /><HeadSwapAsset id="second" body="body" head="head" />
    </Assets>`);
  assert.equal(assets.get('face.png')[0], 2);
  assert.equal(assets.get('../s86/face.png')[0], 3);
  assert.equal(assets.get(new URL('../s86/face.png', base).href)[0], 3);
  assert.equal(fetched.length, 5);
});
