/* tslint:disable */
/* eslint-disable */

export class WasmSceneRenderer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Parse `script` and prepare a renderer.
   */
  constructor(script: string, profile: string);
  /**
   * Register an in-memory asset for this renderer only.
   *
   * The `name` should match the `src` attribute used in `<Image>` or `<Svg>`
   * nodes (e.g. `"logo.png"`). The `bytes` argument is the raw file content.
   */
  add_asset(name: string, bytes: Uint8Array): void;
  /**
   * Clear all assets previously registered on this renderer.
   */
  clear_assets(): void;
  /**
   * Render `frame` to an RGBA byte buffer.
   */
  render_frame(frame: number): Promise<Uint8Array>;
  /**
   * Total number of frames for the graph's duration and fps.
   */
  readonly total_frames: number;
}

export class WasmWorldRenderer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Parse `script` and prepare a renderer.
   */
  constructor(script: string);
  /**
   * Register an in-memory asset for this renderer only.
   */
  add_asset(name: string, bytes: Uint8Array): void;
  /**
   * Clear all assets previously registered on this renderer.
   */
  clear_assets(): void;
  /**
   * Render `frame` to an RGBA byte buffer using the provided asset root for
   * relative-path fallback.
   */
  render_frame(frame: number, asset_root: string): Uint8Array;
}

/**
 * Inspect a script and return the document type as a string.
 */
export function motionloom_document_type(script: string): string;

/**
 * Parse a MotionLoom script and return a short diagnostic summary.
 *
 * Returns an error string if parsing fails.
 */
export function motionloom_parse_summary(script: string): string;

/**
 * Render one frame of a process graph over an RGBA source buffer.
 */
export function motionloom_render_process_frame(script: string, frame: number, width: number, height: number, rgba: Uint8Array): Uint8Array;

/**
 * Render one frame of a scene graph script to an RGBA byte buffer.
 *
 * The returned `Vec<u8>` is row-major RGBA with dimensions `(width, height)`.
 * Hosts can wrap it in `Uint8Array` / `ImageData`.
 *
 * This convenience function uses the default path-based asset resolver and
 * tries the GPU profile, falling back to CPU if GPU initialization fails.
 * To supply in-memory assets use `WasmSceneRenderer`.
 */
export function motionloom_render_scene_frame(script: string, frame: number, width: number, height: number): Promise<Uint8Array>;

/**
 * Render one frame with an explicit render profile.
 *
 * `profile` accepts: `"cpu"`, `"gpu"`, `"gpu-cpu"` (try GPU, fallback to CPU).
 */
export function motionloom_render_scene_frame_with_profile(script: string, frame: number, width: number, height: number, profile: string): Promise<Uint8Array>;

/**
 * Render one frame of a world graph script to an RGBA byte buffer.
 *
 * This convenience function uses the default path-based asset resolver.
 * To supply in-memory assets use `WasmWorldRenderer`.
 */
export function motionloom_render_world_frame(script: string, frame: number, asset_root: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly motionloom_parse_summary: (a: number, b: number) => [number, number, number, number];
  readonly motionloom_render_scene_frame: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly motionloom_render_scene_frame_with_profile: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly motionloom_render_process_frame: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly motionloom_render_world_frame: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly motionloom_document_type: (a: number, b: number) => [number, number];
  readonly __wbg_wasmscenerenderer_free: (a: number, b: number) => void;
  readonly wasmscenerenderer_new: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly wasmscenerenderer_add_asset: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmscenerenderer_clear_assets: (a: number) => void;
  readonly wasmscenerenderer_render_frame: (a: number, b: number) => any;
  readonly wasmscenerenderer_total_frames: (a: number) => number;
  readonly __wbg_wasmworldrenderer_free: (a: number, b: number) => void;
  readonly wasmworldrenderer_new: (a: number, b: number) => [number, number, number];
  readonly wasmworldrenderer_add_asset: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmworldrenderer_clear_assets: (a: number) => void;
  readonly wasmworldrenderer_render_frame: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly wasm_bindgen__convert__closures_____invoke__hc3b6624aebeecb55: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__he641b6fd31452946: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h0cda4798cae695a6: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
