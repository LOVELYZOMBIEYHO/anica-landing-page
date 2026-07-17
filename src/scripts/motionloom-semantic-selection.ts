export type SemanticBounds = { x: number; y: number; width: number; height: number };

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };

type SemanticParent = {
  tag: 'group' | 'layer';
  id: string;
  start: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  parent: SemanticParent | null;
  matrix: Affine;
};

export type SemanticPath = {
  key: string;
  id: string;
  nodeType: string;
  d: string;
  fill: string;
  stroke: string;
  paintKey: string;
  gradientId: string | null;
  gradientSignature: string;
  color: [number, number, number] | null;
  oklab: [number, number, number] | null;
  opacity: number;
  strokeWidth: number;
  order: number;
  start: number;
  end: number;
  parent: SemanticParent | null;
  matrix: Affine;
  bounds: SemanticBounds | null;
  samples: Array<{ x: number; y: number }>;
};

const SELECTABLE_NODES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'text', 'curve', 'polygon', 'image', 'svg']);

export type SemanticSelectionOptions = {
  colorTolerance: number;
  adjacency: number;
  zWindow: number;
  scoreThreshold: number;
};

const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

const translate = (x: number, y: number): Affine => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
const scale = (x: number, y: number): Affine => ({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 });

function rotate(degrees: number): Affine {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

function skew(xDegrees: number, yDegrees: number): Affine {
  return { a: 1, b: Math.tan(yDegrees * Math.PI / 180), c: Math.tan(xDegrees * Math.PI / 180), d: 1, e: 0, f: 0 };
}

function attributes(tag: string) {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1]] = match[2];
  return result;
}

function constantNumber(value: string | undefined, fallback: number) {
  if (!value || /curve\s*\(|\{/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localGroupMatrix(attrs: Record<string, string>) {
  const x = constantNumber(attrs.x, 0);
  const y = constantNumber(attrs.y, 0);
  const uniform = Math.max(0.001, constantNumber(attrs.scale, 1));
  const scaleX = uniform * constantNumber(attrs.scaleX ?? attrs.scale_x, 1);
  const scaleY = uniform * constantNumber(attrs.scaleY ?? attrs.scale_y, 1);
  const originX = constantNumber(attrs.transformOriginX ?? attrs.transform_origin_x, 0);
  const originY = constantNumber(attrs.transformOriginY ?? attrs.transform_origin_y, 0);
  const rotation = constantNumber(attrs.rotation, 0);
  const skewX = constantNumber(attrs.skewX ?? attrs.skew_x, 0);
  const skewY = constantNumber(attrs.skewY ?? attrs.skew_y, 0);
  return multiply(
    multiply(
      multiply(
        multiply(
          multiply(translate(x, y), translate(originX, originY)),
          rotate(rotation),
        ),
        skew(skewX, skewY),
      ),
      scale(scaleX, scaleY),
    ),
    translate(-originX, -originY),
  );
}

function parseColor(value: string): [number, number, number] | null {
  const color = value.trim();
  const short = color.match(/^#([0-9a-f]{3})$/i);
  if (short) return short[1].split('').map((part) => Number.parseInt(`${part}${part}`, 16)) as [number, number, number];
  const hex = color.match(/^#([0-9a-f]{6})[0-9a-f]{0,2}$/i);
  if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex[1].slice(index, index + 2), 16)) as [number, number, number];
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((channel) => Math.max(0, Math.min(255, channel))) as [number, number, number];
}

type GradientDetails = { color: [number, number, number]; signature: string };

function gradientDetails(source: string) {
  const result = new Map<string, GradientDetails>();
  for (const match of source.matchAll(/<(?:LinearGradient|RadialGradient)\b[^>]*\bid=["']([^"']+)["'][^>]*\bstops=["']([^"']+)["'][^>]*\/?\s*>/gi)) {
    const type = /^<LinearGradient/i.test(match[0]) ? 'linear' : 'radial';
    const attrs = attributes(match[0]);
    const colors = match[2].split(',').flatMap((stop) => {
      const separator = stop.indexOf(':');
      const color = separator >= 0 ? parseColor(stop.slice(separator + 1).trim()) : null;
      return color ? [color] : [];
    });
    if (!colors.length) continue;
    const color = [0, 1, 2].map((channel) => colors.reduce((sum, value) => sum + value[channel], 0) / colors.length) as [number, number, number];
    const stops = match[2].split(',').map((stop) => {
      const [offset = '', value = ''] = stop.split(':');
      return `${Number(offset.trim()).toFixed(3)}:${value.trim().toLowerCase()}`;
    }).join('|');
    const geometry = type === 'linear'
      ? [attrs.x1, attrs.y1, attrs.x2, attrs.y2].map((value) => Number(value || 0).toFixed(2)).join(':')
      : [attrs.cx, attrs.cy, attrs.r].map((value) => Number(value || 0).toFixed(2)).join(':');
    result.set(match[1], { color, signature: `${type}:${geometry}:${stops}` });
  }
  return result;
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(color: [number, number, number]): [number, number, number] {
  const [r, g, b] = color.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function paintDetails(fill: string, stroke: string, gradients: Map<string, GradientDetails>) {
  const paint = fill && fill !== 'none' ? fill : stroke;
  const gradient = paint.match(/^url\(\s*#([^)\s]+)\s*\)$/i)?.[1] || null;
  const details = gradient ? gradients.get(gradient) : null;
  const color = details?.color || (gradient ? null : parseColor(paint));
  return {
    paintKey: gradient ? `gradient:${gradient}` : `color:${paint.toLowerCase()}`,
    gradientId: gradient,
    gradientSignature: details?.signature || '',
    color,
    oklab: color ? rgbToOklab(color) : null,
  };
}

function primitivePathData(lower: string, attrs: Record<string, string>) {
  const number = (name: string, fallback = 0) => constantNumber(attrs[name], fallback);
  if (lower === 'path') return attrs.d || '';
  if (lower === 'rect' || lower === 'image' || lower === 'svg') {
    const x = number('x'), y = number('y'), width = number('width'), height = number('height');
    return width > 0 && height > 0 ? `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z` : '';
  }
  if (lower === 'circle') {
    const x = number('x', number('cx')), y = number('y', number('cy')), radius = number('radius', number('r'));
    return radius > 0 ? `M ${x - radius} ${y} A ${radius} ${radius} 0 1 0 ${x + radius} ${y} A ${radius} ${radius} 0 1 0 ${x - radius} ${y} Z` : '';
  }
  if (lower === 'ellipse') {
    const x = number('x', number('cx')), y = number('y', number('cy'));
    const radiusX = number('radiusX', number('rx')), radiusY = number('radiusY', number('ry'));
    return radiusX > 0 && radiusY > 0 ? `M ${x - radiusX} ${y} A ${radiusX} ${radiusY} 0 1 0 ${x + radiusX} ${y} A ${radiusX} ${radiusY} 0 1 0 ${x - radiusX} ${y} Z` : '';
  }
  if (lower === 'line') return `M ${number('x1')} ${number('y1')} L ${number('x2')} ${number('y2')}`;
  if (lower === 'text') {
    const x = number('x'), y = number('y'), fontSize = Math.max(1, number('fontSize', number('font-size', 16)));
    const width = Math.max(fontSize * 0.5, (attrs.value || '').length * fontSize * 0.56);
    return `M ${x} ${y - fontSize} H ${x + width} V ${y + fontSize * 0.22} H ${x} Z`;
  }
  const coordinates = (attrs.points || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  if ((lower === 'curve' || lower === 'polygon') && coordinates.length >= 4) {
    const points = Array.from({ length: Math.floor(coordinates.length / 2) }, (_, index) => `${coordinates[index * 2]} ${coordinates[index * 2 + 1]}`);
    return `M ${points[0]} ${points.slice(1).map((point) => `L ${point}`).join(' ')}${lower === 'polygon' ? ' Z' : ''}`;
  }
  return '';
}

export function affineToSvg(matrix: Affine) {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
}

export function transformBounds(bounds: SemanticBounds, matrix: Affine): SemanticBounds {
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
  ].map(([x, y]) => ({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function indexSemanticPaths(source: string): SemanticPath[] {
  const gradients = gradientDetails(source);
  const paths: SemanticPath[] = [];
  const stack: Array<{ tag: string; excluded: boolean; matrix: Affine; group: SemanticParent | null; openedGroup: SemanticParent | null }> = [];
  const token = /<\/?[A-Za-z][\w-]*\b[^>]*>/g;
  let match: RegExpExecArray | null;
  let order = 0;
  while ((match = token.exec(source))) {
    const raw = match[0];
    const close = /^<\//.test(raw);
    const tag = raw.match(/^<\/?([A-Za-z][\w-]*)/)?.[1] || '';
    const lower = tag.toLowerCase();
    if (close) {
      const entry = stack.pop();
      if (entry?.openedGroup) {
        entry.openedGroup.closeStart = match.index;
        entry.openedGroup.closeEnd = token.lastIndex;
      }
      continue;
    }
    const parent = stack[stack.length - 1];
    const excludedTag = ['defs', 'mask', 'precompose', 'component', 'filter'].includes(lower);
    const attrs = attributes(raw);
    const excluded = Boolean(parent?.excluded || excludedTag || attrs.id === 'drawing_tools_group');
    const parentMatrix = parent?.matrix || IDENTITY;
    if (SELECTABLE_NODES.has(lower) && !excluded) {
      const d = primitivePathData(lower, attrs);
      if (!d) continue;
      const id = attrs.id || `semantic_${lower}_${String(order + 1).padStart(4, '0')}`;
      const defaultFill = ['line', 'curve'].includes(lower) ? 'none' : '#000000';
      const paint = paintDetails(attrs.fill ?? attrs.color ?? defaultFill, attrs.stroke ?? (defaultFill === 'none' ? '#000000' : 'none'), gradients);
      paths.push({
        key: `${id}@@${order}`,
        id,
        nodeType: tag,
        d,
        fill: attrs.fill ?? attrs.color ?? defaultFill,
        stroke: attrs.stroke ?? (defaultFill === 'none' ? '#000000' : 'none'),
        opacity: Math.max(0, Math.min(1, constantNumber(attrs.opacity, 1))),
        strokeWidth: Math.max(0, constantNumber(attrs.strokeWidth ?? attrs['stroke-width'], 1)),
        ...paint,
        order,
        start: match.index,
        end: token.lastIndex,
        parent: parent?.group || null,
        matrix: parentMatrix,
        bounds: null,
        samples: [],
      });
      order += 1;
    }
    if (/\/>\s*$/.test(raw)) continue;
    if (lower === 'group' || lower === 'layer') {
      const matrix = lower === 'group'
        ? multiply(parentMatrix, localGroupMatrix(attrs))
        : parentMatrix;
      const group: SemanticParent = {
        tag: lower,
        id: attrs.id || '',
        start: match.index,
        openEnd: token.lastIndex,
        closeStart: -1,
        closeEnd: -1,
        parent: parent?.group || null,
        matrix,
      };
      stack.push({ tag: lower, excluded, matrix: group.matrix, group, openedGroup: group });
    } else {
      stack.push({ tag: lower, excluded, matrix: parentMatrix, group: parent?.group || null, openedGroup: null });
    }
  }
  return paths;
}

function colorDistance(left: SemanticPath, right: SemanticPath) {
  if (!left.oklab || !right.oklab) return Number.POSITIVE_INFINITY;
  return Math.hypot(left.oklab[0] - right.oklab[0], left.oklab[1] - right.oklab[1], left.oklab[2] - right.oklab[2]) * 442;
}

function boundsDistance(left: SemanticBounds | null, right: SemanticBounds | null) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const dx = Math.max(left.x - (right.x + right.width), right.x - (left.x + left.width), 0);
  const dy = Math.max(left.y - (right.y + right.height), right.y - (left.y + left.height), 0);
  return Math.hypot(dx, dy);
}

export function selectSimilarPaths(paths: SemanticPath[], seedKey: string, options: SemanticSelectionOptions) {
  const seed = paths.find((path) => path.key === seedKey);
  if (!seed) return new Set<string>();
  const selected = new Set<string>([seed.key]);
  for (const candidate of paths) {
    if (candidate.key === seed.key) continue;
    const exactGradient = Boolean(seed.gradientId && seed.gradientId === candidate.gradientId);
    const structuralGradient = Boolean(seed.gradientSignature && seed.gradientSignature === candidate.gradientSignature);
    const color = colorDistance(seed, candidate);
    const proximity = boundsDistance(seed.bounds, candidate.bounds);
    const zDistance = Math.abs(seed.order - candidate.order);
    const sameParent = Boolean(seed.parent?.start !== undefined && seed.parent.start === candidate.parent?.start);
    const seedArea = Math.max(1, (seed.bounds?.width || 0) * (seed.bounds?.height || 0));
    const candidateArea = Math.max(1, (candidate.bounds?.width || 0) * (candidate.bounds?.height || 0));
    const areaSimilarity = Math.min(seedArea, candidateArea) / Math.max(seedArea, candidateArea);
    const seedAspect = (seed.bounds?.width || 1) / Math.max(1, seed.bounds?.height || 1);
    const candidateAspect = (candidate.bounds?.width || 1) / Math.max(1, candidate.bounds?.height || 1);
    const aspectSimilarity = Math.min(seedAspect, candidateAspect) / Math.max(seedAspect, candidateAspect);
    const colorScore = Number.isFinite(color) ? Math.max(0, 1 - color / Math.max(1, options.colorTolerance)) : 0;
    const zScore = Math.max(0, 1 - zDistance / Math.max(1, options.zWindow));
    const proximityScore = Math.max(0, 1 - proximity / Math.max(1, options.adjacency * 4));
    const score = colorScore * 0.3
      + (structuralGradient ? 1 : exactGradient ? 0.82 : 0) * 0.18
      + (sameParent ? 1 : 0) * 0.16
      + ((areaSimilarity + aspectSimilarity) / 2) * 0.12
      + zScore * 0.1
      + proximityScore * 0.14;
    if (score >= options.scoreThreshold) selected.add(candidate.key);
  }
  return selected;
}

function sampledDistance(left: SemanticPath, right: SemanticPath) {
  if (!left.samples.length || !right.samples.length) return boundsDistance(left.bounds, right.bounds);
  let nearest = Number.POSITIVE_INFINITY;
  const leftStep = Math.max(1, Math.floor(left.samples.length / 40));
  const rightStep = Math.max(1, Math.floor(right.samples.length / 40));
  for (let i = 0; i < left.samples.length; i += leftStep) {
    for (let j = 0; j < right.samples.length; j += rightStep) {
      nearest = Math.min(nearest, Math.hypot(left.samples[i].x - right.samples[j].x, left.samples[i].y - right.samples[j].y));
    }
  }
  return nearest;
}

export function growConnectedSelection(paths: SemanticPath[], initial: Set<string>, options: SemanticSelectionOptions) {
  const selected = new Set(initial);
  const queue = paths.filter((path) => selected.has(path.key));
  while (queue.length) {
    const current = queue.shift()!;
    for (const candidate of paths) {
      if (selected.has(candidate.key)) continue;
      if (Math.abs(current.order - candidate.order) > options.zWindow) continue;
      if (boundsDistance(current.bounds, candidate.bounds) > options.adjacency * 2) continue;
      if (sampledDistance(current, candidate) > options.adjacency) continue;
      const relatedPaint = current.gradientId === candidate.gradientId || colorDistance(current, candidate) <= options.colorTolerance;
      if (!relatedPaint) continue;
      selected.add(candidate.key);
      queue.push(candidate);
    }
  }
  return selected;
}

function boundsCorners(bounds: SemanticBounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

export function pathsInMarquee(paths: SemanticPath[], start: { x: number; y: number }, end: { x: number; y: number }) {
  const leftToRight = end.x >= start.x;
  const box = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
  const boxRight = box.x + box.width;
  const boxBottom = box.y + box.height;
  return new Set(paths.flatMap((path) => {
    if (!path.bounds) return [];
    const right = path.bounds.x + path.bounds.width;
    const bottom = path.bounds.y + path.bounds.height;
    const contained = path.bounds.x >= box.x && path.bounds.y >= box.y && right <= boxRight && bottom <= boxBottom;
    const boundsIntersect = right >= box.x && path.bounds.x <= boxRight && bottom >= box.y && path.bounds.y <= boxBottom;
    if (leftToRight) return contained ? [path.key] : [];
    if (!boundsIntersect) return [];
    const geometryIntersects = path.samples.some((point) => point.x >= box.x && point.x <= boxRight && point.y >= box.y && point.y <= boxBottom)
      || boundsCorners(path.bounds).some((point) => point.x >= box.x && point.x <= boxRight && point.y >= box.y && point.y <= boxBottom);
    return geometryIntersects ? [path.key] : [];
  }));
}

export function pathsInLasso(paths: SemanticPath[], polygon: Array<{ x: number; y: number }>) {
  if (polygon.length < 3) return new Set<string>();
  return new Set(paths.flatMap((path) => {
    if (!path.bounds) return [];
    const center = { x: path.bounds.x + path.bounds.width / 2, y: path.bounds.y + path.bounds.height / 2 };
    const insideSamples = path.samples.filter((point) => pointInPolygon(point, polygon)).length;
    const sampleRatio = insideSamples / Math.max(1, path.samples.length);
    const inside = pointInPolygon(center, polygon) || sampleRatio >= 0.35;
    return inside ? [path.key] : [];
  }));
}

function safeId(value: string) {
  const id = value.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return id && !/^\d/.test(id) ? id : `semantic_${id || 'group'}`;
}

export function deleteSemanticPaths(source: string, paths: SemanticPath[], selectedKeys: Set<string>) {
  const ranges = paths
    .filter((path) => selectedKeys.has(path.key))
    .map((path) => ({ start: path.start, end: path.end }))
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((range, index, all) => !all.some((candidate, candidateIndex) => (
      candidateIndex < index && range.start >= candidate.start && range.end <= candidate.end
    )));
  if (!ranges.length) return { source, error: 'Select at least one Scene element.', deleted: 0 };

  let output = source;
  for (const range of [...ranges].reverse()) {
    output = `${output.slice(0, range.start)}${output.slice(range.end)}`;
  }
  return { source: output, error: '', deleted: ranges.length };
}

export function groupSemanticPaths(source: string, paths: SemanticPath[], selectedKeys: Set<string>, requestedId: string) {
  const selected = paths.filter((path) => selectedKeys.has(path.key)).sort((a, b) => a.start - b.start);
  if (!selected.length) return { source, error: 'Select at least one Scene element.' };
  const parentChain = (path: SemanticPath) => {
    const chain: SemanticParent[] = [];
    for (let parent = path.parent; parent; parent = parent.parent) chain.push(parent);
    return chain;
  };
  const commonParent = parentChain(selected[0]).find((parent) => selected.every((path) => parentChain(path).some((candidate) => candidate.start === parent.start)));
  const id = safeId(requestedId);
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`<Group\\b[^>]*(?:\\bid|\\blinkedGroup)=["']${escapedId}["']`, 'i').test(source)) {
    return { source, error: `Group id “${id}” already exists.` };
  }

  const rangesFor = (container: SemanticParent, items: SemanticPath[]) => {
    const ranges = items.map((path) => {
      if (path.parent?.start === container.start) return { start: path.start, end: path.end };
      let branch = path.parent;
      while (branch?.parent && branch.parent.start !== container.start) branch = branch.parent;
      return branch && branch.closeEnd > branch.start
        ? { start: branch.start, end: branch.closeEnd }
        : { start: path.start, end: path.end };
    }).sort((left, right) => left.start - right.start);
    return ranges.filter((range, index) => !ranges.some((candidate, candidateIndex) => candidateIndex < index && range.start >= candidate.start && range.end <= candidate.end));
  };
  const wrapRanges = (input: string, ranges: Array<{ start: number; end: number }>, physicalId: string, linkedId = '') => {
    const selectedDsl = ranges.map((range) => input.slice(range.start, range.end).trim()).join('\n');
    let insertAt = ranges[ranges.length - 1].start;
    let output = input;
    for (const range of [...ranges].reverse()) {
      output = `${output.slice(0, range.start)}${output.slice(range.end)}`;
      if (range.start < insertAt) insertAt -= range.end - range.start;
    }
    const lineStart = output.lastIndexOf('\n', insertAt - 1) + 1;
    const indent = output.slice(lineStart, insertAt).match(/^\s*/)?.[0] || '';
    const children = selectedDsl.split('\n').map((line) => `${indent}  ${line.trim()}`).join('\n');
    const link = linkedId ? ` linkedGroup="${linkedId}"` : '';
    const group = `<Group id="${physicalId}"${link} x="0" y="0" opacity="1">\n${children}\n${indent}</Group>`;
    return `${output.slice(0, insertAt)}${group}${output.slice(insertAt)}`;
  };

  let output = source;
  let linkedParts = 1;
  if (commonParent) {
    output = wrapRanges(output, rangesFor(commonParent, selected), id);
  } else {
    const partitions = new Map<number, { layer: SemanticParent; items: SemanticPath[] }>();
    for (const path of selected) {
      const layer = parentChain(path).find((parent) => parent.tag === 'layer');
      if (!layer) return { source, error: 'Selected elements must be inside Scene Layers.' };
      const partition = partitions.get(layer.start) || { layer, items: [] };
      partition.items.push(path);
      partitions.set(layer.start, partition);
    }
    const operations = [...partitions.values()]
      .map((partition, index) => ({
        ranges: rangesFor(partition.layer, partition.items),
        physicalId: `${id}_part_${String(index + 1).padStart(3, '0')}`,
      }))
      .sort((left, right) => right.ranges[0].start - left.ranges[0].start);
    linkedParts = operations.length;
    for (const operation of operations) {
      output = wrapRanges(output, operation.ranges, operation.physicalId, id);
    }
  }
  return { source: output, id, error: '', linked: linkedParts > 1, parts: linkedParts };
}
