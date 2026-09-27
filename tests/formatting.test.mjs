// =========================================
// =========================================
// tests/formatting.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as wasm from '../public/motionloom-wasm/pkg/motionloom.js';
import { applyFormattedSource, formatDsl, mapFormatPosition, installDslFormatting } from '../src/scripts/motionloom-formatting.ts';

await wasm.default({ module_or_path: await readFile(new URL('../public/motionloom-wasm/pkg/motionloom_bg.wasm', import.meta.url)) });

test('real WASM formatting matches the native CLI and preserves Unicode selections', async () => {
  const source = '<A value="🍎蘋果"><B/></A>';
  const result = formatDsl(wasm, source);
  assert.equal(formatDsl(wasm, result.source).changed, false);
  const caret = source.indexOf('<B');
  assert.equal(mapFormatPosition(caret, result.edits), result.source.indexOf('<B'));
  const editor = {
    value: source, selectionStart: caret, selectionEnd: caret + 2, selectionDirection: 'forward',
    scrollTop: 90, scrollLeft: 12,
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; },
  };
  applyFormattedSource(editor, result);
  assert.equal(editor.value.slice(editor.selectionStart, editor.selectionEnd), '<B');
  assert.equal(editor.scrollTop, 90); assert.equal(editor.scrollLeft, 12);
  const dir = await mkdtemp(join(tmpdir(), 'motionloom-wasm-format-'));
  try {
    const file = join(dir, 'main.motionloom'); await writeFile(file, source);
    const cli = resolve(process.env.MOTIONLOOM_CLI || '../anica/target/debug/motionloom');
    const output = spawnSync(cli, ['fmt', file], { encoding: 'utf8' });
    assert.equal(output.status, 0, output.stderr || String(output.error));
    assert.equal(await readFile(file, 'utf8'), result.source);
  } finally { await rm(dir, { recursive: true }); }
});

test('WASM errors retain the original input and expose a source location', () => {
  const input = '<A>\n</B>';
  assert.throws(() => formatDsl(wasm, input), /line 2, column 1/);
  assert.equal(input, '<A>\n</B>');
});

test('WASM parses compact and formatted documents with the same authored children', () => {
  const source = '<Graph fps={24} duration="1s" size={[64,64]}><Background color="#000000"/><Scene id="s"><Timeline><Track id="t"><Sequence from="0s" duration="1s"><Layer><Rect id="r" x="1" y="2" width="30" height="40" color="#ff0000"/></Layer></Sequence></Track></Timeline></Scene><AnimationTarget node="r" property="x"><Key time="0s" value="1"/><Key time="1s" value="2"/></AnimationTarget><Present from="s"/></Graph>';
  const formatted = formatDsl(wasm, source).source;
  assert.equal(wasm.motionloom_parse_summary(source), wasm.motionloom_parse_summary(formatted));
});

test('format controller commits one undo revision and rejects stale asynchronous input', async () => {
  const previousDocument = globalThis.document; const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const listeners = new Map();
  const makeElement = (extra = {}) => ({
    ...extra, addEventListener(type, callback) { listeners.set(`${this.id}:${type}`, callback); },
  });
  const source = '<A><B/></A>';
  const editor = makeElement({ id: 'editor', value: source, selectionStart: 0, selectionEnd: 0,
    selectionDirection: 'none', scrollTop: 0, scrollLeft: 0,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } });
  const button = makeElement({ id: 'format' }); const save = makeElement({ id: 'save' });
  const download = makeElement({ id: 'download' }); const status = makeElement({ id: 'status' });
  const elements = { '#dsl-editor': editor, '#dsl-format': button, '#dsl-format-on-save': save,
    '#dsl-download': download, '#dsl-format-status': status };
  const history = []; let changed = 0;
  globalThis.document = { querySelector: (selector) => elements[selector] };
  globalThis.window = { dispatchEvent() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  try {
    installDslFormatting({ module: async () => wasm, history: (s) => history.push(s), changed: () => changed++, undo() {}, redo() {} });
    listeners.get('format:click')(); await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(history, [source]); assert.equal(changed, 1); assert.equal(save.checked, true);
    assert.equal(editor.value, formatDsl(wasm, source).source);
    editor.value = source;
    listeners.get('format:click')(); editor.value = '<New/>';
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(editor.value, '<New/>'); assert.equal(history.length, 1);
    assert.match(status.textContent, /Source changed/);
  } finally {
    globalThis.document = previousDocument; globalThis.window = previousWindow; globalThis.localStorage = previousStorage;
  }
});
