import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const config = JSON.parse(fs.readFileSync(new URL('../src/config/motionloom-assets.json', import.meta.url), 'utf8'));
const page = fs.readFileSync(new URL('../src/pages/motionloom.astro', import.meta.url), 'utf8');
function extract(name) {
  const start = page.search(new RegExp(`      (?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const next = page.slice(start + 1).search(/\n      (?:async )?function /);
  return page.slice(start, next < 0 ? undefined : start + 1 + next);
}
const functions = ['exampleConfig', 'exampleIdFromNumber', 'exampleUrlFromNumber',
  'resolveGraphAssetUrl', 'graphSourceBaseUrl', 'setGraphAssetSource',
  'collectGraphAssetReferences', 'collectGraphEnvironmentSources', 'bytesToDataUri', 'inlineGltfDependencies', 'attachGraphAssets'].map(extract).join('\n');
function setup(assetConfig = config) {
  const elements = new Map(['asset-source-input', 'asset-source-status', 'asset-source-category', 'asset-source-number'].map(id => [id, {value:'',textContent:'',classList:{remove(){}}}]));
  const context = vm.createContext({URL, TextDecoder, TextEncoder, Uint8Array, btoa,
    window:{location:{href:'https://site.example/editor/'}},
    assetSourceConfig: assetConfig,
    exampleRawRoot: `https://raw.githubusercontent.com/${assetConfig.repository}/${assetConfig.ref}`,
    currentGraphAssetBaseUrl: null, graphAssetByteCache: new Map(),
    document: {baseURI:'https://site.example/editor/',getElementById:id => elements.get(id)},
    inlineGltfDependencies:async bytes => bytes,
  });
  vm.runInContext(functions, context);
  return {context,elements};
}

test('every configured category resolves paths relative to its source DSL', () => {
  const {context} = setup();
  for (const [category, entry] of Object.entries(config.categories)) {
    const url = context.exampleUrlFromNumber(category, 92);
    assert.equal(url, `${context.exampleRawRoot}/${entry.folder}/${entry.prefix}-000092/${entry.entry}`);
    context.setGraphAssetSource(url);
    assert.equal(context.resolveGraphAssetUrl('assets/sky.png'), new URL('assets/sky.png', url).href);
    assert.equal(context.resolveGraphAssetUrl('../../assets/model.glb'), new URL('../../assets/model.glb', url).href);
  }
});

test('pasted S92 uses its chosen source without changing DSL or fetching a scene', async () => {
  const {context,elements} = setup();
  context.setGraphAssetSource('showcase/s-000001/main.motionloom');
  context.setGraphAssetSource('showcase/s-000092/main.motionloom');
  const fetched = [];
  context.fetch = async url => { fetched.push(url);return {ok:true,arrayBuffer:async () => new Uint8Array([42]).buffer}; };
  const assets = new Map();
  const dsl = '<Assets><ImageAsset id="sky" src="assets/sky.png" /><ModelAsset id="hero" src="../../assets/sample_assets/characters/character1/character1.glb" /></Assets>';
  await context.attachGraphAssets({add_asset:(key,bytes) => assets.set(key,bytes)},dsl);
  assert.deepEqual(fetched, [
    `${context.exampleRawRoot}/showcase/s-000092/assets/sky.png`,
    `${context.exampleRawRoot}/assets/sample_assets/characters/character1/character1.glb`,
  ]);
  assert.equal(assets.get('assets/sky.png')[0],42);
  assert.ok(elements.get('asset-source-status').textContent.includes('/s-000092/'));
});

test('custom hosts, directory URLs, absolute assets and reset retain URL semantics', () => {
  const {context} = setup();
  context.setGraphAssetSource('https://cdn.example/project/scene.motionloom?version=2');
  assert.equal(context.resolveGraphAssetUrl('../textures/face.png'), 'https://cdn.example/textures/face.png');
  context.setGraphAssetSource('https://cdn.example/project/');
  assert.equal(context.resolveGraphAssetUrl('sky.png'), 'https://cdn.example/project/sky.png');
  assert.equal(context.resolveGraphAssetUrl('https://other.example/model.glb'), 'https://other.example/model.glb');
  assert.equal(context.resolveGraphAssetUrl('/shared/sky.png'), 'https://cdn.example/shared/sky.png');
  assert.equal(context.resolveGraphAssetUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.throws(() => context.setGraphAssetSource('file:///tmp/main.motionloom'), /HTTP/);
  assert.throws(() => context.setGraphAssetSource('/Users/me/main.motionloom'), /leading/);
  assert.equal(context.resolveGraphAssetUrl('sky.png'), 'https://cdn.example/project/sky.png');
  context.setGraphAssetSource(null);
  assert.equal(context.resolveGraphAssetUrl('sky.png'), 'https://site.example/editor/sky.png');
});

test('changing the central repo/ref/category config moves every generated source', () => {
  const changed = structuredClone(config);
  changed.repository = 'new-owner/new-repo'; changed.ref = 'v2';
  changed.categories.future = {label:'future',folder:'future/scenes',prefix:'f',entry:'scene.motionloom'};
  const {context} = setup(changed);
  for (const category of Object.keys(changed.categories)) {
    assert.ok(context.exampleUrlFromNumber(category,105).startsWith('https://raw.githubusercontent.com/new-owner/new-repo/v2/'));
  }
  context.setGraphAssetSource('future/scenes/f-000105/scene.motionloom');
  assert.equal(context.resolveGraphAssetUrl('model.glb'),'https://raw.githubusercontent.com/new-owner/new-repo/v2/future/scenes/f-000105/model.glb');
});

test('asset failures report the resolved URL and source remedy', async () => {
  const {context} = setup();
  context.setGraphAssetSource('showcase/s-000092/main.motionloom');
  context.fetch = async () => ({ok:false,status:404,statusText:'Not Found'});
  await assert.rejects(context.attachGraphAssets({add_asset(){}},'<ImageAsset id="sky" src="assets/sky.png" />'),
    /resolved to https:.*s-000092\/assets\/sky\.png.*404.*Check Asset source/);
});


test('nested ActionLibrary dependencies use the library directory', async () => {
  const {context} = setup();
  context.setGraphAssetSource('showcase/s-000105/main.motionloom');
  const libraryUrl = `${context.exampleRawRoot}/actions/shared/main.motionloom`;
  const urls = [];
  context.fetch = async url => {
    urls.push(url);
    const bytes = url === libraryUrl
      ? new TextEncoder().encode('<ModelAsset id="actor" src="assets/actor.glb" />')
      : new Uint8Array([10]);
    return {ok:true,arrayBuffer:async () => bytes.buffer};
  };
  await context.attachGraphAssets({add_asset(){}},'<ActionLibrary id="actions" src="../../actions/shared/main.motionloom" />');
  assert.deepEqual(urls,[libraryUrl, `${context.exampleRawRoot}/actions/shared/assets/actor.glb`]);
});

test('external glTF buffers and textures use the model URL rather than scene source', async () => {
  const {context} = setup();
  context.setGraphAssetSource('showcase/s-000092/main.motionloom');
  const urls = [];
  context.fetch = async url => {
    urls.push(url);
    return {ok:true,arrayBuffer:async () => new Uint8Array([1,2]).buffer,headers:{get:() => null}};
  };
  const model = {asset:{version:'2.0'},buffers:[{uri:'mesh.bin'}],images:[{uri:'../textures/face.png'}]};
  const bytes = await context.inlineGltfDependencies(new TextEncoder().encode(JSON.stringify(model)), 'https://cdn.example/models/hero/model.gltf');
  assert.deepEqual(urls,['https://cdn.example/models/hero/mesh.bin','https://cdn.example/models/textures/face.png']);
  const result = JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(result.buffers[0].uri,'data:application/octet-stream;base64,AQI=');
  assert.equal(result.images[0].uri,'data:image/png;base64,AQI=');
});
