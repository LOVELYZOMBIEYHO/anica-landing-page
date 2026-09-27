// =========================================
// =========================================
// src/scripts/motionloom-formatting.ts

// UI adapters consume Rust edits; no DSL scanning or formatting is implemented here.
export interface DslFormatEdit {
  startByte: number;
  endByte: number;
  startUtf16: number;
  endUtf16: number;
  replacement: string;
}
export interface DslFormatResult { source: string; changed: boolean; edits: DslFormatEdit[] }
export interface DslFormatModule { motionloom_format_dsl(source: string): string }

export function formatDsl(module: DslFormatModule, source: string): DslFormatResult {
  return JSON.parse(module.motionloom_format_dsl(source)) as DslFormatResult;
}

// Offsets supplied by Rust already use JavaScript's UTF-16 selection convention.
export function mapFormatPosition(position: number, edits: DslFormatEdit[], affinity: 'left' | 'right' = 'right'): number {
  let delta = 0;
  for (const edit of edits) {
    if (position < edit.startUtf16) break;
    if (position <= edit.endUtf16) {
      const offset = edit.startUtf16 === edit.endUtf16
        ? (affinity === 'right' ? edit.replacement.length : 0)
        : position === edit.endUtf16 ? edit.replacement.length
        : Math.min(position - edit.startUtf16, edit.replacement.length);
      return edit.startUtf16 + delta + offset;
    }
    delta += edit.replacement.length - (edit.endUtf16 - edit.startUtf16);
  }
  return position + delta;
}

export function applyFormattedSource(editor: HTMLTextAreaElement, result: DslFormatResult): void {
  const start = mapFormatPosition(editor.selectionStart, result.edits);
  const end = mapFormatPosition(editor.selectionEnd, result.edits,
    editor.selectionStart === editor.selectionEnd ? 'right' : 'left');
  const direction = editor.selectionDirection;
  const top = editor.scrollTop; const left = editor.scrollLeft;
  editor.value = result.source;
  editor.setSelectionRange(start, end, direction);
  editor.scrollTop = top; editor.scrollLeft = left;
}

const SAVE_PREFERENCE = 'motionloom.formatOnSave';
export function bindFormatOnSave(input: HTMLInputElement): void {
  try { input.checked = localStorage.getItem(SAVE_PREFERENCE) !== 'false'; } catch { input.checked = true; }
  input.addEventListener('change', () => {
    try { localStorage.setItem(SAVE_PREFERENCE, String(input.checked)); } catch { /* Storage may be disabled. */ }
  });
}

export function downloadDsl(source: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface FormatHost {
  module(): Promise<DslFormatModule | null>;
  history(source: string): void;
  changed(): void;
  undo(): void;
  redo(): void;
}

export function installDslFormatting(host?: FormatHost): void {
  if (!host) return;
  const editor = document.querySelector<HTMLTextAreaElement>('#dsl-editor');
  const button = document.querySelector<HTMLButtonElement>('#dsl-format');
  const save = document.querySelector<HTMLInputElement>('#dsl-format-on-save');
  const download = document.querySelector<HTMLButtonElement>('#dsl-download');
  const status = document.querySelector<HTMLOutputElement>('#dsl-format-status');
  if (!editor || !button || !save || !download || !status) return;
  bindFormatOnSave(save);
  let busy = false;
  let lastFormat: { before: string; after: string } | null = null;
  async function format(): Promise<boolean> {
    if (busy) return false;
    busy = true; button!.disabled = true; download!.disabled = true;
    const source = editor!.value;
    try {
      const module = await host!.module();
      if (!module?.motionloom_format_dsl) throw new Error('DSL formatting needs the MotionLoom WASM package.');
      if (editor!.value !== source) throw new Error('Source changed; format the current revision again.');
      const result = formatDsl(module, source);
      if (result.changed) {
        host!.history(source);
        applyFormattedSource(editor!, result);
        lastFormat = { before: source, after: result.source };
        host!.changed();
        window.dispatchEvent(new CustomEvent('motionloom:source-formatted'));
      }
      status!.textContent = result.changed ? 'DSL formatted.' : 'DSL already formatted.';
      return true;
    } catch (error) {
      status!.textContent = error instanceof Error ? error.message : String(error);
      return false;
    } finally { busy = false; button!.disabled = false; download!.disabled = false; }
  }
  button.addEventListener('click', () => void format());
  download.addEventListener('click', async () => {
    if (save.checked && !await format()) return;
    downloadDsl(editor.value, 'main.motionloom');
  });
  editor.addEventListener('input', () => { lastFormat = null; });
  editor.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'f') {
      event.preventDefault(); void format();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); download.click();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && lastFormat) {
      const revision = event.shiftKey ? lastFormat.before : lastFormat.after;
      if (editor.value === revision) {
        event.preventDefault(); if (event.shiftKey) host!.redo(); else host!.undo();
      }
    }
  });
}
