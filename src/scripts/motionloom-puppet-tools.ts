type GroupRange = {
  id: string;
  start: number;
  openEnd: number;
  end: number;
  parentId: string | null;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  localTransform: Affine;
  worldTransform: Affine;
};

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };

const IDENTITY_AFFINE: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiplyAffine(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function translateAffine(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function groupTransform(tag: string): Affine {
  const x = expressionNumberAttr(tag, 'x');
  const y = expressionNumberAttr(tag, 'y');
  const rotation = expressionNumberAttr(tag, 'rotation');
  const scale = expressionNumberAttr(tag, 'scale', 1);
  const scaleX = scale * expressionNumberAttr(tag, 'scaleX', 1);
  const scaleY = scale * expressionNumberAttr(tag, 'scaleY', 1);
  const skewX = Math.tan(Math.max(-89.9, Math.min(89.9, expressionNumberAttr(tag, 'skewX'))) * Math.PI / 180);
  const skewY = Math.tan(Math.max(-89.9, Math.min(89.9, expressionNumberAttr(tag, 'skewY'))) * Math.PI / 180);
  const originX = expressionNumberAttr(tag, 'transformOriginX');
  const originY = expressionNumberAttr(tag, 'transformOriginY');
  const radians = rotation * Math.PI / 180;
  const rotate: Affine = { a: Math.cos(radians), b: Math.sin(radians), c: -Math.sin(radians), d: Math.cos(radians), e: 0, f: 0 };
  const skew: Affine = { a: 1, b: skewY, c: skewX, d: 1, e: 0, f: 0 };
  const scaled: Affine = { a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0 };
  return [
    translateAffine(x, y),
    translateAffine(originX, originY),
    rotate,
    skew,
    scaled,
    translateAffine(-originX, -originY),
  ].reduce(multiplyAffine, IDENTITY_AFFINE);
}

function affinePoint(transform: Affine, x: number, y: number): [number, number] {
  return [transform.a * x + transform.c * y + transform.e, transform.b * x + transform.d * y + transform.f];
}

function inverseAffinePoint(transform: Affine, x: number, y: number): [number, number] {
  const determinant = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(determinant) < 1e-8) return [x, y];
  const translatedX = x - transform.e;
  const translatedY = y - transform.f;
  return [
    (transform.d * translatedX - transform.c * translatedY) / determinant,
    (-transform.b * translatedX + transform.a * translatedY) / determinant,
  ];
}

function affineScale(transform: Affine): number {
  return Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));
}

type PuppetPin = {
  id: string;
  bindTo: string | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  fixed: boolean;
  start: number;
  end: number;
  raw: string;
};

type PuppetBlock = {
  id: string;
  target: string;
  width: number;
  height: number;
  density: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  parentGroupId: string | null;
  pins: PuppetPin[];
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, 'i'));
  return match ? String(match[1] ?? match[2] ?? match[3] ?? '').trim() : null;
}

function numberAttr(tag: string, name: string, fallback = 0): number {
  const value = Number.parseFloat(attr(tag, name) ?? '');
  return Number.isFinite(value) ? value : fallback;
}

function expressionNumberAttr(tag: string, name: string, fallback = 0): number {
  const directMatch = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
  const direct = Number.parseFloat(directMatch?.[1] ?? '');
  if (Number.isFinite(direct)) return direct;
  const expression = new RegExp(`\\b${name}\\s*=\\s*\\{\\s*curve\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\}`, 'i').exec(tag)?.[1];
  const value = Number.parseFloat(expression?.split(',')[0]?.trim().split(':')[1] ?? '');
  return Number.isFinite(value) ? value : fallback;
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function parseGroups(source: string): GroupRange[] {
  const token = /<Group\b[^>]*>|<\/Group\s*>/gi;
  const stack: Array<Omit<GroupRange, 'end' | 'worldX' | 'worldY' | 'worldTransform'>> = [];
  const result: GroupRange[] = [];
  for (let match = token.exec(source); match; match = token.exec(source)) {
    if (match[0].startsWith('</')) {
      const group = stack.pop();
      if (!group) continue;
      result.push({
        ...group,
        end: token.lastIndex,
        worldX: group.x,
        worldY: group.y,
        worldTransform: group.localTransform,
      });
      continue;
    }
    const id = attr(match[0], 'id');
    stack.push({
      id: id || '',
      start: match.index,
      openEnd: token.lastIndex,
      parentId: [...stack].reverse().find((item) => item.id)?.id || null,
      x: numberAttr(match[0], 'x'),
      y: numberAttr(match[0], 'y'),
      localTransform: groupTransform(match[0]),
    });
  }
  const byId = new Map(result.filter((group) => group.id).map((group) => [group.id, group]));
  const resolving = new Set<string>();
  const resolveWorld = (group: GroupRange): Affine => {
    if (!group.parentId || !byId.has(group.parentId)) return group.localTransform;
    if (resolving.has(group.id)) return group.localTransform;
    resolving.add(group.id);
    const parent = byId.get(group.parentId)!;
    const transform = multiplyAffine(resolveWorld(parent), group.localTransform);
    resolving.delete(group.id);
    return transform;
  };
  for (const group of result) {
    group.worldTransform = resolveWorld(group);
    [group.worldX, group.worldY] = affinePoint(group.worldTransform, 0, 0);
  }
  return result.filter((group) => group.id).sort((a, b) => a.start - b.start);
}

function parsePuppets(source: string, groups: GroupRange[]): PuppetBlock[] {
  const blocks: PuppetBlock[] = [];
  const open = /<Puppet(?:Warp)?\b[^>]*>/gi;
  for (let match = open.exec(source); match; match = open.exec(source)) {
    const tagName = /^<PuppetWarp\b/i.test(match[0]) ? 'PuppetWarp' : 'Puppet';
    const close = new RegExp(`<\\/${tagName}\\s*>`, 'gi');
    close.lastIndex = open.lastIndex;
    const closeMatch = close.exec(source);
    if (!closeMatch) continue;
    const target = attr(match[0], 'target') || '';
    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const parentGroup = groups
      .filter((group) => group.start < match.index && group.end > closeMatch.index)
      .sort((a, b) => b.start - a.start)[0];
    const parentTransform = parentGroup?.worldTransform || IDENTITY_AFFINE;
    const pinPattern = /<PuppetPin\b[^>]*\/>|<Pin\b[^>]*\/>/gi;
    pinPattern.lastIndex = open.lastIndex;
    const pins: PuppetPin[] = [];
    for (let pinMatch = pinPattern.exec(source); pinMatch && pinMatch.index < closeMatch.index; pinMatch = pinPattern.exec(source)) {
      const bindTo = attr(pinMatch[0], 'bindTo') || attr(pinMatch[0], 'bind_to');
      const bound = bindTo ? groupMap.get(bindTo) : undefined;
      const boundLocal = bound ? inverseAffinePoint(parentTransform, bound.worldX, bound.worldY) : [0, 0];
      const x = numberAttr(pinMatch[0], 'x', boundLocal[0]);
      const y = numberAttr(pinMatch[0], 'y', boundLocal[1]);
      pins.push({
        id: attr(pinMatch[0], 'id') || `puppet_pin_${pins.length + 1}`,
        bindTo,
        x,
        y,
        targetX: expressionNumberAttr(pinMatch[0], 'targetX', x),
        targetY: expressionNumberAttr(pinMatch[0], 'targetY', y),
        radius: Math.max(1, numberAttr(pinMatch[0], 'radius', 160)),
        fixed: /^(true|1|yes)$/i.test(attr(pinMatch[0], 'fixed') || ''),
        start: pinMatch.index,
        end: pinPattern.lastIndex,
        raw: pinMatch[0],
      });
    }
    blocks.push({
      id: attr(match[0], 'id') || `${target || 'character'}_puppet_warp`,
      target,
      width: Math.max(1, numberAttr(match[0], 'width', 1920)),
      height: Math.max(1, numberAttr(match[0], 'height', 1080)),
      density: attr(match[0], 'density') || 'medium',
      start: match.index,
      openEnd: open.lastIndex,
      closeStart: closeMatch.index,
      end: close.lastIndex,
      parentGroupId: parentGroup?.id || null,
      pins,
    });
    open.lastIndex = close.lastIndex;
  }
  return blocks;
}

function puppetGridSize(density: string): [number, number] {
  const normalized = density.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'coarse') return [3, 3];
  if (normalized === 'high' || normalized === 'fine') return [7, 7];
  if (normalized === 'ultra' || normalized === 'dense') return [9, 9];
  const custom = normalized.match(/^(\d+)\s*[x,]\s*(\d+)$/);
  return custom ? [Math.max(2, Number(custom[1])), Math.max(2, Number(custom[2]))] : [5, 5];
}

// The renderer deforms regular-grid vertices. Give a pin enough reach to
// influence its nearest vertex with visible smooth falloff instead of no-oping.
function effectivePinRadius(puppet: PuppetBlock, x: number, y: number): number {
  const [cols, rows] = puppetGridSize(puppet.density);
  let nearest = Number.POSITIVE_INFINITY;
  for (let row = 0; row < rows; row += 1) {
    const gridY = puppet.height * row / (rows - 1);
    for (let col = 0; col < cols; col += 1) {
      const gridX = puppet.width * col / (cols - 1);
      nearest = Math.min(nearest, Math.hypot(x - gridX, y - gridY));
    }
  }
  return Math.max(1, Math.ceil(nearest * 1.5));
}

function replaceTagAttr(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/\s*\/>$/, ` ${name}="${escapeAttr(value)}" />`);
}

function replaceTagAttrRaw(tag: string, name: string, rawValue: string): string {
  const pattern = new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}=${rawValue}`);
  return tag.replace(/\s*\/>$/, ` ${name}=${rawValue} />`);
}

// Dragging an animated pin moves its complete motion path instead of replacing
// the curve with one static coordinate.
function translateCurveAttr(tag: string, name: string, from: number, to: number): string {
  const expression = new RegExp(`\\b${name}\\s*=\\s*\\{\\s*curve\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\}`, 'i').exec(tag)?.[1];
  if (!expression) return replaceTagAttr(tag, name, formatNumber(to));
  const delta = to - from;
  const translated = expression.split(',').map((entry) => {
    const parts = entry.trim().split(':');
    if (parts.length < 2) return entry.trim();
    const value = Number.parseFloat(parts[1]);
    if (!Number.isFinite(value)) return entry.trim();
    parts[1] = formatNumber(value + delta);
    return parts.join(':');
  }).join(', ');
  return replaceTagAttrRaw(tag, name, `{curve("${translated}")}`);
}

function graphDuration(source: string): number {
  const graph = source.match(/<Graph\b[^>]*>/i)?.[0] || '';
  const value = Number.parseFloat(attr(graph, 'duration') || '4');
  return Number.isFinite(value) && value > 0 ? value : 4;
}

function buildSwayCurve(base: number, positiveOffset: number, negativeOffset: number, duration: number, cycles: number): string {
  const entries: Array<[number, number]> = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const start = (duration * cycle) / cycles;
    const span = duration / cycles;
    if (cycle === 0) entries.push([start, base]);
    entries.push([start + span * 0.25, base + positiveOffset]);
    entries.push([start + span * 0.5, base]);
    entries.push([start + span * 0.75, base + negativeOffset]);
    entries.push([start + span, base]);
  }
  return entries
    .map(([time, value], index) => `${formatNumber(time)}:${formatNumber(value)}:${index === 0 ? 'linear' : 'ease_in_out'}`)
    .join(', ');
}

function graphSize(source: string): [number, number] {
  const match = source.match(/<Graph\b[^>]*\b(?:renderSize|size)\s*=\s*\{?\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]\}?/i);
  return match ? [Math.max(1, Number(match[1])), Math.max(1, Number(match[2]))] : [1920, 1080];
}

export function installMotionLoomPuppetTools() {
  const editor = document.querySelector<HTMLTextAreaElement>('#dsl-editor')!;
  const panel = document.querySelector<HTMLElement>('#puppet-warp-content')!;
  const panelSelect = document.querySelector<HTMLSelectElement>('#scene-tool-panel-select')!;
  const overlay = document.querySelector<SVGSVGElement>('#motionloom-puppet-overlay')!;
  if (!editor || !panel || !panelSelect || !overlay) return;

  panel.innerHTML = `
    <div class="puppet-tools-shell">
      <header><div><strong>Puppet Warp</strong><span>DSL-first deformation pins</span></div><output id="puppet-active-state">No warp</output></header>
      <div class="puppet-quick-start"><b>Quick Start</b><span>Already have a pin? Press Animate Pins, then Play. Dragging repositions a pin; Animate Pins makes it move over time.</span></div>
      <div class="puppet-tools-grid">
        <section class="puppet-tool-card">
          <h3>Warp Target</h3>
          <label><span>Target Group</span><select id="puppet-target"></select></label>
          <label><span>Warp ID</span><input id="puppet-warp-id" type="text" value="character_puppet_warp" /></label>
          <div class="puppet-inline-fields">
            <label><span>Mesh Width</span><input id="puppet-width" type="number" value="1920" /></label>
            <label><span>Mesh Height</span><input id="puppet-height" type="number" value="1080" /></label>
          </div>
          <label><span>Density</span><select id="puppet-density"><option>low</option><option selected>medium</option><option>high</option></select></label>
          <button id="puppet-create-warp" type="button">Create Warp, Then Click Preview</button>
        </section>
        <section class="puppet-tool-card">
          <h3>Add Pin</h3>
          <label><span>Bind To</span><select id="puppet-bind-target"></select></label>
          <div class="puppet-inline-fields">
            <label><span>Radius</span><input id="puppet-radius" type="number" value="160" min="1" /></label>
            <label><span>Strength</span><input id="puppet-strength" type="number" value="1" min="0" step="0.1" /></label>
          </div>
          <label><span>Falloff</span><select id="puppet-falloff"><option selected>smooth</option><option>linear</option><option>hard</option></select></label>
          <div class="puppet-action-row"><button id="puppet-add-bound" type="button">Add Bound Pin</button><button id="puppet-add-free" type="button">Place Free Pin</button></div>
          <p id="puppet-help">Bound pins follow semantic Group anchors. Drag a pin target in Preview to deform the target.</p>
        </section>
        <section class="puppet-tool-card puppet-pin-card">
          <h3>Pins</h3><div id="puppet-pin-list"></div>
          <div class="puppet-inline-fields"><label><span>Target X</span><input id="puppet-target-x" type="number" step="0.1" /></label><label><span>Target Y</span><input id="puppet-target-y" type="number" step="0.1" /></label></div>
          <div class="puppet-action-row"><button id="puppet-update-pin" type="button">Update Pin</button><button id="puppet-delete-pin" type="button">Delete Pin</button></div>
        </section>
        <section class="puppet-tool-card puppet-hair-animation-card">
          <h3>Animate Pins</h3>
          <p>One pin sways as a loose tip. With two or more pins, place them from root to tip for progressively stronger movement.</p>
          <div class="puppet-inline-fields">
            <label><span>Horizontal Sway</span><input id="puppet-hair-sway-x" type="number" value="18" min="0" step="1" /></label>
            <label><span>Vertical Lift</span><input id="puppet-hair-sway-y" type="number" value="5" min="0" step="1" /></label>
          </div>
          <div class="puppet-inline-fields">
            <label><span>Cycles</span><input id="puppet-hair-cycles" type="number" value="2" min="1" max="12" step="1" /></label>
            <label class="puppet-checkbox-label"><span>Root Anchor</span><span><input id="puppet-hair-root-fixed" type="checkbox" checked /> Keep first pin fixed (2+ pins)</span></label>
          </div>
          <div class="puppet-action-row"><button id="puppet-apply-hair-sway" type="button">Animate Pins</button><button id="puppet-static-pins" type="button">Make Pins Static</button></div>
        </section>
      </div>
      <p id="puppet-status">Choose a target Group, then click Preview. The textarea remains the source of truth.</p>
    </div>`;

  const $ = <T extends Element>(selector: string) => panel.querySelector<T>(selector)!;
  const targetSelect = $<HTMLSelectElement>('#puppet-target');
  const bindSelect = $<HTMLSelectElement>('#puppet-bind-target');
  const pinList = $<HTMLElement>('#puppet-pin-list');
  const status = $<HTMLElement>('#puppet-status');
  const widthInput = $<HTMLInputElement>('#puppet-width');
  const heightInput = $<HTMLInputElement>('#puppet-height');
  const radiusInput = $<HTMLInputElement>('#puppet-radius');
  const targetXInput = $<HTMLInputElement>('#puppet-target-x');
  const targetYInput = $<HTMLInputElement>('#puppet-target-y');
  const hairSwayXInput = $<HTMLInputElement>('#puppet-hair-sway-x');
  const hairSwayYInput = $<HTMLInputElement>('#puppet-hair-sway-y');
  const hairCyclesInput = $<HTMLInputElement>('#puppet-hair-cycles');
  const hairRootFixedInput = $<HTMLInputElement>('#puppet-hair-root-fixed');
  let groups: GroupRange[] = [];
  let puppets: PuppetBlock[] = [];
  let selectedPinId = '';
  let placingFreePin = false;
  let dragPinId = '';
  let historySnapshot = '';
  let graphSizeKey = '';

  const active = () => panelSelect.value === 'puppet-warp';
  // Never animate an unrelated fallback warp when the user has selected a
  // different semantic Group. A target without a warp must create its own.
  const activePuppet = () => {
    const target = targetSelect.value;
    return puppets.find((item) => item.target === target) || (!target ? puppets[0] : null) || null;
  };
  const activePin = () => activePuppet()?.pins.find((pin) => pin.id === selectedPinId) || null;
  const puppetTransform = (puppet: PuppetBlock) => groups.find((group) => group.id === puppet.parentGroupId)?.worldTransform || IDENTITY_AFFINE;
  const overlayToPuppet = (puppet: PuppetBlock, x: number, y: number) => inverseAffinePoint(puppetTransform(puppet), x, y);

  function notify(commit: boolean) {
    window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit } }));
  }

  function writeSource(source: string, commit: boolean) {
    editor.value = source;
    refresh();
    notify(commit);
  }

  function rewriteActivePins(transform: (pin: PuppetPin, index: number, total: number) => string): boolean {
    const puppet = activePuppet();
    if (!puppet) return false;
    let source = editor.value;
    const edits = puppet.pins
      .map((pin, index) => ({ pin, raw: transform(pin, index, puppet.pins.length) }))
      .sort((a, b) => b.pin.start - a.pin.start);
    for (const edit of edits) {
      source = `${source.slice(0, edit.pin.start)}${edit.raw}${source.slice(edit.pin.end)}`;
    }
    writeSource(source, true);
    return true;
  }

  function refresh() {
    const source = editor.value;
    const [graphWidth, graphHeight] = graphSize(source);
    const nextGraphSizeKey = `${graphWidth}x${graphHeight}`;
    if (nextGraphSizeKey !== graphSizeKey) {
      widthInput.value = formatNumber(graphWidth);
      heightInput.value = formatNumber(graphHeight);
      graphSizeKey = nextGraphSizeKey;
    }
    groups = parseGroups(source);
    puppets = parsePuppets(source, groups);
    const previousTarget = targetSelect.value;
    targetSelect.innerHTML = groups.map((group) => `<option value="${escapeAttr(group.id)}">${group.id}</option>`).join('');
    if (groups.some((group) => group.id === previousTarget)) targetSelect.value = previousTarget;
    else if (puppets[0]?.target && groups.some((group) => group.id === puppets[0].target)) targetSelect.value = puppets[0].target;
    const target = groups.find((group) => group.id === targetSelect.value);
    const descendants = target
      ? groups.filter((group) => group.id !== target.id && group.start > target.start && group.end < target.end)
      : groups;
    const previousBind = bindSelect.value;
    bindSelect.innerHTML = descendants.map((group) => `<option value="${escapeAttr(group.id)}">${group.id}</option>`).join('');
    if (descendants.some((group) => group.id === previousBind)) bindSelect.value = previousBind;
    const puppet = activePuppet();
    if (puppet && !puppet.pins.some((pin) => pin.id === selectedPinId)) selectedPinId = puppet.pins[0]?.id || '';
    pinList.innerHTML = puppet?.pins.length
      ? puppet.pins.map((pin) => `<button type="button" data-pin-id="${escapeAttr(pin.id)}" class="${pin.id === selectedPinId ? 'is-selected' : ''}"><b>${pin.id}</b><span>${pin.bindTo ? `bind: ${pin.bindTo}` : `${formatNumber(pin.x)}, ${formatNumber(pin.y)}`}</span></button>`).join('')
      : '<p>No PuppetPin nodes yet.</p>';
    const pin = activePin();
    targetXInput.value = pin ? formatNumber(pin.targetX) : '';
    targetYInput.value = pin ? formatNumber(pin.targetY) : '';
    $('#puppet-active-state').textContent = puppet ? puppet.id : 'No warp';
    const undersizedPins = puppet?.pins.filter((item) => item.radius < effectivePinRadius(puppet, item.x, item.y)) || [];
    if (!puppet) status.textContent = 'Choose a target Group, then create a Puppet Warp.';
    else if (puppet.pins.length === 0) status.textContent = 'No pins yet. Click Place Free Pin, then click the Preview.';
    else if (undersizedPins.length) status.textContent = `${undersizedPins.length} pin radius is too small for this ${puppet.density} mesh. Animate Pins will repair it automatically.`;
    else if (puppet.pins.length === 1) status.textContent = '1 pin ready. Press Animate Pins, then press Play above the Preview.';
    else status.textContent = `${puppet.pins.length} pins ready. Press Animate Pins, then press Play above the Preview.`;
    renderOverlay();
  }

  function renderOverlay() {
    if (!active()) {
      overlay.replaceChildren();
      overlay.classList.add('hidden', 'pointer-events-none');
      overlay.classList.remove('pointer-events-auto', 'puppet-overlay-active');
      return;
    }
    const [width, height] = graphSize(editor.value);
    const handleRadius = Math.max(12, Math.min(26, Math.max(width, height) * 0.012));
    const labelSize = Math.max(18, Math.min(34, Math.max(width, height) * 0.016));
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    overlay.replaceChildren();
    overlay.classList.remove('hidden', 'pointer-events-none');
    overlay.classList.add('pointer-events-auto', 'puppet-overlay-active');
    const puppet = activePuppet();
    if (!puppet) return;
    const transform = puppetTransform(puppet);
    const radiusScale = affineScale(transform);
    for (const pin of puppet.pins) {
      const [sourceX, sourceY] = affinePoint(transform, pin.x, pin.y);
      const [targetX, targetY] = affinePoint(transform, pin.targetX, pin.targetY);
      const radius = document.createElementNS(SVG_NS, 'circle');
      radius.setAttribute('cx', String(sourceX)); radius.setAttribute('cy', String(sourceY));
      radius.setAttribute('r', String(Math.max(handleRadius * 1.5, pin.radius * radiusScale)));
      radius.setAttribute('class', 'puppet-pin-radius');
      overlay.append(radius);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(sourceX)); line.setAttribute('y1', String(sourceY));
      line.setAttribute('x2', String(targetX)); line.setAttribute('y2', String(targetY));
      line.setAttribute('class', 'puppet-pin-link');
      overlay.append(line);
      const source = document.createElementNS(SVG_NS, 'circle');
      source.setAttribute('cx', String(sourceX)); source.setAttribute('cy', String(sourceY)); source.setAttribute('r', String(handleRadius * 0.62));
      source.setAttribute('class', 'puppet-pin-source');
      overlay.append(source);
      const target = document.createElementNS(SVG_NS, 'circle');
      target.setAttribute('cx', String(targetX)); target.setAttribute('cy', String(targetY));
      target.setAttribute('r', String(pin.id === selectedPinId ? handleRadius * 1.2 : handleRadius));
      target.setAttribute('class', `puppet-pin-target${pin.id === selectedPinId ? ' is-selected' : ''}`);
      target.dataset.pinId = pin.id;
      overlay.append(target);
      const core = document.createElementNS(SVG_NS, 'circle');
      core.setAttribute('cx', String(targetX)); core.setAttribute('cy', String(targetY));
      core.setAttribute('r', String(handleRadius * 0.28)); core.setAttribute('class', 'puppet-pin-core');
      overlay.append(core);
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(targetX + handleRadius * 1.55));
      label.setAttribute('y', String(targetY - handleRadius * 1.25));
      label.setAttribute('font-size', String(labelSize)); label.setAttribute('class', 'puppet-pin-label');
      label.textContent = pin.id;
      overlay.append(label);
    }
  }

  function insertPin(attrs: string) {
    const puppet = activePuppet();
    if (!puppet) { status.textContent = 'Create Puppet Warp before adding pins.'; return; }
    const idBase = `${puppet.target || 'character'}_pin`;
    let index = puppet.pins.length + 1;
    while (puppet.pins.some((pin) => pin.id === `${idBase}_${index}`)) index += 1;
    selectedPinId = `${idBase}_${index}`;
    const indent = editor.value.slice(0, puppet.closeStart).match(/(^|\n)([ \t]*)[^\n]*$/)?.[2] || '  ';
    const bindTo = attr(attrs, 'bindTo');
    const bound = bindTo ? groups.find((group) => group.id === bindTo) : undefined;
    const boundLocal = bound ? overlayToPuppet(puppet, bound.worldX, bound.worldY) : [0, 0];
    const pinX = numberAttr(attrs, 'x', boundLocal[0]);
    const pinY = numberAttr(attrs, 'y', boundLocal[1]);
    const requestedRadius = Math.max(1, Number(radiusInput.value) || 160);
    const radius = Math.max(requestedRadius, effectivePinRadius(puppet, pinX, pinY));
    radiusInput.value = formatNumber(radius);
    const strength = $<HTMLInputElement>('#puppet-strength').value;
    const falloff = $<HTMLSelectElement>('#puppet-falloff').value;
    const tag = `${indent}  <PuppetPin id="${selectedPinId}" ${attrs} radius="${radius}" strength="${strength}" falloff="${falloff}" />\n`;
    writeSource(editor.value.slice(0, puppet.closeStart) + tag + editor.value.slice(puppet.closeStart), true);
    status.textContent = `Added ${selectedPinId}. Drag its target in Preview.`;
  }

  function createWarpForTarget(): PuppetBlock | null {
    const target = groups.find((group) => group.id === targetSelect.value);
    if (!target) { status.textContent = 'Choose a target Group first.'; return null; }
    const existing = puppets.find((puppet) => puppet.target === target.id);
    if (existing) return existing;
    const [graphWidth, graphHeight] = graphSize(editor.value);
    const warpId = ($<HTMLInputElement>('#puppet-warp-id')).value.trim() || `${target.id}_puppet_warp`;
    const width = Number(widthInput.value) || graphWidth;
    const height = Number(heightInput.value) || graphHeight;
    const density = $<HTMLSelectElement>('#puppet-density').value;
    const lineStart = editor.value.lastIndexOf('\n', target.start) + 1;
    const indent = editor.value.slice(lineStart, target.start);
    const block = `\n${indent}<PuppetWarp id="${escapeAttr(warpId)}" target="${escapeAttr(target.id)}" width="${width}" height="${height}" density="${density}">\n${indent}</PuppetWarp>`;
    writeSource(editor.value.slice(0, target.end) + block + editor.value.slice(target.end), true);
    placingFreePin = true;
    status.textContent = `Created ${warpId}. Click Preview to place the first pin.`;
    return activePuppet();
  }

  function updatePinPosition(pinId: string, x: number, y: number, commit: boolean) {
    const pin = activePuppet()?.pins.find((item) => item.id === pinId);
    if (!pin) return;
    let tag = translateCurveAttr(pin.raw, 'targetX', pin.targetX, x);
    tag = translateCurveAttr(tag, 'targetY', pin.targetY, y);
    writeSource(editor.value.slice(0, pin.start) + tag + editor.value.slice(pin.end), commit);
    selectedPinId = pinId;
    if (commit && (/\btargetX\s*=\s*\{\s*curve\(/i.test(pin.raw) || /\btargetY\s*=\s*\{\s*curve\(/i.test(pin.raw))) {
      status.textContent = `Moved ${pinId}; its animation curve was preserved.`;
    }
  }

  function overlayPoint(event: PointerEvent): [number, number] {
    const point = new DOMPoint(event.clientX, event.clientY);
    const matrix = overlay.getScreenCTM();
    if (!matrix) return [0, 0];
    const local = point.matrixTransform(matrix.inverse());
    return [local.x, local.y];
  }

  $('#puppet-create-warp').addEventListener('click', () => {
    const puppet = createWarpForTarget();
    if (puppet?.pins.length) {
      placingFreePin = false;
      status.textContent = `${puppet.id} already exists. Select and drag a lime pin, or choose Place Free Pin.`;
    }
  });

  $('#puppet-add-bound').addEventListener('click', () => {
    if (!bindSelect.value) { status.textContent = 'The target has no descendant Group to bind.'; return; }
    insertPin(`bindTo="${escapeAttr(bindSelect.value)}"`);
  });
  $('#puppet-add-free').addEventListener('click', () => {
    placingFreePin = true;
    status.textContent = 'Click the Preview to place a free PuppetPin.';
  });
  $('#puppet-update-pin').addEventListener('click', () => {
    const pin = activePin();
    if (!pin) return;
    updatePinPosition(pin.id, Number(targetXInput.value), Number(targetYInput.value), true);
  });
  $('#puppet-delete-pin').addEventListener('click', () => {
    const pin = activePin();
    if (!pin) return;
    selectedPinId = '';
    writeSource(editor.value.slice(0, pin.start) + editor.value.slice(pin.end), true);
  });
  $('#puppet-apply-hair-sway').addEventListener('click', () => {
    const puppet = activePuppet();
    if (!puppet || puppet.pins.length === 0) {
      status.textContent = 'Add at least one pin before animating.';
      return;
    }
    const pinCount = puppet.pins.length;
    const swayX = Math.abs(Number(hairSwayXInput.value) || 18);
    const liftY = Math.abs(Number(hairSwayYInput.value) || 5);
    const cycles = Math.max(1, Math.min(12, Math.round(Number(hairCyclesInput.value) || 2)));
    const duration = graphDuration(editor.value);
    const keepRootFixed = hairRootFixedInput.checked;
    let expandedRadiusCount = 0;
    rewriteActivePins((pin, index, total) => {
      // A single pin represents the loose tip; root locking only applies when
      // another pin is available to carry the motion.
      const factor = total === 1 ? 1 : index / (total - 1);
      const safeRadius = effectivePinRadius(puppet, pin.x, pin.y);
      let preparedTag = pin.raw;
      if (pin.radius < safeRadius) {
        preparedTag = replaceTagAttr(preparedTag, 'radius', formatNumber(safeRadius));
        expandedRadiusCount += 1;
      }
      if (pin.fixed || (total > 1 && index === 0 && keepRootFixed)) {
        let tag = replaceTagAttr(preparedTag, 'targetX', formatNumber(pin.x));
        tag = replaceTagAttr(tag, 'targetY', formatNumber(pin.y));
        tag = replaceTagAttr(tag, 'fixed', 'true');
        return tag;
      }
      const baseX = Number.isFinite(pin.targetX) ? pin.targetX : pin.x;
      const baseY = Number.isFinite(pin.targetY) ? pin.targetY : pin.y;
      const xCurve = buildSwayCurve(baseX, swayX * factor, -swayX * factor, duration, cycles);
      const yCurve = buildSwayCurve(baseY, -liftY * factor, liftY * factor * 0.6, duration, cycles);
      let tag = replaceTagAttrRaw(preparedTag, 'targetX', `{curve("${xCurve}")}`);
      tag = replaceTagAttrRaw(tag, 'targetY', `{curve("${yCurve}")}`);
      return tag;
    });
    const radiusNote = expandedRadiusCount ? ` Repaired ${expandedRadiusCount} undersized pin radius.` : '';
    status.textContent = (pinCount === 1
      ? 'Animated 1 pin as a loose tip. Press Play above the Preview.'
      : `Animated ${pinCount} pins from root to tip. Press Play above the Preview.`) + radiusNote;
  });
  $('#puppet-static-pins').addEventListener('click', () => {
    const puppet = activePuppet();
    if (!puppet) return;
    const pinCount = puppet.pins.length;
    rewriteActivePins((pin) => {
      let tag = replaceTagAttr(pin.raw, 'targetX', formatNumber(pin.targetX));
      tag = replaceTagAttr(tag, 'targetY', formatNumber(pin.targetY));
      return tag;
    });
    status.textContent = `Removed animation curves from ${pinCount} pins.`;
  });
  pinList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pin-id]');
    if (!button) return;
    selectedPinId = button.dataset.pinId || '';
    refresh();
  });
  targetSelect.addEventListener('change', refresh);

  overlay.addEventListener('pointerdown', (event) => {
    if (!active()) return;
    const target = (event.target as SVGElement).closest<SVGElement>('[data-pin-id]');
    if (target?.dataset.pinId) {
      dragPinId = target.dataset.pinId;
      selectedPinId = dragPinId;
      historySnapshot = editor.value;
      overlay.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const puppet = activePuppet() || createWarpForTarget();
    if (!puppet) return;
    if (placingFreePin || (puppet && puppet.pins.length === 0)) {
      const [overlayX, overlayY] = overlayPoint(event);
      const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
      placingFreePin = false;
      insertPin(`x="${formatNumber(x)}" y="${formatNumber(y)}" targetX="${formatNumber(x)}" targetY="${formatNumber(y)}"`);
      event.preventDefault();
    }
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!active() || !dragPinId) return;
    const puppet = activePuppet();
    if (!puppet) return;
    const [overlayX, overlayY] = overlayPoint(event);
    const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
    updatePinPosition(dragPinId, x, y, false);
    event.preventDefault();
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!dragPinId) return;
    const puppet = activePuppet();
    if (!puppet) return;
    const [overlayX, overlayY] = overlayPoint(event);
    const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
    updatePinPosition(dragPinId, x, y, true);
    dragPinId = '';
    historySnapshot = '';
    event.preventDefault();
  });
  overlay.addEventListener('pointercancel', () => {
    if (historySnapshot) writeSource(historySnapshot, true);
    dragPinId = '';
    historySnapshot = '';
  });

  editor.addEventListener('input', refresh);
  window.addEventListener('motionloom:tool-panel-change', (event: Event) => {
    const custom = event as CustomEvent<{ panel?: string }>;
    if (custom.detail?.panel === 'puppet-warp') refresh();
    else renderOverlay();
  });
  refresh();
}
