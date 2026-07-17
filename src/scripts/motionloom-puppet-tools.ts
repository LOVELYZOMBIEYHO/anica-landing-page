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
};

type PuppetPin = {
  id: string;
  bindTo: string | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  start: number;
  end: number;
  raw: string;
};

type PuppetBlock = {
  id: string;
  target: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
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

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function parseGroups(source: string): GroupRange[] {
  const token = /<Group\b[^>]*>|<\/Group\s*>/gi;
  const stack: Array<Omit<GroupRange, 'end' | 'worldX' | 'worldY'>> = [];
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
    });
  }
  const byId = new Map(result.filter((group) => group.id).map((group) => [group.id, group]));
  for (const group of result) {
    let parentId = group.parentId;
    let depth = 0;
    while (parentId && depth++ < 100) {
      const parent = byId.get(parentId);
      if (!parent) break;
      group.worldX += parent.x;
      group.worldY += parent.y;
      parentId = parent.parentId;
    }
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
    const pinPattern = /<PuppetPin\b[^>]*\/>|<Pin\b[^>]*\/>/gi;
    pinPattern.lastIndex = open.lastIndex;
    const pins: PuppetPin[] = [];
    for (let pinMatch = pinPattern.exec(source); pinMatch && pinMatch.index < closeMatch.index; pinMatch = pinPattern.exec(source)) {
      const bindTo = attr(pinMatch[0], 'bindTo') || attr(pinMatch[0], 'bind_to');
      const bound = bindTo ? groupMap.get(bindTo) : undefined;
      const x = numberAttr(pinMatch[0], 'x', bound?.worldX ?? 0);
      const y = numberAttr(pinMatch[0], 'y', bound?.worldY ?? 0);
      pins.push({
        id: attr(pinMatch[0], 'id') || `puppet_pin_${pins.length + 1}`,
        bindTo,
        x,
        y,
        targetX: numberAttr(pinMatch[0], 'targetX', x),
        targetY: numberAttr(pinMatch[0], 'targetY', y),
        start: pinMatch.index,
        end: pinPattern.lastIndex,
        raw: pinMatch[0],
      });
    }
    blocks.push({
      id: attr(match[0], 'id') || `${target || 'character'}_puppet_warp`,
      target,
      start: match.index,
      openEnd: open.lastIndex,
      closeStart: closeMatch.index,
      end: close.lastIndex,
      pins,
    });
    open.lastIndex = close.lastIndex;
  }
  return blocks;
}

function replaceTagAttr(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/\s*\/>$/, ` ${name}="${escapeAttr(value)}" />`);
}

function graphSize(source: string): [number, number] {
  const match = source.match(/<Graph\b[^>]*\b(?:renderSize|size)\s*=\s*\{?\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]\}?/i);
  return match ? [Math.max(1, Number(match[1])), Math.max(1, Number(match[2]))] : [1920, 1080];
}

export function installMotionLoomPuppetTools() {
  const editor = document.querySelector<HTMLTextAreaElement>('#dsl-editor')!;
  const panel = document.querySelector<HTMLElement>('#puppet-warp-content')!;
  const panelSelect = document.querySelector<HTMLSelectElement>('#scene-tool-panel-select')!;
  const overlay = document.querySelector<SVGSVGElement>('#motionloom-drawing-overlay')!;
  if (!editor || !panel || !panelSelect || !overlay) return;

  panel.innerHTML = `
    <div class="puppet-tools-shell">
      <header><div><strong>Puppet Warp</strong><span>DSL-first deformation pins</span></div><output id="puppet-active-state">No warp</output></header>
      <div class="puppet-quick-start"><b>Quick Start</b><span>1. Choose a target Group. 2. Click Preview to create the first pin. 3. Drag the lime pin to deform it.</span></div>
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
  const targetXInput = $<HTMLInputElement>('#puppet-target-x');
  const targetYInput = $<HTMLInputElement>('#puppet-target-y');
  let groups: GroupRange[] = [];
  let puppets: PuppetBlock[] = [];
  let selectedPinId = '';
  let placingFreePin = false;
  let dragPinId = '';
  let historySnapshot = '';
  let graphSizeKey = '';

  const active = () => panelSelect.value === 'puppet-warp';
  const activePuppet = () => puppets.find((item) => item.target === targetSelect.value) || puppets[0] || null;
  const activePin = () => activePuppet()?.pins.find((pin) => pin.id === selectedPinId) || null;

  function notify(commit: boolean) {
    window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit } }));
  }

  function writeSource(source: string, commit: boolean) {
    editor.value = source;
    refresh();
    notify(commit);
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
    renderOverlay();
  }

  function renderOverlay() {
    if (!active()) return;
    const [width, height] = graphSize(editor.value);
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    overlay.replaceChildren();
    overlay.classList.remove('hidden');
    overlay.classList.add('pointer-events-auto', 'puppet-overlay-active');
    for (const pin of activePuppet()?.pins || []) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(pin.x)); line.setAttribute('y1', String(pin.y));
      line.setAttribute('x2', String(pin.targetX)); line.setAttribute('y2', String(pin.targetY));
      line.setAttribute('class', 'puppet-pin-link');
      overlay.append(line);
      const source = document.createElementNS(SVG_NS, 'circle');
      source.setAttribute('cx', String(pin.x)); source.setAttribute('cy', String(pin.y)); source.setAttribute('r', '9');
      source.setAttribute('class', 'puppet-pin-source');
      overlay.append(source);
      const target = document.createElementNS(SVG_NS, 'circle');
      target.setAttribute('cx', String(pin.targetX)); target.setAttribute('cy', String(pin.targetY)); target.setAttribute('r', pin.id === selectedPinId ? '15' : '12');
      target.setAttribute('class', `puppet-pin-target${pin.id === selectedPinId ? ' is-selected' : ''}`);
      target.dataset.pinId = pin.id;
      overlay.append(target);
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
    const radius = $<HTMLInputElement>('#puppet-radius').value;
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
    let tag = replaceTagAttr(pin.raw, 'targetX', formatNumber(x));
    tag = replaceTagAttr(tag, 'targetY', formatNumber(y));
    writeSource(editor.value.slice(0, pin.start) + tag + editor.value.slice(pin.end), commit);
    selectedPinId = pinId;
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
    if (placingFreePin || (puppet && puppet.pins.length === 0)) {
      const [x, y] = overlayPoint(event);
      placingFreePin = false;
      insertPin(`x="${formatNumber(x)}" y="${formatNumber(y)}" targetX="${formatNumber(x)}" targetY="${formatNumber(y)}"`);
      event.preventDefault();
    }
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!active() || !dragPinId) return;
    const [x, y] = overlayPoint(event);
    updatePinPosition(dragPinId, x, y, false);
    event.preventDefault();
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!dragPinId) return;
    const [x, y] = overlayPoint(event);
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
    else overlay.classList.remove('puppet-overlay-active');
  });
  refresh();
}
