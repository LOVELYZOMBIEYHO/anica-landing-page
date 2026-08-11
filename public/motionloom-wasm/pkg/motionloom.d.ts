/* tslint:disable */
/* eslint-disable */

/**
 * WASM-facing wrapper around a parsed scene graph. Keeps the parsed script
 * alive across JS calls so that repeated frame renders avoid re-parsing.
 *
 * Each renderer owns its own `MemoryAssetResolver`; assets added to one
 * renderer do not affect any other renderer or the global state.
 */
export class WasmSceneRenderer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Register an in-memory asset for this renderer only.
     *
     * The `name` should match the `src` attribute used in `<Image>` or `<Svg>`
     * nodes (e.g. `"logo.png"`). The `bytes` argument is the raw file content.
     */
    add_asset(name: string, bytes: Uint8Array): void;
    /**
     * Register an in-memory font for this renderer only.
     *
     * Browser hosts should use this for CJK or brand-specific text because
     * WASM cannot discover OS fonts and browser CSS fonts are not visible to
     * the Rust text rasterizer.
     */
    add_font(bytes: Uint8Array): Promise<void>;
    /**
     * Clear all assets previously registered on this renderer.
     */
    clear_assets(): void;
    /**
     * Asynchronously parse `script` and initialize the persistent renderer.
     *
     * Browser hosts should prefer this factory for animated GPU preview loops
     * because repeated frame renders reuse the same Rust/WGPU renderer.
     */
    static create(script: string, profile: string): Promise<WasmSceneRenderer>;
    /**
     * Render a white empty scene texture and present it to the canvas.
     */
    debug_empty_scene_texture_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;
    /**
     * Draw a solid WebGPU color into the canvas using this renderer's GPU device.
     */
    debug_solid_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;
    /**
     * Upload a blue WebGPU texture and present it to the canvas.
     */
    debug_uploaded_texture_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;
    /**
     * Parse `script` and prepare a renderer.
     */
    constructor(script: string, profile: string);
    /**
     * Render `frame` to an RGBA byte buffer.
     */
    render_frame(frame: number): Promise<Uint8Array>;
    /**
     * Render `frame` directly into an HTML canvas using the GPU canvas path.
     *
     * The renderer profile must be `"gpu"`. CPU profiles continue to use
     * `render_frame`, which returns RGBA bytes for Canvas2D/ImageData hosts.
     */
    render_frame_to_canvas(frame: number, canvas: HTMLCanvasElement): Promise<void>;
    /**
     * Update a numeric `<Group id="...">` attribute without reparsing the DSL.
     *
     * This is intended for editor scrubbing (x/y/rotation/scale/opacity). It
     * keeps the persistent renderer and its vector/GPU caches alive.
     */
    set_group_attr(group_id: string, attr: string, value: string): boolean;
    /**
     * Total number of frames for the graph's duration and fps.
     */
    readonly total_frames: number;
}

/**
 * WASM-facing wrapper for the legacy world compatibility renderer.
 *
 * New DSL must use `<Scene>`; `<World>` is no longer a valid authoring tag.
 */
export class WasmWorldRenderer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Register an in-memory asset for this renderer only.
     */
    add_asset(name: string, bytes: Uint8Array): void;
    /**
     * Clear all assets previously registered on this renderer.
     */
    clear_assets(): void;
    /**
     * Parse `script` and prepare a renderer.
     */
    constructor(script: string);
    /**
     * Render `frame` to an RGBA byte buffer using the provided asset root for
     * relative-path fallback.
     */
    render_frame(frame: number, asset_root: string): Uint8Array;
}

/**
 * Analyze one DSL revision for a concrete renderer such as `wasm-webgpu`.
 */
export function motionloom_analyze_script_for_target_json(script: string, target: string): string;

/**
 * Analyze one DSL revision and return parse, semantic, compatibility, and repair diagnostics.
 */
export function motionloom_analyze_script_json(script: string): string;

/**
 * Return the same AnimationTarget capability registry used by native editors.
 */
export function motionloom_animation_property_schema_json(): string;

/**
 * Inspect a script and return the document type as a string.
 */
export function motionloom_document_type(script: string): string;

/**
 * Return structured AnimationTarget binding diagnostics for one graph script.
 */
export function motionloom_inspect_animation_targets(script: string): string;

export function motionloom_inspect_glb_environment_json(asset_label: string, bytes: Uint8Array): string;

/**
 * Inspect GLB bytes and propose humanoid mapping, axes, rest pose, and confidence.
 */
export function motionloom_inspect_glb_skeleton_json(asset_label: string, bytes: Uint8Array): string;

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
 * Render one frame of a process graph directly to an HTML canvas with WebGPU.
 */
export function motionloom_render_process_frame_to_canvas_gpu(script: string, frame: number, width: number, height: number, rgba: Uint8Array, canvas: HTMLCanvasElement): Promise<void>;

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
 * Render one scene frame directly into an HTML canvas using the WASM WebGPU path.
 *
 * This is the first no-readback canvas path. It is strict: only GPU-native
 * scene graphs are accepted, and unsupported nodes return an error instead of
 * silently falling back to CPU.
 */
export function motionloom_render_scene_frame_to_canvas_gpu(script: string, frame: number, width: number, height: number, canvas: HTMLCanvasElement): Promise<void>;

/**
 * Render one frame with an explicit render profile.
 *
 * `profile` accepts: `"cpu"`, `"gpu"`, `"gpu-cpu"` (try GPU, fallback to CPU).
 */
export function motionloom_render_scene_frame_with_profile(script: string, frame: number, width: number, height: number, profile: string): Promise<Uint8Array>;

/**
 * Render one frame through the legacy world compatibility path.
 *
 * New DSL must use `<Scene>`; `<World>` is no longer a valid authoring tag.
 *
 * This convenience function uses the default path-based asset resolver.
 * To supply in-memory assets use `WasmWorldRenderer`.
 */
export function motionloom_render_world_frame(script: string, frame: number, asset_root: string): Uint8Array;

/**
 * Return the machine-readable syntax slice demonstrated by one showcase script.
 */
export function motionloom_showcase_schema_json(script: string): string;

/**
 * Render a white empty scene texture and present it to an HTML canvas for debugging.
 */
export function motionloom_webgpu_debug_empty_scene_texture_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;

/**
 * Draw a solid WebGPU color into an HTML canvas for debugging browser surface presentation.
 */
export function motionloom_webgpu_debug_solid_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;

/**
 * Upload a blue WebGPU texture and present it to an HTML canvas for debugging.
 */
export function motionloom_webgpu_debug_uploaded_texture_to_canvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<void>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly motionloom_parse_summary: (a: number, b: number) => [number, number, number, number];
    readonly motionloom_animation_property_schema_json: () => [number, number];
    readonly motionloom_analyze_script_json: (a: number, b: number) => [number, number];
    readonly motionloom_analyze_script_for_target_json: (a: number, b: number, c: number, d: number) => [number, number];
    readonly motionloom_showcase_schema_json: (a: number, b: number) => [number, number];
    readonly motionloom_inspect_glb_skeleton_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly motionloom_inspect_glb_environment_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly motionloom_inspect_animation_targets: (a: number, b: number) => [number, number, number, number];
    readonly motionloom_render_scene_frame: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly motionloom_render_scene_frame_with_profile: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
    readonly motionloom_render_scene_frame_to_canvas_gpu: (a: number, b: number, c: number, d: number, e: number, f: any) => any;
    readonly motionloom_webgpu_debug_solid_to_canvas: (a: any, b: number, c: number) => any;
    readonly motionloom_webgpu_debug_uploaded_texture_to_canvas: (a: any, b: number, c: number) => any;
    readonly motionloom_webgpu_debug_empty_scene_texture_to_canvas: (a: any, b: number, c: number) => any;
    readonly motionloom_render_process_frame: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly motionloom_render_process_frame_to_canvas_gpu: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any) => any;
    readonly motionloom_render_world_frame: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly motionloom_document_type: (a: number, b: number) => [number, number];
    readonly __wbg_wasmscenerenderer_free: (a: number, b: number) => void;
    readonly wasmscenerenderer_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasmscenerenderer_create: (a: number, b: number, c: number, d: number) => any;
    readonly wasmscenerenderer_add_asset: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmscenerenderer_add_font: (a: number, b: number, c: number) => any;
    readonly wasmscenerenderer_clear_assets: (a: number) => void;
    readonly wasmscenerenderer_set_group_attr: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly wasmscenerenderer_render_frame: (a: number, b: number) => any;
    readonly wasmscenerenderer_render_frame_to_canvas: (a: number, b: number, c: any) => any;
    readonly wasmscenerenderer_debug_solid_to_canvas: (a: number, b: any, c: number, d: number) => any;
    readonly wasmscenerenderer_debug_uploaded_texture_to_canvas: (a: number, b: any, c: number, d: number) => any;
    readonly wasmscenerenderer_debug_empty_scene_texture_to_canvas: (a: number, b: any, c: number, d: number) => any;
    readonly wasmscenerenderer_total_frames: (a: number) => number;
    readonly __wbg_wasmworldrenderer_free: (a: number, b: number) => void;
    readonly wasmworldrenderer_new: (a: number, b: number) => [number, number, number];
    readonly wasmworldrenderer_add_asset: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmworldrenderer_clear_assets: (a: number) => void;
    readonly wasmworldrenderer_render_frame: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h4aa3e05baac20cce: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h45c32c0111268609: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h200a21b777a48c32: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
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
