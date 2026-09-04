interface EditableBone { id: string; channels: Record<string, string>; interpolation?: string; inTangent?: string; outTangent?: string }
interface EditablePose { timeMs: number; bones: EditableBone[] }
interface EditableContact { id: string; effector: string; target: string; from: number; to: number; mode: string; weight: string }
interface EditableDiagnostic { severity: string; code: string; message: string }
interface EditableIk { id: string; root: string; mid: string; end: string; targetX: string; targetY: string; targetZ: string; bend: string; weight: string; iterations: string }
interface EditableAction { id: string; durationMs: number; poses: EditablePose[]; contacts?: EditableContact[]; iks?: EditableIk[]; diagnostics?: EditableDiagnostic[] }
interface EditableDocument { fps: number; durationMs: number; actions: EditableAction[] }
interface Joint { actor: string; bone: string; x: number; y: number; depth: number }
interface RigSnapshot { width: number; height: number; joints: Joint[] }

interface SceneRenderer {
  add_asset(name: string, bytes: Uint8Array): void;
  render_frame_to_canvas(frame: number, canvas: HTMLCanvasElement): Promise<void>;
  editor_rig_snapshot_json(): string;
  set_action_pose_channel(action: string, timeMs: number, bone: string, channel: string, value: string): boolean;
  set_camera3d_pose(cameraId: string, position: string, target: string): boolean;
  free?(): void;
  readonly total_frames: number;
}

interface MotionLoomModule {
  default(options: { module_or_path: string }): Promise<unknown>;
  WasmSceneRenderer: { create(script: string, profile: string): Promise<SceneRenderer> };
  motionloom_editable_actions_json(script: string): string;
  motionloom_apply_action_edit(script: string, command: string): string;
  motionloom_inspect_glb_skeleton_json(assetLabel: string, bytes: Uint8Array): string;
  motionloom_inspect_glb_humanoid_profile_json?(assetLabel: string, bytes: Uint8Array): string;
}

interface DetectedHumanoidRig {
  family: string;
  label: string;
  confidence: number;
  mappingSource: string;
  matchedBoneCount: number;
  coreBoneCount: number;
  evidence: string[];
}

interface GlbSkeletonInspectionReport {
  skinJointCount: number;
  overallConfidence: number;
  manualReviewRequired: boolean;
  mappings: Array<{ canonicalBone: string; sourceJoint: string; confidence: number }>;
  diagnostics: Array<{ severity: string; message: string; recommendation: string }>;
  profileDsl: string;
  detectedRig?: DetectedHumanoidRig;
}

interface ActionLibraryEntry {
  id: string;
  file: string;
  label: string;
  icon: string;
  description: string;
  defaultAction?: string;
  members?: string[];
  rootMotion?: 'none' | 'clip' | 'in_place' | 'match_target';
  loop?: boolean;
}

interface ActionLibraryManifest {
  template: string;
  actions: ActionLibraryEntry[];
}

type ActionEditorWindow = {
  MOTIONLOOM_BASE?: string;
  MOTIONLOOM_WASM_VERSION?: string;
  MOTIONLOOM_WASM_PROMISE?: Promise<MotionLoomModule | null>;
};

type Tool = 'select' | 'move' | 'rotate';
type TimelineMode = 'dopesheet' | 'graph';
interface SelectedKey { actionId: string; boneId: string; channel: string; timeMs: number }
const keyId = (key: SelectedKey) => `${key.actionId}|${key.boneId}|${key.channel}|${key.timeMs}`;
const LOCAL_CHARACTER_ASSET = 'motionloom-imported-character.glb';

const TREE: Array<[string, string | null]> = [
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['upper_chest', 'chest'], ['neck', 'upper_chest'], ['head', 'neck'],
  ['shoulder_l', 'upper_chest'], ['upper_arm_l', 'shoulder_l'], ['forearm_l', 'upper_arm_l'], ['hand_l', 'forearm_l'],
  ['shoulder_r', 'upper_chest'], ['upper_arm_r', 'shoulder_r'], ['forearm_r', 'upper_arm_r'], ['hand_r', 'forearm_r'],
  ['upper_leg_l', 'hips'], ['lower_leg_l', 'upper_leg_l'], ['foot_l', 'lower_leg_l'], ['toe_l', 'foot_l'],
  ['upper_leg_r', 'hips'], ['lower_leg_r', 'upper_leg_r'], ['foot_r', 'lower_leg_r'], ['toe_r', 'foot_r'],
  ...(['l', 'r'] as const).flatMap((side) => ['thumb', 'index', 'middle', 'ring', 'pinky'].flatMap((finger) => [1, 2, 3].map((segment) => [
    `${finger}_${segment}_${side}`,
    segment === 1 ? `hand_${side}` : `${finger}_${segment - 1}_${side}`,
  ] as [string, string]))),
];

const LOCATION = [
  { channel: 'x', label: 'X', min: -1, max: 1, step: .005 },
  { channel: 'y', label: 'Y', min: -1, max: 1, step: .005 },
  { channel: 'z', label: 'Z', min: -1, max: 1, step: .005 },
];
const ROTATION = [
  // Blender-style local Euler channels.  Semantic Action channels such as
  // forward/side/twist require a BoneAxisMap and are therefore not universal
  // (distal finger bones commonly expose only `bend`).
  { channel: 'rotationX', label: 'X', min: -180, max: 180, step: 1 },
  { channel: 'rotationY', label: 'Y', min: -180, max: 180, step: 1 },
  { channel: 'rotationZ', label: 'Z', min: -180, max: 180, step: 1 },
  { channel: 'bend', label: 'B', min: -180, max: 180, step: 1 },
  { channel: 'turn', label: 'T', min: -180, max: 180, step: 1 },
];

const state = {
  wasm: null as MotionLoomModule | null,
  renderer: null as SceneRenderer | null,
  dsl: '',
  document: null as EditableDocument | null,
  actionId: 'look_around_action',
  frame: 0,
  endFrame: 150,
  selectedBone: 'hips',
  selectedKey: null as SelectedKey | null,
  selectedKeys: new Map<string, SelectedKey>(),
  keyClipboard: [] as Array<SelectedKey & { value: string }>,
  clipboardOriginMs: 0,
  tool: 'select' as Tool,
  timelineMode: 'dopesheet' as TimelineMode,
  autoKey: true,
  playing: false,
  playbackOriginMs: 0,
  playbackOriginFrame: 0,
  playbackFramePending: false,
  playbackQueuedFrame: null as number | null,
  playbackLastRequestedFrame: -1,
  renderPending: false,
  renderAgain: false,
  snapshot: null as RigSnapshot | null,
  undo: [] as string[],
  redo: [] as string[],
  assetBytes: new Map<string, Uint8Array>(),
  cameraYaw: 0,
  cameraPitch: .025,
  cameraDistance: 4.25,
  showJoints: true,
  transformSpace: 'Local' as 'Local' | 'Parent' | 'World',
  actionDialogMode: 'create' as 'create' | 'duplicate',
  dirty: false,
  actionMeta: {} as Record<string, Omit<ActionLibraryEntry, 'id' | 'file'>>,
  actionLibrary: [] as ActionLibraryEntry[],
  libraryBase: '',
  libraryVersion: 'dev',
  loadedActionFiles: new Set<string>(),
  characterLabel: 'Character1',
};

const q = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const frameMs = () => Math.round(state.frame * 1000 / (state.document?.fps || 30));
const currentAction = () => state.document?.actions.find((action) => action.id === state.actionId) || null;
const currentPose = () => currentAction()?.poses.find((pose) => Math.abs(pose.timeMs - frameMs()) <= 1) || null;
const currentBone = () => currentPose()?.bones.find((bone) => bone.id === state.selectedBone) || null;
type ValueState = 'keyed' | 'interpolated' | 'held' | 'default';
interface EvaluatedValue { value: number; state: ValueState }

function evaluatedChannel(boneId: string, channel: string, atMs = frameMs()): EvaluatedValue {
  const samples = (currentAction()?.poses || []).flatMap((pose) => {
    const value = pose.bones.find((bone) => bone.id === boneId)?.channels[channel];
    const bone = pose.bones.find((entry) => entry.id === boneId);
    return value === undefined ? [] : [{ timeMs: pose.timeMs, value: Number(value), interpolation: bone?.interpolation || 'linear', inTangent: Number(bone?.inTangent || 0), outTangent: Number(bone?.outTangent || 0) }];
  }).filter((sample) => Number.isFinite(sample.value)).sort((a, b) => a.timeMs - b.timeMs);
  if (!samples.length) return { value: 0, state: 'default' };
  const exact = samples.find((sample) => Math.abs(sample.timeMs - atMs) <= 1);
  if (exact) return { value: exact.value, state: 'keyed' };
  const previous = [...samples].reverse().find((sample) => sample.timeMs < atMs);
  const next = samples.find((sample) => sample.timeMs > atMs);
  if (previous && next) {
    let phase = (atMs - previous.timeMs) / Math.max(1, next.timeMs - previous.timeMs);
    if (previous.interpolation === 'hold') phase = 0;
    else if (previous.interpolation === 'ease') phase = phase * phase * (3 - 2 * phase);
    else if (previous.interpolation === 'bezier') {
      const t2 = phase * phase; const t3 = t2 * phase;
      phase = Math.max(0, Math.min(1, (-2 * t3 + 3 * t2) + (t3 - 2 * t2 + phase) * previous.outTangent + (t3 - t2) * next.inTangent));
    }
    return { value: previous.value + (next.value - previous.value) * phase, state: 'interpolated' };
  }
  return { value: (previous || next)!.value, state: 'held' };
}

const channelValue = (channel: string) => evaluatedChannel(state.selectedBone, channel).value;
const isFinger = (bone: string) => /^(thumb|index|middle|ring|pinky)_/.test(bone);
const niceName = (bone: string) => bone.split('_').map((part) => part === 'l' ? 'L' : part === 'r' ? 'R' : part[0].toUpperCase() + part.slice(1)).join(' ');
function basePath(): string {
  return String((window as unknown as ActionEditorWindow).MOTIONLOOM_BASE || '/').replace(/\/$/, '');
}

async function loadWasm(): Promise<MotionLoomModule> {
  const host = window as unknown as ActionEditorWindow;
  if (host.MOTIONLOOM_WASM_PROMISE) {
    const shared = await host.MOTIONLOOM_WASM_PROMISE;
    if (!shared) throw new Error('MotionLoom WASM initialization failed.');
    return shared;
  }
  const version = encodeURIComponent(String(host.MOTIONLOOM_WASM_VERSION || 'dev'));
  const jsUrl = `${basePath()}/motionloom-wasm/pkg/motionloom.js?v=${version}`;
  const wasmUrl = `${basePath()}/motionloom-wasm/pkg/motionloom_bg.wasm?v=${version}`;
  const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
  const promise = nativeImport(jsUrl).then(async (raw) => {
    const module = raw as MotionLoomModule;
    await module.default({ module_or_path: wasmUrl });
    return module;
  });
  host.MOTIONLOOM_WASM_PROMISE = promise;
  return promise;
}

function setStatus(message: string, error = false): void {
  const output = q<HTMLElement>('#ae-runtime-status');
  output.textContent = message;
  output.classList.toggle('is-error', error);
}

function parseDocument(): void {
  if (!state.wasm) return;
  state.document = JSON.parse(state.wasm.motionloom_editable_actions_json(state.dsl)) as EditableDocument;
  const action = state.document.actions.find((entry) => entry.id === state.actionId) || state.document.actions[0];
  if (action) state.actionId = action.id;
  state.endFrame = Math.max(1, Math.round((action?.durationMs || state.document.durationMs) * state.document.fps / 1000));
  q<HTMLInputElement>('#ae-end-frame').value = String(state.endFrame);
  q<HTMLElement>('#ae-action-name').textContent = `${state.actionId}${state.dirty ? ' *' : ''}`;
  const diagnostics = action?.diagnostics || [];
  q<HTMLOutputElement>('#ae-diagnostics').textContent = diagnostics.length
    ? diagnostics.map((entry) => `${entry.severity.toUpperCase()}: ${entry.message}`).join('\n')
    : `${action?.contacts?.length || 0} contacts · no diagnostics`;
  renderActionBrowser();
}

function renderActionBrowser(): void {
  const root = document.querySelector<HTMLElement>('#ae-action-options');
  if (!root || !state.document) return;
  root.replaceChildren();
  const entries: ActionLibraryEntry[] = state.actionLibrary.length ? state.actionLibrary : state.document.actions.map((action) => ({
    id: action.id,
    file: '',
    label: niceName(action.id),
    icon: '◆',
    description: `${action.poses.length} poses`,
  }));
  entries.forEach((entry) => {
    const actionId = entry.defaultAction || entry.id;
    const action = state.document?.actions.find((candidate) => candidate.id === actionId);
    const members = entry.members?.length ? entry.members : [actionId];
    const button = document.createElement('button');
    button.type = 'button'; button.className = `action-option${members.includes(state.actionId) ? ' is-selected' : ''}`;
    button.dataset.action = actionId; button.setAttribute('role', 'menuitem');
    button.innerHTML = `<span class="action-icon">${entry.icon}</span><span><strong>${entry.label}</strong><small>${entry.description}</small></span><small>${entry.members?.length ? `${entry.members.length} phases` : action ? `${action.poses.length} keys` : 'Load'}</small>`;
    root.append(button);
  });
}

function libraryEntryForAction(actionId: string): ActionLibraryEntry | undefined {
  return state.actionLibrary.find((entry) => (
    entry.id === actionId || entry.defaultAction === actionId || entry.members?.includes(actionId)
  ));
}

async function ensureActionLoaded(actionId: string): Promise<void> {
  if (state.document?.actions.some((action) => action.id === actionId)) return;
  const entry = libraryEntryForAction(actionId);
  if (!entry) throw new Error(`Action ${actionId} is not present in the library manifest.`);
  if (state.loadedActionFiles.has(entry.file)) {
    throw new Error(`Action file ${entry.file} was loaded but did not contain ${actionId}.`);
  }
  setStatus(`Loading ${entry.label}…`);
  const response = await fetch(`${state.libraryBase}/${entry.file}?v=${state.libraryVersion}`);
  if (!response.ok) throw new Error(`Action DSL fetch failed (${entry.file}): ${response.status}`);
  const source = await response.text();
  const insertion = state.dsl.indexOf('\n  <Background');
  if (insertion < 0) throw new Error('Character1 scene template has no Action insertion boundary.');
  state.dsl = `${state.dsl.slice(0, insertion)}\n\n${source}${state.dsl.slice(insertion)}`;
  state.loadedActionFiles.add(entry.file);
  parseDocument();
}

function replaceApplyAction(
  source: string,
  actionId: string,
  durationMs: number,
  contacts?: EditableAction['contacts'],
  playback?: Pick<ActionLibraryEntry, 'rootMotion' | 'loop'>,
): string {
  return source.replace(/<ApplyAction\b[^>]*\btarget=["']character1_actor["'][^>]*\/>/, (tag) => {
    const setAttribute = (value: string, attribute: string, next: string | null) => {
      const pattern = new RegExp(`\\s+${attribute}=["'][^"']*["']`);
      if (next === null) return value.replace(pattern, '');
      return pattern.test(value)
        ? value.replace(pattern, ` ${attribute}="${next}"`)
        : value.replace('/>', ` ${attribute}="${next}" />`);
    };
    let next = setAttribute(tag, 'action', actionId);
    next = setAttribute(next, 'duration', `${durationMs}ms`);
    // Manifest playback metadata is optional, so removing it restores the
    // editor's established in-place looping behavior without a migration.
    next = setAttribute(next, 'loop', String(playback?.loop ?? true));
    next = setAttribute(next, 'rootMotion', playback?.rootMotion ?? 'none');
    if (contacts !== undefined) {
      const hasGroundContact = contacts.some((contact) => contact.target === 'ground');
      const hasGroundFootLock = contacts.some((contact) => (
        contact.target === 'ground'
        && (contact.effector === 'foot_l' || contact.effector === 'foot_r')
        && contact.mode === 'lock'
      ));
      next = setAttribute(next, 'contactCorrection', hasGroundContact ? 'auto' : null);
      next = setAttribute(next, 'footLock', hasGroundFootLock ? 'auto' : null);
      if (hasGroundContact) next = setAttribute(next, 'ground', 'action_ground');
    }
    return next;
  });
}

async function selectAction(actionId: string): Promise<void> {
  await ensureActionLoaded(actionId);
  const action = state.document?.actions.find((entry) => entry.id === actionId);
  if (!action || actionId === state.actionId) return;
  state.undo.push(state.dsl); state.redo.length = 0;
  state.actionId = actionId;
  state.selectedKey = null;
  state.selectedKeys.clear();
  // Switch the action and its contact bindings as one valid DSL transaction.
  state.dsl = replaceApplyAction(
    state.dsl,
    actionId,
    action.durationMs,
    action.contacts || [],
    state.actionMeta[actionId],
  );
  state.dirty = true;
  state.frame = 0;
  state.selectedBone = action.poses.flatMap((pose) => pose.bones).find((bone) => bone.id === 'hips')?.id
    || action.poses.flatMap((pose) => pose.bones)[0]?.id || 'hips';
  parseDocument();
  refreshUi();
  q<HTMLElement>('#ae-action-browser').hidden = true;
  q<HTMLButtonElement>('#ae-pose-menu').setAttribute('aria-expanded', 'false');
  await rebuildRenderer();
  setStatus(`${state.actionMeta[actionId]?.label || niceName(actionId)} selected · press Edit or adjust a bone`);
}

async function fetchAssets(renderer: SceneRenderer): Promise<void> {
  const urls = [...state.dsl.matchAll(/<ModelAsset\b[^>]*\bsrc=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const url of urls) {
    let bytes = state.assetBytes.get(url);
    if (!bytes) {
      setStatus(`Loading ${url.split('/').pop()}…`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Asset fetch failed: ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      state.assetBytes.set(url, bytes);
    }
    renderer.add_asset(url, bytes);
  }
}

function replaceCharacterInScene(source: string, profileDsl: string): string {
  const assetPattern = /<ModelAsset\b(?=[^>]*\bid=["']character1_model["'])[^>]*\/>/;
  const profilePattern = /<ModelProfile\b(?=[^>]*\bid=["']character1_profile["'])[^>]*>[\s\S]*?<\/ModelProfile>/;
  if (!assetPattern.test(source)) throw new Error('Action Editor scene has no character1_model asset.');
  if (!profilePattern.test(source)) throw new Error('Action Editor scene has no character1_profile.');
  const importedProfile = profileDsl
    .replace(/\bid=["']auto_humanoid_profile["']/, 'id="character1_profile"')
    .replace(/\bmodel=["'][^"']*["']/, 'model="character1_model"');
  return source
    .replace(assetPattern, `<ModelAsset id="character1_model" src="${LOCAL_CHARACTER_ASSET}" />`)
    .replace(profilePattern, importedProfile);
}

async function importCharacterGlb(file: File): Promise<void> {
  if (!state.wasm) throw new Error('MotionLoom WASM is not ready yet.');
  if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('Choose a binary .glb character file.');
  setStatus(`Inspecting ${file.name} skeleton…`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspect = state.wasm.motionloom_inspect_glb_humanoid_profile_json
    || state.wasm.motionloom_inspect_glb_skeleton_json;
  const report = JSON.parse(inspect('character1_model', bytes)) as GlbSkeletonInspectionReport;
  if (!report.profileDsl || !report.mappings?.length) throw new Error(`${file.name} has no usable humanoid mapping.`);

  const previousDsl = state.dsl;
  const previousBytes = state.assetBytes.get(LOCAL_CHARACTER_ASSET);
  const previousLabel = state.characterLabel;
  const previousTitle = q<HTMLElement>('#ae-character-name').title;
  try {
    state.dsl = replaceCharacterInScene(state.dsl, report.profileDsl);
    state.assetBytes.set(LOCAL_CHARACTER_ASSET, bytes);
    state.characterLabel = file.name.replace(/\.glb$/i, '') || 'Imported Character';
    const characterName = q<HTMLElement>('#ae-character-name');
    characterName.textContent = state.characterLabel;
    characterName.title = report.detectedRig
      ? `${report.detectedRig.label} · ${report.detectedRig.mappingSource} mapping`
      : 'Generic humanoid · heuristic mapping';
    await rebuildRenderer();
  } catch (error) {
    state.dsl = previousDsl;
    state.characterLabel = previousLabel;
    q<HTMLElement>('#ae-character-name').textContent = previousLabel;
    q<HTMLElement>('#ae-character-name').title = previousTitle;
    if (previousBytes) state.assetBytes.set(LOCAL_CHARACTER_ASSET, previousBytes);
    else state.assetBytes.delete(LOCAL_CHARACTER_ASSET);
    throw error;
  }

  const confidence = Math.round(Number(report.overallConfidence || 0) * 100);
  const mappedCore = report.mappings.filter((mapping) => ['hips', 'spine', 'head', 'upper_arm_l', 'upper_arm_r', 'upper_leg_l', 'upper_leg_r', 'lower_leg_l', 'lower_leg_r'].includes(mapping.canonicalBone)).length;
  const rig = report.detectedRig
    ? `${report.detectedRig.label} (${report.detectedRig.mappingSource})`
    : 'Generic humanoid (heuristic)';
  setStatus(`${rig} · ${report.mappings.length} bones · ${confidence}% profile${report.manualReviewRequired ? ' · review retargeting' : ''}`, report.manualReviewRequired && mappedCore < 9);
}

async function rebuildRenderer(): Promise<void> {
  if (!state.wasm) return;
  const previous = state.renderer;
  setStatus(`Building ${state.characterLabel} scene…`);
  const renderer = await state.wasm.WasmSceneRenderer.create(state.dsl, 'gpu');
  await fetchAssets(renderer);
  state.renderer = renderer;
  previous?.free?.();
  await renderFrame();
}

async function renderFrame(): Promise<void> {
  if (!state.renderer || state.renderPending) {
    state.renderAgain = Boolean(state.renderer);
    return;
  }
  state.renderPending = true;
  try {
    const canvas = q<HTMLCanvasElement>('#ae-canvas');
    // Resizing a canvas clears its current texture immediately. Reassigning
    // these values on every wheel event caused a black flash before WebGPU
    // presented the next camera frame.
    if (canvas.width !== 960) canvas.width = 960;
    if (canvas.height !== 720) canvas.height = 720;
    await state.renderer.render_frame_to_canvas(Math.min(state.frame, state.renderer.total_frames - 1), canvas);
    const raw = state.renderer.editor_rig_snapshot_json();
    state.snapshot = raw ? JSON.parse(raw) as RigSnapshot | null : null;
    renderJointOverlay();
    q<HTMLElement>('#ae-runtime-status').textContent = `${state.characterLabel} ready · frame ${state.frame} · ${state.snapshot?.joints.length || 0} selectable joints`;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    state.renderPending = false;
    if (state.renderAgain) {
      state.renderAgain = false;
      void renderFrame();
    }
  }
}

function renderBoneTree(filter = ''): void {
  const root = q<HTMLElement>('#ae-bone-tree');
  const normalized = filter.trim().toLowerCase();
  root.replaceChildren();
  const depthOf = (id: string): number => {
    let depth = 0;
    let parent = TREE.find(([bone]) => bone === id)?.[1];
    while (parent) { depth += 1; parent = TREE.find(([bone]) => bone === parent)?.[1]; }
    return depth;
  };
  TREE.filter(([bone]) => !normalized || bone.includes(normalized)).forEach(([bone]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bone-row${bone === state.selectedBone ? ' is-selected' : ''}${isFinger(bone) ? ' is-finger' : ''}`;
    button.style.paddingLeft = `${9 + Math.min(depthOf(bone), 6) * 14}px`;
    button.dataset.bone = bone;
    button.setAttribute('role', 'treeitem');
    button.innerHTML = `<span class="bone-dot"></span><span>${niceName(bone)}</span>`;
    root.append(button);
  });
}

function makeField(container: HTMLElement, spec: typeof LOCATION[number], group: 'location' | 'rotation'): void {
  const row = document.createElement('label');
  row.className = 'axis-field';
  row.innerHTML = `<b class="${spec.label.toLowerCase()}">${spec.label}</b><input type="number" min="${spec.min}" max="${spec.max}" step="${spec.step}" data-channel="${spec.channel}" data-group="${group}"><button type="button" title="Insert keyframe">◆</button>`;
  container.append(row);
}

function renderInspector(): void {
  q<HTMLElement>('#ae-active-bone').textContent = niceName(state.selectedBone);
  const parent = TREE.find(([bone]) => bone === state.selectedBone)?.[1];
  q<HTMLElement>('#ae-bone-path').textContent = parent ? `${niceName(parent)} / ${niceName(state.selectedBone)}` : niceName(state.selectedBone);
  const valueStates = new Set<ValueState>();
  document.querySelectorAll<HTMLInputElement>('.axis-field input[data-channel]').forEach((input) => {
    const evaluated = evaluatedChannel(state.selectedBone, input.dataset.channel || '');
    input.value = Number(evaluated.value.toFixed(3)).toString();
    input.dataset.valueState = evaluated.state;
    input.title = evaluated.state === 'keyed' ? 'Authored keyframe value' : evaluated.state === 'interpolated'
      ? `Interpolated at frame ${state.frame}` : evaluated.state === 'held' ? 'Held from nearest authored key' : 'Channel is not authored on this bone';
    valueStates.add(evaluated.state);
  });
  const exactBone = currentBone();
  const animated = (currentAction()?.poses || []).some((pose) => pose.bones.some((bone) => bone.id === state.selectedBone && Object.keys(bone.channels).length));
  const stateLabel = q<HTMLElement>('#ae-value-state');
  stateLabel.className = '';
  if (exactBone && Object.keys(exactBone.channels).length) {
    stateLabel.textContent = `Keyed · frame ${state.frame}`; stateLabel.classList.add('is-keyed');
  } else if (valueStates.has('interpolated')) {
    stateLabel.textContent = `Interpolated · frame ${state.frame}`; stateLabel.classList.add('is-interpolated');
  } else if (valueStates.has('held')) {
    stateLabel.textContent = `Held · frame ${state.frame}`; stateLabel.classList.add('is-unanimated');
  } else if (animated) {
    stateLabel.textContent = `Authored on another frame · ${state.frame}`; stateLabel.classList.add('is-interpolated');
  } else {
    stateLabel.textContent = 'Not animated in this Action'; stateLabel.classList.add('is-unanimated');
  }
  const animatedChild = findAnimatedDescendant(state.selectedBone);
  const childButton = q<HTMLButtonElement>('#ae-select-animated-child');
  childButton.hidden = animated || !animatedChild;
  childButton.dataset.bone = animatedChild || '';
  childButton.textContent = animatedChild ? `Select ${niceName(animatedChild)}` : '';
  q<HTMLElement>('#ae-selection-label').textContent = niceName(state.selectedBone);
  const exact = currentBone();
  q<HTMLSelectElement>('#ae-interpolation').value = niceName(exact?.interpolation || 'linear');
  q<HTMLInputElement>('#ae-in-tangent').value = exact?.inTangent || '0';
  q<HTMLInputElement>('#ae-out-tangent').value = exact?.outTangent || '0';
}

function findAnimatedDescendant(boneId: string): string | null {
  const action = currentAction();
  if (!action) return null;
  const animated = new Set(action.poses.flatMap((pose) => pose.bones.filter((bone) => Object.keys(bone.channels).length).map((bone) => bone.id)));
  const queue = TREE.filter(([, parent]) => parent === boneId).map(([bone]) => bone);
  while (queue.length) {
    const candidate = queue.shift()!;
    if (animated.has(candidate)) return candidate;
    queue.push(...TREE.filter(([, parent]) => parent === candidate).map(([bone]) => bone));
  }
  return null;
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderJointOverlay(): void {
  const svg = q<SVGSVGElement>('#ae-joint-overlay');
  svg.replaceChildren();
  if (!state.snapshot || !state.showJoints) return;
  svg.setAttribute('viewBox', `0 0 ${state.snapshot.width || 960} ${state.snapshot.height || 720}`);
  for (const joint of state.snapshot.joints) {
    if (!TREE.some(([bone]) => bone === joint.bone)) continue;
    svg.append(svgElement('circle', {
      cx: String(joint.x), cy: String(joint.y), r: isFinger(joint.bone) ? '4.5' : '6',
      class: `joint${isFinger(joint.bone) ? ' finger' : ''}${joint.bone === state.selectedBone ? ' selected' : ''}`,
      'data-bone': joint.bone,
    }));
  }
  const selected = state.snapshot.joints.find((joint) => joint.bone === state.selectedBone);
  if (selected && state.tool !== 'select') {
    if (state.tool === 'rotate') {
      ['axis-x', 'axis-y', 'axis-z'].forEach((axis, index) => svg.append(svgElement('circle', {
        cx: String(selected.x), cy: String(selected.y), r: String(24 + index * 7), class: `gizmo-ring ${axis}`, 'data-axis': String(index),
      })));
    } else {
      const axes = [[46, 0, 'axis-x', 'x'], [0, -46, 'axis-y', 'y'], [-30, 30, 'axis-z', 'z']] as const;
      axes.forEach(([dx, dy, klass, channel]) => svg.append(svgElement('line', {
        x1: String(selected.x), y1: String(selected.y), x2: String(selected.x + dx), y2: String(selected.y + dy),
        class: `gizmo-ring ${klass}`, 'data-channel': channel,
      })));
    }
  }
}

function renderTimeline(): void {
  const list = q<HTMLElement>('#ae-channel-list');
  const view = q<HTMLElement>('#ae-timeline-view');
  const action = currentAction();
  const keyed = action?.poses.flatMap((pose) => pose.bones.filter((bone) => bone.id === state.selectedBone).flatMap((bone) => Object.keys(bone.channels))) || [];
  const rows = [state.selectedBone, ...new Set(keyed)];
  list.innerHTML = `<div class="timeline-ruler-spacer">Channels</div>${rows.map((row, index) => `<div class="channel-row" style="padding-left:${index ? 22 : 9}px">${index ? row : niceName(row)}</div>`).join('')}`;
  view.replaceChildren();
  const ruler = document.createElement('div');
  ruler.className = 'timeline-ruler';
  const tickStep = state.endFrame <= 60 ? 5 : state.endFrame <= 180 ? 15 : 30;
  for (let frame = 0; frame <= state.endFrame; frame += tickStep) {
    const tick = document.createElement('span'); tick.className = 'timeline-tick';
    tick.style.left = `${frame / state.endFrame * 100}%`; tick.textContent = String(frame); ruler.append(tick);
  }
  view.append(ruler);
  const playhead = document.createElement('div');
  playhead.id = 'ae-playhead'; playhead.className = 'playhead';
  playhead.style.left = `${state.frame / state.endFrame * 100}%`;
  const playheadLabel = document.createElement('span'); playheadLabel.className = 'playhead-label';
  playheadLabel.textContent = `${state.frame}f · ${(state.frame / (state.document?.fps || 30)).toFixed(2)}s`;
  playhead.append(playheadLabel);
  view.append(playhead);
  if (state.timelineMode === 'graph') {
    const width = Math.max(800, state.endFrame * 7);
    const svg = svgElement('svg', { viewBox: `0 0 ${width} 180`, preserveAspectRatio: 'none', class: 'graph-curves' });
    const colors = ['#ff6565', '#75dc7b', '#6a9fff', '#d8ff3e', '#d27cff'];
    rows.slice(1).forEach((channel, rowIndex) => {
      const samples = (action?.poses || []).flatMap((pose) => {
        const bone = pose.bones.find((entry) => entry.id === state.selectedBone); const raw = bone?.channels[channel];
        return raw === undefined ? [] : [{ pose, bone: bone!, value: Number(raw), x: pose.timeMs / (action?.durationMs || 1) * width, y: 90 - Math.max(-80, Math.min(80, Number(raw))) }];
      });
      const points = samples.map((sample) => `${sample.x},${sample.y}`).join(' ');
      if (points) svg.append(svgElement('polyline', { points, fill: 'none', stroke: colors[rowIndex % colors.length], 'stroke-width': '2' }));
      for (const sample of samples) {
        const key: SelectedKey = { actionId: state.actionId, boneId: state.selectedBone, channel, timeMs: sample.pose.timeMs };
        const selected = state.selectedKeys.has(keyId(key));
        if (selected && (sample.bone.interpolation || 'linear') === 'bezier') {
          const outY = sample.y - Number(sample.bone.outTangent || 0) * 26;
          const inY = sample.y + Number(sample.bone.inTangent || 0) * 26;
          svg.append(svgElement('line', { x1: String(sample.x), y1: String(sample.y), x2: String(sample.x - 34), y2: String(inY), class: 'tangent-line' }));
          svg.append(svgElement('circle', { cx: String(sample.x - 34), cy: String(inY), r: '4', class: 'tangent-handle', 'data-handle': 'in', 'data-time-ms': String(sample.pose.timeMs), 'data-channel': channel }));
          svg.append(svgElement('line', { x1: String(sample.x), y1: String(sample.y), x2: String(sample.x + 34), y2: String(outY), class: 'tangent-line' }));
          svg.append(svgElement('circle', { cx: String(sample.x + 34), cy: String(outY), r: '4', class: 'tangent-handle', 'data-handle': 'out', 'data-time-ms': String(sample.pose.timeMs), 'data-channel': channel }));
        }
        svg.append(svgElement('circle', { cx: String(sample.x), cy: String(sample.y), r: '5', class: `graph-key${selected ? ' selected' : ''}`, 'data-time-ms': String(sample.pose.timeMs), 'data-channel': channel, 'data-frame': String(Math.round(sample.pose.timeMs * (state.document?.fps || 30) / 1000)), 'data-bone': state.selectedBone }));
      }
    });
    view.append(svg);
  } else {
    action?.poses.forEach((pose) => {
      const frame = Math.round(pose.timeMs * (state.document?.fps || 30) / 1000);
      const channels = pose.bones.find((bone) => bone.id === state.selectedBone)?.channels || {};
      Object.keys(channels).forEach((channel) => {
        const row = Math.max(1, rows.indexOf(channel));
        const key = document.createElement('button');
        const candidate = { actionId: state.actionId, boneId: state.selectedBone, channel, timeMs: pose.timeMs };
        const selected = state.selectedKeys.has(keyId(candidate));
        key.type = 'button'; key.className = `timeline-key${selected ? ' selected multi-selected' : ''}`;
        key.style.left = `${frame / state.endFrame * 100}%`; key.style.top = `${20 + 12.5 + row * 25}px`;
        key.dataset.frame = String(frame); key.dataset.timeMs = String(pose.timeMs); key.dataset.channel = channel;
        key.dataset.bone = state.selectedBone; key.title = `${niceName(state.selectedBone)} · ${channel} · frame ${frame}`;
        view.append(key);
      });
    });
  }
  updateTimelinePlayhead();
}

// Playback changes only the playhead; authored key DOM is rebuilt by edit paths.
function updateTimelinePlayhead(): void {
  const playhead = document.querySelector<HTMLElement>('#ae-playhead');
  if (playhead) {
    playhead.style.left = `${state.frame / Math.max(1, state.endFrame) * 100}%`;
    const label = playhead.querySelector<HTMLElement>('.playhead-label');
    if (label) label.textContent = `${state.frame}f · ${(state.frame / (state.document?.fps || 30)).toFixed(2)}s`;
  }
  q<HTMLInputElement>('#ae-current-frame').value = String(state.frame);
  updateKeyContext();
}

function updateKeyContext(): void {
  const output = q<HTMLOutputElement>('#ae-key-context');
  const deleteButton = q<HTMLButtonElement>('#ae-delete-key');
  deleteButton.disabled = !state.selectedKey && !state.selectedKeys.size;
  const frames = [...new Set((currentAction()?.poses || []).flatMap((pose) => {
    const bone = pose.bones.find((entry) => entry.id === state.selectedBone);
    return bone && Object.keys(bone.channels).length ? [Math.round(pose.timeMs * (state.document?.fps || 30) / 1000)] : [];
  }))].sort((a, b) => a - b);
  let playheadContext = 'Selected bone has no keyframes';
  if (frames.includes(state.frame)) playheadContext = `On keyframe ${state.frame}`;
  else if (frames.length) {
    const previous = [...frames].reverse().find((frame) => frame < state.frame);
    const next = frames.find((frame) => frame > state.frame);
    if (previous !== undefined && next !== undefined) {
      const phase = Math.round((state.frame - previous) / Math.max(1, next - previous) * 100);
      playheadContext = `Between key ${previous} → ${next} · ${phase}%`;
    } else if (previous !== undefined) playheadContext = `After key ${previous} · held`;
    else playheadContext = `Before key ${next} · held`;
  }
  if (state.selectedKeys.size > 1) output.textContent = `${state.selectedKeys.size} keys selected · ${playheadContext}`;
  else if (state.selectedKey) {
    const frame = Math.round(state.selectedKey.timeMs * (state.document?.fps || 30) / 1000);
    output.textContent = `Selected ${state.selectedKey.channel}@${frame} · Playhead: ${playheadContext}`;
  } else output.textContent = playheadContext;
}

function refreshUi(): void {
  renderBoneTree(q<HTMLInputElement>('#ae-bone-search')?.value || '');
  renderInspector(); renderTimeline(); renderJointOverlay();
}

function selectBone(bone: string): void {
  if (!TREE.some(([id]) => id === bone)) return;
  if (state.selectedBone !== bone) state.selectedKey = null;
  state.selectedBone = bone; refreshUi();
}

function applyEdit(command: Record<string, unknown>, recordUndo = true): boolean {
  if (!state.wasm) return false;
  try {
    if (recordUndo) { state.undo.push(state.dsl); state.redo.length = 0; }
    state.dsl = state.wasm.motionloom_apply_action_edit(state.dsl, JSON.stringify(command));
    state.dirty = true;
    parseDocument(); refreshUi(); return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true); return false;
  }
}

function ensurePose(): boolean {
  if (currentPose()) return false;
  const poses = currentAction()?.poses || [];
  const nearest = poses.reduce<EditablePose | null>((best, pose) => !best || Math.abs(pose.timeMs - frameMs()) < Math.abs(best.timeMs - frameMs()) ? pose : best, null);
  applyEdit({ type: 'addPose', actionId: state.actionId, timeMs: frameMs(), copyFromMs: nearest?.timeMs }, true);
  return true;
}

async function setChannel(channel: string, value: number, commit = true): Promise<void> {
  if (!currentPose() && !state.autoKey) {
    setStatus(`Frame ${state.frame} has no key. Enable Auto Key or select a keyed frame.`, true);
    return;
  }
  const needsRebuild = ensurePose();
  if (commit) applyEdit({ type: 'setBoneChannel', actionId: state.actionId, timeMs: frameMs(), boneId: state.selectedBone, channel, value: String(value) }, !needsRebuild);
  const updated = state.renderer?.set_action_pose_channel(state.actionId, frameMs(), state.selectedBone, channel, String(value));
  if (needsRebuild || updated === false) await rebuildRenderer(); else await renderFrame();
  renderInspector(); renderTimeline();
}

async function deleteSelectedKey(): Promise<void> {
  const selected = [...state.selectedKeys.values()];
  if (!selected.length && state.selectedKey) selected.push(state.selectedKey);
  if (!selected.length) return;
  state.undo.push(state.dsl); state.redo.length = 0;
  for (const key of selected) applyEdit({
    type: 'setBoneChannel', actionId: key.actionId, timeMs: key.timeMs,
    boneId: key.boneId, channel: key.channel, value: null,
  }, false);
  state.selectedKey = null; state.selectedKeys.clear();
  refreshUi();
  await rebuildRenderer();
  setStatus(`Deleted ${selected.length} selected keyframe${selected.length === 1 ? '' : 's'}`);
}

function valueAtKey(key: SelectedKey): string | null {
  return currentAction()?.poses.find((pose) => pose.timeMs === key.timeMs)?.bones
    .find((bone) => bone.id === key.boneId)?.channels[key.channel] ?? null;
}

function copySelectedKeys(): void {
  const keys = [...state.selectedKeys.values()];
  if (!keys.length && state.selectedKey) keys.push(state.selectedKey);
  state.keyClipboard = keys.flatMap((key) => {
    const value = valueAtKey(key); return value === null ? [] : [{ ...key, value }];
  });
  state.clipboardOriginMs = Math.min(...state.keyClipboard.map((key) => key.timeMs));
  setStatus(`Copied ${state.keyClipboard.length} channel keys`);
}

async function pasteSelectedKeys(): Promise<void> {
  if (!state.keyClipboard.length) return;
  ensurePose(); state.undo.push(state.dsl); state.redo.length = 0;
  state.selectedKeys.clear();
  for (const source of state.keyClipboard) {
    const targetMs = frameMs() + source.timeMs - state.clipboardOriginMs;
    if (!currentAction()?.poses.some((pose) => pose.timeMs === targetMs)) {
      applyEdit({ type: 'addPose', actionId: state.actionId, timeMs: targetMs }, false);
    }
    const key = { actionId: state.actionId, boneId: source.boneId, channel: source.channel, timeMs: targetMs };
    applyEdit({ type: 'setBoneChannel', ...key, value: source.value }, false);
    state.selectedKeys.set(keyId(key), key);
  }
  state.selectedKey = [...state.selectedKeys.values()][0] || null;
  await rebuildRenderer(); refreshUi();
}

async function moveSelectedKeys(deltaFrames: number, copy = false): Promise<void> {
  const keys = [...state.selectedKeys.values()];
  if (!keys.length || !deltaFrames) return;
  copySelectedKeys();
  const deltaMs = Math.round(deltaFrames * 1000 / (state.document?.fps || 30));
  state.undo.push(state.dsl); state.redo.length = 0;
  if (!copy) for (const key of keys) applyEdit({ type: 'setBoneChannel', ...key, value: null }, false);
  state.selectedKeys.clear();
  for (const key of keys) {
    const toMs = Math.max(0, key.timeMs + deltaMs);
    if (!currentAction()?.poses.some((pose) => pose.timeMs === toMs)) applyEdit({ type: 'addPose', actionId: state.actionId, timeMs: toMs }, false);
    const value = state.keyClipboard.find((entry) => keyId(entry) === keyId(key))?.value || '0';
    const moved = { ...key, timeMs: toMs };
    applyEdit({ type: 'setBoneChannel', ...moved, value }, false);
    state.selectedKeys.set(keyId(moved), moved);
  }
  state.selectedKey = [...state.selectedKeys.values()][0] || null;
  await rebuildRenderer(); refreshUi();
}

async function scaleSelectedKeys(): Promise<void> {
  const keys = [...state.selectedKeys.values()]; if (keys.length < 2) { setStatus('Select at least two keys to scale time', true); return; }
  const raw = window.prompt('Scale selected key timing by factor:', '1.25'); const factor = Number(raw);
  if (!Number.isFinite(factor) || factor <= 0) return;
  copySelectedKeys(); const origin = Math.min(...keys.map((key) => key.timeMs));
  state.undo.push(state.dsl); state.redo.length = 0;
  for (const key of keys) applyEdit({ type: 'setBoneChannel', ...key, value: null }, false);
  state.selectedKeys.clear();
  for (const key of keys) {
    const toMs = Math.round(origin + (key.timeMs - origin) * factor);
    if (!currentAction()?.poses.some((pose) => pose.timeMs === toMs)) applyEdit({ type: 'addPose', actionId: state.actionId, timeMs: toMs }, false);
    const value = state.keyClipboard.find((entry) => keyId(entry) === keyId(key))?.value || '0'; const scaled = { ...key, timeMs: toMs };
    applyEdit({ type: 'setBoneChannel', ...scaled, value }, false); state.selectedKeys.set(keyId(scaled), scaled);
  }
  state.selectedKey = [...state.selectedKeys.values()][0] || null; await rebuildRenderer(); refreshUi();
}

function replaceTagAttr(source: string, tagId: string, attribute: string, value: string): string {
  const pattern = new RegExp(`(<Camera3D\\b(?=[^>]*\\bid=["']${tagId}["'])[^>]*?)\\s${attribute}=\\{?[^\\s>]+(?:\\s*[^>]*?\\})?`, 'm');
  if (attribute === 'position' || attribute === 'target') {
    const vectorPattern = new RegExp(`(<Camera3D\\b(?=[^>]*\\bid=["']${tagId}["'])[^>]*?)\\s${attribute}=\\{\\[[^\\]]+\\]\\}`, 'm');
    return vectorPattern.test(source) ? source.replace(vectorPattern, `$1 ${attribute}={${value}}`) : source;
  }
  return pattern.test(source) ? source.replace(pattern, `$1 ${attribute}="${value}"`) : source;
}

async function setCamera(position: [number, number, number], target: [number, number, number], label: string): Promise<void> {
  const positionDsl = `[${position.map((v) => v.toFixed(3)).join(',')}]`;
  const targetDsl = `[${target.map((v) => v.toFixed(3)).join(',')}]`;
  state.dsl = replaceTagAttr(state.dsl, 'action_camera', 'position', positionDsl);
  state.dsl = replaceTagAttr(state.dsl, 'action_camera', 'target', targetDsl);
  q<HTMLElement>('#ae-view-label').textContent = label;
  const patched = state.renderer?.set_camera3d_pose('action_camera', positionDsl, targetDsl);
  if (patched === false || !state.renderer) await rebuildRenderer();
  else await renderFrame();
}

async function orbitCamera(dx: number, dy: number, zoom = 0): Promise<void> {
  state.cameraYaw += dx * .008;
  state.cameraPitch = Math.max(-1.25, Math.min(1.25, state.cameraPitch + dy * .008));
  state.cameraDistance = Math.max(1.7, Math.min(9, state.cameraDistance + zoom));
  const target: [number, number, number] = [0, 1.02, 0];
  const cp = Math.cos(state.cameraPitch);
  const position: [number, number, number] = [
    target[0] + Math.sin(state.cameraYaw) * cp * state.cameraDistance,
    target[1] + Math.sin(state.cameraPitch) * state.cameraDistance,
    target[2] + Math.cos(state.cameraYaw) * cp * state.cameraDistance,
  ];
  await setCamera(position, target, 'User Perspective');
}

function resetPlaybackClock(now = performance.now()): void {
  state.playbackOriginMs = now;
  state.playbackOriginFrame = state.frame;
  state.playbackLastRequestedFrame = -1;
}

async function seek(frame: number, fromPlayback = false): Promise<void> {
  state.frame = Math.max(0, Math.min(state.endFrame, Math.round(frame)));
  if (!fromPlayback && state.playing) resetPlaybackClock();
  updateTimelinePlayhead();
  // The renderer has always evaluated in-between frames, but the inspector
  // must follow the playhead too. Otherwise it keeps showing the values from
  // the last selected/keyed frame while the Character is visibly moving.
  renderInspector();
  await renderFrame();
}

// Keep at most one playback seek in flight and coalesce lag to the newest frame.
async function queuePlaybackFrame(frame: number): Promise<void> {
  state.playbackQueuedFrame = frame;
  if (state.playbackFramePending) return;
  state.playbackFramePending = true;
  try {
    while (state.playing && state.playbackQueuedFrame !== null) {
      const next = state.playbackQueuedFrame;
      state.playbackQueuedFrame = null;
      await seek(next, true);
    }
  } finally {
    state.playbackFramePending = false;
  }
}

function setTool(tool: Tool): void {
  state.tool = tool;
  (['select', 'move', 'rotate'] as Tool[]).forEach((entry) => {
    const button = q<HTMLButtonElement>(`#ae-tool-${entry}`);
    button.classList.toggle('is-active', tool === entry); button.setAttribute('aria-pressed', String(tool === entry));
  });
  renderJointOverlay();
}

async function handPreset(kind: string): Promise<void> {
  const side = state.selectedBone.endsWith('_r') ? 'r' : 'l';
  const bends = kind === 'fist' ? [70, 90, 75] : kind === 'relaxed' ? [18, 28, 20] : [0, 0, 0];
  ensurePose(); state.undo.push(state.dsl);
  for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (let segment = 1; segment <= 3; segment += 1) {
    const value = kind === 'point' && finger !== 'index' ? [70, 90, 75][segment - 1] : bends[segment - 1];
    applyEdit({ type: 'setBoneChannel', actionId: state.actionId, timeMs: frameMs(), boneId: `${finger}_${segment}_${side}`, channel: 'bend', value: String(value) }, false);
  }
  await rebuildRenderer(); selectBone(`hand_${side}`);
}

function extractAction(): string {
  const escaped = state.actionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return state.dsl.match(new RegExp(`<Action\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*(?:\\/>|>[\\s\\S]*?<\\/Action>)`))?.[0] || state.dsl;
}

function download(name: string, source: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openActionDialog(mode: 'create' | 'duplicate'): void {
  state.actionDialogMode = mode;
  q<HTMLElement>('#ae-action-dialog-title').textContent = mode === 'create' ? 'New Action' : 'Duplicate Action';
  q<HTMLInputElement>('#ae-action-id').value = mode === 'create' ? 'new_action' : `${state.actionId}_copy`;
  q<HTMLInputElement>('#ae-action-duration').value = String(mode === 'create' ? 60 : state.endFrame);
  q<HTMLButtonElement>('#ae-confirm-action').textContent = mode === 'create' ? 'Create' : 'Duplicate';
  q<HTMLDialogElement>('#ae-action-dialog').showModal();
}

async function confirmActionDialog(): Promise<void> {
  const id = q<HTMLInputElement>('#ae-action-id').value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const frames = Math.max(1, Number(q<HTMLInputElement>('#ae-action-duration').value));
  if (!id) return;
  const durationMs = Math.round(frames * 1000 / (state.document?.fps || 30));
  const ok = state.actionDialogMode === 'create'
    ? applyEdit({ type: 'createAction', id, skeleton: 'humanoid_v1', durationMs })
    : applyEdit({ type: 'duplicateAction', actionId: state.actionId, newId: id });
  if (!ok) return;
  q<HTMLDialogElement>('#ae-action-dialog').close();
  await selectAction(id);
}

async function addOrDuplicatePose(duplicate: boolean): Promise<void> {
  const target = frameMs();
  if (currentPose()) { setStatus(`Frame ${state.frame} already contains a Pose`, true); return; }
  const poses = currentAction()?.poses || [];
  const nearest = poses.reduce<EditablePose | null>((best, pose) => !best || Math.abs(pose.timeMs - target) < Math.abs(best.timeMs - target) ? pose : best, null);
  if (!applyEdit({ type: 'addPose', actionId: state.actionId, timeMs: target, copyFromMs: duplicate ? nearest?.timeMs : undefined })) return;
  await rebuildRenderer(); setStatus(`${duplicate ? 'Duplicated' : 'Added blank'} Pose at frame ${state.frame}`);
}

async function deleteCurrentPose(): Promise<void> {
  const pose = currentPose(); if (!pose) { setStatus('Playhead is not on a Pose', true); return; }
  if (!applyEdit({ type: 'removePose', actionId: state.actionId, timeMs: pose.timeMs })) return;
  await rebuildRenderer();
}

async function setKeyMetadata(): Promise<void> {
  const pose = currentPose(); const bone = currentBone();
  if (!pose || !bone || !Object.keys(bone.channels).length) { setStatus('Insert a channel key before setting interpolation', true); return; }
  const interpolation = q<HTMLSelectElement>('#ae-interpolation').value.toLowerCase();
  const inTangent = q<HTMLInputElement>('#ae-in-tangent').value;
  const outTangent = q<HTMLInputElement>('#ae-out-tangent').value;
  if (!applyEdit({ type: 'setBoneKeyMetadata', actionId: state.actionId, timeMs: pose.timeMs, boneId: state.selectedBone, interpolation, inTangent, outTangent })) return;
  await rebuildRenderer(); setStatus(`${niceName(state.selectedBone)} key uses ${interpolation}`);
}

async function toggleFootContact(effector: 'foot_l' | 'foot_r'): Promise<void> {
  const action = currentAction(); if (!action) return;
  const id = `${effector}_lock`;
  const existing = action.contacts?.find((contact) => contact.id === id);
  if (existing && (action.contacts?.length || 0) === 1) {
    applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'contactCorrection', value: null }, false);
    applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'footLock', value: null }, false);
  }
  const contactChanged = existing
    ? applyEdit({ type: 'removeContact', actionId: state.actionId, contactId: id })
    : applyEdit({ type: 'upsertContact', actionId: state.actionId, contact: {
    id, effector, target: 'ground', from: state.frame / state.endFrame,
    to: Math.min(1, (state.frame + Math.max(1, Math.round(state.endFrame * .2))) / state.endFrame), mode: 'lock', weight: q<HTMLInputElement>('#ae-ik-weight').value,
  }});
  if (!contactChanged) return;
  if (!existing) {
    const left = effector === 'foot_l';
    applyEdit({ type: 'upsertIk', actionId: state.actionId, ik: {
      id: `${effector}_ik`, root: left ? 'upper_leg_l' : 'upper_leg_r', mid: left ? 'lower_leg_l' : 'lower_leg_r', end: effector,
      targetX: q<HTMLInputElement>('#ae-ik-x').value, targetY: q<HTMLInputElement>('#ae-ik-y').value,
      targetZ: q<HTMLInputElement>('#ae-ik-z').value, bend: '1', weight: q<HTMLInputElement>('#ae-ik-weight').value, iterations: '8',
    }}, false);
  } else applyEdit({ type: 'removeIk', actionId: state.actionId, ikId: `${effector}_ik` }, false);
  applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'ground', value: 'action_ground' }, false);
  applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'contactCorrection', value: 'auto' }, false);
  applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'footLock', value: 'auto' }, false);
  await rebuildRenderer();
}

async function clearContacts(): Promise<void> {
  const contacts = [...(currentAction()?.contacts || [])]; const iks = [...(currentAction()?.iks || [])];
  if (!contacts.length && !iks.length) return;
  state.undo.push(state.dsl);
  if (!applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'contactCorrection', value: null }, false)) return;
  if (!applyEdit({ type: 'setBinding', target: 'character1_actor', action: state.actionId, attribute: 'footLock', value: null }, false)) return;
  for (const ik of iks) if (!applyEdit({ type: 'removeIk', actionId: state.actionId, ikId: ik.id }, false)) return;
  for (const contact of contacts) if (!applyEdit({ type: 'removeContact', actionId: state.actionId, contactId: contact.id }, false)) return;
  await rebuildRenderer();
}

function bindUi(): void {
  const location = q<HTMLElement>('#ae-location-fields'); const rotation = q<HTMLElement>('#ae-rotation-fields');
  LOCATION.forEach((spec) => makeField(location, spec, 'location')); ROTATION.forEach((spec) => makeField(rotation, spec, 'rotation'));
  const jointsToggle = q<HTMLButtonElement>('#ae-toggle-joints');
  jointsToggle.addEventListener('click', () => {
    state.showJoints = !state.showJoints;
    jointsToggle.classList.toggle('is-on', state.showJoints);
    jointsToggle.setAttribute('aria-pressed', String(state.showJoints));
    jointsToggle.textContent = state.showJoints ? '● Joints' : '○ Joints';
    q<SVGSVGElement>('#ae-joint-overlay').classList.toggle('is-hidden', !state.showJoints);
    renderJointOverlay();
  });
  q<HTMLElement>('#ae-bone-tree').addEventListener('click', (event) => { const button = (event.target as Element).closest<HTMLElement>('[data-bone]'); if (button?.dataset.bone) selectBone(button.dataset.bone); });
  const overlay = q<SVGSVGElement>('#ae-joint-overlay');
  let gizmoDrag: { channel: string; startX: number; startY: number; startValue: number } | null = null;
  overlay.addEventListener('pointerdown', (event) => {
    const target = event.target as SVGElement;
    const bone = target.dataset.bone;
    if (bone) { event.stopPropagation(); selectBone(bone); return; }
    const channel = target.dataset.channel || (target.dataset.axis === '0' ? 'rotationX' : target.dataset.axis === '1' ? 'rotationY' : target.dataset.axis === '2' ? 'rotationZ' : '');
    if (channel) { gizmoDrag = { channel, startX: event.clientX, startY: event.clientY, startValue: channelValue(channel) }; overlay.setPointerCapture(event.pointerId); event.preventDefault(); }
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!gizmoDrag) return;
    const scale = state.tool === 'move' ? .006 : .8;
    const delta = (gizmoDrag.channel === 'y' ? gizmoDrag.startY - event.clientY : event.clientX - gizmoDrag.startX) * scale;
    void setChannel(gizmoDrag.channel, Number((gizmoDrag.startValue + delta).toFixed(3)), false);
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!gizmoDrag) return;
    const scale = state.tool === 'move' ? .006 : .8;
    const delta = (gizmoDrag.channel === 'y' ? gizmoDrag.startY - event.clientY : event.clientX - gizmoDrag.startX) * scale;
    void setChannel(gizmoDrag.channel, Number((gizmoDrag.startValue + delta).toFixed(3)));
    gizmoDrag = null; overlay.releasePointerCapture(event.pointerId);
  });
  q<HTMLInputElement>('#ae-bone-search').addEventListener('input', (event) => renderBoneTree((event.target as HTMLInputElement).value));
  q('#ae-select-animated-child').addEventListener('click', (event) => {
    const bone = (event.currentTarget as HTMLElement).dataset.bone;
    if (bone) selectBone(bone);
  });
  q('#ae-pose-menu').addEventListener('click', (event) => {
    event.stopPropagation();
    const menu = q<HTMLElement>('#ae-action-browser'); menu.hidden = !menu.hidden;
    q<HTMLButtonElement>('#ae-pose-menu').setAttribute('aria-expanded', String(!menu.hidden));
  });
  q('#ae-action-options').addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (option?.dataset.action) void selectAction(option.dataset.action).catch((error) => {
      setStatus(error instanceof Error ? error.message : String(error), true);
    });
  });
  q('#ae-edit-action').addEventListener('click', () => {
    q<HTMLElement>('#ae-action-browser').hidden = true;
    q<HTMLButtonElement>('#ae-pose-menu').setAttribute('aria-expanded', 'false');
    q<HTMLElement>('#ae-timeline-view').focus();
    setStatus(`Editing ${state.actionMeta[state.actionId]?.label || niceName(state.actionId)} · frame ${state.frame}`);
  });
  document.addEventListener('click', (event) => {
    if (!(event.target as Element).closest('.pose-browser-wrap')) {
      q<HTMLElement>('#ae-action-browser').hidden = true;
      q<HTMLButtonElement>('#ae-pose-menu').setAttribute('aria-expanded', 'false');
    }
  });
  document.querySelectorAll<HTMLInputElement>('.axis-field input').forEach((input) => input.addEventListener('change', () => void setChannel(input.dataset.channel || '', Number(input.value))));
  document.querySelectorAll<HTMLButtonElement>('.axis-field button').forEach((button) => button.addEventListener('click', () => {
    const input = button.parentElement?.querySelector<HTMLInputElement>('input[data-channel]'); if (!input) return;
    const channel = input.dataset.channel || ''; const exact = currentBone()?.channels[channel];
    if (exact !== undefined) {
      const key = { actionId: state.actionId, boneId: state.selectedBone, channel, timeMs: frameMs() };
      state.selectedKey = key; state.selectedKeys.set(keyId(key), key); void deleteSelectedKey();
    } else void setChannel(channel, Number(input.value));
  }));
  document.querySelectorAll<HTMLElement>('[data-reset-group]').forEach((button) => button.addEventListener('click', async () => { const specs = button.dataset.resetGroup === 'location' ? LOCATION : ROTATION; for (const spec of specs) await setChannel(spec.channel, 0); }));
  (['select', 'move', 'rotate'] as Tool[]).forEach((tool) => q(`#ae-tool-${tool}`).addEventListener('click', () => setTool(tool)));
  q<HTMLInputElement>('#ae-current-frame').addEventListener('change', (event) => void seek(Number((event.target as HTMLInputElement).value)));
  q<HTMLInputElement>('#ae-end-frame').addEventListener('change', async (event) => {
    const next = Math.max(1, Number((event.target as HTMLInputElement).value));
    const durationMs = Math.round(next * 1000 / (state.document?.fps || 30));
    if (!applyEdit({ type: 'setActionMetadata', actionId: state.actionId, durationMs })) return;
    state.dsl = replaceApplyAction(
      state.dsl,
      state.actionId,
      durationMs,
      undefined,
      state.actionMeta[state.actionId],
    ); state.endFrame = next;
    parseDocument(); refreshUi(); await rebuildRenderer();
  });
  q<HTMLInputElement>('#ae-auto-key').addEventListener('change', (event) => { state.autoKey = (event.target as HTMLInputElement).checked; });
  q('#ae-first').addEventListener('click', () => void seek(0)); q('#ae-last').addEventListener('click', () => void seek(state.endFrame));
  q('#ae-prev').addEventListener('click', () => void seek(state.frame - 1)); q('#ae-next').addEventListener('click', () => void seek(state.frame + 1));
  q('#ae-play').addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing) resetPlaybackClock();
    else state.playbackQueuedFrame = null;
    q('#ae-play').textContent = state.playing ? '❚❚' : '▶';
  });
  let suppressTimelineClick = false;
  q('#ae-timeline-view').addEventListener('click', (event) => {
    if (suppressTimelineClick) { suppressTimelineClick = false; return; }
    const key = (event.target as Element).closest<HTMLElement>('.timeline-key,.graph-key');
    if (key) {
      const selected = {
        actionId: state.actionId, boneId: key.dataset.bone || state.selectedBone,
        channel: key.dataset.channel || '', timeMs: Number(key.dataset.timeMs || 0),
      };
      if (!(event as MouseEvent).shiftKey) state.selectedKeys.clear();
      if (state.selectedKeys.has(keyId(selected)) && (event as MouseEvent).shiftKey) state.selectedKeys.delete(keyId(selected));
      else state.selectedKeys.set(keyId(selected), selected);
      state.selectedKey = selected;
      renderTimeline();
      void seek(Number(key.dataset.frame));
    } else {
      if (!(event as MouseEvent).shiftKey) { state.selectedKey = null; state.selectedKeys.clear(); }
      const rect = q('#ae-timeline-view').getBoundingClientRect();
      void seek(((event as MouseEvent).clientX - rect.left) / rect.width * state.endFrame);
    }
  });
  let timelineDrag: { startX: number; startFrames: number } | null = null;
  let tangentDrag: { startY: number; timeMs: number; channel: string; handle: string } | null = null;
  let marqueeDrag: { startX: number; startY: number; box: HTMLElement } | null = null;
  q('#ae-timeline-view').addEventListener('pointerdown', (event) => {
    const pointer = event as PointerEvent;
    const handle = (event.target as Element).closest<HTMLElement>('.tangent-handle');
    if (handle) {
      tangentDrag = { startY: pointer.clientY, timeMs: Number(handle.dataset.timeMs), channel: handle.dataset.channel || '', handle: handle.dataset.handle || 'out' };
      state.frame = Math.round(tangentDrag.timeMs * (state.document?.fps || 30) / 1000);
      const selected = { actionId: state.actionId, boneId: state.selectedBone, channel: tangentDrag.channel, timeMs: tangentDrag.timeMs };
      state.selectedKey = selected; state.selectedKeys.clear(); state.selectedKeys.set(keyId(selected), selected); renderInspector();
      (event.currentTarget as HTMLElement).setPointerCapture(pointer.pointerId); event.preventDefault(); return;
    }
    const key = (event.target as Element).closest<HTMLElement>('.timeline-key,.graph-key');
    if (!key) {
      const box = document.createElement('div'); box.className = 'marquee';
      marqueeDrag = { startX: pointer.clientX, startY: pointer.clientY, box };
      (event.currentTarget as HTMLElement).append(box); (event.currentTarget as HTMLElement).setPointerCapture(pointer.pointerId); return;
    }
    timelineDrag = { startX: pointer.clientX, startFrames: 0 };
    (event.currentTarget as HTMLElement).setPointerCapture(pointer.pointerId);
  });
  q('#ae-timeline-view').addEventListener('pointermove', (event) => {
    const pointer = event as PointerEvent;
    if (marqueeDrag) {
      const timeline = q<HTMLElement>('#ae-timeline-view'); const host = timeline.getBoundingClientRect();
      const left = Math.min(marqueeDrag.startX, pointer.clientX) - host.left + timeline.scrollLeft;
      const top = Math.min(marqueeDrag.startY, pointer.clientY) - host.top + timeline.scrollTop;
      marqueeDrag.box.style.left = `${left}px`; marqueeDrag.box.style.top = `${top}px`;
      marqueeDrag.box.style.width = `${Math.abs(pointer.clientX - marqueeDrag.startX)}px`; marqueeDrag.box.style.height = `${Math.abs(pointer.clientY - marqueeDrag.startY)}px`; return;
    }
    if (tangentDrag) {
      q<HTMLInputElement>(tangentDrag.handle === 'in' ? '#ae-in-tangent' : '#ae-out-tangent').value = ((tangentDrag.startY - pointer.clientY) / 26).toFixed(2);
      return;
    }
    if (!timelineDrag) return; const rect = q('#ae-timeline-view').getBoundingClientRect();
    timelineDrag.startFrames = Math.round((pointer.clientX - timelineDrag.startX) / rect.width * state.endFrame);
  });
  q('#ae-timeline-view').addEventListener('pointerup', (event) => {
    if (marqueeDrag) {
      const selection = marqueeDrag.box.getBoundingClientRect(); const large = selection.width > 4 || selection.height > 4;
      if (large) {
        if (!(event as PointerEvent).shiftKey) state.selectedKeys.clear();
        q('#ae-timeline-view').querySelectorAll<HTMLElement>('.timeline-key,.graph-key').forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.right >= selection.left && rect.left <= selection.right && rect.bottom >= selection.top && rect.top <= selection.bottom) {
            const key = { actionId: state.actionId, boneId: element.dataset.bone || state.selectedBone, channel: element.dataset.channel || '', timeMs: Number(element.dataset.timeMs) };
            state.selectedKeys.set(keyId(key), key);
          }
        });
        state.selectedKey = [...state.selectedKeys.values()][0] || null; suppressTimelineClick = true;
      }
      marqueeDrag.box.remove(); marqueeDrag = null; renderTimeline(); return;
    }
    if (tangentDrag) { void setKeyMetadata(); tangentDrag = null; return; }
    if (timelineDrag?.startFrames) void moveSelectedKeys(timelineDrag.startFrames, (event as PointerEvent).altKey);
    timelineDrag = null;
  });
  q('#ae-delete-key').addEventListener('click', () => void deleteSelectedKey());
  q('#ae-copy-keys').addEventListener('click', copySelectedKeys);
  q('#ae-paste-keys').addEventListener('click', () => void pasteSelectedKeys());
  q('#ae-scale-keys').addEventListener('click', () => void scaleSelectedKeys());
  q('#ae-add-pose').addEventListener('click', () => void addOrDuplicatePose(false));
  q('#ae-duplicate-pose').addEventListener('click', () => void addOrDuplicatePose(true));
  q('#ae-delete-pose').addEventListener('click', () => void deleteCurrentPose());
  q('#ae-dopesheet-tab').addEventListener('click', () => { state.timelineMode = 'dopesheet'; q('#ae-dopesheet-tab').classList.add('is-active'); q('#ae-graph-tab').classList.remove('is-active'); renderTimeline(); });
  q('#ae-graph-tab').addEventListener('click', () => { state.timelineMode = 'graph'; q('#ae-graph-tab').classList.add('is-active'); q('#ae-dopesheet-tab').classList.remove('is-active'); renderTimeline(); });
  document.querySelectorAll<HTMLElement>('[data-hand-preset]').forEach((button) => button.addEventListener('click', () => void handPreset(button.dataset.handPreset || 'open')));
  q<HTMLSelectElement>('#ae-interpolation').addEventListener('change', () => void setKeyMetadata());
  q<HTMLInputElement>('#ae-in-tangent').addEventListener('change', () => void setKeyMetadata());
  q<HTMLInputElement>('#ae-out-tangent').addEventListener('change', () => void setKeyMetadata());
  document.querySelectorAll<HTMLElement>('[data-foot-lock]').forEach((button) => button.addEventListener('click', () => void toggleFootContact(button.dataset.footLock as 'foot_l' | 'foot_r')));
  q('#ae-clear-contact').addEventListener('click', () => void clearContacts());
  q<HTMLInputElement>('#ae-hand-curl').addEventListener('change', (event) => { const value = Number((event.target as HTMLInputElement).value); const side = state.selectedBone.endsWith('_r') ? 'r' : 'l'; void handPreset(value > 45 ? 'fist' : value > 5 ? 'relaxed' : 'open').then(() => selectBone(`hand_${side}`)); });
  q<HTMLInputElement>('#ae-hand-spread').addEventListener('change', (event) => {
    const value = Number((event.target as HTMLInputElement).value); const side = state.selectedBone.endsWith('_r') ? 'r' : 'l';
    void (async () => { for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) { selectBone(`${finger}_1_${side}`); await setChannel('side', finger === 'thumb' ? value : value * .45); } selectBone(`hand_${side}`); })();
  });
  q('#ae-front').addEventListener('click', () => { state.cameraYaw = 0; state.cameraPitch = .025; void setCamera([0, 1.12, 4.25], [0, 1.02, 0], 'Front Orthographic'); });
  q('#ae-side').addEventListener('click', () => { state.cameraYaw = Math.PI / 2; state.cameraPitch = .025; void setCamera([4.25, 1.12, 0], [0, 1.02, 0], 'Right View'); });
  q('#ae-top').addEventListener('click', () => { state.cameraPitch = 1.2; void setCamera([0, 5.25, .02], [0, .9, 0], 'Top View'); });
  q('#ae-focus').addEventListener('click', () => { state.cameraDistance = 3.1; void orbitCamera(0, 0); });
  q('#ae-space').addEventListener('click', () => {
    state.transformSpace = state.transformSpace === 'Local' ? 'Parent' : state.transformSpace === 'Parent' ? 'World' : 'Local';
    q('#ae-space').textContent = `${state.transformSpace}⌄`; setStatus(`${state.transformSpace} transform orientation active`);
  });
  q('#ae-view-menu').addEventListener('click', () => {
    q<HTMLButtonElement>('#ae-toggle-joints').click();
    setStatus(`View overlays ${state.showJoints ? 'enabled' : 'disabled'}`);
  });
  const viewport = q<HTMLElement>('#ae-viewport');
  let orbitStart: { x: number; y: number; pointerId: number } | null = null;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 1) return;
    // Joint markers and transform gizmos own primary-button gestures. Orbit
    // only begins on the remaining viewport so selecting a finger or dragging
    // a rotation ring never moves the camera at the same time.
    if ((event.target as Element).closest('.joint, .gizmo-ring')) return;
    orbitStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    viewport.classList.add('is-orbiting');
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!orbitStart || event.pointerId !== orbitStart.pointerId) return;
    const dx = event.clientX - orbitStart.x; const dy = event.clientY - orbitStart.y;
    orbitStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; void orbitCamera(dx, dy);
  });
  const finishOrbit = (event: PointerEvent): void => {
    if (!orbitStart || event.pointerId !== orbitStart.pointerId) return;
    orbitStart = null;
    viewport.classList.remove('is-orbiting');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup', finishOrbit);
  viewport.addEventListener('pointercancel', finishOrbit);
  viewport.addEventListener('lostpointercapture', () => {
    orbitStart = null;
    viewport.classList.remove('is-orbiting');
  });
  viewport.addEventListener('wheel', (event) => { event.preventDefault(); void orbitCamera(0, 0, event.deltaY * .004); }, { passive: false });
  q('#ae-collapse-left').addEventListener('click', () => q('#action-workspace').classList.toggle('hide-left'));
  q('#ae-collapse-right').addEventListener('click', () => q('#action-workspace').classList.toggle('hide-right'));
  q('#ae-new-action').addEventListener('click', () => openActionDialog('create'));
  q('#ae-duplicate-action').addEventListener('click', () => openActionDialog('duplicate'));
  q('#ae-confirm-action').addEventListener('click', () => void confirmActionDialog());
  q('#ae-file').addEventListener('click', () => q<HTMLInputElement>('#ae-import-file').click());
  q('#ae-import-character').addEventListener('click', () => q<HTMLInputElement>('#ae-import-character-file').click());
  q<HTMLInputElement>('#ae-import-character-file').addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try { await importCharacterGlb(file); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error), true); }
  });
  q<HTMLInputElement>('#ae-import-file').addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    const source = await file.text();
    if (!source.includes('<Action')) { setStatus('Selected file has no MotionLoom <Action>.', true); return; }
    state.undo.push(state.dsl); state.dsl = source.includes('<Graph') ? source : state.dsl.replace(extractAction(), source);
    parseDocument(); refreshUi(); await rebuildRenderer();
  });
  q('#ae-view-dsl').addEventListener('click', () => { q<HTMLTextAreaElement>('#ae-dsl-source').value = state.dsl; q<HTMLDialogElement>('#ae-dsl-dialog').showModal(); });
  q('#ae-copy-dsl').addEventListener('click', () => void navigator.clipboard.writeText(extractAction()));
  q('#ae-export').addEventListener('click', () => { download(`${state.actionId}.motionloom`, extractAction()); state.dirty = false; parseDocument(); });
  q('#ae-undo').addEventListener('click', () => void restore('undo')); q('#ae-redo').addEventListener('click', () => void restore('redo'));
  document.addEventListener('keydown', (event) => {
    if ((event.target as HTMLElement).matches('input,textarea,select')) return;
    if (event.key.toLowerCase() === 'q') setTool('select'); if (event.key.toLowerCase() === 'g') setTool('move'); if (event.key.toLowerCase() === 'r') setTool('rotate');
    if (event.key === '1') q<HTMLButtonElement>('#ae-front').click(); if (event.key === '3') q<HTMLButtonElement>('#ae-side').click(); if (event.key === '7') q<HTMLButtonElement>('#ae-top').click(); if (event.key.toLowerCase() === 'f') q<HTMLButtonElement>('#ae-focus').click();
    if (event.key === 'ArrowLeft') void seek(state.frame - 1); if (event.key === 'ArrowRight') void seek(state.frame + 1);
    if (event.code === 'Space') { event.preventDefault(); q<HTMLButtonElement>('#ae-play').click(); }
    if (event.key === 'Delete' || event.key === 'Backspace') { if (state.selectedKey) { event.preventDefault(); void deleteSelectedKey(); } }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); void restore(event.shiftKey ? 'redo' : 'undo'); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelectedKeys(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); void pasteSelectedKeys(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); void addOrDuplicatePose(true); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault(); state.selectedKeys.clear();
      for (const pose of currentAction()?.poses || []) for (const bone of pose.bones) if (bone.id === state.selectedBone) for (const channel of Object.keys(bone.channels)) {
        const key = { actionId: state.actionId, boneId: state.selectedBone, channel, timeMs: pose.timeMs }; state.selectedKeys.set(keyId(key), key);
      }
      state.selectedKey = [...state.selectedKeys.values()][0] || null; renderTimeline();
    }
  });
  const tick = (now: number) => {
    if (state.playing) {
      const fps = state.document?.fps || 30;
      const frameCount = Math.max(1, state.endFrame + 1);
      const elapsedFrames = Math.floor((now - state.playbackOriginMs) * fps / 1000);
      const target = (state.playbackOriginFrame + elapsedFrames) % frameCount;
      if (target !== state.playbackLastRequestedFrame) {
        state.playbackLastRequestedFrame = target;
        void queuePlaybackFrame(target);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function restore(direction: 'undo' | 'redo'): Promise<void> {
  const from = direction === 'undo' ? state.undo : state.redo; const to = direction === 'undo' ? state.redo : state.undo;
  const source = from.pop(); if (!source) return;
  to.push(state.dsl); state.dsl = source; parseDocument(); refreshUi(); await rebuildRenderer();
}

async function boot(): Promise<void> {
  bindUi(); renderBoneTree();
  try {
    setStatus('Loading MotionLoom WASM…'); state.wasm = await loadWasm();
    setStatus('Loading humanoid Action library…');
    const version = encodeURIComponent(String((window as unknown as ActionEditorWindow).MOTIONLOOM_WASM_VERSION || 'dev'));
    const libraryBase = `${basePath()}/motionloom-actions`;
    state.libraryBase = libraryBase;
    state.libraryVersion = version;
    const manifestResponse = await fetch(`${libraryBase}/manifest.json?v=${version}`);
    if (!manifestResponse.ok) throw new Error(`Action manifest fetch failed: ${manifestResponse.status}`);
    const manifest = await manifestResponse.json() as ActionLibraryManifest;
    if (!manifest.template || !manifest.actions?.length) throw new Error('Action manifest is empty or invalid.');
    const fetchDsl = async (file: string): Promise<string> => {
      const response = await fetch(`${libraryBase}/${file}?v=${version}`);
      if (!response.ok) throw new Error(`Action DSL fetch failed (${file}): ${response.status}`);
      return response.text();
    };
    const firstEntry = manifest.actions[0];
    const [template, firstAction] = await Promise.all([
      fetchDsl(manifest.template),
      fetchDsl(firstEntry.file),
    ]);
    const marker = '<!-- ACTION_LIBRARY -->';
    if (!template.includes(marker)) throw new Error(`Humanoid scene template is missing ${marker}.`);
    state.actionLibrary = manifest.actions;
    state.loadedActionFiles.clear();
    state.loadedActionFiles.add(firstEntry.file);
    state.actionMeta = Object.fromEntries(manifest.actions.flatMap(({ id, label, icon, description, defaultAction, members, rootMotion, loop }) => (
      [id, defaultAction, ...(members || [])].filter((actionId): actionId is string => Boolean(actionId)).map((actionId) => [
        actionId,
        { label, icon, description, defaultAction, members, rootMotion, loop },
      ])
    )));
    state.dsl = template.replace(marker, firstAction);
    parseDocument(); refreshUi(); await rebuildRenderer();
  } catch (error) { setStatus(error instanceof Error ? error.message : String(error), true); }
}

export function installActionEditor(): void {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
  else void boot();
}
