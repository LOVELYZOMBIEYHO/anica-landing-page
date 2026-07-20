import {
  DrawingHistory,
  MotionLoomDrawingDocument,
  drawingPathD,
  graphCanvasSize,
  normalizeDrawingColor,
  parseDrawingGroup,
  patchDrawingGroup,
  type DrawingPoint,
  type DrawingShape,
  type DrawingStyle,
  type DrawingTool,
} from './motionloom-drawing-core';
import {
  affineToSvg,
  combineSemanticSelectionWithGroup,
  deleteSemanticPaths,
  growConnectedSelection,
  groupSemanticPaths,
  indexSemanticPaths,
  pathsInLasso,
  pathsInMarquee,
  selectSimilarPaths,
  semanticPathContourCount,
  splitSemanticCompoundPath,
  transformBounds,
  type SemanticPath,
} from './motionloom-semantic-selection';

const SVG_NS = 'http://www.w3.org/2000/svg';
const toolMeta: Record<DrawingTool, [string, string, string]> = {
  selection: ['Selection Tool', 'V', 'Select and move a complete Path.'],
  direct: ['Direct Selection', 'A', 'Select and move individual anchors and Bezier handles.'],
  pen: ['Pen Tool', 'P', 'Click anchors; drag to create Bezier handles. Enter finishes the path.'],
  brush: ['Brush Tool', 'B', 'Draw freehand. Stylus pressure is retained in the Path model.'],
  width: ['Width Tool', 'Shift+W', 'Drag near a path start or end to taper its stroke.'],
  shape: ['Shape Tools', 'M', 'Drag to draw a rectangle, ellipse, or line.'],
  hand: ['Hand Tool', 'H', 'Drag to pan the canvas without changing the DSL.'],
  zoom: ['Zoom Tool', 'Z', 'Click to zoom in. Alt/Option-click zooms out.'],
};

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string>) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function finiteNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scrollTextareaOffsetIntoView(editor: HTMLTextAreaElement, offset: number) {
  const computed = getComputedStyle(editor);
  const mirror = document.createElement('div');
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
    left: '-100000px',
    top: '0',
    width: `${editor.clientWidth}px`,
    height: 'auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    wordBreak: computed.wordBreak,
    padding: computed.padding,
    border: '0',
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontStyle: computed.fontStyle,
    fontWeight: computed.fontWeight,
    fontVariant: computed.fontVariant,
    lineHeight: computed.lineHeight,
    letterSpacing: computed.letterSpacing,
    wordSpacing: computed.wordSpacing,
    tabSize: computed.tabSize,
    textTransform: computed.textTransform,
    direction: computed.direction,
  });
  mirror.append(document.createTextNode(editor.value.slice(0, offset)));
  const marker = document.createElement('span');
  marker.textContent = editor.value[offset] || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const targetTop = marker.offsetTop;
  mirror.remove();
  editor.scrollTop = Math.max(0, targetTop - editor.clientHeight * 0.2);
}

export function installMotionLoomDrawingTools() {
  const mount = () => {
    const panel = document.querySelector<HTMLElement>('#drawing-tools-content');
    const editor = document.querySelector<HTMLTextAreaElement>('#dsl-editor');
    const overlay = document.querySelector<SVGSVGElement>('#motionloom-drawing-overlay');
    const gpuCanvas = document.querySelector<HTMLCanvasElement>('#motionloom-canvas-webgpu');
    const fallbackCanvas = document.querySelector<HTMLCanvasElement>('#motionloom-canvas');
    const panelSelect = document.querySelector<HTMLSelectElement>('#scene-tool-panel-select');
    if (!panel || !editor || !overlay || panel.dataset.installed === 'true') return;
    panel.dataset.installed = 'true';
    panel.innerHTML = `
      <div class="drawing-tools-shell">
        <div class="drawing-tool-rail" role="toolbar" aria-label="Vector tools">
          ${([
            ['selection', '↖', 'Selection', 'V'], ['direct', '◇', 'Direct', 'A'], ['pen', '⌁', 'Pen', 'P'],
            ['brush', '╱', 'Brush', 'B'], ['width', '↔', 'Width', '⇧W'], ['shape', '○', 'Shapes', 'M'],
            ['hand', '✋', 'Hand', 'H'], ['zoom', '⌕', 'Zoom', 'Z'],
          ] as const).map(([tool, icon, label, key]) => `<button type="button" data-drawing-tool="${tool}" data-tooltip="${label} (${key})" aria-label="${label} (${key})" aria-pressed="${tool === 'selection'}"><span class="drawing-tool-icon">${icon}</span><span class="drawing-tool-copy"><b>${label}</b><small>${key}</small></span></button>`).join('')}
        </div>
        <div class="drawing-properties">
          <div class="drawing-command-bar">
            <strong id="drawing-active-tool">Selection Tool · V</strong><span id="drawing-zoom-label">100%</span><span id="drawing-active-path-state">No active path</span>
            <button type="button" id="drawing-undo">Undo</button><button type="button" id="drawing-redo">Redo</button>
            <button type="button" id="drawing-finish">Finish / New Path</button><button type="button" id="drawing-duplicate">Duplicate</button><button type="button" id="drawing-delete">Delete</button>
          </div>
          <div class="drawing-editor-layout">
            <div>
              <div class="drawing-property-grid">
                <label><span>Fill · HEX / RGBA</span><input id="drawing-fill" type="text" value="#D8FF2F" /></label>
                <label><span>Stroke · HEX / RGBA</span><input id="drawing-stroke" type="text" value="#11130F" /></label>
                <div class="drawing-mini-actions"><button id="drawing-swap-colors" type="button">Swap Fill / Stroke</button><button id="drawing-no-fill" type="button">No Fill</button></div>
                <label><span>Stroke Width</span><input id="drawing-stroke-width" type="number" value="8" min="0" step="0.5" /></label>
                <label><span>Opacity</span><input id="drawing-opacity" type="number" value="1" min="0" max="1" step="0.05" /></label>
                <label><span>Width Start</span><input id="drawing-width-start" type="number" value="1" min="0.02" max="8" step="0.05" /></label>
                <label><span>Width End</span><input id="drawing-width-end" type="number" value="1" min="0.02" max="8" step="0.05" /></label>
                <label class="drawing-wide-field"><span>Width Profile · offset:width</span><input id="drawing-width-profile" type="text" value="" placeholder="0:0.2, 0.5:1.4, 1:0.05" /></label>
                <label><span>Shape</span><select id="drawing-shape"><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option></select></label>
                <label class="drawing-checkbox"><input id="drawing-closed" type="checkbox" /><span>Close Pen Path</span></label>
                <div class="drawing-anchor-actions"><span>Anchor Convert</span><button type="button" data-anchor-mode="corner">Corner</button><button type="button" data-anchor-mode="smooth">Smooth</button><button type="button" data-anchor-mode="symmetric">Symmetric</button></div>
              </div>
              <p id="drawing-status">${toolMeta.selection[2]}</p>
            </div>
            <aside class="drawing-layers-panel"><div><strong>Layers / Group</strong><span>drawing_tools_group</span></div><div id="drawing-layer-list"></div><div class="drawing-layer-actions"><button id="drawing-layer-up" type="button">Move Up</button><button id="drawing-layer-down" type="button">Move Down</button></div></aside>
          </div>
        </div>
      </div>`;

    const model = new MotionLoomDrawingDocument();
    const history = new DrawingHistory();
    const q = <T extends Element>(selector: string) => panel.querySelector<T>(selector)!;
    const sceneControls = document.querySelector<HTMLElement>('#scene-controls-content')!;
    const sq = <T extends Element>(selector: string) => sceneControls.querySelector<T>(selector)!;
    const fillInput = q<HTMLInputElement>('#drawing-fill');
    const strokeInput = q<HTMLInputElement>('#drawing-stroke');
    const strokeWidthInput = q<HTMLInputElement>('#drawing-stroke-width');
    const opacityInput = q<HTMLInputElement>('#drawing-opacity');
    const widthStartInput = q<HTMLInputElement>('#drawing-width-start');
    const widthEndInput = q<HTMLInputElement>('#drawing-width-end');
    const widthProfileInput = q<HTMLInputElement>('#drawing-width-profile');
    const closedInput = q<HTMLInputElement>('#drawing-closed');
    const shapeSelect = q<HTMLSelectElement>('#drawing-shape');
    const status = q<HTMLElement>('#drawing-status');
    const activeToolLabel = q<HTMLElement>('#drawing-active-tool');
    const zoomLabel = q<HTMLElement>('#drawing-zoom-label');
    const activePathState = q<HTMLElement>('#drawing-active-path-state');
    const layerList = q<HTMLElement>('#drawing-layer-list');
    const semanticCounts = [...document.querySelectorAll<HTMLOutputElement>('[data-semantic-count]')];
    const semanticModeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-semantic-mode]')];
    const semanticDeleteButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-delete-semantic]')];
    const semanticColor = sq<HTMLInputElement>('#drawing-semantic-color');
    const semanticAdjacency = sq<HTMLInputElement>('#drawing-semantic-adjacency');
    const semanticZ = sq<HTMLInputElement>('#drawing-semantic-z');
    const semanticScore = sq<HTMLInputElement>('#drawing-semantic-score');
    const semanticGroupId = sq<HTMLInputElement>('#drawing-semantic-group-id');
    const semanticStatus = sq<HTMLElement>('#scene-selection-status');
    const semanticPathState = sq<HTMLOutputElement>('#drawing-semantic-path-state');
    const semanticSplitButton = sq<HTMLButtonElement>('#drawing-split-semantic-path');
    const semanticLocateButton = sq<HTMLButtonElement>('#drawing-locate-semantic');
    const toolButtons = [...panel.querySelectorAll<HTMLButtonElement>('[data-drawing-tool]')];
    let tool: DrawingTool = 'selection';
    let panelActive = panelSelect?.value === 'drawing-tools';
    let sceneSelectionActive = panelSelect?.value === 'scene-controls';
    let pointerId: number | null = null;
    let pointerStart: DrawingPoint | null = null;
    let previousPoint: DrawingPoint | null = null;
    let anchorIndex = -1;
    let selectedAnchorIndex = -1;
    let handleKind: 'in' | 'out' | null = null;
    let transformHandle = '';
    let transformCenter = { x: 0, y: 0 };
    let widthEdge: 'start' | 'end' = 'end';
    let widthOrigin = 1;
    let widthOffset = 1;
    let shapeDraftEnd: DrawingPoint | null = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let parseTimer = 0;
    let semanticPaths: SemanticPath[] = [];
    let semanticSelected = new Set<string>();
    let semanticSeedKey: string | null = null;
    let semanticSource = '';
    const semanticGeometryCache = new Map<string, Pick<SemanticPath, 'bounds' | 'samples'>>();
    let semanticPointer = false;
    type SemanticMode = 'click' | 'marquee' | 'lasso' | 'unselect';
    let semanticMode: SemanticMode = 'click';
    let semanticDrag: DrawingPoint[] = [];
    let semanticDragRemove = false;
    let semanticDragAdd = false;
    let semanticCycle = { x: Number.NaN, y: Number.NaN, index: -1, keys: [] as string[] };

    const semanticOptions = () => ({
      colorTolerance: Math.max(0, finiteNumber(semanticColor.value, 56)),
      adjacency: Math.max(0, finiteNumber(semanticAdjacency.value, 12)),
      zWindow: Math.max(0, Math.round(finiteNumber(semanticZ.value, 64))),
      scoreThreshold: Math.min(1, Math.max(0, finiteNumber(semanticScore.value, 0.52))),
    });

    const refreshSemanticIndex = (preserveSelection = true) => {
      if (semanticSource !== editor.value) semanticGeometryCache.clear();
      semanticPaths = indexSemanticPaths(editor.value);
      semanticSource = editor.value;
      if (!preserveSelection) semanticSelected.clear();
      const valid = new Set(semanticPaths.map((path) => path.key));
      semanticSelected = new Set([...semanticSelected].filter((key) => valid.has(key)));
      if (semanticSeedKey && !valid.has(semanticSeedKey)) semanticSeedKey = null;
    };

    const style = (): DrawingStyle => ({
      fill: fillInput.value === 'none' ? 'none' : normalizeDrawingColor(fillInput.value) || '#D8FF2F',
      stroke: normalizeDrawingColor(strokeInput.value) || '#11130F',
      strokeWidth: Math.max(0, finiteNumber(strokeWidthInput.value, 8)),
      opacity: Math.min(1, Math.max(0, finiteNumber(opacityInput.value, 1))),
      closed: closedInput.checked,
    });

    const canvasPoint = (event: PointerEvent): DrawingPoint => {
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(overlay.getScreenCTM()?.inverse());
      return { x: local.x, y: local.y, pressure: event.pressure > 0 ? event.pressure : 0.5 };
    };

    const setViewBox = () => {
      const [w, h] = graphCanvasSize(editor.value);
      overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      [gpuCanvas, fallbackCanvas, overlay].forEach((element) => {
        if (!element) return;
        element.style.transformOrigin = '50% 50%';
        element.style.transform = transform;
      });
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    };

    const pathBounds = (points: DrawingPoint[]) => {
      const xs = points.flatMap((p) => [p.x, p.inX ?? p.x, p.outX ?? p.x]);
      const ys = points.flatMap((p) => [p.y, p.inY ?? p.y, p.outY ?? p.y]);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    };

    const updateFields = () => {
      const path = model.selectedPath();
      if (!path) return;
      fillInput.value = path.style.fill;
      strokeInput.value = path.style.stroke;
      strokeWidthInput.value = String(path.style.strokeWidth);
      opacityInput.value = String(path.style.opacity);
      widthStartInput.value = String(path.widthStart);
      widthEndInput.value = String(path.widthEnd);
      widthProfileInput.value = path.widthProfile.map((point) => `${point.offset}:${point.width}`).join(', ');
      closedInput.checked = path.style.closed;
    };

    const renderLayers = () => {
      layerList.replaceChildren();
      [...model.paths].reverse().forEach((path) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.layerId = path.id;
        button.className = path.id === model.selectedPathId ? 'is-selected' : '';
        button.innerHTML = `<span>${path.kind === 'brush' ? '〰' : '◇'}</span><b>${path.id}</b>`;
        button.addEventListener('click', () => { model.setSelectedPath(path.id); updateFields(); render(); });
        layerList.append(button);
      });
    };

    const render = () => {
      if (semanticSource !== editor.value) refreshSemanticIndex();
      setViewBox();
      overlay.replaceChildren();
      if (sceneSelectionActive) {
        for (const path of semanticPaths) {
          const selected = semanticSelected.has(path.key);
          const hit = svgElement('path', {
            d: path.d,
            transform: affineToSvg(path.matrix),
            fill: path.fill === 'none' ? 'none' : 'rgba(185,255,57,0.001)',
            stroke: selected ? '#B9FF39' : 'rgba(185,255,57,0.001)',
            'stroke-width': selected ? '3' : '14',
            'vector-effect': 'non-scaling-stroke',
            'data-semantic-key': path.key,
            'data-semantic-type': path.nodeType,
            class: `drawing-semantic-hit${selected ? ' is-selected' : ''}`,
          });
          overlay.append(hit);
          const geometryKey = `${path.d}|${affineToSvg(path.matrix)}`;
          const cachedGeometry = semanticGeometryCache.get(geometryKey);
          if (cachedGeometry) {
            path.bounds = cachedGeometry.bounds;
            path.samples = cachedGeometry.samples;
          } else {
            try {
              const bounds = hit.getBBox();
              path.bounds = transformBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, path.matrix);
              const length = hit.getTotalLength();
              const sampleCount = Math.max(8, Math.min(96, Math.ceil(length / 12)));
              path.samples = Array.from({ length: sampleCount + 1 }, (_, index) => {
                const point = hit.getPointAtLength(length * index / sampleCount);
                return {
                  x: path.matrix.a * point.x + path.matrix.c * point.y + path.matrix.e,
                  y: path.matrix.b * point.x + path.matrix.d * point.y + path.matrix.f,
                };
              });
            } catch {
              path.bounds = null;
              path.samples = [];
            }
            semanticGeometryCache.set(geometryKey, { bounds: path.bounds, samples: path.samples });
          }
        }
        if (semanticDrag.length > 1) {
          if (semanticMode === 'marquee') {
            const first = semanticDrag[0], last = semanticDrag[semanticDrag.length - 1];
            overlay.append(svgElement('rect', {
              x: String(Math.min(first.x, last.x)), y: String(Math.min(first.y, last.y)),
              width: String(Math.abs(last.x - first.x)), height: String(Math.abs(last.y - first.y)),
              class: `drawing-semantic-drag${last.x < first.x ? ' is-crossing' : ''}`,
            }));
          } else if (semanticMode === 'lasso') {
            overlay.append(svgElement('polyline', { points: semanticDrag.map((point) => `${point.x},${point.y}`).join(' '), class: 'drawing-semantic-lasso' }));
          }
        }
      }
      if (panelActive) for (const path of model.paths) {
        const selected = path.id === model.selectedPathId;
        const showGeometryPreview = tool === 'pen' || tool === 'brush';
        overlay.append(svgElement('path', {
          d: drawingPathD(path), fill: path.kind === 'pen' && path.style.closed ? path.style.fill : 'none', stroke: path.style.stroke,
          'stroke-width': String(path.style.strokeWidth), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: String(path.style.opacity),
          'data-path-id': path.id,
          class: `drawing-overlay-path${selected ? ' is-selected' : ''}${showGeometryPreview ? ' is-geometry-preview' : ''}`,
        }));
        if (!selected) continue;
        if (tool === 'selection') {
          const b = pathBounds(path.points);
          overlay.append(svgElement('rect', { x: String(b.x), y: String(b.y), width: String(b.width), height: String(b.height), class: 'drawing-selection-box' }));
          const handles = [
            ['nw', b.x, b.y], ['n', b.x + b.width / 2, b.y], ['ne', b.x + b.width, b.y],
            ['w', b.x, b.y + b.height / 2], ['e', b.x + b.width, b.y + b.height / 2],
            ['sw', b.x, b.y + b.height], ['s', b.x + b.width / 2, b.y + b.height], ['se', b.x + b.width, b.y + b.height],
          ] as const;
          handles.forEach(([name, x, y]) => overlay.append(svgElement('rect', { x: String(x - 6), y: String(y - 6), width: '12', height: '12', class: 'drawing-transform-handle', 'data-path-id': path.id, 'data-transform-handle': name })));
          overlay.append(svgElement('line', { x1: String(b.x + b.width / 2), y1: String(b.y), x2: String(b.x + b.width / 2), y2: String(b.y - 34), class: 'drawing-handle-line' }));
          overlay.append(svgElement('circle', { cx: String(b.x + b.width / 2), cy: String(b.y - 40), r: '8', class: 'drawing-rotate-handle', 'data-path-id': path.id, 'data-transform-handle': 'rotate' }));
        }
        if (tool === 'direct' || tool === 'pen') path.points.forEach((point, index) => {
          if (point.inX !== undefined && point.inY !== undefined) {
            overlay.append(svgElement('line', { x1: String(point.x), y1: String(point.y), x2: String(point.inX), y2: String(point.inY), class: 'drawing-handle-line' }));
            overlay.append(svgElement('circle', { cx: String(point.inX), cy: String(point.inY), r: '6', class: 'drawing-handle-point', 'data-path-id': path.id, 'data-anchor-index': String(index), 'data-handle': 'in' }));
          }
          if (point.outX !== undefined && point.outY !== undefined) {
            overlay.append(svgElement('line', { x1: String(point.x), y1: String(point.y), x2: String(point.outX), y2: String(point.outY), class: 'drawing-handle-line' }));
            overlay.append(svgElement('circle', { cx: String(point.outX), cy: String(point.outY), r: '6', class: 'drawing-handle-point', 'data-path-id': path.id, 'data-anchor-index': String(index), 'data-handle': 'out' }));
          }
          overlay.append(svgElement('circle', { cx: String(point.x), cy: String(point.y), r: '7', class: 'drawing-anchor-point', 'data-path-id': path.id, 'data-anchor-index': String(index) }));
        });
        if (tool === 'width') {
          const widthPoints = path.widthProfile.length
            ? path.widthProfile
            : [{ offset: 0, width: path.widthStart }, { offset: 1, width: path.widthEnd }];
          widthPoints.forEach((profilePoint, index) => {
            const pointIndex = Math.round(profilePoint.offset * Math.max(0, path.points.length - 1));
            const point = path.points[pointIndex];
            if (!point) return;
            overlay.append(svgElement('circle', { cx: String(point.x), cy: String(point.y), r: '9', class: 'drawing-width-point', 'data-path-id': path.id, 'data-width-index': String(index) }));
          });
        }
      }
      if (panelActive && tool === 'shape' && pointerStart && shapeDraftEnd) {
        const x = Math.min(pointerStart.x, shapeDraftEnd.x);
        const y = Math.min(pointerStart.y, shapeDraftEnd.y);
        const width = Math.abs(shapeDraftEnd.x - pointerStart.x);
        const height = Math.abs(shapeDraftEnd.y - pointerStart.y);
        const attributes = { class: 'drawing-shape-draft' };
        const draft = shapeSelect.value === 'ellipse'
          ? svgElement('ellipse', { ...attributes, cx: String(x + width / 2), cy: String(y + height / 2), rx: String(width / 2), ry: String(height / 2) })
          : shapeSelect.value === 'line'
            ? svgElement('line', { ...attributes, x1: String(pointerStart.x), y1: String(pointerStart.y), x2: String(shapeDraftEnd.x), y2: String(shapeDraftEnd.y) })
            : svgElement('rect', { ...attributes, x: String(x), y: String(y), width: String(width), height: String(height) });
        overlay.append(draft);
      }
      if (panelActive) renderLayers();
      semanticCounts.forEach((count) => { count.textContent = `${semanticSelected.size} Element${semanticSelected.size === 1 ? '' : 's'}`; });
      window.dispatchEvent(new CustomEvent('motionloom:semantic-selection-change', {
        detail: { count: semanticSelected.size },
      }));
      semanticDeleteButtons.forEach((button) => { button.disabled = semanticSelected.size === 0; });
      const selectedSemanticPaths = semanticPaths.filter((path) => semanticSelected.has(path.key));
      const selectedSemanticPath = selectedSemanticPaths.length === 1 ? selectedSemanticPaths[0] : null;
      const contourCount = selectedSemanticPath ? semanticPathContourCount(selectedSemanticPath) : 0;
      const canSplit = Boolean(selectedSemanticPath && selectedSemanticPath.nodeType.toLowerCase() === 'path' && contourCount > 1);
      semanticLocateButton.disabled = !selectedSemanticPath;
      semanticSplitButton.disabled = !canSplit;
      semanticSplitButton.textContent = canSplit ? `Split ${contourCount} Contours` : 'Needs Knife';
      semanticSplitButton.title = canSplit
        ? `Split ${contourCount} independent M... contours into separate Path elements.`
        : selectedSemanticPath
          ? 'This element has one continuous contour. It needs a Knife cut line, not compound-path splitting.'
          : 'Select one compound Path first.';
      semanticPathState.textContent = selectedSemanticPath
        ? `${selectedSemanticPath.nodeType} · #${selectedSemanticPath.id}${selectedSemanticPath.nodeType.toLowerCase() === 'path' ? ` · ${contourCount || 1} contour${contourCount === 1 ? '' : 's'}` : ''}`
        : semanticSelected.size > 1
          ? `${semanticSelected.size} elements selected. Locate DSL requires exactly one element.`
          : 'Select one element to inspect its DSL source.';
      activePathState.textContent = model.activePathId
        ? `Active: ${model.activePathId}`
        : semanticSelected.size ? `${semanticSelected.size} scene element${semanticSelected.size === 1 ? '' : 's'}` : 'No active path';
      activePathState.classList.toggle('is-active', Boolean(model.activePathId || semanticSelected.size));
    };

    const write = (commit = false, notifyRenderer = true) => {
      editor.value = patchDrawingGroup(editor.value, model.groupDsl());
      if (commit) refreshSemanticIndex(); else semanticSource = editor.value;
      if (notifyRenderer) window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit } }));
    };
    const sync = (commit = false) => { render(); write(commit); };

    const selectTarget = (target: EventTarget | null) => {
      const element = target instanceof SVGElement ? target.closest<SVGElement>('[data-path-id]') : null;
      model.setSelectedPath(element?.dataset.pathId || null);
      updateFields();
      return model.selectedPath();
    };

    const setTool = (next: DrawingTool) => {
      const finishedActivePath = Boolean(model.activePathId);
      tool = next;
      model.finishPath();
      toolButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.drawingTool === tool)));
      activeToolLabel.textContent = `${toolMeta[tool][0]} · ${toolMeta[tool][1]}`;
      status.textContent = toolMeta[tool][2];
      shapeSelect.closest('label')?.classList.toggle('is-emphasized', tool === 'shape');
      render();
      if (finishedActivePath) write(true);
    };

    const applySemanticSelection = (keys: Set<string>, add: boolean, remove: boolean) => {
      if (!add && !remove) semanticSelected.clear();
      for (const key of keys) {
        if (remove) semanticSelected.delete(key);
        else semanticSelected.add(key);
      }
      const first = [...keys][0];
      if (first) semanticSeedKey = first;
    };

    overlay.addEventListener('pointerdown', (event) => {
      if ((!panelActive && !sceneSelectionActive) || event.button !== 0) return;
      const point = canvasPoint(event);
      pointerStart = point;
      previousPoint = point;
      pointerId = event.pointerId;
      overlay.setPointerCapture(event.pointerId);
      if (panelActive && !['hand', 'zoom'].includes(tool)) history.push(model.snapshot());
      const target = event.target instanceof SVGElement ? event.target : null;
      transformHandle = target?.dataset.transformHandle || '';
      if (sceneSelectionActive) {
        if (semanticMode === 'marquee' || semanticMode === 'lasso') {
          semanticPointer = true;
          semanticDrag = [point];
          semanticDragAdd = event.shiftKey;
          semanticDragRemove = event.altKey;
          model.setSelectedPath(null);
          render();
          return;
        }
        const semanticKey = target?.dataset.semanticKey;
        if (semanticKey) {
          semanticPointer = true;
          model.setSelectedPath(null);
          const hitKeys = [...document.elementsFromPoint(event.clientX, event.clientY)]
            .flatMap((element) => element instanceof SVGElement && element.dataset.semanticKey ? [element.dataset.semanticKey] : [])
            .filter((key, index, values) => values.indexOf(key) === index);
          let pickedKey = semanticMode === 'unselect'
            ? hitKeys.find((key) => semanticSelected.has(key)) || ''
            : semanticKey;
          if (semanticMode !== 'unselect' && event.altKey && hitKeys.length > 1) {
            const samePoint = Math.hypot(semanticCycle.x - point.x, semanticCycle.y - point.y) < 6
              && hitKeys.join('|') === semanticCycle.keys.join('|');
            semanticCycle = { x: point.x, y: point.y, keys: hitKeys, index: samePoint ? (semanticCycle.index + 1) % hitKeys.length : 0 };
            pickedKey = hitKeys[semanticCycle.index];
          } else semanticCycle = { x: point.x, y: point.y, keys: hitKeys, index: hitKeys.indexOf(semanticKey) };
          if (semanticMode === 'unselect') {
            if (!pickedKey) {
              semanticStatus.textContent = 'Unselect only removes currently selected elements. Nothing selected was hit.';
              render();
              return;
            }
            semanticSelected.delete(pickedKey);
            const removed = semanticPaths.find((path) => path.key === pickedKey);
            semanticStatus.textContent = `Unselected ${removed?.nodeType || 'element'} “${removed?.id || 'unnamed'}”.`;
            render();
            return;
          }
          if (!event.shiftKey) semanticSelected.clear();
          if (event.shiftKey && semanticSelected.has(pickedKey)) semanticSelected.delete(pickedKey);
          else semanticSelected.add(pickedKey);
          semanticSeedKey = pickedKey;
          const seed = semanticPaths.find((path) => path.key === pickedKey);
          semanticStatus.textContent = `Selected ${seed?.nodeType || 'element'} “${seed?.id || 'unnamed'}”. Use Select Similar or Grow Connected if needed.`;
          render();
          return;
        }
        if (semanticMode !== 'unselect') {
          semanticSelected.clear();
          semanticSeedKey = null;
          semanticStatus.textContent = 'No Scene element selected.';
        } else semanticStatus.textContent = 'Unselect mode only removes selected elements; the current selection is unchanged.';
        render();
        return;
      }
      if (tool === 'selection') {
        selectTarget(target);
        if (event.altKey && model.selectedPath()) model.duplicateSelected(0, 0);
        const selected = model.selectedPath();
        if (selected && transformHandle) {
          const b = pathBounds(selected.points);
          transformCenter = transformHandle === 'rotate'
            ? { x: b.x + b.width / 2, y: b.y + b.height / 2 }
            : {
                x: transformHandle.includes('w') ? b.x + b.width : transformHandle.includes('e') ? b.x : b.x + b.width / 2,
                y: transformHandle.includes('n') ? b.y + b.height : transformHandle.includes('s') ? b.y : b.y + b.height / 2,
              };
        }
      }
      else if (tool === 'direct') {
        selectTarget(target);
        anchorIndex = Number(target?.dataset.anchorIndex ?? -1);
        selectedAnchorIndex = anchorIndex;
        handleKind = (target?.dataset.handle as 'in' | 'out') || null;
      } else if (tool === 'pen') model.addPenAnchor(point, style());
      else if (tool === 'brush') model.beginBrush(point, style());
      else if (tool === 'width') {
        const path = selectTarget(target);
        if (path) {
          const first = path.points[0], last = path.points[path.points.length - 1];
          widthEdge = Math.hypot(point.x - first.x, point.y - first.y) < Math.hypot(point.x - last.x, point.y - last.y) ? 'start' : 'end';
          widthOrigin = widthEdge === 'start' ? path.widthStart : path.widthEnd;
          const explicitIndex = Number(target?.dataset.widthIndex ?? -1);
          if (explicitIndex >= 0 && path.widthProfile[explicitIndex]) {
            widthOffset = path.widthProfile[explicitIndex].offset;
            widthOrigin = path.widthProfile[explicitIndex].width;
          } else {
            let nearestIndex = 0;
            let nearestDistance = Number.POSITIVE_INFINITY;
            path.points.forEach((candidate, index) => {
              const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
              if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
            });
            widthOffset = nearestIndex / Math.max(1, path.points.length - 1);
            widthOrigin = path.widthStart + (path.widthEnd - path.widthStart) * widthOffset;
            model.setSelectedWidthProfilePoint(widthOffset, widthOrigin);
          }
        }
      } else if (tool === 'zoom') {
        zoom = Math.min(8, Math.max(0.25, zoom * (event.altKey ? 0.8 : 1.25)));
        setViewBox();
      }
      render();
    });

    overlay.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId || !previousPoint || !pointerStart) return;
      const point = canvasPoint(event);
      const dx = point.x - previousPoint.x, dy = point.y - previousPoint.y;
      if (sceneSelectionActive && semanticPointer) {
        if (semanticMode !== 'click') {
          if (semanticMode === 'marquee') semanticDrag = [pointerStart, point];
          else if (!semanticDrag.length || Math.hypot(point.x - semanticDrag[semanticDrag.length - 1].x, point.y - semanticDrag[semanticDrag.length - 1].y) >= 3) semanticDrag.push(point);
          render();
        }
        return;
      }
      if (tool === 'selection') {
        const path = model.selectedPath();
        if (path && transformHandle === 'rotate') {
          const previousAngle = Math.atan2(previousPoint.y - transformCenter.y, previousPoint.x - transformCenter.x);
          const nextAngle = Math.atan2(point.y - transformCenter.y, point.x - transformCenter.x);
          model.rotateSelected(transformCenter.x, transformCenter.y, nextAngle - previousAngle);
        } else if (path && transformHandle) {
          const b = pathBounds(path.points);
          const sx = transformHandle.includes('e') ? 1 + dx / Math.max(1, b.width) : transformHandle.includes('w') ? 1 - dx / Math.max(1, b.width) : 1;
          const sy = transformHandle.includes('s') ? 1 + dy / Math.max(1, b.height) : transformHandle.includes('n') ? 1 - dy / Math.max(1, b.height) : 1;
          model.scaleSelected(transformCenter.x, transformCenter.y, sx, sy);
        } else model.moveSelected(dx, dy);
      }
      else if (tool === 'direct' && anchorIndex >= 0) {
        if (handleKind) model.moveHandle(anchorIndex, handleKind, point.x, point.y);
        else model.moveAnchor(anchorIndex, dx, dy);
      } else if (tool === 'pen') model.updateLastPenHandle(point);
      else if (tool === 'brush') {
        if (event.pressure <= 0) point.pressure = Math.min(1, Math.max(0.22, 1.12 - Math.hypot(dx, dy) / 28));
        model.appendBrushPoint(point);
      } else if (tool === 'shape') {
        shapeDraftEnd = point;
      } else if (tool === 'width') {
        const value = widthOrigin + (pointerStart.y - point.y) / 80;
        model.setSelectedWidthProfilePoint(widthOffset, value, 0.001);
        if (widthOffset <= 0.001) model.setSelectedWidth('start', value);
        if (widthOffset >= 0.999) model.setSelectedWidth('end', value);
        updateFields();
      }
      else if (tool === 'hand') { panX += event.movementX; panY += event.movementY; }
      previousPoint = point;
      if (tool !== 'zoom') {
        render();
        if (!['hand', 'shape'].includes(tool)) write(false, tool !== 'pen' && tool !== 'brush');
      }
    });

    const pointerEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId || !pointerStart) return;
      if (semanticPointer) {
        if (semanticMode !== 'click' && semanticDrag.length > 1) {
          const keys = semanticMode === 'marquee'
            ? pathsInMarquee(semanticPaths, semanticDrag[0], semanticDrag[semanticDrag.length - 1])
            : pathsInLasso(semanticPaths, semanticDrag);
          applySemanticSelection(keys, semanticDragAdd, semanticDragRemove);
          semanticStatus.textContent = `${semanticMode === 'marquee' ? 'Marquee' : 'Lasso'} selected ${keys.size} Scene element${keys.size === 1 ? '' : 's'}.`;
        }
        pointerId = null; pointerStart = null; previousPoint = null; semanticPointer = false;
        semanticDrag = []; semanticDragAdd = false; semanticDragRemove = false;
        render();
        return;
      }
      const end = canvasPoint(event);
      if (tool === 'shape' && Math.hypot(end.x - pointerStart.x, end.y - pointerStart.y) > 2) model.createShape(shapeSelect.value as DrawingShape, pointerStart, end, style());
      if (tool === 'brush') model.finishPath();
      pointerId = null; pointerStart = null; previousPoint = null; shapeDraftEnd = null; anchorIndex = -1; handleKind = null; transformHandle = '';
      if (tool === 'pen') { render(); write(false, false); }
      else if (!['hand', 'zoom'].includes(tool)) sync(true);
      else render();
    };
    overlay.addEventListener('pointerup', pointerEnd);
    overlay.addEventListener('pointercancel', pointerEnd);
    overlay.addEventListener('dblclick', (event) => {
      if (tool !== 'pen') return;
      event.preventDefault();
      model.finishPath();
      status.textContent = 'Path finished. The next Pen click starts a new independent Path.';
      sync(true);
    });
    overlay.addEventListener('wheel', (event) => {
      if (!panelActive) return;
      event.preventDefault();
      zoom = Math.min(8, Math.max(0.25, zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
      render();
    }, { passive: false });

    const undo = () => { const snapshot = history.undo(model.snapshot()); if (snapshot) { model.restore(snapshot); sync(true); } };
    const redo = () => { const snapshot = history.redo(model.snapshot()); if (snapshot) { model.restore(snapshot); sync(true); } };
    toolButtons.forEach((button) => button.addEventListener('click', () => setTool(button.dataset.drawingTool as DrawingTool)));
    semanticModeButtons.forEach((button) => button.addEventListener('click', () => {
      semanticMode = button.dataset.semanticMode as SemanticMode;
      semanticModeButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate.dataset.semanticMode === semanticMode)));
      semanticStatus.textContent = semanticMode === 'click'
        ? 'Click exact visible Scene elements. Alt-click cycles overlapping elements.'
        : semanticMode === 'marquee'
          ? 'Drag left-to-right to contain; right-to-left to intersect.'
          : semanticMode === 'lasso'
            ? 'Draw a freeform lasso around the Scene elements to select.'
            : 'Click currently selected Scene elements to remove them. Unselected elements and empty space are ignored.';
      render();
    }));
    q('#drawing-undo').addEventListener('click', undo); q('#drawing-redo').addEventListener('click', redo);
    q('#drawing-finish').addEventListener('click', () => { model.finishPath(); status.textContent = 'Path finished. The next Pen click starts a new independent Path.'; sync(true); });
    const duplicate = () => { if (model.selectedPath()) { history.push(model.snapshot()); model.duplicateSelected(); sync(true); } };
    q('#drawing-duplicate').addEventListener('click', duplicate);
    q('#drawing-delete').addEventListener('click', () => { if (model.selectedPath()) { history.push(model.snapshot()); model.removeSelected(); sync(true); } });
    q('#drawing-layer-up').addEventListener('click', () => { history.push(model.snapshot()); model.reorderSelected(1); sync(true); });
    q('#drawing-layer-down').addEventListener('click', () => { history.push(model.snapshot()); model.reorderSelected(-1); sync(true); });
    sq('#drawing-select-similar').addEventListener('click', () => {
      if (!semanticSeedKey) { semanticStatus.textContent = 'Select one Scene element first to set the similarity seed.'; return; }
      semanticSelected = selectSimilarPaths(semanticPaths, semanticSeedKey, semanticOptions());
      semanticStatus.textContent = `Selected ${semanticSelected.size} elements by gradient, color, shape, adjacency, and z-order.`;
      render();
    });
    sq('#drawing-grow-selection').addEventListener('click', () => {
      if (!semanticSelected.size) { semanticStatus.textContent = 'Select a Scene element first.'; return; }
      semanticSelected = growConnectedSelection(semanticPaths, semanticSelected, semanticOptions());
      semanticStatus.textContent = `Grew selection to ${semanticSelected.size} connected Scene elements.`;
      render();
    });
    sq('#drawing-clear-semantic').addEventListener('click', () => {
      semanticSelected.clear(); semanticSeedKey = null; semanticStatus.textContent = 'Selection cleared.'; render();
    });
    semanticSplitButton.addEventListener('click', () => {
      const result = splitSemanticCompoundPath(editor.value, semanticPaths, semanticSelected);
      if (result.error) { semanticStatus.textContent = result.error; semanticPathState.textContent = result.error; return; }
      window.dispatchEvent(new CustomEvent('motionloom:dsl-history-push', { detail: { source: editor.value } }));
      editor.value = result.source;
      refreshSemanticIndex(false);
      semanticSelected = new Set(semanticPaths.filter((path) => result.ids.includes(path.id)).map((path) => path.key));
      semanticSeedKey = [...semanticSelected][0] || null;
      semanticStatus.textContent = `Split compound Path into ${result.ids.length} independently selectable contours.`;
      render();
      window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit: true } }));
    });
    semanticLocateButton.addEventListener('click', () => {
      const selected = semanticPaths.filter((path) => semanticSelected.has(path.key));
      if (selected.length !== 1) {
        semanticStatus.textContent = 'Select exactly one Scene element to locate its DSL.';
        return;
      }
      const identity = selected[0];
      const freshPaths = indexSemanticPaths(editor.value);
      const path = freshPaths.find((candidate) => (
        candidate.id === identity.id
        && candidate.nodeType.toLowerCase() === identity.nodeType.toLowerCase()
      ));
      if (!path) {
        semanticStatus.textContent = `Could not find <${identity.nodeType} id="${identity.id}"> in the current DSL. Re-select the element and try again.`;
        semanticPathState.textContent = `Missing DSL target · ${identity.nodeType} #${identity.id}`;
        return;
      }
      semanticPaths = freshPaths;
      semanticSource = editor.value;
      semanticSelected = new Set([path.key]);
      semanticSeedKey = path.key;
      semanticStatus.textContent = `Located DSL target <${path.nodeType} id="${path.id}">; the complete tag is selected by exact ID.`;
      render();
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(path.start, path.end, 'backward');
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestAnimationFrame(() => scrollTextareaOffsetIntoView(editor, path.start));
    });
    const deleteSemanticSelection = () => {
      const result = deleteSemanticPaths(editor.value, semanticPaths, semanticSelected);
      if (result.error) { semanticStatus.textContent = result.error; return; }
      window.dispatchEvent(new CustomEvent('motionloom:dsl-history-push', { detail: { source: editor.value } }));
      editor.value = result.source;
      semanticSelected.clear();
      semanticSeedKey = null;
      refreshSemanticIndex(false);
      semanticStatus.textContent = `Deleted ${result.deleted} Scene element${result.deleted === 1 ? '' : 's'} from the MotionLoom DSL.`;
      render();
      window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit: true } }));
    };
    semanticDeleteButtons.forEach((button) => button.addEventListener('click', deleteSemanticSelection));
    sq('#drawing-create-semantic-group').addEventListener('click', () => {
      const result = groupSemanticPaths(editor.value, semanticPaths, semanticSelected, semanticGroupId.value);
      if (result.error) { semanticStatus.textContent = result.error; return; }
      window.dispatchEvent(new CustomEvent('motionloom:dsl-history-push', { detail: { source: editor.value } }));
      editor.value = result.source;
      semanticSelected.clear(); semanticSeedKey = null;
      refreshSemanticIndex(false);
      semanticStatus.textContent = result.linked
        ? `Created linked Group “${result.id}” across ${result.parts} Layers. Scene Controls will edit every part together.`
        : `Created <Group id="${result.id}">. It is now available in Scene Controls.`;
      render();
      window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', { detail: { commit: true, groupId: result.id } }));
    });
    window.addEventListener('motionloom:semantic-combine-request', (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const currentGroupId = String(detail.currentGroupId || '');
      const requestedId = String(detail.combinedGroupId || '');
      const result = combineSemanticSelectionWithGroup(
        editor.value,
        semanticPaths,
        semanticSelected,
        currentGroupId,
        requestedId,
      );
      if (result.error) {
        semanticStatus.textContent = result.error;
        window.dispatchEvent(new CustomEvent('motionloom:semantic-combine-result', {
          detail: { error: result.error },
        }));
        return;
      }
      window.dispatchEvent(new CustomEvent('motionloom:dsl-history-push', { detail: { source: editor.value } }));
      editor.value = result.source;
      semanticSelected.clear();
      semanticSeedKey = null;
      refreshSemanticIndex(false);
      const physical = 'physical' in result && result.physical === true;
      const moved = 'moved' in result ? Number(result.moved) : 0;
      semanticStatus.textContent = physical
        ? `Moved ${moved} selected Scene element${moved === 1 ? '' : 's'} inside Group “${currentGroupId}”; visual transforms were preserved.`
        : `Combined Scene Selection with “${currentGroupId}” as linked Group “${result.id}”.`;
      render();
      window.dispatchEvent(new CustomEvent('motionloom:drawing-dsl-change', {
        detail: { commit: true, groupId: result.id },
      }));
      window.dispatchEvent(new CustomEvent('motionloom:semantic-combine-result', {
        detail: {
          id: result.id,
          currentParts: 'currentParts' in result ? result.currentParts : undefined,
          selectionParts: 'selectionParts' in result ? result.selectionParts : undefined,
          physical,
          moved,
          alreadyInside: 'alreadyInside' in result ? result.alreadyInside : 0,
        },
      }));
    });
    q('#drawing-swap-colors').addEventListener('click', () => { [fillInput.value, strokeInput.value] = [strokeInput.value, fillInput.value === 'none' ? '#11130F' : fillInput.value]; applyStyle(); });
    q('#drawing-no-fill').addEventListener('click', () => { fillInput.value = 'none'; applyStyle(); });
    panel.querySelectorAll<HTMLButtonElement>('[data-anchor-mode]').forEach((button) => button.addEventListener('click', () => {
      if (selectedAnchorIndex < 0 || !model.selectedPath()) { status.textContent = 'Use Direct Selection (A) and select an anchor first.'; return; }
      history.push(model.snapshot());
      model.convertAnchor(selectedAnchorIndex, button.dataset.anchorMode as 'corner' | 'smooth' | 'symmetric');
      sync(true);
    }));

    function applyStyle() {
      const fillValid = fillInput.value === 'none' || Boolean(normalizeDrawingColor(fillInput.value));
      const strokeValid = Boolean(normalizeDrawingColor(strokeInput.value));
      fillInput.classList.toggle('is-invalid', !fillValid); strokeInput.classList.toggle('is-invalid', !strokeValid);
      if (!fillValid || !strokeValid) { status.textContent = 'Use HEX, rgb(), rgba(), or “none” for Fill.'; return; }
      if (!model.selectedPath()) return;
      history.push(model.snapshot()); model.setSelectedStyle(style()); sync(true);
    }
    [fillInput, strokeInput, strokeWidthInput, opacityInput, closedInput].forEach((input) => input.addEventListener('change', applyStyle));
    widthStartInput.addEventListener('change', () => { history.push(model.snapshot()); model.setSelectedWidth('start', finiteNumber(widthStartInput.value, 1)); sync(true); });
    widthEndInput.addEventListener('change', () => { history.push(model.snapshot()); model.setSelectedWidth('end', finiteNumber(widthEndInput.value, 1)); sync(true); });
    widthProfileInput.addEventListener('change', () => {
      const profile = widthProfileInput.value.split(',').flatMap((item) => {
        const [offset, width] = item.trim().split(':').map(Number);
        return Number.isFinite(offset) && Number.isFinite(width) ? [{ offset, width }] : [];
      });
      if (widthProfileInput.value.trim() && profile.length < 2) { widthProfileInput.classList.add('is-invalid'); status.textContent = 'Width Profile needs at least two offset:width points.'; return; }
      widthProfileInput.classList.remove('is-invalid'); history.push(model.snapshot()); model.setSelectedWidthProfile(profile); sync(true);
    });

    window.addEventListener('motionloom:tool-panel-change', ((event: CustomEvent<{ panel: string }>) => {
      panelActive = event.detail.panel === 'drawing-tools';
      sceneSelectionActive = event.detail.panel === 'scene-controls';
      const overlayActive = panelActive || sceneSelectionActive;
      overlay.classList.toggle('hidden', !overlayActive); overlay.classList.toggle('pointer-events-none', !overlayActive); overlay.classList.toggle('pointer-events-auto', overlayActive); render();
    }) as EventListener);
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (sceneSelectionActive && !panelActive && (event.key === 'Delete' || event.key === 'Backspace') && semanticSelected.size) {
        event.preventDefault();
        deleteSemanticSelection();
        return;
      }
      if (!panelActive) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.metaKey || event.ctrlKey) && key === 'd') { event.preventDefault(); duplicate(); return; }
      const shortcuts: Partial<Record<string, DrawingTool>> = { v: 'selection', a: 'direct', p: 'pen', b: 'brush', m: 'shape', h: 'hand', z: 'zoom' };
      if (event.shiftKey && key === 'w') setTool('width'); else if (shortcuts[key]) setTool(shortcuts[key]!);
      if (event.key === 'Enter' && tool === 'pen') { model.finishPath(); sync(true); }
      if (event.key === 'Escape' && tool === 'pen') { model.finishPath(); status.textContent = 'Active Path ended. No geometry was deleted.'; render(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && model.selectedPath()) { event.preventDefault(); history.push(model.snapshot()); model.removeSelected(); sync(true); }
    });
    editor.addEventListener('input', () => { window.clearTimeout(parseTimer); parseTimer = window.setTimeout(() => {
      const snapshot = parseDrawingGroup(editor.value);
      if (snapshot) model.restore(snapshot);
      refreshSemanticIndex(); updateFields(); render();
    }, 120); });
    window.addEventListener('motionloom:dsl-source-change', () => {
      const snapshot = parseDrawingGroup(editor.value);
      if (snapshot) model.restore(snapshot);
      refreshSemanticIndex();
      updateFields();
      render();
    });

    const initial = parseDrawingGroup(editor.value); if (initial) model.restore(initial);
    refreshSemanticIndex(false);
    setTool('selection');
    window.dispatchEvent(new CustomEvent('motionloom:tool-panel-change', { detail: { panel: panelSelect?.value || 'scene-controls' } }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
}
