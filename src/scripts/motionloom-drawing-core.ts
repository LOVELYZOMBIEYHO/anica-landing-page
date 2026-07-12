export type DrawingTool = 'selection' | 'direct' | 'pen' | 'brush' | 'width' | 'shape' | 'hand' | 'zoom';
export type DrawingShape = 'rectangle' | 'ellipse' | 'line';

export type DrawingPoint = {
  x: number;
  y: number;
  pressure: number;
  inX?: number;
  inY?: number;
  outX?: number;
  outY?: number;
};

export type DrawingStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  closed: boolean;
};

export type DrawingPath = {
  id: string;
  kind: 'pen' | 'brush';
  points: DrawingPoint[];
  style: DrawingStyle;
  widthStart: number;
  widthEnd: number;
  widthProfile: Array<{ offset: number; width: number }>;
};

export type DrawingSnapshot = {
  paths: DrawingPath[];
  selectedPathId: string | null;
};

const number = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const clonePaths = (paths: DrawingPath[]) => structuredClone(paths);

export function normalizeDrawingColor(input: string): string | null {
  const value = input.trim();
  if (/^#[0-9a-f]{3,4}$/i.test(value) || /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
    return value.toUpperCase();
  }

  const rgba = value.match(/^rgba?\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)(?:\s*,\s*([+-]?[\d.]+)\s*)?\)$/i);
  if (!rgba) return null;
  const channels = rgba.slice(1, 4).map((channel) => Math.round(Math.min(255, Math.max(0, Number(channel)))));
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  const alpha = rgba[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(rgba[4])));
  if (!Number.isFinite(alpha)) return null;
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${number(alpha)})`;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function distance(a: DrawingPoint, b: DrawingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function catmullRomPath(points: DrawingPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${number(points[0].x)} ${number(points[0].y)}`;
  if (points.length === 2) {
    return `M ${number(points[0].x)} ${number(points[0].y)} L ${number(points[1].x)} ${number(points[1].y)}`;
  }
  let output = `M ${number(points[0].x)} ${number(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    output += ` C ${number(cp1x)} ${number(cp1y)} ${number(cp2x)} ${number(cp2y)} ${number(p2.x)} ${number(p2.y)}`;
  }
  return output;
}

export function drawingPathD(path: DrawingPath) {
  if (path.kind === 'brush') return catmullRomPath(path.points);
  if (path.points.length === 0) return '';
  let output = `M ${number(path.points[0].x)} ${number(path.points[0].y)}`;
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const current = path.points[index];
    const cp1x = previous.outX ?? previous.x;
    const cp1y = previous.outY ?? previous.y;
    const cp2x = current.inX ?? current.x;
    const cp2y = current.inY ?? current.y;
    output += ` C ${number(cp1x)} ${number(cp1y)} ${number(cp2x)} ${number(cp2y)} ${number(current.x)} ${number(current.y)}`;
  }
  if (path.style.closed && path.points.length > 2) output += ' Z';
  return output;
}

export class DrawingHistory {
  private undoStack: DrawingSnapshot[] = [];
  private redoStack: DrawingSnapshot[] = [];

  push(snapshot: DrawingSnapshot) {
    this.undoStack.push(structuredClone(snapshot));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(current: DrawingSnapshot) {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;
    this.redoStack.push(structuredClone(current));
    return structuredClone(snapshot);
  }

  redo(current: DrawingSnapshot) {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;
    this.undoStack.push(structuredClone(current));
    return structuredClone(snapshot);
  }
}

export class MotionLoomDrawingDocument {
  paths: DrawingPath[] = [];
  selectedPathId: string | null = null;
  activePathId: string | null = null;
  private nextId = 1;

  snapshot(): DrawingSnapshot {
    return { paths: clonePaths(this.paths), selectedPathId: this.selectedPathId };
  }

  restore(snapshot: DrawingSnapshot) {
    this.paths = clonePaths(snapshot.paths);
    this.selectedPathId = snapshot.selectedPathId;
    this.activePathId = null;
    this.nextId = Math.max(1, ...this.paths.map((path) => Number(path.id.match(/(\d+)$/)?.[1] || 0) + 1));
  }

  selectedPath() {
    return this.paths.find((path) => path.id === this.selectedPathId) || null;
  }

  private newPath(kind: 'pen' | 'brush', point: DrawingPoint, style: DrawingStyle) {
    const id = `drawing_path_${String(this.nextId++).padStart(3, '0')}`;
    const path: DrawingPath = {
      id,
      kind,
      points: [point],
      style: { ...style },
      widthStart: kind === 'brush' ? 0.35 : 1,
      widthEnd: kind === 'brush' ? 0.22 : 1,
      widthProfile: [],
    };
    this.paths.push(path);
    this.selectedPathId = id;
    this.activePathId = id;
    return path;
  }

  addPenAnchor(point: DrawingPoint, style: DrawingStyle) {
    let path = this.paths.find((candidate) => candidate.id === this.activePathId && candidate.kind === 'pen');
    if (!path) path = this.newPath('pen', point, style);
    else path.points.push(point);
    this.selectedPathId = path.id;
    return path;
  }

  updateLastPenHandle(point: DrawingPoint) {
    const path = this.paths.find((candidate) => candidate.id === this.activePathId && candidate.kind === 'pen');
    const anchor = path?.points[path.points.length - 1];
    if (!anchor) return;
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    anchor.outX = anchor.x + dx;
    anchor.outY = anchor.y + dy;
    anchor.inX = anchor.x - dx;
    anchor.inY = anchor.y - dy;
  }

  beginBrush(point: DrawingPoint, style: DrawingStyle) {
    return this.newPath('brush', point, style);
  }

  appendBrushPoint(point: DrawingPoint) {
    const path = this.paths.find((candidate) => candidate.id === this.activePathId && candidate.kind === 'brush');
    if (!path) return;
    const last = path.points[path.points.length - 1];
    if (distance(last, point) >= 0.8) path.points.push(point);
  }

  finishPath() {
    this.activePathId = null;
  }

  removeSelected() {
    if (!this.selectedPathId) return;
    this.paths = this.paths.filter((path) => path.id !== this.selectedPathId);
    this.selectedPathId = null;
    this.activePathId = null;
  }

  setSelectedPath(id: string | null) {
    this.selectedPathId = this.paths.some((path) => path.id === id) ? id : null;
    this.activePathId = null;
  }

  setSelectedWidth(edge: 'start' | 'end', value: number) {
    const path = this.selectedPath();
    if (!path) return;
    const normalized = Math.min(8, Math.max(0.02, value));
    path[edge === 'start' ? 'widthStart' : 'widthEnd'] = normalized;
    if (path.widthProfile.length) this.setSelectedWidthProfilePoint(edge === 'start' ? 0 : 1, normalized, 0.001);
  }

  setSelectedWidthProfilePoint(offset: number, width: number, threshold = 0.06) {
    const path = this.selectedPath();
    if (!path) return;
    const normalizedOffset = Math.min(1, Math.max(0, offset));
    const normalizedWidth = Math.min(16, Math.max(0.02, width));
    const existing = path.widthProfile.find((point) => Math.abs(point.offset - normalizedOffset) <= threshold);
    if (existing) {
      existing.offset = normalizedOffset;
      existing.width = normalizedWidth;
    } else {
      path.widthProfile.push({ offset: normalizedOffset, width: normalizedWidth });
    }
    path.widthProfile.sort((a, b) => a.offset - b.offset);
    if (path.widthProfile.length > 8) path.widthProfile.length = 8;
  }

  setSelectedWidthProfile(profile: Array<{ offset: number; width: number }>) {
    const path = this.selectedPath();
    if (!path) return;
    path.widthProfile = profile
      .map((point) => ({ offset: Math.min(1, Math.max(0, point.offset)), width: Math.min(16, Math.max(0.02, point.width)) }))
      .sort((a, b) => a.offset - b.offset)
      .slice(0, 8);
  }

  setSelectedStyle(style: Partial<DrawingStyle>) {
    const path = this.selectedPath();
    if (!path) return;
    path.style = { ...path.style, ...style };
  }

  moveSelected(dx: number, dy: number) {
    const path = this.selectedPath();
    if (!path) return;
    for (const point of path.points) {
      point.x += dx;
      point.y += dy;
      if (point.inX !== undefined) point.inX += dx;
      if (point.inY !== undefined) point.inY += dy;
      if (point.outX !== undefined) point.outX += dx;
      if (point.outY !== undefined) point.outY += dy;
    }
  }

  moveAnchor(index: number, dx: number, dy: number) {
    const point = this.selectedPath()?.points[index];
    if (!point) return;
    point.x += dx;
    point.y += dy;
    if (point.inX !== undefined) point.inX += dx;
    if (point.inY !== undefined) point.inY += dy;
    if (point.outX !== undefined) point.outX += dx;
    if (point.outY !== undefined) point.outY += dy;
  }

  moveHandle(index: number, handle: 'in' | 'out', x: number, y: number) {
    const point = this.selectedPath()?.points[index];
    if (!point) return;
    if (handle === 'in') {
      point.inX = x;
      point.inY = y;
    } else {
      point.outX = x;
      point.outY = y;
    }
  }

  convertAnchor(index: number, mode: 'corner' | 'smooth' | 'symmetric') {
    const point = this.selectedPath()?.points[index];
    if (!point) return;
    if (mode === 'corner') {
      delete point.inX; delete point.inY; delete point.outX; delete point.outY;
      return;
    }
    const outDx = (point.outX ?? point.x + 36) - point.x;
    const outDy = (point.outY ?? point.y) - point.y;
    const outLength = Math.max(8, Math.hypot(outDx, outDy));
    const unitX = outDx / outLength;
    const unitY = outDy / outLength;
    const inLength = mode === 'symmetric'
      ? outLength
      : Math.max(8, Math.hypot((point.inX ?? point.x - 36) - point.x, (point.inY ?? point.y) - point.y));
    point.outX = point.x + unitX * outLength;
    point.outY = point.y + unitY * outLength;
    point.inX = point.x - unitX * inLength;
    point.inY = point.y - unitY * inLength;
  }

  scaleSelected(originX: number, originY: number, scaleX: number, scaleY: number) {
    const path = this.selectedPath();
    if (!path) return;
    for (const point of path.points) {
      point.x = originX + (point.x - originX) * scaleX;
      point.y = originY + (point.y - originY) * scaleY;
      if (point.inX !== undefined) point.inX = originX + (point.inX - originX) * scaleX;
      if (point.inY !== undefined) point.inY = originY + (point.inY - originY) * scaleY;
      if (point.outX !== undefined) point.outX = originX + (point.outX - originX) * scaleX;
      if (point.outY !== undefined) point.outY = originY + (point.outY - originY) * scaleY;
    }
  }

  rotateSelected(originX: number, originY: number, radians: number) {
    const path = this.selectedPath();
    if (!path) return;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const rotate = (x: number, y: number) => ({ x: originX + (x - originX) * cos - (y - originY) * sin, y: originY + (x - originX) * sin + (y - originY) * cos });
    for (const point of path.points) {
      const anchor = rotate(point.x, point.y); point.x = anchor.x; point.y = anchor.y;
      if (point.inX !== undefined && point.inY !== undefined) { const value = rotate(point.inX, point.inY); point.inX = value.x; point.inY = value.y; }
      if (point.outX !== undefined && point.outY !== undefined) { const value = rotate(point.outX, point.outY); point.outX = value.x; point.outY = value.y; }
    }
  }

  duplicateSelected(offsetX = 20, offsetY = 20) {
    const source = this.selectedPath();
    if (!source) return null;
    const copy = structuredClone(source);
    copy.id = `drawing_path_${String(this.nextId++).padStart(3, '0')}`;
    const index = this.paths.indexOf(source);
    this.paths.splice(index + 1, 0, copy);
    this.selectedPathId = copy.id;
    this.moveSelected(offsetX, offsetY);
    return copy;
  }

  reorderSelected(direction: -1 | 1) {
    const index = this.paths.findIndex((path) => path.id === this.selectedPathId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= this.paths.length) return;
    [this.paths[index], this.paths[next]] = [this.paths[next], this.paths[index]];
  }

  createShape(shape: DrawingShape, start: DrawingPoint, end: DrawingPoint, style: DrawingStyle) {
    let points: DrawingPoint[];
    if (shape === 'line') {
      points = [start, end];
      style = { ...style, closed: false };
    } else if (shape === 'rectangle') {
      points = [
        start,
        { x: end.x, y: start.y, pressure: 1 },
        end,
        { x: start.x, y: end.y, pressure: 1 },
      ];
      style = { ...style, closed: true };
    } else {
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const bottom = Math.max(start.y, end.y);
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const rx = (right - left) / 2;
      const ry = (bottom - top) / 2;
      const k = 0.5522847498;
      points = [
        { x: cx, y: top, pressure: 1, inX: cx - rx * k, inY: top, outX: cx + rx * k, outY: top },
        { x: right, y: cy, pressure: 1, inX: right, inY: cy - ry * k, outX: right, outY: cy + ry * k },
        { x: cx, y: bottom, pressure: 1, inX: cx + rx * k, inY: bottom, outX: cx - rx * k, outY: bottom },
        { x: left, y: cy, pressure: 1, inX: left, inY: cy + ry * k, outX: left, outY: cy - ry * k },
      ];
      style = { ...style, closed: true };
    }
    const path = this.newPath('pen', points[0], style);
    path.points = points;
    this.finishPath();
    return path;
  }

  groupDsl() {
    const paths = this.paths
      .filter((path) => path.points.length >= 2)
      .map((path) => {
        const d = drawingPathD(path);
        const fill = path.kind === 'pen' && path.style.closed ? path.style.fill : 'none';
        const profile = path.widthProfile.length
          ? ` strokeWidthProfile="${path.widthProfile.map((point) => `${number(point.offset)}:${number(point.width)}`).join(', ')}"`
          : '';
        return `  <Path id="${escapeAttribute(path.id)}" d="${escapeAttribute(d)}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(path.style.stroke)}" strokeWidth="${number(path.style.strokeWidth)}" strokeWidthStart="${number(path.widthStart)}" strokeWidthEnd="${number(path.widthEnd)}"${profile} strokePressure="${path.kind === 'brush' ? 'auto' : 'none'}" opacity="${number(path.style.opacity)}" lineCap="round" lineJoin="round" normalize="true" />`;
      })
      .join('\n');
    return `<Group id="drawing_tools_group" x="0" y="0" opacity="1">\n${paths}\n</Group>`;
  }
}

function matchingElementRange(source: string, tagName: string, id: string): [number, number] | null {
  const matcher = new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const match = matcher.exec(source);
  if (!match) return null;
  const start = match.index;
  const token = new RegExp(`<${tagName}\\b[^>]*>|<\\/${tagName}\\s*>`, 'gi');
  token.lastIndex = start;
  let depth = 0;
  let current;
  while ((current = token.exec(source))) {
    if (new RegExp(`^<${tagName}\\b`, 'i').test(current[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) return [start, token.lastIndex];
  }
  return null;
}

function matchingGroupRange(source: string, groupId: string): [number, number] | null {
  return matchingElementRange(source, 'Group', groupId);
}

function drawingTrackDsl(source: string, groupDsl: string) {
  const duration = source.match(/<Graph\b[^>]*\bduration=["']([^"']+)["']/i)?.[1] || '4s';
  const group = groupDsl.split('\n').map((line) => `        ${line}`).join('\n');
  return `<Track id="drawing_tools_track" space="screen" z="1000000">
  <Sequence from="0s" duration="${escapeAttribute(duration)}" out="hold">
    <Layer id="drawing_tools_layer" zDepth="-1000000">
${group}
    </Layer>
  </Sequence>
</Track>`;
}

export function patchDrawingGroup(source: string, groupDsl: string) {
  const trackDsl = drawingTrackDsl(source, groupDsl);
  const existingTrack = matchingElementRange(source, 'Track', 'drawing_tools_track');
  if (existingTrack) return `${source.slice(0, existingTrack[0])}${trackDsl}${source.slice(existingTrack[1])}`;

  const sceneStart = source.search(/<Scene\b/i);
  if (sceneStart < 0) return source;
  const timelineClose = source.indexOf('</Timeline>', sceneStart);
  if (timelineClose < 0) return source;

  // Migrate the original editor format, which inserted the drawing group into the first Layer.
  const legacyGroup = matchingGroupRange(source, 'drawing_tools_group');
  const withoutLegacy = legacyGroup
    ? `${source.slice(0, legacyGroup[0])}${source.slice(legacyGroup[1])}`
    : source;
  const migratedSceneStart = withoutLegacy.search(/<Scene\b/i);
  const migratedTimelineClose = withoutLegacy.indexOf('</Timeline>', migratedSceneStart);
  const indent = withoutLegacy.slice(0, migratedTimelineClose).match(/(^|\n)([ \t]*)[^\n]*$/)?.[2] || '      ';
  const inserted = trackDsl.split('\n').map((line) => `${indent}${line}`).join('\n');
  return `${withoutLegacy.slice(0, migratedTimelineClose)}${inserted}\n${withoutLegacy.slice(migratedTimelineClose)}`;
}

function parseAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) attributes[match[1]] = match[2];
  return attributes;
}

function parseGeneratedPathData(d: string): DrawingPoint[] {
  const tokens = d.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
  const points: DrawingPoint[] = [];
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++].toUpperCase();
    if (command === 'M' || command === 'L') {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y, pressure: 1 });
    } else if (command === 'C') {
      const cp1x = Number(tokens[index++]);
      const cp1y = Number(tokens[index++]);
      const cp2x = Number(tokens[index++]);
      const cp2y = Number(tokens[index++]);
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      const previous = points[points.length - 1];
      if (previous) {
        previous.outX = cp1x;
        previous.outY = cp1y;
      }
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y, pressure: 1, inX: cp2x, inY: cp2y });
    } else if (command !== 'Z') {
      break;
    }
  }
  return points;
}

export function parseDrawingGroup(source: string): DrawingSnapshot | null {
  const range = matchingGroupRange(source, 'drawing_tools_group');
  if (!range) return null;
  const group = source.slice(range[0], range[1]);
  const paths: DrawingPath[] = [];
  for (const match of group.matchAll(/<Path\b[^>]*\/?\s*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const points = parseGeneratedPathData(attributes.d || '');
    if (points.length < 2) continue;
    const kind = attributes.strokePressure === 'auto' ? 'brush' : 'pen';
    paths.push({
      id: attributes.id || `drawing_path_${String(paths.length + 1).padStart(3, '0')}`,
      kind,
      points,
      style: {
        fill: attributes.fill && attributes.fill !== 'none' ? attributes.fill : '#D8FF2F',
        stroke: attributes.stroke || '#11130F',
        strokeWidth: Number(attributes.strokeWidth || 8),
        opacity: Number(attributes.opacity || 1),
        closed: /\bZ\s*$/i.test(attributes.d || ''),
      },
      widthStart: Number(attributes.strokeWidthStart || 1),
      widthEnd: Number(attributes.strokeWidthEnd || 1),
      widthProfile: (attributes.strokeWidthProfile || '').split(',').flatMap((item) => {
        const [offset, width] = item.trim().split(':').map(Number);
        return Number.isFinite(offset) && Number.isFinite(width) ? [{ offset, width }] : [];
      }),
    });
  }
  return { paths, selectedPathId: paths[0]?.id || null };
}

export function graphCanvasSize(source: string): [number, number] {
  const graph = source.match(/<Graph\b[^>]*(?:renderSize|size)=\{\[\s*(\d+)\s*,\s*(\d+)\s*\]\}/i);
  return graph ? [Number(graph[1]), Number(graph[2])] : [1920, 1080];
}
