/* @ts-self-types="./motionloom.d.ts" */

/**
 * CPU-only diagnostic handle; does not change any preview or renderer state.
 */
export class WasmPoseDiagnostics {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPoseDiagnosticsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmposediagnostics_free(ptr, 0);
    }
    /**
     * Evaluate the same World pose path into the stable, versioned rig report.
     * @param {string} request_json
     * @returns {string}
     */
    evaluate_json(request_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmposediagnostics_evaluate_json(this.__wbg_ptr, ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Accept an existing World DSL document and GLB bytes; never fetch assets.
     * @param {string} world_dsl
     * @param {Uint8Array} glb
     */
    constructor(world_dsl, glb) {
        const ptr0 = passStringToWasm0(world_dsl, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(glb, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmposediagnostics_new(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WasmPoseDiagnosticsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Return complete model-global joint matrices using the native evaluator.
     * @param {string} actor_id
     * @param {number} frame
     * @param {number} fps
     * @returns {string}
     */
    sample_json(actor_id, frame, fps) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(actor_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmposediagnostics_sample_json(this.__wbg_ptr, ptr0, len0, frame, fps);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) WasmPoseDiagnostics.prototype[Symbol.dispose] = WasmPoseDiagnostics.prototype.free;

/**
 * WASM-facing wrapper around a parsed scene graph. Keeps the parsed script
 * alive across JS calls so that repeated frame renders avoid re-parsing.
 *
 * Each renderer owns its own `MemoryAssetResolver`; assets added to one
 * renderer do not affect any other renderer or the global state.
 */
export class WasmSceneRenderer {
    static __wrap(ptr) {
        const obj = Object.create(WasmSceneRenderer.prototype);
        obj.__wbg_ptr = ptr;
        WasmSceneRendererFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSceneRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmscenerenderer_free(ptr, 0);
    }
    /**
     * Register an in-memory asset for this renderer only.
     *
     * The `name` should match the `src` attribute used in `<Image>` or `<Svg>`
     * nodes (e.g. `"logo.png"`). The `bytes` argument is the raw file content.
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    add_asset(name, bytes) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmscenerenderer_add_asset(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * Register transformed GLB bounds alongside an already preloaded asset.
     * This is optional and non-breaking; renderers fall back to inspecting
     * the asset bytes when the hint is absent.
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    add_environment_bounds(name, bytes) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmscenerenderer_add_environment_bounds(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * Register an in-memory font for this renderer only.
     *
     * Browser hosts should use this for CJK or brand-specific text because
     * WASM cannot discover OS fonts and browser CSS fonts are not visible to
     * the Rust text rasterizer.
     * @param {Uint8Array} bytes
     * @returns {Promise<void>}
     */
    add_font(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_add_font(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Clear all assets previously registered on this renderer.
     */
    clear_assets() {
        wasm.wasmscenerenderer_clear_assets(this.__wbg_ptr);
    }
    /**
     * Asynchronously parse `script` and initialize the persistent renderer.
     *
     * Browser hosts should prefer this factory for animated GPU preview loops
     * because repeated frame renders reuse the same Rust/WGPU renderer.
     * @param {string} script
     * @param {string} profile
     * @returns {Promise<WasmSceneRenderer>}
     */
    static create(script, profile) {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(profile, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_create(ptr0, len0, ptr1, len1);
        return ret;
    }
    /**
     * Render a white empty scene texture and present it to the canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @returns {Promise<void>}
     */
    debug_empty_scene_texture_to_canvas(canvas, width, height) {
        const ret = wasm.wasmscenerenderer_debug_empty_scene_texture_to_canvas(this.__wbg_ptr, canvas, width, height);
        return ret;
    }
    /**
     * Draw a solid WebGPU color into the canvas using this renderer's GPU device.
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @returns {Promise<void>}
     */
    debug_solid_to_canvas(canvas, width, height) {
        const ret = wasm.wasmscenerenderer_debug_solid_to_canvas(this.__wbg_ptr, canvas, width, height);
        return ret;
    }
    /**
     * Upload a blue WebGPU texture and present it to the canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @returns {Promise<void>}
     */
    debug_uploaded_texture_to_canvas(canvas, width, height) {
        const ret = wasm.wasmscenerenderer_debug_uploaded_texture_to_canvas(this.__wbg_ptr, canvas, width, height);
        return ret;
    }
    /**
     * Return true screen-space joints for the most recently rendered frame.
     * Coordinates use the renderer's authored pixel size and include finger
     * bones when the active ModelProfile maps them.
     * @returns {string}
     */
    editor_rig_snapshot_json() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.wasmscenerenderer_editor_rig_snapshot_json(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Evaluate one actor through the exact browser Scene renderer and return
     * the stable, versioned rig report as JSON.
     * @param {string} actor_id
     * @param {number} frame
     * @returns {Promise<string>}
     */
    evaluate_rig_frame_json(actor_id, frame) {
        const ptr0 = passStringToWasm0(actor_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_evaluate_rig_frame_json(this.__wbg_ptr, ptr0, len0, frame);
        return ret;
    }
    /**
     * Evaluate a frame, time, or Action phase from a serialized
     * `RigEvaluationRequest` and return the versioned report JSON.
     * @param {string} request_json
     * @returns {Promise<string>}
     */
    evaluate_rig_json(request_json) {
        const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_evaluate_rig_json(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Parse `script` and prepare a renderer.
     * @param {string} script
     * @param {string} profile
     */
    constructor(script, profile) {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(profile, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_new(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WasmSceneRendererFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Render `frame` to an RGBA byte buffer.
     * @param {number} frame
     * @returns {Promise<Uint8Array>}
     */
    render_frame(frame) {
        const ret = wasm.wasmscenerenderer_render_frame(this.__wbg_ptr, frame);
        return ret;
    }
    /**
     * Render `frame` directly into an HTML canvas using the GPU canvas path.
     *
     * The renderer profile must be `"gpu"`. CPU profiles continue to use
     * `render_frame`, which returns RGBA bytes for Canvas2D/ImageData hosts.
     * @param {number} frame
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<void>}
     */
    render_frame_to_canvas(frame, canvas) {
        const ret = wasm.wasmscenerenderer_render_frame_to_canvas(this.__wbg_ptr, frame, canvas);
        return ret;
    }
    /**
     * Update one authored Action channel without reconstructing the renderer.
     *
     * The source editor remains authoritative: hosts use this method while a
     * pointer is moving, then commit the same value through the typed Action
     * edit API when the gesture ends. GLB bytes and GPU mesh caches stay live.
     * @param {string} action_id
     * @param {number} pose_ms
     * @param {string} bone_id
     * @param {string} channel
     * @param {string} value
     * @returns {boolean}
     */
    set_action_pose_channel(action_id, pose_ms, bone_id, channel, value) {
        const ptr0 = passStringToWasm0(action_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(bone_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(channel, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_set_action_pose_channel(this.__wbg_ptr, ptr0, len0, pose_ms, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Update one Camera3D pose in the parsed graph without recreating GPU
     * pipelines, GLB meshes, textures, or the scene renderer.
     * @param {string} camera_id
     * @param {string} position
     * @param {string} target
     * @returns {boolean}
     */
    set_camera3d_pose(camera_id, position, target) {
        const ptr0 = passStringToWasm0(camera_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(position, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_set_camera3d_pose(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Update a numeric `<Group id="...">` attribute without reparsing the DSL.
     *
     * This is intended for editor scrubbing (x/y/rotation/scale/opacity). It
     * keeps the persistent renderer and its vector/GPU caches alive.
     * @param {string} group_id
     * @param {string} attr
     * @param {string} value
     * @returns {boolean}
     */
    set_group_attr(group_id, attr, value) {
        const ptr0 = passStringToWasm0(group_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(attr, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_set_group_attr(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Total number of frames for the graph's duration and fps.
     * @returns {number}
     */
    get total_frames() {
        const ret = wasm.wasmscenerenderer_total_frames(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Render a sampled range and return a machine-readable shot validation
     * report. Optional editor/physics observations use the same JSON shape as
     * `motionloom_analyze_shot_observations_json`.
     * @param {string} options_json
     * @param {string} observations_json
     * @returns {Promise<string>}
     */
    validate_shots_json(options_json, observations_json) {
        const ptr0 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(observations_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmscenerenderer_validate_shots_json(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
}
if (Symbol.dispose) WasmSceneRenderer.prototype[Symbol.dispose] = WasmSceneRenderer.prototype.free;

/**
 * WASM-facing wrapper for the legacy world compatibility renderer.
 *
 * New DSL must use `<Scene>`; `<World>` is no longer a valid authoring tag.
 */
export class WasmWorldRenderer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmWorldRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmworldrenderer_free(ptr, 0);
    }
    /**
     * Register an in-memory asset for this renderer only.
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    add_asset(name, bytes) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.wasmworldrenderer_add_asset(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * Clear all assets previously registered on this renderer.
     */
    clear_assets() {
        wasm.wasmworldrenderer_clear_assets(this.__wbg_ptr);
    }
    /**
     * Parse `script` and prepare a renderer.
     * @param {string} script
     */
    constructor(script) {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmworldrenderer_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WasmWorldRendererFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Render `frame` to an RGBA byte buffer using the provided asset root for
     * relative-path fallback.
     * @param {number} frame
     * @param {string} asset_root
     * @returns {Uint8Array}
     */
    render_frame(frame, asset_root) {
        const ptr0 = passStringToWasm0(asset_root, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmworldrenderer_render_frame(this.__wbg_ptr, frame, ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
}
if (Symbol.dispose) WasmWorldRenderer.prototype[Symbol.dispose] = WasmWorldRenderer.prototype.free;

/**
 * Analyze one DSL revision for a concrete renderer such as `wasm-webgpu`.
 * @param {string} script
 * @param {string} target
 * @returns {string}
 */
export function motionloom_analyze_script_for_target_json(script, target) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_analyze_script_for_target_json(ptr0, len0, ptr1, len1);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Analyze one DSL revision and return parse, semantic, compatibility, and repair diagnostics.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_analyze_script_json(script) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_analyze_script_json(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Analyze host/backend observations without parsing or changing MotionLoom DSL.
 * Empty options select the cinematic defaults.
 * @param {string} options_json
 * @param {string} observations_json
 * @returns {string}
 */
export function motionloom_analyze_shot_observations_json(options_json, observations_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(observations_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_analyze_shot_observations_json(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Return the same AnimationTarget capability registry used by native editors.
 * @returns {string}
 */
export function motionloom_animation_property_schema_json() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.motionloom_animation_property_schema_json();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Apply one JSON-encoded Action edit and return a validated DSL revision.
 * @param {string} script
 * @param {string} command_json
 * @returns {string}
 */
export function motionloom_apply_action_edit(script, command_json) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(command_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_apply_action_edit(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Compare two previously evaluated rig reports without loading or rendering assets.
 * @param {string} reference_json
 * @param {string} candidate_json
 * @param {string} options_json
 * @returns {string}
 */
export function motionloom_compare_rigs_json(reference_json, candidate_json, options_json) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(reference_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(candidate_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_compare_rigs_json(ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Inspect a script and return the document type as a string.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_document_type(script) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_document_type(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Return the complete machine-readable MotionLoom DSL capability catalog.
 * @returns {string}
 */
export function motionloom_dsl_schema_json() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.motionloom_dsl_schema_json();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Return the typed Action authoring document used by browser editors.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_editable_actions_json(script) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_editable_actions_json(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Return structured AnimationTarget binding diagnostics for one graph script.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_inspect_animation_targets(script) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_inspect_animation_targets(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} asset_label
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function motionloom_inspect_glb_environment_json(asset_label, bytes) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(asset_label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_inspect_glb_environment_json(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Detect declared/known humanoid rigs and propose a compatible profile.
 * This additive API preserves the legacy skeleton-inspection JSON contract.
 * @param {string} asset_label
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function motionloom_inspect_glb_humanoid_profile_json(asset_label, bytes) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(asset_label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_inspect_glb_humanoid_profile_json(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Inspect GLB bytes and propose humanoid mapping, axes, rest pose, and confidence.
 * @param {string} asset_label
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function motionloom_inspect_glb_skeleton_json(asset_label, bytes) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(asset_label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_inspect_glb_skeleton_json(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Parse a MotionLoom script and return a short diagnostic summary.
 *
 * Returns an error string if parsing fails.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_parse_summary(script) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_parse_summary(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Produce read-only calibration suggestions from one comparison report.
 * @param {string} comparison_json
 * @returns {string}
 */
export function motionloom_propose_rig_calibration_json(comparison_json) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(comparison_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_propose_rig_calibration_json(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Render one frame of a process graph over an RGBA source buffer.
 * @param {string} script
 * @param {number} frame
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {Uint8Array}
 */
export function motionloom_render_process_frame(script, frame, width, height, rgba) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(rgba, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_process_frame(ptr0, len0, frame, width, height, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Render one frame of a process graph directly to an HTML canvas with WebGPU.
 * @param {string} script
 * @param {number} frame
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<void>}
 */
export function motionloom_render_process_frame_to_canvas_gpu(script, frame, width, height, rgba, canvas) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(rgba, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_process_frame_to_canvas_gpu(ptr0, len0, frame, width, height, ptr1, len1, canvas);
    return ret;
}

/**
 * Render one frame of a scene graph script to an RGBA byte buffer.
 *
 * The returned `Vec<u8>` is row-major RGBA with dimensions `(width, height)`.
 * Hosts can wrap it in `Uint8Array` / `ImageData`.
 *
 * This convenience function uses the default path-based asset resolver and
 * tries the GPU profile, falling back to CPU if GPU initialization fails.
 * To supply in-memory assets use `WasmSceneRenderer`.
 * @param {string} script
 * @param {number} frame
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Uint8Array>}
 */
export function motionloom_render_scene_frame(script, frame, width, height) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_scene_frame(ptr0, len0, frame, width, height);
    return ret;
}

/**
 * Render one scene frame directly into an HTML canvas using the WASM WebGPU path.
 *
 * This is the first no-readback canvas path. It is strict: only GPU-native
 * scene graphs are accepted, and unsupported nodes return an error instead of
 * silently falling back to CPU.
 * @param {string} script
 * @param {number} frame
 * @param {number} width
 * @param {number} height
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<void>}
 */
export function motionloom_render_scene_frame_to_canvas_gpu(script, frame, width, height, canvas) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_scene_frame_to_canvas_gpu(ptr0, len0, frame, width, height, canvas);
    return ret;
}

/**
 * Render one frame with an explicit render profile.
 *
 * `profile` accepts: `"cpu"`, `"gpu"`, `"gpu-cpu"` (try GPU, fallback to CPU).
 * @param {string} script
 * @param {number} frame
 * @param {number} width
 * @param {number} height
 * @param {string} profile
 * @returns {Promise<Uint8Array>}
 */
export function motionloom_render_scene_frame_with_profile(script, frame, width, height, profile) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(profile, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_scene_frame_with_profile(ptr0, len0, frame, width, height, ptr1, len1);
    return ret;
}

/**
 * Render one frame through the legacy world compatibility path.
 *
 * New DSL must use `<Scene>`; `<World>` is no longer a valid authoring tag.
 *
 * This convenience function uses the default path-based asset resolver.
 * To supply in-memory assets use `WasmWorldRenderer`.
 * @param {string} script
 * @param {number} frame
 * @param {string} asset_root
 * @returns {Uint8Array}
 */
export function motionloom_render_world_frame(script, frame, asset_root) {
    const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(asset_root, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.motionloom_render_world_frame(ptr0, len0, frame, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Return the versioned JSON Schema envelope for rig diagnostics.
 * @returns {string}
 */
export function motionloom_rig_diagnostics_schema_json() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.motionloom_rig_diagnostics_schema_json();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Return the machine-readable syntax slice demonstrated by one showcase script.
 * @param {string} script
 * @returns {string}
 */
export function motionloom_showcase_schema_json(script) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(script, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.motionloom_showcase_schema_json(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Render a white empty scene texture and present it to an HTML canvas for debugging.
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 * @param {number} height
 * @returns {Promise<void>}
 */
export function motionloom_webgpu_debug_empty_scene_texture_to_canvas(canvas, width, height) {
    const ret = wasm.motionloom_webgpu_debug_empty_scene_texture_to_canvas(canvas, width, height);
    return ret;
}

/**
 * Draw a solid WebGPU color into an HTML canvas for debugging browser surface presentation.
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 * @param {number} height
 * @returns {Promise<void>}
 */
export function motionloom_webgpu_debug_solid_to_canvas(canvas, width, height) {
    const ret = wasm.motionloom_webgpu_debug_solid_to_canvas(canvas, width, height);
    return ret;
}

/**
 * Upload a blue WebGPU texture and present it to an HTML canvas for debugging.
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 * @param {number} height
 * @returns {Promise<void>}
 */
export function motionloom_webgpu_debug_uploaded_texture_to_canvas(canvas, width, height) {
    const ret = wasm.motionloom_webgpu_debug_uploaded_texture_to_canvas(canvas, width, height);
    return ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Window_0dc65f28a4345887: function(arg0) {
            const ret = arg0.Window;
            return ret;
        },
        __wbg_WorkerGlobalScope_262c8e34a919509f: function(arg0) {
            const ret = arg0.WorkerGlobalScope;
            return ret;
        },
        __wbg___wbindgen_debug_string_8a447059637473e2: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_acc5528be2b923f2: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_6d937fbfb6478470: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_721f8decd50c87a3: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_71bb4348194e31f0: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_33c39e13d73b25f6: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_beginComputePass_42c1dc19dd244059: function(arg0, arg1) {
            const ret = arg0.beginComputePass(arg1);
            return ret;
        },
        __wbg_beginRenderPass_1636be9bc8e33c43: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.beginRenderPass(arg1);
            return ret;
        }, arguments); },
        __wbg_buffer_9e4d98d0766fb908: function(arg0) {
            const ret = arg0.buffer;
            return ret;
        },
        __wbg_call_5575218572ead796: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_configure_a85ef99634672c4a: function() { return handleError(function (arg0, arg1) {
            arg0.configure(arg1);
        }, arguments); },
        __wbg_copyTextureToBuffer_1b7c1b3bf90b2b7f: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.copyTextureToBuffer(arg1, arg2, arg3);
        }, arguments); },
        __wbg_copyTextureToTexture_f58b0c7d8e6276e2: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.copyTextureToTexture(arg1, arg2, arg3);
        }, arguments); },
        __wbg_createBindGroupLayout_0f080b11fd4b5ffe: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createBindGroupLayout(arg1);
            return ret;
        }, arguments); },
        __wbg_createBindGroup_4a548d28221a3724: function(arg0, arg1) {
            const ret = arg0.createBindGroup(arg1);
            return ret;
        },
        __wbg_createBuffer_de348fec3cfa3bd1: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createBuffer(arg1);
            return ret;
        }, arguments); },
        __wbg_createCommandEncoder_f1ebf253171c6c1b: function(arg0, arg1) {
            const ret = arg0.createCommandEncoder(arg1);
            return ret;
        },
        __wbg_createComputePipeline_62e5760885549445: function(arg0, arg1) {
            const ret = arg0.createComputePipeline(arg1);
            return ret;
        },
        __wbg_createPipelineLayout_8d969fc745f20f23: function(arg0, arg1) {
            const ret = arg0.createPipelineLayout(arg1);
            return ret;
        },
        __wbg_createRenderPipeline_1dbdc88da325f5dc: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createRenderPipeline(arg1);
            return ret;
        }, arguments); },
        __wbg_createSampler_80b553fb1915ad98: function(arg0, arg1) {
            const ret = arg0.createSampler(arg1);
            return ret;
        },
        __wbg_createShaderModule_4a697f05633fc0d8: function(arg0, arg1) {
            const ret = arg0.createShaderModule(arg1);
            return ret;
        },
        __wbg_createTexture_423ec5113612ebe8: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createTexture(arg1);
            return ret;
        }, arguments); },
        __wbg_createView_d928ef35cd04a244: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createView(arg1);
            return ret;
        }, arguments); },
        __wbg_dispatchWorkgroups_f22f0de17d48bf6f: function(arg0, arg1, arg2, arg3) {
            arg0.dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
        },
        __wbg_document_2634180a4c694068: function(arg0) {
            const ret = arg0.document;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_draw_144fe15cf5de8254: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_end_65366a9d18a534f9: function(arg0) {
            arg0.end();
        },
        __wbg_end_68d2bd9f647a2a38: function(arg0) {
            arg0.end();
        },
        __wbg_error_933f449d72fef598: function(arg0) {
            console.error(arg0);
        },
        __wbg_features_308760f9ae699ee0: function(arg0) {
            const ret = arg0.features;
            return ret;
        },
        __wbg_finish_7d949e916fb756c0: function(arg0) {
            const ret = arg0.finish();
            return ret;
        },
        __wbg_finish_7dc4e63765afdf59: function(arg0, arg1) {
            const ret = arg0.finish(arg1);
            return ret;
        },
        __wbg_getContext_486aab500e1c34c9: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getContext_70c2d1bed75d4122: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getCurrentTexture_a516a0b9b636961a: function() { return handleError(function (arg0) {
            const ret = arg0.getCurrentTexture();
            return ret;
        }, arguments); },
        __wbg_getMappedRange_3505c06e92dc304c: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getMappedRange(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_getPreferredCanvasFormat_78b186193f25cd47: function(arg0) {
            const ret = arg0.getPreferredCanvasFormat();
            return (__wbindgen_enum_GpuTextureFormat.indexOf(ret) + 1 || 96) - 1;
        },
        __wbg_get_37b48b8fa52d1f2c: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_gpu_03716d242aac2a7a: function(arg0) {
            const ret = arg0.gpu;
            return ret;
        },
        __wbg_has_3dde616b19827a8d: function(arg0, arg1, arg2) {
            const ret = arg0.has(getStringFromWasm0(arg1, arg2));
            return ret;
        },
        __wbg_height_a04613570d793df2: function(arg0) {
            const ret = arg0.height;
            return ret;
        },
        __wbg_instanceof_GpuAdapter_331cc7dcda68de8c: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUAdapter;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuCanvasContext_4ea475a10f693c29: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUCanvasContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_0d356b88a2f77c42: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_is_de5b366c746e004c: function(arg0, arg1) {
            const ret = Object.is(arg0, arg1);
            return ret;
        },
        __wbg_label_9850c9fa8a462e67: function(arg0, arg1) {
            const ret = arg1.label;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_length_589238bdcf171f0e: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_limits_5bca67036d8c5c3d: function(arg0) {
            const ret = arg0.limits;
            return ret;
        },
        __wbg_limits_ea41c3962a6b95bc: function(arg0) {
            const ret = arg0.limits;
            return ret;
        },
        __wbg_mapAsync_d12bc60445b38969: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.mapAsync(arg1 >>> 0, arg2, arg3);
            return ret;
        },
        __wbg_maxBindGroups_2bf4f99a58a6309f: function(arg0) {
            const ret = arg0.maxBindGroups;
            return ret;
        },
        __wbg_maxBindingsPerBindGroup_dacc570aa61d0dca: function(arg0) {
            const ret = arg0.maxBindingsPerBindGroup;
            return ret;
        },
        __wbg_maxBufferSize_99fc9443bb4067ba: function(arg0) {
            const ret = arg0.maxBufferSize;
            return ret;
        },
        __wbg_maxColorAttachmentBytesPerSample_2da4920e0acebc0e: function(arg0) {
            const ret = arg0.maxColorAttachmentBytesPerSample;
            return ret;
        },
        __wbg_maxColorAttachments_bebac93064a9d843: function(arg0) {
            const ret = arg0.maxColorAttachments;
            return ret;
        },
        __wbg_maxComputeInvocationsPerWorkgroup_ccd6b7df84154e21: function(arg0) {
            const ret = arg0.maxComputeInvocationsPerWorkgroup;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeX_0e4f5019b8ab256e: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeX;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeY_8276aa965a003c45: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeY;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeZ_977746dd442595bd: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeZ;
            return ret;
        },
        __wbg_maxComputeWorkgroupStorageSize_ce16b9d5d8733780: function(arg0) {
            const ret = arg0.maxComputeWorkgroupStorageSize;
            return ret;
        },
        __wbg_maxComputeWorkgroupsPerDimension_3b7b8e447a68f678: function(arg0) {
            const ret = arg0.maxComputeWorkgroupsPerDimension;
            return ret;
        },
        __wbg_maxDynamicStorageBuffersPerPipelineLayout_8355a4388945b17c: function(arg0) {
            const ret = arg0.maxDynamicStorageBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxDynamicUniformBuffersPerPipelineLayout_977505074842a93f: function(arg0) {
            const ret = arg0.maxDynamicUniformBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxSampledTexturesPerShaderStage_e946a03f2f1039de: function(arg0) {
            const ret = arg0.maxSampledTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxSamplersPerShaderStage_14d367c8faabd3bc: function(arg0) {
            const ret = arg0.maxSamplersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageBufferBindingSize_4a8221c2bde16572: function(arg0) {
            const ret = arg0.maxStorageBufferBindingSize;
            return ret;
        },
        __wbg_maxStorageBuffersPerShaderStage_0f46960801ff4626: function(arg0) {
            const ret = arg0.maxStorageBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageTexturesPerShaderStage_55c540c36a9a8670: function(arg0) {
            const ret = arg0.maxStorageTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxTextureArrayLayers_ff0524af946d2147: function(arg0) {
            const ret = arg0.maxTextureArrayLayers;
            return ret;
        },
        __wbg_maxTextureDimension1D_7e7b3134d878963f: function(arg0) {
            const ret = arg0.maxTextureDimension1D;
            return ret;
        },
        __wbg_maxTextureDimension2D_4cebfd3132f9db9c: function(arg0) {
            const ret = arg0.maxTextureDimension2D;
            return ret;
        },
        __wbg_maxTextureDimension3D_487f24962e39588f: function(arg0) {
            const ret = arg0.maxTextureDimension3D;
            return ret;
        },
        __wbg_maxUniformBufferBindingSize_a7c5e53f603450e4: function(arg0) {
            const ret = arg0.maxUniformBufferBindingSize;
            return ret;
        },
        __wbg_maxUniformBuffersPerShaderStage_b4a0c0df66ad558d: function(arg0) {
            const ret = arg0.maxUniformBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxVertexAttributes_6561757d6b756306: function(arg0) {
            const ret = arg0.maxVertexAttributes;
            return ret;
        },
        __wbg_maxVertexBufferArrayStride_32ac993891416ff9: function(arg0) {
            const ret = arg0.maxVertexBufferArrayStride;
            return ret;
        },
        __wbg_maxVertexBuffers_933477de1b5f4825: function(arg0) {
            const ret = arg0.maxVertexBuffers;
            return ret;
        },
        __wbg_minStorageBufferOffsetAlignment_e1f616695b1de18f: function(arg0) {
            const ret = arg0.minStorageBufferOffsetAlignment;
            return ret;
        },
        __wbg_minUniformBufferOffsetAlignment_c3f7877c57eab7a0: function(arg0) {
            const ret = arg0.minUniformBufferOffsetAlignment;
            return ret;
        },
        __wbg_navigator_017bc45e84c473cc: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_navigator_935098efd1dc7fe5: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_new_2e117a478906f062: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_36e147a8ced3c6e0: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_e66a4b7758dd2e5c: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_from_slice_543b875b27789a8f: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_00a409eb4ec4f2d9: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen__convert__closures_____invoke__h45c32c0111268609(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_byte_offset_and_length_f2b65504a914f37a: function(arg0, arg1, arg2) {
            const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_prototypesetcall_d721637c7ca66eb8: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_f724b5db8acf89d2: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_querySelectorAll_ffda3c891a9eb29a: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.querySelectorAll(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_queueMicrotask_1c9b3800e321a967: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_311744e534a929a3: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_queue_7fafbac0ddb6c670: function(arg0) {
            const ret = arg0.queue;
            return ret;
        },
        __wbg_requestAdapter_dc3b730968f39ede: function(arg0, arg1) {
            const ret = arg0.requestAdapter(arg1);
            return ret;
        },
        __wbg_requestDevice_0666fa181666d96b: function(arg0, arg1) {
            const ret = arg0.requestDevice(arg1);
            return ret;
        },
        __wbg_resolve_d82363d90af6928a: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_setBindGroup_1e20fc6d5b3ffe60: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        }, arguments); },
        __wbg_setBindGroup_3e9afe0921b76fc0: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_4d965ae927c8aca7: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_74acc5ee1686b62a: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        }, arguments); },
        __wbg_setPipeline_53daa3617ec29b41: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setPipeline_88a119262ecbb240: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setVertexBuffer_6a8d07ae366fb470: function(arg0, arg1, arg2, arg3) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3);
        },
        __wbg_setVertexBuffer_8538c8d57ff796e6: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_set_272b80acaf9a75e8: function(arg0, arg1, arg2) {
            arg0.set(arg1, arg2 >>> 0);
        },
        __wbg_set_4564f7dc44fcb0c9: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_a_0e9ffd7edfa8a9f0: function(arg0, arg1) {
            arg0.a = arg1;
        },
        __wbg_set_access_3a025015b8de87b2: function(arg0, arg1) {
            arg0.access = __wbindgen_enum_GpuStorageTextureAccess[arg1];
        },
        __wbg_set_address_mode_u_a09823787fe8d44a: function(arg0, arg1) {
            arg0.addressModeU = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_v_ba2b151a62621475: function(arg0, arg1) {
            arg0.addressModeV = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_w_4454e22a72f0df4c: function(arg0, arg1) {
            arg0.addressModeW = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_alpha_658ed1dfc4154d22: function(arg0, arg1) {
            arg0.alpha = arg1;
        },
        __wbg_set_alpha_mode_d40fc95f2f0a65b8: function(arg0, arg1) {
            arg0.alphaMode = __wbindgen_enum_GpuCanvasAlphaMode[arg1];
        },
        __wbg_set_alpha_to_coverage_enabled_627ce591dddc23f7: function(arg0, arg1) {
            arg0.alphaToCoverageEnabled = arg1 !== 0;
        },
        __wbg_set_array_layer_count_372c4a910f9741ae: function(arg0, arg1) {
            arg0.arrayLayerCount = arg1 >>> 0;
        },
        __wbg_set_array_stride_aa1d7ec2f2866247: function(arg0, arg1) {
            arg0.arrayStride = arg1;
        },
        __wbg_set_aspect_c490b83df964e769: function(arg0, arg1) {
            arg0.aspect = __wbindgen_enum_GpuTextureAspect[arg1];
        },
        __wbg_set_attributes_6d60f4f903a301a8: function(arg0, arg1) {
            arg0.attributes = arg1;
        },
        __wbg_set_b_fb8e7191ce2f917c: function(arg0, arg1) {
            arg0.b = arg1;
        },
        __wbg_set_base_array_layer_2ab45d90e7a581f7: function(arg0, arg1) {
            arg0.baseArrayLayer = arg1 >>> 0;
        },
        __wbg_set_base_mip_level_2ae99b85d1e778e9: function(arg0, arg1) {
            arg0.baseMipLevel = arg1 >>> 0;
        },
        __wbg_set_beginning_of_pass_write_index_1997e8ae19580364: function(arg0, arg1) {
            arg0.beginningOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_beginning_of_pass_write_index_ae7fb8f7339200a4: function(arg0, arg1) {
            arg0.beginningOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_bind_group_layouts_2a3fbfe6301f7cc2: function(arg0, arg1) {
            arg0.bindGroupLayouts = arg1;
        },
        __wbg_set_binding_6c7ed77073549aaa: function(arg0, arg1) {
            arg0.binding = arg1 >>> 0;
        },
        __wbg_set_binding_799d4a2ff61a29c4: function(arg0, arg1) {
            arg0.binding = arg1 >>> 0;
        },
        __wbg_set_blend_8b5f0206031032b9: function(arg0, arg1) {
            arg0.blend = arg1;
        },
        __wbg_set_buffer_4564be0900c8093c: function(arg0, arg1) {
            arg0.buffer = arg1;
        },
        __wbg_set_buffer_52ccf9f23c8c8d74: function(arg0, arg1) {
            arg0.buffer = arg1;
        },
        __wbg_set_buffer_a8fd59883ba44573: function(arg0, arg1) {
            arg0.buffer = arg1;
        },
        __wbg_set_buffers_894c092e99bf8541: function(arg0, arg1) {
            arg0.buffers = arg1;
        },
        __wbg_set_bytes_per_row_1cfe3bbc2f242df7: function(arg0, arg1) {
            arg0.bytesPerRow = arg1 >>> 0;
        },
        __wbg_set_bytes_per_row_361465586ee5212a: function(arg0, arg1) {
            arg0.bytesPerRow = arg1 >>> 0;
        },
        __wbg_set_clear_value_c6eaca1e9b16e209: function(arg0, arg1) {
            arg0.clearValue = arg1;
        },
        __wbg_set_code_22962864d78928e2: function(arg0, arg1, arg2) {
            arg0.code = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_color_attachments_f027806af3f83980: function(arg0, arg1) {
            arg0.colorAttachments = arg1;
        },
        __wbg_set_color_c1b12d789a2ea5d0: function(arg0, arg1) {
            arg0.color = arg1;
        },
        __wbg_set_compare_1807a293c48e067f: function(arg0, arg1) {
            arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_compare_624c2c00fd10c924: function(arg0, arg1) {
            arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_compute_8b2be52085d34e36: function(arg0, arg1) {
            arg0.compute = arg1;
        },
        __wbg_set_count_c6179bb884c328ef: function(arg0, arg1) {
            arg0.count = arg1 >>> 0;
        },
        __wbg_set_cull_mode_3233e59624672d4e: function(arg0, arg1) {
            arg0.cullMode = __wbindgen_enum_GpuCullMode[arg1];
        },
        __wbg_set_depth_bias_6e7bad3a03bae686: function(arg0, arg1) {
            arg0.depthBias = arg1;
        },
        __wbg_set_depth_bias_clamp_c3e46e20b1319eb6: function(arg0, arg1) {
            arg0.depthBiasClamp = arg1;
        },
        __wbg_set_depth_bias_slope_scale_e4faf95c5d1e38a2: function(arg0, arg1) {
            arg0.depthBiasSlopeScale = arg1;
        },
        __wbg_set_depth_clear_value_22ac16071c012963: function(arg0, arg1) {
            arg0.depthClearValue = arg1;
        },
        __wbg_set_depth_compare_7f7567a7e8d2a20f: function(arg0, arg1) {
            arg0.depthCompare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_depth_fail_op_36618aa2c112a8b4: function(arg0, arg1) {
            arg0.depthFailOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_depth_load_op_6c5eb58390842042: function(arg0, arg1) {
            arg0.depthLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_depth_or_array_layers_d021b9602446c0c8: function(arg0, arg1) {
            arg0.depthOrArrayLayers = arg1 >>> 0;
        },
        __wbg_set_depth_read_only_9df48fdffe0aa66e: function(arg0, arg1) {
            arg0.depthReadOnly = arg1 !== 0;
        },
        __wbg_set_depth_stencil_7c07649e913ec16e: function(arg0, arg1) {
            arg0.depthStencil = arg1;
        },
        __wbg_set_depth_stencil_attachment_de6bf51d002eb908: function(arg0, arg1) {
            arg0.depthStencilAttachment = arg1;
        },
        __wbg_set_depth_store_op_bb2ba04b36c7bdd9: function(arg0, arg1) {
            arg0.depthStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_depth_write_enabled_c0ecc7101fe87bf8: function(arg0, arg1) {
            arg0.depthWriteEnabled = arg1 !== 0;
        },
        __wbg_set_device_c7cc69d60d9cf106: function(arg0, arg1) {
            arg0.device = arg1;
        },
        __wbg_set_dimension_7f0364deea72ace0: function(arg0, arg1) {
            arg0.dimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_dimension_b140d4ffc52ab9f4: function(arg0, arg1) {
            arg0.dimension = __wbindgen_enum_GpuTextureDimension[arg1];
        },
        __wbg_set_dst_factor_53d01078ea67659a: function(arg0, arg1) {
            arg0.dstFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_end_of_pass_write_index_4307b5cef2d4d86d: function(arg0, arg1) {
            arg0.endOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_end_of_pass_write_index_52644fc3d56949b1: function(arg0, arg1) {
            arg0.endOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_entries_e5ad285e3289950f: function(arg0, arg1) {
            arg0.entries = arg1;
        },
        __wbg_set_entries_e8be1c8eb246cf26: function(arg0, arg1) {
            arg0.entries = arg1;
        },
        __wbg_set_entry_point_519259f79c5a8e4d: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_782b1d45a38001cf: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_d4b0da956bd6b2ba: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_fail_op_9d9650df23ba2111: function(arg0, arg1) {
            arg0.failOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_format_0e52ea7b9384ac6b: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_1ed4e12702593d8e: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_423f8c1de58d873f: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_4f6e506395604296: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_672708c6c96d3a04: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuVertexFormat[arg1];
        },
        __wbg_set_format_7c2a49ba44065a80: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_db451b4d880fc239: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_fragment_6d9f8c36b406d9b4: function(arg0, arg1) {
            arg0.fragment = arg1;
        },
        __wbg_set_front_face_dc4795f2754276bf: function(arg0, arg1) {
            arg0.frontFace = __wbindgen_enum_GpuFrontFace[arg1];
        },
        __wbg_set_g_5fbc9fad3ad27a7c: function(arg0, arg1) {
            arg0.g = arg1;
        },
        __wbg_set_has_dynamic_offset_b5f5f44b752da2e2: function(arg0, arg1) {
            arg0.hasDynamicOffset = arg1 !== 0;
        },
        __wbg_set_height_ad5056ea051acd78: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_height_ef298446b359b0c5: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_height_fc3358fe68410392: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_label_021ea25609809a07: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_415b065ec3fb4f48: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_5fa4c422680863eb: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_7b502181277e1279: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_885ee6c3a47183a6: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_8b2b2c1877722f9a: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_8d581de453b70e55: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_9bd0253bfeba31f3: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_b096894575aaba1e: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_b5b02ca1f89a90ec: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_cec0b41bfb77804d: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_d775c1defc56c544: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e426b73942527b8e: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_f20461bed18e52e3: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_f6a207f7f83dc626: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_layout_34c410044847aa48: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_layout_61b88e458ca5dc7d: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_layout_f2ee989d1a9d52a4: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_load_op_5b310bb9c61eb1d5: function(arg0, arg1) {
            arg0.loadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_lod_max_clamp_83c3eaae40b5d729: function(arg0, arg1) {
            arg0.lodMaxClamp = arg1;
        },
        __wbg_set_lod_min_clamp_c13c1046f64fccaa: function(arg0, arg1) {
            arg0.lodMinClamp = arg1;
        },
        __wbg_set_mag_filter_b34a0f82f66fd504: function(arg0, arg1) {
            arg0.magFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mapped_at_creation_461c27df7c64ac7b: function(arg0, arg1) {
            arg0.mappedAtCreation = arg1 !== 0;
        },
        __wbg_set_mask_16f0fb977a077e6d: function(arg0, arg1) {
            arg0.mask = arg1 >>> 0;
        },
        __wbg_set_max_anisotropy_33280b9303d377c0: function(arg0, arg1) {
            arg0.maxAnisotropy = arg1;
        },
        __wbg_set_min_binding_size_2fd83a7bce6fc84a: function(arg0, arg1) {
            arg0.minBindingSize = arg1;
        },
        __wbg_set_min_filter_18e71b62b66d6a52: function(arg0, arg1) {
            arg0.minFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mip_level_1df7434229448f62: function(arg0, arg1) {
            arg0.mipLevel = arg1 >>> 0;
        },
        __wbg_set_mip_level_count_9cfaadd4d97253b4: function(arg0, arg1) {
            arg0.mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mip_level_count_cc06dd5cc8da32fa: function(arg0, arg1) {
            arg0.mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mipmap_filter_37622626d458c955: function(arg0, arg1) {
            arg0.mipmapFilter = __wbindgen_enum_GpuMipmapFilterMode[arg1];
        },
        __wbg_set_module_1bff0ef07bc49331: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_module_4c77a24bd1c45eb0: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_module_574e5aee4331f373: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_multisample_f57845304ba73461: function(arg0, arg1) {
            arg0.multisample = arg1;
        },
        __wbg_set_multisampled_935682e740c8dac5: function(arg0, arg1) {
            arg0.multisampled = arg1 !== 0;
        },
        __wbg_set_offset_0a36ff790807cdfd: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_offset_3cac50c03a339f62: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_offset_7fc612b79c557829: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_offset_a439877bbb8d5db6: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_operation_d4755de4993bb6bf: function(arg0, arg1) {
            arg0.operation = __wbindgen_enum_GpuBlendOperation[arg1];
        },
        __wbg_set_origin_aa76a76dc965377e: function(arg0, arg1) {
            arg0.origin = arg1;
        },
        __wbg_set_pass_op_533e59101ae79854: function(arg0, arg1) {
            arg0.passOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_power_preference_0ff4caf1d78a9780: function(arg0, arg1) {
            arg0.powerPreference = __wbindgen_enum_GpuPowerPreference[arg1];
        },
        __wbg_set_primitive_928272ce7b250184: function(arg0, arg1) {
            arg0.primitive = arg1;
        },
        __wbg_set_query_set_256baf2505706dbf: function(arg0, arg1) {
            arg0.querySet = arg1;
        },
        __wbg_set_query_set_673b9867af3843cf: function(arg0, arg1) {
            arg0.querySet = arg1;
        },
        __wbg_set_r_d482350b90f66f22: function(arg0, arg1) {
            arg0.r = arg1;
        },
        __wbg_set_required_features_ee015feb3bb46e2b: function(arg0, arg1) {
            arg0.requiredFeatures = arg1;
        },
        __wbg_set_resolve_target_cf716fc86d56d49d: function(arg0, arg1) {
            arg0.resolveTarget = arg1;
        },
        __wbg_set_resource_adeca9e90e1291a9: function(arg0, arg1) {
            arg0.resource = arg1;
        },
        __wbg_set_rows_per_image_5da7ca4e10fa05b5: function(arg0, arg1) {
            arg0.rowsPerImage = arg1 >>> 0;
        },
        __wbg_set_rows_per_image_880d6b16f62c535a: function(arg0, arg1) {
            arg0.rowsPerImage = arg1 >>> 0;
        },
        __wbg_set_sample_count_47e00797c7c7007e: function(arg0, arg1) {
            arg0.sampleCount = arg1 >>> 0;
        },
        __wbg_set_sample_type_f21f11f4b4085a2f: function(arg0, arg1) {
            arg0.sampleType = __wbindgen_enum_GpuTextureSampleType[arg1];
        },
        __wbg_set_sampler_faa53060dad855d4: function(arg0, arg1) {
            arg0.sampler = arg1;
        },
        __wbg_set_shader_location_732ba25997f99074: function(arg0, arg1) {
            arg0.shaderLocation = arg1 >>> 0;
        },
        __wbg_set_size_3ce80484fe014d70: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_size_ec0879fafa1f7f60: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_size_f3bdb3b76d69ce2e: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_src_factor_6325dccd3632ca02: function(arg0, arg1) {
            arg0.srcFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_stencil_back_977d937f4a2aea06: function(arg0, arg1) {
            arg0.stencilBack = arg1;
        },
        __wbg_set_stencil_clear_value_ef31b2c0d12da2b2: function(arg0, arg1) {
            arg0.stencilClearValue = arg1 >>> 0;
        },
        __wbg_set_stencil_front_a16dbeef8ddf654b: function(arg0, arg1) {
            arg0.stencilFront = arg1;
        },
        __wbg_set_stencil_load_op_2bda5d883d7144ab: function(arg0, arg1) {
            arg0.stencilLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_stencil_read_mask_cdba22ff97b765e5: function(arg0, arg1) {
            arg0.stencilReadMask = arg1 >>> 0;
        },
        __wbg_set_stencil_read_only_73585db3e480ce39: function(arg0, arg1) {
            arg0.stencilReadOnly = arg1 !== 0;
        },
        __wbg_set_stencil_store_op_c25139982e6199cf: function(arg0, arg1) {
            arg0.stencilStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_stencil_write_mask_37ea11c2cfe654c4: function(arg0, arg1) {
            arg0.stencilWriteMask = arg1 >>> 0;
        },
        __wbg_set_step_mode_ac09182f2ffc02f9: function(arg0, arg1) {
            arg0.stepMode = __wbindgen_enum_GpuVertexStepMode[arg1];
        },
        __wbg_set_storage_texture_d8bd64b59571a6f2: function(arg0, arg1) {
            arg0.storageTexture = arg1;
        },
        __wbg_set_store_op_7330f77e7616004a: function(arg0, arg1) {
            arg0.storeOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_strip_index_format_5926dd63cfa44857: function(arg0, arg1) {
            arg0.stripIndexFormat = __wbindgen_enum_GpuIndexFormat[arg1];
        },
        __wbg_set_targets_7c73183a12a957e2: function(arg0, arg1) {
            arg0.targets = arg1;
        },
        __wbg_set_texture_0601e2dc5424513c: function(arg0, arg1) {
            arg0.texture = arg1;
        },
        __wbg_set_texture_d38afc883df646c2: function(arg0, arg1) {
            arg0.texture = arg1;
        },
        __wbg_set_timestamp_writes_2a561a80b2b13dba: function(arg0, arg1) {
            arg0.timestampWrites = arg1;
        },
        __wbg_set_timestamp_writes_8fb776a718ade3b9: function(arg0, arg1) {
            arg0.timestampWrites = arg1;
        },
        __wbg_set_topology_69b5f25779091d7a: function(arg0, arg1) {
            arg0.topology = __wbindgen_enum_GpuPrimitiveTopology[arg1];
        },
        __wbg_set_type_336070a0bd5481c7: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_GpuBufferBindingType[arg1];
        },
        __wbg_set_type_5229687b3589bb10: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_GpuSamplerBindingType[arg1];
        },
        __wbg_set_usage_6c6fc8226c337ad8: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_78b7be73aa90cfd0: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_a43a1605e508ea21: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_b5a7dc195085b58e: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_vertex_3bcd2e7cbc333978: function(arg0, arg1) {
            arg0.vertex = arg1;
        },
        __wbg_set_view_8d0c46c633d57f1d: function(arg0, arg1) {
            arg0.view = arg1;
        },
        __wbg_set_view_dimension_11b23089a475c4f6: function(arg0, arg1) {
            arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_dimension_12a9363db2b90aa8: function(arg0, arg1) {
            arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_e53bc62c1806468e: function(arg0, arg1) {
            arg0.view = arg1;
        },
        __wbg_set_view_formats_34fa0f58e15c05c7: function(arg0, arg1) {
            arg0.viewFormats = arg1;
        },
        __wbg_set_view_formats_8f0e5c8999d03426: function(arg0, arg1) {
            arg0.viewFormats = arg1;
        },
        __wbg_set_visibility_d5104b65ecbecfb1: function(arg0, arg1) {
            arg0.visibility = arg1 >>> 0;
        },
        __wbg_set_width_031bdecd763c5855: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_width_f4beed5df54549b2: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_width_f9e631f4ee129e5c: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_write_mask_0e892ff393c2878b: function(arg0, arg1) {
            arg0.writeMask = arg1 >>> 0;
        },
        __wbg_set_x_d5a0f838d03cc0c8: function(arg0, arg1) {
            arg0.x = arg1 >>> 0;
        },
        __wbg_set_y_fa0f8ba06a4aca5a: function(arg0, arg1) {
            arg0.y = arg1 >>> 0;
        },
        __wbg_set_z_2cb0edac0ad5210f: function(arg0, arg1) {
            arg0.z = arg1 >>> 0;
        },
        __wbg_static_accessor_GLOBAL_THIS_2fee5048bcca5938: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_ce44e66a4935da8c: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_44f6e0cb5e67cdad: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_168f178805d978fe: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_submit_a0eef27ac882fdbc: function(arg0, arg1) {
            arg0.submit(arg1);
        },
        __wbg_then_05edfc8a4fea5106: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_2a84678a50976959: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_591b6b3a75ee817a: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_unmap_86f345d7fc3ecd10: function(arg0) {
            arg0.unmap();
        },
        __wbg_wasmscenerenderer_new: function(arg0) {
            const ret = WasmSceneRenderer.__wrap(arg0);
            return ret;
        },
        __wbg_width_c8740d5bdf596189: function(arg0) {
            const ret = arg0.width;
            return ret;
        },
        __wbg_writeBuffer_280ac7924a1b1df0: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.writeBuffer(arg1, arg2, arg3, arg4, arg5);
        }, arguments); },
        __wbg_writeTexture_9d6295813b0ef4a1: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.writeTexture(arg1, arg2, arg3, arg4);
        }, arguments); },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 1494, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h200a21b777a48c32);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 1745, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h4aa3e05baac20cce);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0, arg1) {
            var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
            wasm.__wbindgen_free(arg0, arg1 * 1, 1);
            // Cast intrinsic for `Vector(U8) -> Externref`.
            const ret = v0;
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./motionloom_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__h200a21b777a48c32(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h200a21b777a48c32(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h4aa3e05baac20cce(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__h4aa3e05baac20cce(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h45c32c0111268609(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h45c32c0111268609(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_GpuAddressMode = ["clamp-to-edge", "repeat", "mirror-repeat"];


const __wbindgen_enum_GpuBlendFactor = ["zero", "one", "src", "one-minus-src", "src-alpha", "one-minus-src-alpha", "dst", "one-minus-dst", "dst-alpha", "one-minus-dst-alpha", "src-alpha-saturated", "constant", "one-minus-constant", "src1", "one-minus-src1", "src1-alpha", "one-minus-src1-alpha"];


const __wbindgen_enum_GpuBlendOperation = ["add", "subtract", "reverse-subtract", "min", "max"];


const __wbindgen_enum_GpuBufferBindingType = ["uniform", "storage", "read-only-storage"];


const __wbindgen_enum_GpuCanvasAlphaMode = ["opaque", "premultiplied"];


const __wbindgen_enum_GpuCompareFunction = ["never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always"];


const __wbindgen_enum_GpuCullMode = ["none", "front", "back"];


const __wbindgen_enum_GpuFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuFrontFace = ["ccw", "cw"];


const __wbindgen_enum_GpuIndexFormat = ["uint16", "uint32"];


const __wbindgen_enum_GpuLoadOp = ["load", "clear"];


const __wbindgen_enum_GpuMipmapFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuPowerPreference = ["low-power", "high-performance"];


const __wbindgen_enum_GpuPrimitiveTopology = ["point-list", "line-list", "line-strip", "triangle-list", "triangle-strip"];


const __wbindgen_enum_GpuSamplerBindingType = ["filtering", "non-filtering", "comparison"];


const __wbindgen_enum_GpuStencilOperation = ["keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap"];


const __wbindgen_enum_GpuStorageTextureAccess = ["write-only", "read-only", "read-write"];


const __wbindgen_enum_GpuStoreOp = ["store", "discard"];


const __wbindgen_enum_GpuTextureAspect = ["all", "stencil-only", "depth-only"];


const __wbindgen_enum_GpuTextureDimension = ["1d", "2d", "3d"];


const __wbindgen_enum_GpuTextureFormat = ["r8unorm", "r8snorm", "r8uint", "r8sint", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32uint", "r32sint", "r32float", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb9e5ufloat", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rg32uint", "rg32sint", "rg32float", "rgba16uint", "rgba16sint", "rgba16float", "rgba32uint", "rgba32sint", "rgba32float", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb"];


const __wbindgen_enum_GpuTextureSampleType = ["float", "unfilterable-float", "depth", "sint", "uint"];


const __wbindgen_enum_GpuTextureViewDimension = ["1d", "2d", "2d-array", "cube", "cube-array", "3d"];


const __wbindgen_enum_GpuVertexFormat = ["uint8", "uint8x2", "uint8x4", "sint8", "sint8x2", "sint8x4", "unorm8", "unorm8x2", "unorm8x4", "snorm8", "snorm8x2", "snorm8x4", "uint16", "uint16x2", "uint16x4", "sint16", "sint16x2", "sint16x4", "unorm16", "unorm16x2", "unorm16x4", "snorm16", "snorm16x2", "snorm16x4", "float16", "float16x2", "float16x4", "float32", "float32x2", "float32x3", "float32x4", "uint32", "uint32x2", "uint32x3", "uint32x4", "sint32", "sint32x2", "sint32x3", "sint32x4", "unorm10-10-10-2", "unorm8x4-bgra"];


const __wbindgen_enum_GpuVertexStepMode = ["vertex", "instance"];
const WasmPoseDiagnosticsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmposediagnostics_free(ptr, 1));
const WasmSceneRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmscenerenderer_free(ptr, 1));
const WasmWorldRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmworldrenderer_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('motionloom_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
