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

type LayerRange = {
  id: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
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
  role: string | null;
  parent: string | null;
  bindTo: string | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  rotation: number;
  scale: number;
  fixed: boolean;
  start: number;
  end: number;
  raw: string;
};

type MeshVertex = {
  id: string;
  bone: string | null;
  x: number;
  y: number;
  start: number;
  end: number;
  raw: string;
};

type MeshTriangle = {
  id: string;
  a: string;
  b: string;
  c: string;
};

type PuppetMesh = {
  id: string;
  start: number;
  closeStart: number;
  end: number;
  vertices: MeshVertex[];
  triangles: MeshTriangle[];
};

type LimbEnvelope = {
  id: string;
  d: string;
  alphaClip: boolean;
  handFrom: string | null;
  start: number;
  end: number;
  points: MeshPoint[];
};

type LimbRegionRole = 'anchor' | 'joint' | 'control';

type LimbRegion = {
  id: string;
  role: LimbRegionRole;
  d: string;
  alphaClip: boolean;
  start: number;
  end: number;
  points: MeshPoint[];
};

type PuppetBlock = {
  id: string;
  target: string;
  solver: string;
  bend: string;
  jointSoftness: number;
  preserveOutside: boolean;
  width: number;
  height: number;
  density: string;
  start: number;
  openEnd: number;
  rawOpen: string;
  closeStart: number;
  end: number;
  parentGroupId: string | null;
  parentLayerStart: number | null;
  envelope: LimbEnvelope | null;
  regions: LimbRegion[];
  mesh: PuppetMesh | null;
  pins: PuppetPin[];
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_LIMB_REGION_POINTS = 4;

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function parseLayers(source: string): LayerRange[] {
  const token = /<Layer\b[^>]*>|<\/Layer\s*>/gi;
  const stack: Array<Omit<LayerRange, 'closeStart' | 'end'>> = [];
  const result: LayerRange[] = [];
  for (let match = token.exec(source); match; match = token.exec(source)) {
    if (match[0].startsWith('</')) {
      const layer = stack.pop();
      if (!layer) continue;
      result.push({
        ...layer,
        closeStart: match.index,
        end: token.lastIndex,
      });
      continue;
    }
    stack.push({
      id: attr(match[0], 'id') || '',
      start: match.index,
      openEnd: token.lastIndex,
    });
  }
  return result.sort((a, b) => a.start - b.start);
}

function parsePuppets(source: string, groups: GroupRange[], layers: LayerRange[]): PuppetBlock[] {
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
    const parentLayer = layers
      .filter((layer) => layer.start < match.index && layer.end > closeMatch.index)
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
        role: attr(pinMatch[0], 'role'),
        parent: attr(pinMatch[0], 'parent') || attr(pinMatch[0], 'parentId') || attr(pinMatch[0], 'parent_id'),
        bindTo,
        x,
        y,
        targetX: expressionNumberAttr(pinMatch[0], 'targetX', x),
        targetY: expressionNumberAttr(pinMatch[0], 'targetY', y),
        radius: Math.max(1, numberAttr(pinMatch[0], 'radius', 160)),
        rotation: expressionNumberAttr(pinMatch[0], 'rotation'),
        scale: expressionNumberAttr(pinMatch[0], 'scale', 1),
        fixed: /^(true|1|yes)$/i.test(attr(pinMatch[0], 'fixed') || ''),
        start: pinMatch.index,
        end: pinPattern.lastIndex,
        raw: pinMatch[0],
      });
    }
    let envelope: LimbEnvelope | null = null;
    const envelopePattern = /<LimbEnvelope\b[^>]*\/>/gi;
    envelopePattern.lastIndex = open.lastIndex;
    const envelopeMatch = envelopePattern.exec(source);
    if (envelopeMatch && envelopeMatch.index < closeMatch.index) {
      const d = attr(envelopeMatch[0], 'd') || '';
      const numbers = d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) || [];
      const points: MeshPoint[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: numbers[index], y: numbers[index + 1] });
      }
      envelope = {
        id: attr(envelopeMatch[0], 'id') || 'limb_area',
        d,
        alphaClip: !/^(false|0|no)$/i.test(attr(envelopeMatch[0], 'alphaClip') || 'true'),
        handFrom: attr(envelopeMatch[0], 'handFrom') || attr(envelopeMatch[0], 'hand_from'),
        start: envelopeMatch.index,
        end: envelopePattern.lastIndex,
        points,
      };
    }
    const regions: LimbRegion[] = [];
    const regionPattern = /<LimbRegion\b[^>]*\/>/gi;
    regionPattern.lastIndex = open.lastIndex;
    for (
      let regionMatch = regionPattern.exec(source);
      regionMatch && regionMatch.index < closeMatch.index;
      regionMatch = regionPattern.exec(source)
    ) {
      const rawRole = (attr(regionMatch[0], 'role') || '').toLowerCase();
      const role: LimbRegionRole | null = /^(anchor|upper|shoulder)$/.test(rawRole)
        ? 'anchor'
        : /^(joint|elbow)$/.test(rawRole)
          ? 'joint'
          : /^(control|lower|forearm|wrist|hand)$/.test(rawRole)
            ? 'control'
            : null;
      if (!role) continue;
      const d = attr(regionMatch[0], 'd') || '';
      const numbers = d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) || [];
      const points: MeshPoint[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: numbers[index], y: numbers[index + 1] });
      }
      regions.push({
        id: attr(regionMatch[0], 'id') || `limb_${role}_area`,
        role,
        d,
        alphaClip: !/^(false|0|no)$/i.test(attr(regionMatch[0], 'alphaClip') || 'true'),
        start: regionMatch.index,
        end: regionPattern.lastIndex,
        points,
      });
    }
    let mesh: PuppetMesh | null = null;
    const meshOpen = /<MeshTopology\b[^>]*>/gi;
    meshOpen.lastIndex = open.lastIndex;
    const meshMatch = meshOpen.exec(source);
    if (meshMatch && meshMatch.index < closeMatch.index) {
      const meshClose = /<\/MeshTopology\s*>/gi;
      meshClose.lastIndex = meshOpen.lastIndex;
      const meshCloseMatch = meshClose.exec(source);
      if (meshCloseMatch && meshCloseMatch.index < closeMatch.index) {
        const vertices: MeshVertex[] = [];
        const vertexPattern = /<Vertex\b[^>]*\/>/gi;
        vertexPattern.lastIndex = meshOpen.lastIndex;
        for (
          let vertexMatch = vertexPattern.exec(source);
          vertexMatch && vertexMatch.index < meshCloseMatch.index;
          vertexMatch = vertexPattern.exec(source)
        ) {
          vertices.push({
            id: attr(vertexMatch[0], 'id') || `mesh_vertex_${vertices.length + 1}`,
            bone: attr(vertexMatch[0], 'bone') || attr(vertexMatch[0], 'bindTo'),
            x: numberAttr(vertexMatch[0], 'x'),
            y: numberAttr(vertexMatch[0], 'y'),
            start: vertexMatch.index,
            end: vertexPattern.lastIndex,
            raw: vertexMatch[0],
          });
        }
        const triangles: MeshTriangle[] = [];
        const trianglePattern = /<Triangle\b[^>]*\/>/gi;
        trianglePattern.lastIndex = meshOpen.lastIndex;
        for (
          let triangleMatch = trianglePattern.exec(source);
          triangleMatch && triangleMatch.index < meshCloseMatch.index;
          triangleMatch = trianglePattern.exec(source)
        ) {
          triangles.push({
            id: attr(triangleMatch[0], 'id') || `mesh_triangle_${triangles.length + 1}`,
            a: attr(triangleMatch[0], 'a') || '',
            b: attr(triangleMatch[0], 'b') || '',
            c: attr(triangleMatch[0], 'c') || '',
          });
        }
        mesh = {
          id: attr(meshMatch[0], 'id') || 'custom_mesh',
          start: meshMatch.index,
          closeStart: meshCloseMatch.index,
          end: meshClose.lastIndex,
          vertices,
          triangles,
        };
      }
    }
    blocks.push({
      id: attr(match[0], 'id') || `${target || 'character'}_puppet_warp`,
      target,
      solver: (attr(match[0], 'solver') || 'soft').toLowerCase(),
      bend: attr(match[0], 'bend') || 'auto',
      jointSoftness: Math.max(1, numberAttr(match[0], 'jointSoftness', 32)),
      preserveOutside: /^(true|1|yes)$/i.test(attr(match[0], 'preserveOutside') || ''),
      width: Math.max(1, numberAttr(match[0], 'width', 1920)),
      height: Math.max(1, numberAttr(match[0], 'height', 1080)),
      density: attr(match[0], 'density') || 'medium',
      start: match.index,
      openEnd: open.lastIndex,
      rawOpen: match[0],
      closeStart: closeMatch.index,
      end: close.lastIndex,
      parentGroupId: parentGroup?.id || null,
      parentLayerStart: parentLayer?.start ?? null,
      envelope,
      regions,
      mesh,
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

function removeTagAttr(tag: string, name: string): string {
  const pattern = new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  return tag.replace(pattern, '');
}

function replaceOpenTagAttr(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\})`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/\s*>$/, ` ${name}="${escapeAttr(value)}">`);
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

type MeshPoint = { x: number; y: number };

function polygonArea(points: MeshPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function triangleCross(a: MeshPoint, b: MeshPoint, c: MeshPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInTriangle(point: MeshPoint, a: MeshPoint, b: MeshPoint, c: MeshPoint): boolean {
  const ab = triangleCross(a, b, point);
  const bc = triangleCross(b, c, point);
  const ca = triangleCross(c, a, point);
  const hasNegative = ab < -1e-7 || bc < -1e-7 || ca < -1e-7;
  const hasPositive = ab > 1e-7 || bc > 1e-7 || ca > 1e-7;
  return !(hasNegative && hasPositive);
}

// Ear clipping preserves a hand-drawn concave outline, unlike a triangle fan
// which can spill deformation into the face/background around an arm or hair.
function triangulatePolygon(points: MeshPoint[]): Array<[number, number, number]> {
  if (points.length < 3 || Math.abs(polygonArea(points)) < 1e-5) return [];
  const orientation = Math.sign(polygonArea(points));
  const remaining = points.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  let guard = points.length * points.length;
  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index - 1 + remaining.length) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (triangleCross(points[previous], points[current], points[next]) * orientation <= 1e-7) continue;
      const containsVertex = remaining.some((candidate) => (
        candidate !== previous
        && candidate !== current
        && candidate !== next
        && pointInTriangle(points[candidate], points[previous], points[current], points[next])
      ));
      if (containsVertex) continue;
      triangles.push([previous, current, next]);
      remaining.splice(index, 1);
      clipped = true;
      break;
    }
    if (!clipped) return [];
  }
  if (remaining.length === 3) triangles.push([remaining[0], remaining[1], remaining[2]]);
  return triangles;
}

function pointInPolygon(point: MeshPoint, polygon: MeshPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const edgeDx = b.x - a.x;
    const edgeDy = b.y - a.y;
    const pointDx = point.x - a.x;
    const pointDy = point.y - a.y;
    const epsilon = 1e-4;
    if (
      Math.abs(edgeDx * pointDy - edgeDy * pointDx) <= epsilon &&
      point.x >= Math.min(a.x, b.x) - epsilon &&
      point.x <= Math.max(a.x, b.x) + epsilon &&
      point.y >= Math.min(a.y, b.y) - epsilon &&
      point.y <= Math.max(a.y, b.y) + epsilon
    ) {
      return true;
    }
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const edgeX = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (point.x < edgeX) inside = !inside;
  }
  return inside;
}

type CapturedAlphaMesh = {
  points: MeshPoint[];
  triangles: Array<[number, number, number]>;
};

/**
 * Builds a coarse alpha/foreground mesh from the currently rendered artwork.
 * The edge-connected background is flood-filled first, so white details inside
 * an outlined character remain part of the surface instead of disappearing.
 */
async function captureVisibleSurfaceMesh(
  graphWidth: number,
  graphHeight: number,
  density: string,
  source: string,
): Promise<CapturedAlphaMesh | null> {
  const canvases = [
    document.querySelector<HTMLCanvasElement>('#motionloom-canvas-webgpu'),
    document.querySelector<HTMLCanvasElement>('#motionloom-canvas'),
  ].filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas?.width && canvas?.height));
  const canvas = canvases.find((candidate) => Number(getComputedStyle(candidate).opacity) > 0.5)
    || canvases[0];
  if (!canvas) return null;

  const sampleWidth = Math.max(64, Math.min(384, canvas.width));
  const sampleHeight = Math.max(
    64,
    Math.round(sampleWidth * canvas.height / Math.max(1, canvas.width)),
  );
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  let bitmap: ImageBitmap | null = null;
  let objectUrl = '';
  let copied = false;
  try {
    context.clearRect(0, 0, sampleWidth, sampleHeight);
    const cpuCapture = (window as Window & {
      motionloomRenderSceneRgba?: (
        script: string,
        frame?: number,
      ) => Promise<{ rgba: Uint8Array; width: number; height: number }>;
    }).motionloomRenderSceneRgba;
    if (cpuCapture) {
      try {
        const rendered = await cpuCapture(source, 0);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = rendered.width;
        sourceCanvas.height = rendered.height;
        const sourceContext = sourceCanvas.getContext('2d');
        if (sourceContext) {
          const clamped = new Uint8ClampedArray(rendered.rgba.byteLength);
          clamped.set(rendered.rgba);
          sourceContext.putImageData(
            new ImageData(clamped, rendered.width, rendered.height),
            0,
            0,
          );
          context.drawImage(sourceCanvas, 0, 0, sampleWidth, sampleHeight);
          copied = true;
        }
      } catch {
        copied = false;
      }
    }
    // A WebGPU canvas cannot be used as a Canvas2D source reliably on all
    // browsers. Prefer ImageBitmap, then fall back to a PNG snapshot.
    if (!copied && typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(canvas);
        context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);
        copied = true;
      } catch {
        bitmap = null;
      }
    }
    if (!copied) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      copied = true;
    }
  } catch {
    return null;
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  if (!copied) return null;
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const cornerIndices = [
    0,
    sampleWidth - 1,
    (sampleHeight - 1) * sampleWidth,
    sampleHeight * sampleWidth - 1,
  ];
  const background = [0, 1, 2, 3].map((channel) => (
    cornerIndices.reduce((sum, index) => sum + pixels[index * 4 + channel], 0) / cornerIndices.length
  ));
  const backgroundDistance = (index: number) => {
    const offset = index * 4;
    const dr = pixels[offset] - background[0];
    const dg = pixels[offset + 1] - background[1];
    const db = pixels[offset + 2] - background[2];
    const da = pixels[offset + 3] - background[3];
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.25);
  };

  const exterior = new Uint8Array(sampleWidth * sampleHeight);
  const queue = new Int32Array(sampleWidth * sampleHeight);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number) => {
    if (exterior[index] || backgroundDistance(index) > 34) return;
    exterior[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < sampleWidth; x += 1) {
    enqueue(x);
    enqueue((sampleHeight - 1) * sampleWidth + x);
  }
  for (let y = 0; y < sampleHeight; y += 1) {
    enqueue(y * sampleWidth);
    enqueue(y * sampleWidth + sampleWidth - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % sampleWidth;
    const y = Math.floor(index / sampleWidth);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < sampleWidth) enqueue(index + 1);
    if (y > 0) enqueue(index - sampleWidth);
    if (y + 1 < sampleHeight) enqueue(index + sampleWidth);
  }

  let [cols, rows] = puppetGridSize(density);
  // Density describes a target cell size, not a forced square grid. Matching
  // the graph aspect ratio keeps portrait characters just as detailed around
  // shoulders, fingers, and ankles as a landscape subject.
  if (cols === rows) {
    if (graphHeight > graphWidth) {
      rows = Math.min(96, Math.max(rows, Math.round(rows * graphHeight / graphWidth)));
    } else if (graphWidth > graphHeight) {
      cols = Math.min(96, Math.max(cols, Math.round(cols * graphWidth / graphHeight)));
    }
  }
  const cellCols = cols - 1;
  const cellRows = rows - 1;
  const occupied = new Uint8Array(cellCols * cellRows);
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = y * sampleWidth + x;
      if (exterior[index] || pixels[index * 4 + 3] <= 8) continue;
      const col = Math.min(cellCols - 1, Math.floor(x * cellCols / sampleWidth));
      const row = Math.min(cellRows - 1, Math.floor(y * cellRows / sampleHeight));
      occupied[row * cellCols + col] = 1;
    }
  }
  // One-cell dilation is the equivalent of a small mesh expansion: it keeps
  // antialiased outlines and narrow fingers inside the triangulated surface.
  const expanded = occupied.slice();
  for (let row = 0; row < cellRows; row += 1) {
    for (let col = 0; col < cellCols; col += 1) {
      if (!occupied[row * cellCols + col]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nextCol = col + dx;
          const nextRow = row + dy;
          if (nextCol >= 0 && nextCol < cellCols && nextRow >= 0 && nextRow < cellRows) {
            expanded[nextRow * cellCols + nextCol] = 1;
          }
        }
      }
    }
  }
  const occupiedCount = expanded.reduce((sum, value) => sum + value, 0);
  if (occupiedCount < 1 || occupiedCount > expanded.length * 0.92) return null;

  const points: MeshPoint[] = [];
  const pointIndex = new Map<number, number>();
  const triangles: Array<[number, number, number]> = [];
  const ensurePoint = (gridIndex: number) => {
    const existing = pointIndex.get(gridIndex);
    if (existing !== undefined) return existing;
    const col = gridIndex % cols;
    const row = Math.floor(gridIndex / cols);
    const index = points.length;
    points.push({
      x: graphWidth * col / Math.max(1, cols - 1),
      y: graphHeight * row / Math.max(1, rows - 1),
    });
    pointIndex.set(gridIndex, index);
    return index;
  };
  for (let row = 0; row < cellRows; row += 1) {
    for (let col = 0; col < cellCols; col += 1) {
      if (!expanded[row * cellCols + col]) continue;
      const topLeft = row * cols + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + cols;
      const bottomRight = bottomLeft + 1;
      triangles.push([
        ensurePoint(topLeft),
        ensurePoint(topRight),
        ensurePoint(bottomRight),
      ]);
      triangles.push([
        ensurePoint(topLeft),
        ensurePoint(bottomRight),
        ensurePoint(bottomLeft),
      ]);
    }
  }
  return { points, triangles };
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
      <div class="puppet-command-bar" role="toolbar" aria-label="Puppet tools">
        <button id="puppet-tool-select" class="puppet-icon-tool" type="button" aria-label="Select and move pins" title="Select and move pins">
          <span class="puppet-tool-glyph" aria-hidden="true">↖</span><small>Select</small>
        </button>
        <button id="puppet-quick-kind-mesh" class="puppet-icon-tool is-selected" type="button" aria-label="Position pin" title="Position Pin — free surface deformation">
          <span class="puppet-tool-glyph puppet-pin-glyph" aria-hidden="true">●</span><small>Position</small>
        </button>
        <button id="puppet-tool-bend" class="puppet-icon-tool" type="button" aria-label="Bend pin" title="Bend Pin — rotate or scale a local area">
          <span class="puppet-tool-glyph" aria-hidden="true">↻</span><small>Bend</small>
        </button>
        <button id="puppet-quick-kind-ik" class="puppet-icon-tool" type="button" aria-label="Limb IK" title="Limb IK — shoulder, joint, wrist">
          <span class="puppet-tool-glyph" aria-hidden="true">⌁</span><small>Limb IK</small>
        </button>
        <button id="puppet-quick-kind-chain" class="puppet-icon-tool" type="button" aria-label="Chain" title="Chain — hair, tail, rope">
          <span class="puppet-tool-glyph" aria-hidden="true">⛓</span><small>Chain</small>
        </button>
        <button id="puppet-tool-refine" class="puppet-icon-tool" type="button" aria-label="Refine deformation area" title="Refine the exact deformation area">
          <span class="puppet-tool-glyph" aria-hidden="true">⬡</span><small>Refine</small>
        </button>
        <button id="puppet-mode-quick" class="hidden" type="button" aria-hidden="true" tabindex="-1">Layer</button>
        <button id="puppet-mode-isolate" class="hidden" type="button" aria-hidden="true" tabindex="-1">Group</button>
      </div>
      <div class="puppet-target-scope">
        <label><span>Target</span>
          <select id="puppet-target-scope-select">
            <option value="layer">Auto Layer</option>
            <option value="group">Selected Group</option>
          </select>
        </label>
        <label id="puppet-target-group-label" class="hidden"><span>Group</span><select id="puppet-target"></select></label>
        <p id="puppet-target-scope-help">Visible artwork in the current Layer is captured automatically.</p>
      </div>

      <section id="puppet-quick-workflow" class="puppet-quick-workflow" aria-label="Quick Puppet workflow">
        <div class="puppet-quick-heading">
          <div><b>Pin anywhere</b><span>MotionLoom captures the current Layer as one surface. No Group ID is required.</span></div>
          <output id="puppet-quick-target">Finding Layer…</output>
        </div>
        <div id="puppet-quick-ik-controls" class="hidden">
        <ol class="puppet-quick-steps">
          <li id="puppet-quick-step-artwork" class="is-current"><b>1</b><span><strong>Layer</strong><small>Capture all earlier artwork in the current Layer.</small></span></li>
          <li id="puppet-quick-step-anchor"><b>2</b><span><strong>Anchor</strong><small>Click a fixed root, such as a shoulder.</small></span></li>
          <li id="puppet-quick-step-joint"><b>3</b><span><strong>Joint</strong><small>Click a bend point, such as an elbow.</small></span></li>
          <li id="puppet-quick-step-control"><b>4</b><span><strong>Control</strong><small>Click the moving tip, then drag it.</small></span></li>
        </ol>
        <div class="puppet-quick-actions">
          <button id="puppet-quick-start" type="button">Start Quick Puppet</button>
          <button id="puppet-quick-anchor" type="button" disabled>Place Anchor</button>
          <button id="puppet-quick-joint" type="button" disabled>Place Joint</button>
          <button id="puppet-quick-control" type="button" disabled>Place Control</button>
        </div>
        <div class="puppet-mesh-actions">
          <label><span>Active Limb</span>
            <select id="puppet-quick-ik-rig" aria-label="Active Bone IK limb"></select>
          </label>
          <button id="puppet-quick-add-limb" type="button" disabled>Add Another Limb</button>
        </div>
        <div class="puppet-quick-pin-size">
          <div class="puppet-mesh-actions puppet-limb-region-actions">
            <button id="puppet-limb-region-anchor" type="button">Shoulder + Upper Arm</button>
            <button id="puppet-limb-region-joint" type="button">Elbow Overlap</button>
            <button id="puppet-limb-region-control" type="button">Forearm + Hand</button>
            <button id="puppet-limb-envelope-close" type="button" disabled>Close Area</button>
            <button id="puppet-limb-envelope-undo" type="button" disabled>Undo Point</button>
            <button id="puppet-limb-envelope-delete" type="button" disabled>Use Limb Width</button>
          </div>
          <small id="puppet-limb-envelope-state">Draw three small regions: shoulder/upper arm, elbow overlap, then forearm/hand. Each region belongs directly to its Pin.</small>
          <label for="puppet-quick-radius"><span>Limb Width</span><output id="puppet-quick-radius-value">96</output></label>
          <input id="puppet-quick-radius" type="range" min="24" max="320" step="4" value="96" />
          <small>Match this to the visible arm or leg width. It rebuilds the local bone mesh.</small>
          <label for="puppet-quick-bend"><span>Joint Bend</span></label>
          <select id="puppet-quick-bend">
            <option value="auto">Auto</option>
            <option value="1">Counter-clockwise</option>
            <option value="-1">Clockwise</option>
          </select>
          <small id="puppet-quick-bend-help">Lock a side when Anchor, Joint, and Control are nearly in a straight line.</small>
        </div>
        </div>
        <div id="puppet-quick-mesh-controls" class="puppet-quick-mesh-controls">
          <ol class="puppet-quick-steps puppet-mesh-steps">
            <li id="puppet-mesh-step-artwork" class="is-current"><b>1</b><span><strong>Layer</strong><small>Capture the current Layer as one deformable surface.</small></span></li>
            <li id="puppet-mesh-step-surface"><b>2</b><span><strong>Alpha Mesh</strong><small>Triangulate only the visible artwork, not the canvas.</small></span></li>
            <li id="puppet-mesh-step-pins"><b>3</b><span><strong>Position / Bend Pins</strong><small>Add arbitrary controls without naming body joints.</small></span></li>
          </ol>
          <div class="puppet-mesh-actions">
            <button id="puppet-mesh-start" type="button">Build Alpha Mesh</button>
            <button id="puppet-mesh-add-pin" type="button" disabled>Add Position Pin</button>
            <button id="puppet-mesh-add-bend-pin" type="button" disabled>Add Bend Pin</button>
            <button id="puppet-mesh-delete-pin" type="button" disabled>Delete Selected</button>
          </div>
          <div class="puppet-mesh-settings">
            <label><span>Mesh Density</span>
              <select id="puppet-mesh-density">
                <option value="8x8">8 × 8 · Fast</option>
                <option value="12x12">12 × 12</option>
                <option value="16x16">16 × 16 · Fast</option>
                <option value="24x24">24 × 24 · Balanced</option>
                <option value="32x32" selected>32 × 32 · Recommended</option>
                <option value="48x48">48 × 48 · Detailed</option>
              </select>
            </label>
            <label for="puppet-mesh-radius"><span>Selected Pin Radius</span><output id="puppet-mesh-radius-value">48</output></label>
            <input id="puppet-mesh-radius" type="range" min="12" max="240" step="2" value="48" />
            <label for="puppet-mesh-bend-rotation"><span>Selected Bend Rotation</span><output id="puppet-mesh-bend-rotation-value">0°</output></label>
            <input id="puppet-mesh-bend-rotation" type="range" min="-180" max="180" step="1" value="0" />
            <label class="puppet-mesh-checkbox"><input id="puppet-mesh-show" type="checkbox" checked /> Show triangulated mesh</label>
          </div>
          <div class="puppet-mesh-pin-list">
            <div><b>Surface Pins</b><output id="puppet-mesh-pin-count">0</output></div>
            <div id="puppet-quick-pin-list"><p>No pins yet.</p></div>
          </div>
          <p class="puppet-mesh-note">Position Pins can be added anywhere. Dragging a named head, hand, elbow, foot, or knee Pin also moves its nearby support Pins, preventing a connected body mesh from being pulled into a spike. Bend Pins rotate the local mesh.</p>
        </div>
        <div id="puppet-quick-chain-controls" class="puppet-quick-mesh-controls hidden">
          <ol class="puppet-quick-steps puppet-mesh-steps">
            <li><b>1</b><span><strong>Surface</strong><small>Capture only the visible Layer artwork.</small></span></li>
            <li><b>2</b><span><strong>Centerline</strong><small>Click points from the fixed root to the loose tip.</small></span></li>
            <li><b>3</b><span><strong>Chain</strong><small>Finish to create parent-linked pins and SpringChain.</small></span></li>
          </ol>
          <div class="puppet-mesh-actions">
            <button id="puppet-chain-start" type="button">Build Chain Surface</button>
            <button id="puppet-chain-draw" type="button" disabled>Draw Centerline</button>
            <button id="puppet-chain-finish" type="button" disabled>Finish Chain</button>
            <button id="puppet-chain-undo" type="button" disabled>Undo Point</button>
          </div>
          <div class="puppet-mesh-settings">
            <label><span>Mesh Density</span>
              <select id="puppet-chain-density">
                <option value="16x16">16 × 16 · Fast</option>
                <option value="24x24" selected>24 × 24 · Recommended</option>
                <option value="32x32">32 × 32 · Detailed</option>
              </select>
            </label>
            <label for="puppet-chain-stiffness"><span>Stiffness</span><output id="puppet-chain-stiffness-value">0.72</output></label>
            <input id="puppet-chain-stiffness" type="range" min="0.05" max="1" step="0.01" value="0.72" />
            <label for="puppet-chain-damping"><span>Damping</span><output id="puppet-chain-damping-value">0.84</output></label>
            <input id="puppet-chain-damping" type="range" min="0" max="0.99" step="0.01" value="0.84" />
            <label for="puppet-chain-drag"><span>Drag</span><output id="puppet-chain-drag-value">0.18</output></label>
            <input id="puppet-chain-drag" type="range" min="0" max="1" step="0.01" value="0.18" />
            <label for="puppet-chain-overlap"><span>Overlap / Delay</span><output id="puppet-chain-overlap-value">0.12</output></label>
            <input id="puppet-chain-overlap" type="range" min="0" max="0.9" step="0.01" value="0.12" />
            <label class="puppet-mesh-checkbox"><input id="puppet-chain-preserve-length" type="checkbox" checked /> Preserve segment lengths</label>
            <label class="puppet-mesh-checkbox"><input id="puppet-chain-show" type="checkbox" checked /> Show triangulated mesh</label>
          </div>
          <p class="puppet-mesh-note">Use 4–12 centerline points. The first point is fixed; the final point is the controller. Drag the final pin to pose the chain.</p>
        </div>
        <div class="puppet-quick-tip">
          <b id="puppet-quick-tip-title">Ready to rig</b>
          <span id="puppet-quick-tip-copy">Press Start Quick Puppet. No Group ID, mesh setup, or Bind To is required.</span>
        </div>
        <button id="puppet-open-isolate" class="puppet-text-button" type="button">Target only one existing Group →</button>
      </section>

      <div id="puppet-isolate-workflow" class="hidden">
      <div class="puppet-quick-start"><b>Selected Group</b><span>Position Pins now affect only the chosen Group. Use Refine when its automatic mesh needs a tighter outline.</span></div>
      <div class="puppet-tools-grid">
        <section class="puppet-tool-card">
          <h3>Warp Target</h3>
          <p id="puppet-isolate-target-copy">Choose the Group from the Target bar above.</p>
          <label><span>Warp ID</span><input id="puppet-warp-id" type="text" value="character_puppet_warp" /></label>
          <div class="puppet-inline-fields">
            <label><span>Mesh Width</span><input id="puppet-width" type="number" value="1920" /></label>
            <label><span>Mesh Height</span><input id="puppet-height" type="number" value="1080" /></label>
          </div>
          <label><span>Density</span><select id="puppet-density"><option>low</option><option selected>medium</option><option>high</option></select></label>
          <button id="puppet-create-warp" type="button">Create Warp, Then Click Preview</button>
        </section>
        <section class="puppet-tool-card puppet-mesh-card">
          <h3>Custom Mesh</h3>
          <p>Draw the deformation boundary in Preview. The outline is triangulated and saved as DSL MeshTopology.</p>
          <div id="puppet-mesh-state">Auto mesh</div>
          <div class="puppet-action-row">
            <button id="puppet-draw-mesh" type="button">Draw Mesh</button>
            <button id="puppet-close-mesh" type="button" disabled>Close Mesh</button>
          </div>
          <div class="puppet-action-row">
            <button id="puppet-undo-mesh-point" type="button" disabled>Undo Point</button>
            <button id="puppet-delete-mesh" type="button" disabled>Use Auto Mesh</button>
          </div>
          <p id="puppet-mesh-help">Click around an arm, hair lock, eye, or clothing section. Use 4–12 points and avoid crossing the outline.</p>
        </section>
        <section class="puppet-tool-card">
          <h3>Add Pin</h3>
          <label><span>Bind To</span><select id="puppet-bind-target"></select></label>
          <div class="puppet-inline-fields">
            <label><span>Radius</span><input id="puppet-radius" type="number" value="160" min="1" /></label>
            <label><span>Strength</span><input id="puppet-strength" type="number" value="1" min="0" step="0.1" /></label>
          </div>
          <label><span>Falloff</span><select id="puppet-falloff"><option selected>smooth</option><option>rigid</option><option>linear</option><option>hard</option></select></label>
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
      </div>
      <p id="puppet-status">Choose a target Group, then click Preview. The textarea remains the source of truth.</p>
    </div>`;

  const $ = <T extends Element>(selector: string) => panel.querySelector<T>(selector)!;
  const quickModeButton = $<HTMLButtonElement>('#puppet-mode-quick');
  const isolateModeButton = $<HTMLButtonElement>('#puppet-mode-isolate');
  const selectToolButton = $<HTMLButtonElement>('#puppet-tool-select');
  const bendToolButton = $<HTMLButtonElement>('#puppet-tool-bend');
  const refineToolButton = $<HTMLButtonElement>('#puppet-tool-refine');
  const targetScopeSelect = $<HTMLSelectElement>('#puppet-target-scope-select');
  const targetGroupLabel = $<HTMLElement>('#puppet-target-group-label');
  const targetScopeHelp = $<HTMLElement>('#puppet-target-scope-help');
  const quickWorkflow = $<HTMLElement>('#puppet-quick-workflow');
  const isolateWorkflow = $<HTMLElement>('#puppet-isolate-workflow');
  const quickTargetOutput = $<HTMLOutputElement>('#puppet-quick-target');
  const quickIkKindButton = $<HTMLButtonElement>('#puppet-quick-kind-ik');
  const quickMeshKindButton = $<HTMLButtonElement>('#puppet-quick-kind-mesh');
  const quickChainKindButton = $<HTMLButtonElement>('#puppet-quick-kind-chain');
  const quickIkControls = $<HTMLElement>('#puppet-quick-ik-controls');
  const quickMeshControls = $<HTMLElement>('#puppet-quick-mesh-controls');
  const quickChainControls = $<HTMLElement>('#puppet-quick-chain-controls');
  const quickStartButton = $<HTMLButtonElement>('#puppet-quick-start');
  const quickAnchorButton = $<HTMLButtonElement>('#puppet-quick-anchor');
  const quickJointButton = $<HTMLButtonElement>('#puppet-quick-joint');
  const quickControlButton = $<HTMLButtonElement>('#puppet-quick-control');
  const quickIkRigSelect = $<HTMLSelectElement>('#puppet-quick-ik-rig');
  const quickAddLimbButton = $<HTMLButtonElement>('#puppet-quick-add-limb');
  const quickRadiusInput = $<HTMLInputElement>('#puppet-quick-radius');
  const quickRadiusOutput = $<HTMLOutputElement>('#puppet-quick-radius-value');
  const quickBendSelect = $<HTMLSelectElement>('#puppet-quick-bend');
  const quickBendHelp = $<HTMLElement>('#puppet-quick-bend-help');
  const meshStartButton = $<HTMLButtonElement>('#puppet-mesh-start');
  const meshAddPinButton = $<HTMLButtonElement>('#puppet-mesh-add-pin');
  const meshAddBendPinButton = $<HTMLButtonElement>('#puppet-mesh-add-bend-pin');
  const meshDeletePinButton = $<HTMLButtonElement>('#puppet-mesh-delete-pin');
  const meshDensitySelect = $<HTMLSelectElement>('#puppet-mesh-density');
  const meshRadiusInput = $<HTMLInputElement>('#puppet-mesh-radius');
  const meshRadiusOutput = $<HTMLOutputElement>('#puppet-mesh-radius-value');
  const meshBendRotationInput = $<HTMLInputElement>('#puppet-mesh-bend-rotation');
  const meshBendRotationOutput = $<HTMLOutputElement>('#puppet-mesh-bend-rotation-value');
  const meshShowInput = $<HTMLInputElement>('#puppet-mesh-show');
  const chainStartButton = $<HTMLButtonElement>('#puppet-chain-start');
  const chainDrawButton = $<HTMLButtonElement>('#puppet-chain-draw');
  const chainFinishButton = $<HTMLButtonElement>('#puppet-chain-finish');
  const chainUndoButton = $<HTMLButtonElement>('#puppet-chain-undo');
  const chainDensitySelect = $<HTMLSelectElement>('#puppet-chain-density');
  const chainStiffnessInput = $<HTMLInputElement>('#puppet-chain-stiffness');
  const chainDampingInput = $<HTMLInputElement>('#puppet-chain-damping');
  const chainDragInput = $<HTMLInputElement>('#puppet-chain-drag');
  const chainOverlapInput = $<HTMLInputElement>('#puppet-chain-overlap');
  const chainPreserveLengthInput = $<HTMLInputElement>('#puppet-chain-preserve-length');
  const chainShowInput = $<HTMLInputElement>('#puppet-chain-show');
  const quickPinList = $<HTMLElement>('#puppet-quick-pin-list');
  const quickPinCountOutput = $<HTMLOutputElement>('#puppet-mesh-pin-count');
  const quickTipTitle = $<HTMLElement>('#puppet-quick-tip-title');
  const quickTipCopy = $<HTMLElement>('#puppet-quick-tip-copy');
  const targetSelect = $<HTMLSelectElement>('#puppet-target');
  const bindSelect = $<HTMLSelectElement>('#puppet-bind-target');
  const pinList = $<HTMLElement>('#puppet-pin-list');
  const status = $<HTMLElement>('#puppet-status');
  const widthInput = $<HTMLInputElement>('#puppet-width');
  const heightInput = $<HTMLInputElement>('#puppet-height');
  const radiusInput = $<HTMLInputElement>('#puppet-radius');
  const targetXInput = $<HTMLInputElement>('#puppet-target-x');
  const targetYInput = $<HTMLInputElement>('#puppet-target-y');
  const meshState = $<HTMLElement>('#puppet-mesh-state');
  const drawMeshButton = $<HTMLButtonElement>('#puppet-draw-mesh');
  const closeMeshButton = $<HTMLButtonElement>('#puppet-close-mesh');
  const undoMeshPointButton = $<HTMLButtonElement>('#puppet-undo-mesh-point');
  const deleteMeshButton = $<HTMLButtonElement>('#puppet-delete-mesh');
  const drawAnchorRegionButton = $<HTMLButtonElement>('#puppet-limb-region-anchor');
  const drawJointRegionButton = $<HTMLButtonElement>('#puppet-limb-region-joint');
  const drawControlRegionButton = $<HTMLButtonElement>('#puppet-limb-region-control');
  const closeLimbEnvelopeButton = $<HTMLButtonElement>('#puppet-limb-envelope-close');
  const undoLimbEnvelopeButton = $<HTMLButtonElement>('#puppet-limb-envelope-undo');
  const deleteLimbEnvelopeButton = $<HTMLButtonElement>('#puppet-limb-envelope-delete');
  const limbEnvelopeState = $<HTMLElement>('#puppet-limb-envelope-state');
  const hairSwayXInput = $<HTMLInputElement>('#puppet-hair-sway-x');
  const hairSwayYInput = $<HTMLInputElement>('#puppet-hair-sway-y');
  const hairCyclesInput = $<HTMLInputElement>('#puppet-hair-cycles');
  const hairRootFixedInput = $<HTMLInputElement>('#puppet-hair-root-fixed');
  let groups: GroupRange[] = [];
  let layers: LayerRange[] = [];
  let puppets: PuppetBlock[] = [];
  let puppetMode: 'quick' | 'isolate' = 'quick';
  let quickTargetId = '';
  let quickLayerStart: number | null = null;
  let quickRigKind: 'ik' | 'mesh' | 'chain' = 'mesh';
  let canvasTool: 'select' | 'position' | 'bend' | 'ik' | 'chain' | 'refine' = 'position';
  let refineOpen = false;
  let activeQuickPuppetId = '';
  let quickPinRole: 'anchor' | 'joint' | 'control' | '' = '';
  let meshPinRole: 'position' | 'bend' = 'position';
  let selectedPinId = '';
  let placingFreePin = false;
  let dragPinId = '';
  let drawingMesh = false;
  let draftMeshPoints: MeshPoint[] = [];
  let drawingLimbEnvelope = false;
  let drawingLimbRegionRole: LimbRegionRole | '' = '';
  let draftLimbEnvelopePoints: MeshPoint[] = [];
  let drawingChain = false;
  let draftChainPoints: MeshPoint[] = [];
  let dragMeshVertexId = '';
  let historySnapshot = '';
  let graphSizeKey = '';
  let autoDetectedRigKey = '';

  const active = () => panelSelect.value === 'puppet-warp';
  const recommendedQuickTarget = () => {
    const eligible = groups.filter((group) => (
      group.id
      && !/drawing_tools|overlay|guide/i.test(group.id)
    ));
    if (!eligible.length) return groups[0] || null;
    return eligible
      .map((group) => {
        const descendants = eligible.filter((candidate) => candidate.start > group.start && candidate.end < group.end).length;
        const importedRootBonus = /svg_(?:viewbox|asset|import)|imported.*(?:svg|art)|character.*(?:root|art)/i.test(group.id) ? 1_000_000_000 : 0;
        const rootBonus = group.parentId ? 0 : 100_000_000;
        return { group, score: importedRootBonus + rootBonus + descendants * 1_000_000 + (group.end - group.start) };
      })
      .sort((a, b) => b.score - a.score)[0].group;
  };
  const recommendedQuickLayer = () => {
    const artwork = recommendedQuickTarget();
    if (artwork) {
      const containing = layers
        .filter((layer) => layer.start < artwork.start && layer.end > artwork.end)
        .sort((a, b) => b.start - a.start)[0];
      if (containing) return containing;
    }
    return [...layers].sort((a, b) => (b.closeStart - b.openEnd) - (a.closeStart - a.openEnd))[0] || null;
  };
  const directQuickPuppets = () => (
    puppets.filter((item) => item.target === '@layer' && item.parentLayerStart === quickLayerStart)
  );
  const directQuickPuppet = () => {
    const candidates = directQuickPuppets();
    return candidates.find((item) => item.id === activeQuickPuppetId)
      || candidates[candidates.length - 1]
      || null;
  };
  // A loaded example often contains one Group-target rig. Quick Puppet may
  // inspect and pose that unique rig, but creation/rebuild remains @layer-only.
  const inspectedQuickPuppet = () => directQuickPuppet() || (puppets.length === 1 ? puppets[0] : null);
  // Never animate an unrelated fallback warp when the user has selected a
  // different semantic Group. A target without a warp must create its own.
  const activePuppet = () => {
    if (puppetMode === 'quick') {
      return inspectedQuickPuppet();
    }
    const target = targetSelect.value;
    return puppets.find((item) => item.target === target) || (!target ? puppets[0] : null) || null;
  };
  const activePin = () => activePuppet()?.pins.find((pin) => pin.id === selectedPinId) || null;
  const puppetTransform = (puppet: PuppetBlock) => groups.find((group) => group.id === puppet.parentGroupId)?.worldTransform || IDENTITY_AFFINE;
  const overlayToPuppet = (puppet: PuppetBlock, x: number, y: number) => inverseAffinePoint(puppetTransform(puppet), x, y);

  function syncCanvasTool() {
    const buttons: Array<[HTMLButtonElement, typeof canvasTool]> = [
      [selectToolButton, 'select'],
      [quickMeshKindButton, 'position'],
      [bendToolButton, 'bend'],
      [quickIkKindButton, 'ik'],
      [quickChainKindButton, 'chain'],
      [refineToolButton, 'refine'],
    ];
    buttons.forEach(([button, tool]) => {
      const selected = tool === 'refine' ? refineOpen : canvasTool === tool;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    panel.classList.toggle('is-refining', refineOpen);
    panel.dataset.puppetTool = canvasTool;
  }

  function cancelCanvasAction() {
    placingFreePin = false;
    quickPinRole = '';
    drawingMesh = false;
    draftMeshPoints = [];
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    drawingChain = false;
    draftChainPoints = [];
    dragPinId = '';
    dragMeshVertexId = '';
  }

  function setPuppetMode(mode: 'quick' | 'isolate') {
    puppetMode = mode;
    if (mode === 'isolate') {
      const selectedHasWarp = puppets.some((item) => item.target === targetSelect.value);
      const firstGroupPuppet = puppets.find((item) => groups.some((group) => group.id === item.target));
      if (!selectedHasWarp && firstGroupPuppet) targetSelect.value = firstGroupPuppet.target;
    }
    const quick = mode === 'quick';
    quickWorkflow.classList.toggle('hidden', !quick);
    isolateWorkflow.classList.toggle('hidden', quick);
    quickModeButton.setAttribute('aria-selected', String(quick));
    isolateModeButton.setAttribute('aria-selected', String(!quick));
    quickModeButton.classList.toggle('is-selected', quick);
    isolateModeButton.classList.toggle('is-selected', !quick);
    targetScopeSelect.value = quick ? 'layer' : 'group';
    targetGroupLabel.classList.toggle('hidden', quick);
    targetScopeHelp.textContent = quick
      ? 'Auto Layer captures the visible artwork as one deformable surface.'
      : 'Selected Group limits Position Pins and mesh refinement to one named Group.';
    cancelCanvasAction();
    syncCanvasTool();
    refresh();
  }

  function setQuickRigKind(kind: 'ik' | 'mesh' | 'chain') {
    quickRigKind = kind;
    const ik = kind === 'ik';
    const mesh = kind === 'mesh';
    const chain = kind === 'chain';
    quickIkControls.classList.toggle('hidden', !ik);
    quickMeshControls.classList.toggle('hidden', !mesh);
    quickChainControls.classList.toggle('hidden', !chain);
    quickIkKindButton.setAttribute('aria-selected', String(ik));
    quickMeshKindButton.setAttribute('aria-selected', String(mesh));
    quickChainKindButton.setAttribute('aria-selected', String(chain));
    quickPinRole = '';
    placingFreePin = false;
    drawingChain = false;
    draftChainPoints = [];
    syncCanvasTool();
    refresh();
  }

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
    layers = parseLayers(source);
    puppets = parsePuppets(source, groups, layers);
    const previousTarget = targetSelect.value;
    targetSelect.innerHTML = groups.map((group) => `<option value="${escapeAttr(group.id)}">${group.id}</option>`).join('');
    if (puppetMode === 'quick') {
      const layer = recommendedQuickLayer();
      quickLayerStart = layer?.start ?? null;
      quickTargetId = layer ? '@layer' : '';
    } else if (groups.some((group) => group.id === previousTarget)) targetSelect.value = previousTarget;
    else if (puppets[0]?.target && groups.some((group) => group.id === puppets[0].target)) targetSelect.value = puppets[0].target;
    const target = groups.find((group) => group.id === targetSelect.value);
    const descendants = target
      ? groups.filter((group) => group.id !== target.id && group.start > target.start && group.end < target.end)
      : groups;
    const previousBind = bindSelect.value;
    bindSelect.innerHTML = descendants.map((group) => `<option value="${escapeAttr(group.id)}">${group.id}</option>`).join('');
    if (descendants.some((group) => group.id === previousBind)) bindSelect.value = previousBind;
    const quickLayerPuppets = directQuickPuppets();
    if (!quickLayerPuppets.some((item) => item.id === activeQuickPuppetId)) {
      activeQuickPuppetId = quickLayerPuppets[quickLayerPuppets.length - 1]?.id || '';
    }
    quickIkRigSelect.innerHTML = quickLayerPuppets.length
      ? quickLayerPuppets.map((item, index) => (
        `<option value="${escapeAttr(item.id)}">Limb ${index + 1} · ${escapeAttr(item.id)}</option>`
      )).join('')
      : '<option value="">No Bone IK limb</option>';
    quickIkRigSelect.value = activeQuickPuppetId;
    quickIkRigSelect.disabled = quickLayerPuppets.length < 2;
    const puppet = activePuppet();
    const rigKey = puppet ? `${puppet.id}:${puppet.solver}` : '';
    if (puppetMode === 'quick' && puppet && rigKey !== autoDetectedRigKey) {
      autoDetectedRigKey = rigKey;
      const detectedKind = puppet.solver === 'chain'
        ? 'chain'
        : puppet.solver === 'bones'
          ? 'ik'
          : 'mesh';
      if (detectedKind !== quickRigKind) {
        if (canvasTool !== 'select') {
          canvasTool = detectedKind === 'ik'
            ? 'ik'
            : detectedKind === 'chain'
              ? 'chain'
              : canvasTool === 'bend' ? 'bend' : 'position';
        }
        setQuickRigKind(detectedKind);
        return;
      }
    }
    if (puppet && !puppet.pins.some((pin) => pin.id === selectedPinId)) selectedPinId = puppet.pins[0]?.id || '';
    pinList.innerHTML = puppet?.pins.length
      ? puppet.pins.map((pin) => `<button type="button" data-pin-id="${escapeAttr(pin.id)}" class="${pin.id === selectedPinId ? 'is-selected' : ''}"><b>${pin.id}</b><span>${pin.bindTo ? `bind: ${pin.bindTo}` : `${formatNumber(pin.x)}, ${formatNumber(pin.y)}`}</span></button>`).join('')
      : '<p>No PuppetPin nodes yet.</p>';
    quickPinList.innerHTML = puppet?.pins.length
      ? puppet.pins.map((pin, index) => {
        const roleLabel = pin.role === 'anchor'
          ? 'Root'
          : pin.role === 'joint'
            ? 'Joint'
            : pin.role === 'control'
              ? 'Control'
              : pin.role === 'chain'
                ? 'Chain'
                : pin.role === 'bend'
                  ? 'Bend'
                  : 'Position';
        return `<button type="button" data-pin-id="${escapeAttr(pin.id)}" class="${pin.id === selectedPinId ? 'is-selected' : ''}"><b>${roleLabel} ${index + 1}</b><span>${formatNumber(pin.targetX)}, ${formatNumber(pin.targetY)}${pin.role === 'bend' ? ` · ${formatNumber(pin.rotation)}°` : ''}</span></button>`;
      }).join('')
      : '<p>No pins yet.</p>';
    quickPinCountOutput.value = String(puppet?.pins.length || 0);
    const pin = activePin();
    targetXInput.value = pin ? formatNumber(pin.targetX) : '';
    targetYInput.value = pin ? formatNumber(pin.targetY) : '';
    $('#puppet-active-state').textContent = puppet ? puppet.id : 'No warp';
    const quickAnchorPin = puppet ? quickRolePin(puppet, 'anchor') : undefined;
    const quickJointPin = puppet ? quickRolePin(puppet, 'joint') : undefined;
    const quickControlPin = puppet ? quickRolePin(puppet, 'control') : undefined;
    const quickPinCount = [quickAnchorPin, quickJointPin, quickControlPin].filter(Boolean).length;
    const quickBendAmbiguous = puppet ? isQuickBendAmbiguous(puppet) : false;
    const quickLayer = layers.find((layer) => layer.start === quickLayerStart);
    const directQuick = directQuickPuppet();
    const borrowedQuick = puppetMode === 'quick' && Boolean(puppet && puppet !== directQuick);
    quickTargetOutput.textContent = borrowedQuick && puppet
      ? `${puppet.target} · loaded Group rig`
      : quickLayer
        ? `${quickLayer.id || 'Current Layer'} · @layer${quickLayerPuppets.length ? ` · Limb ${Math.max(1, quickLayerPuppets.findIndex((item) => item.id === activeQuickPuppetId) + 1)}/${quickLayerPuppets.length}` : ''}`
        : 'No Layer found';
    quickStartButton.textContent = directQuick ? 'Reset Selected Limb' : 'Start Quick Puppet';
    quickStartButton.disabled = !quickTargetId;
    quickAnchorButton.textContent = quickAnchorPin ? 'Move Anchor' : 'Place Anchor';
    quickJointButton.textContent = quickJointPin ? 'Move Joint' : 'Place Joint';
    quickControlButton.textContent = quickControlPin ? 'Move Control' : 'Place Control';
    quickAnchorButton.disabled = !puppet || borrowedQuick;
    quickJointButton.disabled = !puppet || !quickAnchorPin || borrowedQuick;
    quickControlButton.disabled = !puppet || !quickJointPin || borrowedQuick;
    quickBendSelect.disabled = !puppet || !quickAnchorPin || !quickJointPin || !quickControlPin || borrowedQuick;
    quickBendSelect.value = !puppet || puppet.bend.trim().toLowerCase() === 'auto'
      ? 'auto'
      : Number(puppet.bend) < 0 ? '-1' : '1';
    quickBendHelp.textContent = quickBendAmbiguous && quickBendSelect.value === 'auto'
      ? 'The three pins are almost straight. Auto can flip sides; choose Clockwise or Counter-clockwise.'
      : 'Lock a side when Anchor, Joint, and Control are nearly in a straight line.';
    const meshRigReady = Boolean(
      puppet
      && puppet.solver !== 'bones'
      && puppet.solver !== 'chain'
      && !puppet.pins.some((item) => item.role && !['position', 'bend'].includes(item.role)),
    );
    meshStartButton.textContent = !puppet
      ? 'Build Alpha Mesh'
      : meshRigReady
        ? 'Rebuild Alpha Mesh'
        : 'Replace Bone IK with Alpha Mesh';
    meshStartButton.disabled = !quickTargetId || borrowedQuick;
    meshAddPinButton.disabled = !meshRigReady || borrowedQuick;
    meshAddBendPinButton.disabled = !meshRigReady || borrowedQuick;
    meshDeletePinButton.disabled = !meshRigReady || !pin || borrowedQuick;
    if (puppet && meshRigReady) {
      meshDensitySelect.value = puppet.density;
    }
    if (pin && quickRigKind === 'mesh') {
      meshRadiusInput.value = formatNumber(pin.radius);
      meshRadiusOutput.value = formatNumber(pin.radius);
      meshBendRotationInput.value = formatNumber(pin.rotation);
      meshBendRotationOutput.value = `${formatNumber(pin.rotation)}°`;
      meshBendRotationInput.disabled = pin.role !== 'bend';
    } else {
      meshRadiusOutput.value = formatNumber(Number(meshRadiusInput.value) || 120);
      meshBendRotationInput.value = '0';
      meshBendRotationOutput.value = '0°';
      meshBendRotationInput.disabled = true;
    }
    const chainSurfaceReady = Boolean(puppet && puppet.solver !== 'bones');
    chainStartButton.textContent = puppet?.solver === 'chain' ? 'Reset Chain Surface' : 'Build Chain Surface';
    chainStartButton.disabled = !quickTargetId || borrowedQuick;
    chainDrawButton.disabled = !chainSurfaceReady || borrowedQuick;
    chainDrawButton.textContent = drawingChain ? 'Cancel Centerline' : 'Draw Centerline';
    chainFinishButton.disabled = !drawingChain || draftChainPoints.length < 2;
    chainUndoButton.disabled = !drawingChain || draftChainPoints.length === 0;
    const quickSteps = [
      $('#puppet-quick-step-artwork'),
      $('#puppet-quick-step-anchor'),
      $('#puppet-quick-step-joint'),
      $('#puppet-quick-step-control'),
    ];
    quickSteps.forEach((step, index) => {
      const complete = index === 0
        ? Boolean(puppet)
        : Boolean([quickAnchorPin, quickJointPin, quickControlPin][index - 1]);
      const current = index === 0
        ? !puppet
        : Boolean(puppet)
          && ![quickAnchorPin, quickJointPin, quickControlPin][index - 1]
          && (index === 1 || Boolean([quickAnchorPin, quickJointPin][index - 2]));
      step.classList.toggle('is-complete', complete);
      step.classList.toggle('is-current', current);
    });
    const meshSteps = [
      $('#puppet-mesh-step-artwork'),
      $('#puppet-mesh-step-surface'),
      $('#puppet-mesh-step-pins'),
    ];
    const meshStepComplete = [
      Boolean(puppet),
      Boolean(puppet?.mesh),
      Boolean(puppet?.pins.length),
    ];
    meshSteps.forEach((step, index) => {
      step.classList.toggle('is-complete', meshStepComplete[index]);
      step.classList.toggle(
        'is-current',
        !meshStepComplete[index] && (index === 0 || meshStepComplete[index - 1]),
      );
    });
    if (quickRigKind === 'chain' && !puppet) {
      quickTipTitle.textContent = 'Build the chain surface';
      quickTipCopy.textContent = 'Capture the visible artwork, then draw a centerline from the fixed root to the loose tip.';
    } else if (quickRigKind === 'chain' && drawingChain) {
      quickTipTitle.textContent = 'Draw root to tip';
      quickTipCopy.textContent = `${draftChainPoints.length} point${draftChainPoints.length === 1 ? '' : 's'} placed. Finish with at least two points; 4–12 gives smoother motion.`;
    } else if (quickRigKind === 'chain' && puppet?.solver === 'chain') {
      quickTipTitle.textContent = 'Pose the chain';
      quickTipCopy.textContent = 'Drag the final control pin. Parent-linked segments keep their length and SpringChain supplies overlap.';
    } else if (quickRigKind === 'chain') {
      quickTipTitle.textContent = 'Draw the centerline';
      quickTipCopy.textContent = 'Press Draw Centerline, then click from the fixed root through each bend to the loose tip.';
    } else if (quickRigKind === 'mesh' && !puppet) {
      quickTipTitle.textContent = 'Build the surface';
      quickTipCopy.textContent = 'Press Build Alpha Mesh. MotionLoom triangulates the visible artwork and excludes the empty canvas.';
    } else if (quickRigKind === 'mesh' && !meshRigReady) {
      quickTipTitle.textContent = 'Switch solver';
      quickTipCopy.textContent = 'This Layer currently contains a 3-point Bone IK rig. Replace it to use unlimited independent position pins.';
    } else if (quickRigKind === 'mesh' && puppet && puppet.pins.length === 0) {
      quickTipTitle.textContent = 'Add position pins';
      quickTipCopy.textContent = 'Add Position Pins to hold or move pixels, or Bend Pins to rotate a local area. No body-part names are required.';
    } else if (quickRigKind === 'mesh' && puppet) {
      quickTipTitle.textContent = 'Pose the mesh';
      quickTipCopy.textContent = `Drag any of the ${puppet.pins.length} lime pins. Add more pins wherever the artwork needs another local control.`;
    } else if (!puppet) {
      quickTipTitle.textContent = 'Ready to rig';
      quickTipCopy.textContent = 'Press Start Quick Puppet. MotionLoom will capture the current Layer once and create an automatic surface.';
    } else if (!quickAnchorPin) {
      quickTipTitle.textContent = 'Place the fixed root';
      quickTipCopy.textContent = 'Press Place Anchor, then click a shoulder, hip, or other point that must stay fixed.';
    } else if (!quickJointPin) {
      quickTipTitle.textContent = 'Place a bend point';
      quickTipCopy.textContent = 'Press Place Joint, then click an elbow, knee, or middle point.';
    } else if (!quickControlPin) {
      quickTipTitle.textContent = 'Place the moving control';
      quickTipCopy.textContent = 'Press Place Control, click the wrist or tip, then drag the lime pin to pose it.';
    } else if (quickBendAmbiguous && quickBendSelect.value === 'auto') {
      quickTipTitle.textContent = 'Choose joint bend';
      quickTipCopy.textContent = 'The three pins are nearly straight, so Auto has no stable bend side. Choose Clockwise or Counter-clockwise before dragging.';
    } else {
      quickTipTitle.textContent = 'Drag the hand';
      quickTipCopy.textContent = 'Drag the IK Control at the wrist. Bone lengths stay fixed, the elbow follows, and only the local limb mesh is replaced.';
    }
    meshState.textContent = drawingMesh
      ? `${draftMeshPoints.length} outline point${draftMeshPoints.length === 1 ? '' : 's'}`
      : puppet?.mesh
        ? `${puppet.mesh.vertices.length} vertices · ${puppet.mesh.triangles.length} triangles`
        : 'Auto mesh';
    drawMeshButton.textContent = drawingMesh ? 'Cancel Drawing' : puppet?.mesh ? 'Redraw Mesh' : 'Draw Mesh';
    closeMeshButton.disabled = !drawingMesh || draftMeshPoints.length < 3;
    undoMeshPointButton.disabled = !drawingMesh || draftMeshPoints.length === 0;
    deleteMeshButton.disabled = !puppet?.mesh;
    const completeIkPins = Boolean(quickAnchorPin && quickJointPin && quickControlPin);
    quickAddLimbButton.disabled = !completeIkPins || borrowedQuick;
    const regionRoles: LimbRegionRole[] = ['anchor', 'joint', 'control'];
    const regionButtons: Record<LimbRegionRole, HTMLButtonElement> = {
      anchor: drawAnchorRegionButton,
      joint: drawJointRegionButton,
      control: drawControlRegionButton,
    };
    regionRoles.forEach((role) => {
      const exists = puppet?.regions.some((region) => region.role === role);
      regionButtons[role].textContent = drawingLimbRegionRole === role
        ? `Cancel ${role} area`
        : `${exists ? 'Redraw' : 'Draw'} ${role} area`;
      regionButtons[role].disabled = !puppet || !quickRolePin(puppet, role);
      regionButtons[role].classList.toggle('is-selected', drawingLimbRegionRole === role);
    });
    closeLimbEnvelopeButton.disabled = (
      !drawingLimbEnvelope
      || draftLimbEnvelopePoints.length < MIN_LIMB_REGION_POINTS
    );
    undoLimbEnvelopeButton.disabled = !drawingLimbEnvelope || draftLimbEnvelopePoints.length === 0;
    deleteLimbEnvelopeButton.disabled = !puppet?.envelope && !puppet?.regions.length;
    const completedRegionRoles = regionRoles.filter((role) => (
      puppet?.regions.some((region) => region.role === role)
    ));
    limbEnvelopeState.textContent = drawingLimbEnvelope
      ? `${draftLimbEnvelopePoints.length}/${MIN_LIMB_REGION_POINTS} minimum points for the ${drawingLimbRegionRole} region. Keep only its matching Pin inside.`
      : completedRegionRoles.length
        ? `${completedRegionRoles.length}/3 regions ready: ${completedRegionRoles.join(', ')}. Complete all three to use exact Bone IK areas.`
        : puppet?.envelope
          ? 'Legacy single LimbEnvelope loaded. Draw any role region to replace it with the easier three-region workflow.'
        : completeIkPins
          ? 'Draw Anchor Area around shoulder/upper arm, Joint Area around the elbow, and Control Area around forearm/hand.'
          : 'Place Anchor, Joint, and Control first; each matching Area button becomes available with its Pin.';
    const undersizedPins = puppet?.pins.filter((item) => item.radius < effectivePinRadius(puppet, item.x, item.y)) || [];
    if (puppetMode === 'quick' && quickRigKind === 'chain' && drawingChain) {
      status.textContent = `Drawing chain centerline: ${draftChainPoints.length} point${draftChainPoints.length === 1 ? '' : 's'}.`;
    }
    else if (puppetMode === 'quick' && borrowedQuick) status.textContent = `${puppet?.pins.length || 0} pins loaded from Group rig “${puppet?.target || ''}”. Drag to pose, or open Isolate Part to edit its structure.`;
    else if (puppetMode === 'quick' && quickRigKind === 'chain' && puppet?.solver === 'chain') status.textContent = `${puppet.pins.length} parent-linked chain pins ready. Drag the final control pin.`;
    else if (puppetMode === 'quick' && quickRigKind === 'chain') status.textContent = 'Build the visible surface, then draw a root-to-tip centerline.';
    else if (puppetMode === 'quick' && quickRigKind === 'mesh' && placingFreePin) {
      status.textContent = `Click Preview to add the next ${meshPinRole} pin.`;
    }
    else if (puppetMode === 'quick' && quickRigKind === 'mesh' && !puppet) status.textContent = 'Alpha Mesh is ready. Build it once, then add as many Position or Bend pins as needed.';
    else if (puppetMode === 'quick' && quickRigKind === 'mesh' && !meshRigReady) status.textContent = 'Replace the current Bone IK rig before adding mesh pins.';
    else if (puppetMode === 'quick' && quickRigKind === 'mesh') status.textContent = `${puppet?.pins.length || 0} surface pin${puppet?.pins.length === 1 ? '' : 's'} on a ${puppet?.density || meshDensitySelect.value} alpha mesh.`;
    else if (puppetMode === 'quick' && quickPinRole) status.textContent = `Click Preview to place the ${quickPinRole} pin anywhere on the artwork.`;
    else if (drawingLimbEnvelope) status.textContent = `Drawing ${drawingLimbRegionRole} area: ${draftLimbEnvelopePoints.length} point${draftLimbEnvelopePoints.length === 1 ? '' : 's'}.`;
    else if (puppetMode === 'quick' && !puppet) status.textContent = 'Quick Puppet is ready. Start once, then place pins anywhere on the captured Layer.';
    else if (puppetMode === 'quick' && puppet) status.textContent = `${quickPinCount} quick pin${quickPinCount === 1 ? '' : 's'} placed. Use the highlighted next step above.`;
    else if (drawingMesh) status.textContent = `Drawing custom mesh: ${draftMeshPoints.length} point${draftMeshPoints.length === 1 ? '' : 's'}. Click Preview; Close Mesh when the outline is complete.`;
    else if (!puppet) status.textContent = 'Choose a target Group, then create a Puppet Warp.';
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
    if (
      puppetMode === 'quick'
      && (quickRigKind === 'mesh' || quickRigKind === 'chain')
      && (quickRigKind === 'mesh' ? meshShowInput.checked : chainShowInput.checked)
      && puppet.solver !== 'bones'
      && !puppet.mesh
    ) {
      const [cols, rows] = puppetGridSize(puppet.density);
      const gridPoints: Array<[number, number]> = [];
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          gridPoints.push(affinePoint(
            transform,
            puppet.width * col / (cols - 1),
            puppet.height * row / (rows - 1),
          ));
        }
      }
      const renderedEdges = new Set<string>();
      const drawGridEdge = (fromIndex: number, toIndex: number) => {
        const key = fromIndex < toIndex ? `${fromIndex}|${toIndex}` : `${toIndex}|${fromIndex}`;
        if (renderedEdges.has(key)) return;
        renderedEdges.add(key);
        const from = gridPoints[fromIndex];
        const to = gridPoints[toIndex];
        const edge = document.createElementNS(SVG_NS, 'line');
        edge.setAttribute('x1', String(from[0])); edge.setAttribute('y1', String(from[1]));
        edge.setAttribute('x2', String(to[0])); edge.setAttribute('y2', String(to[1]));
        edge.setAttribute('class', 'puppet-mesh-edge puppet-auto-mesh-edge');
        overlay.append(edge);
      };
      for (let row = 0; row < rows - 1; row += 1) {
        for (let col = 0; col < cols - 1; col += 1) {
          const topLeft = row * cols + col;
          const topRight = topLeft + 1;
          const bottomLeft = topLeft + cols;
          const bottomRight = bottomLeft + 1;
          drawGridEdge(topLeft, topRight);
          drawGridEdge(topLeft, bottomLeft);
          drawGridEdge(topLeft, bottomRight);
          drawGridEdge(topRight, bottomRight);
          drawGridEdge(bottomLeft, bottomRight);
        }
      }
    }
    if (
      puppet.mesh
      && (
        puppetMode === 'isolate'
        || (
          puppetMode === 'quick'
          && (quickRigKind === 'mesh' || quickRigKind === 'chain')
          && (quickRigKind === 'mesh' ? meshShowInput.checked : chainShowInput.checked)
        )
      )
    ) {
      const vertexMap = new Map(puppet.mesh.vertices.map((vertex) => [vertex.id, vertex]));
      const renderedEdges = new Set<string>();
      for (const triangle of puppet.mesh.triangles) {
        for (const [fromId, toId] of [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]) {
          const from = vertexMap.get(fromId);
          const to = vertexMap.get(toId);
          if (!from || !to) continue;
          const edgeKey = [fromId, toId].sort().join('|');
          if (renderedEdges.has(edgeKey)) continue;
          renderedEdges.add(edgeKey);
          const [fromX, fromY] = affinePoint(transform, from.x, from.y);
          const [toX, toY] = affinePoint(transform, to.x, to.y);
          const edge = document.createElementNS(SVG_NS, 'line');
          edge.setAttribute('x1', String(fromX)); edge.setAttribute('y1', String(fromY));
          edge.setAttribute('x2', String(toX)); edge.setAttribute('y2', String(toY));
          edge.setAttribute('class', 'puppet-mesh-edge');
          overlay.append(edge);
        }
      }
      if (puppetMode === 'isolate') {
        for (const vertex of puppet.mesh.vertices) {
          const [x, y] = affinePoint(transform, vertex.x, vertex.y);
          const handle = document.createElementNS(SVG_NS, 'circle');
          handle.setAttribute('cx', String(x)); handle.setAttribute('cy', String(y));
          handle.setAttribute('r', String(handleRadius * 0.48));
          handle.setAttribute('class', 'puppet-mesh-vertex');
          handle.dataset.meshVertexId = vertex.id;
          overlay.append(handle);
        }
      }
    }
    if (drawingMesh && draftMeshPoints.length) {
      const worldPoints = draftMeshPoints.map((point) => affinePoint(transform, point.x, point.y));
      const outline = document.createElementNS(SVG_NS, 'polyline');
      outline.setAttribute('points', worldPoints.map(([x, y]) => `${x},${y}`).join(' '));
      outline.setAttribute('class', 'puppet-mesh-draft');
      overlay.append(outline);
      worldPoints.forEach(([x, y], index) => {
        const handle = document.createElementNS(SVG_NS, 'circle');
        handle.setAttribute('cx', String(x)); handle.setAttribute('cy', String(y));
        handle.setAttribute('r', String(index === 0 ? handleRadius * 0.62 : handleRadius * 0.46));
        handle.setAttribute('class', `puppet-mesh-draft-point${index === 0 ? ' is-first' : ''}`);
        overlay.append(handle);
      });
    }
    const visibleRegions = [
      ...(puppet?.regions || []).map((region) => ({ role: region.role, points: region.points })),
      ...(puppet?.regions.length ? [] : puppet?.envelope ? [{ role: 'legacy', points: puppet.envelope.points }] : []),
      ...(drawingLimbEnvelope ? [{ role: drawingLimbRegionRole || 'draft', points: draftLimbEnvelopePoints }] : []),
    ];
    visibleRegions.forEach((region) => {
      if (!region.points.length) return;
      const worldPoints = region.points.map((point) => affinePoint(transform, point.x, point.y));
      const outline = document.createElementNS(SVG_NS, 'polygon');
      outline.setAttribute('points', worldPoints.map(([x, y]) => `${x},${y}`).join(' '));
      outline.setAttribute('class', 'puppet-mesh-draft');
      outline.dataset.limbRegion = region.role;
      overlay.append(outline);
      if (drawingLimbEnvelope && region.role === drawingLimbRegionRole) {
        worldPoints.forEach(([x, y], index) => {
          const handle = document.createElementNS(SVG_NS, 'circle');
          handle.setAttribute('cx', String(x));
          handle.setAttribute('cy', String(y));
          handle.setAttribute('r', String(index === 0 ? handleRadius * 0.62 : handleRadius * 0.46));
          handle.setAttribute('class', `puppet-mesh-draft-point${index === 0 ? ' is-first' : ''}`);
          overlay.append(handle);
        });
      }
    });
    if (drawingChain && draftChainPoints.length) {
      const worldPoints = draftChainPoints.map((point) => affinePoint(transform, point.x, point.y));
      const centerline = document.createElementNS(SVG_NS, 'polyline');
      centerline.setAttribute('points', worldPoints.map(([x, y]) => `${x},${y}`).join(' '));
      centerline.setAttribute('class', 'puppet-mesh-draft');
      overlay.append(centerline);
      worldPoints.forEach(([x, y], index) => {
        const handle = document.createElementNS(SVG_NS, 'circle');
        handle.setAttribute('cx', String(x));
        handle.setAttribute('cy', String(y));
        handle.setAttribute('r', String(index === 0 ? handleRadius * 0.7 : handleRadius * 0.5));
        handle.setAttribute('class', `puppet-mesh-draft-point${index === 0 ? ' is-first' : ''}`);
        overlay.append(handle);
      });
    }
    for (const pin of puppet.pins) {
      const [sourceX, sourceY] = affinePoint(transform, pin.x, pin.y);
      const [targetX, targetY] = affinePoint(transform, pin.targetX, pin.targetY);
      if (puppetMode !== 'quick' || !['mesh', 'chain'].includes(quickRigKind) || pin.id === selectedPinId) {
        const radius = document.createElementNS(SVG_NS, 'circle');
        radius.setAttribute('cx', String(sourceX)); radius.setAttribute('cy', String(sourceY));
        radius.setAttribute('r', String(Math.max(handleRadius * 1.5, pin.radius * radiusScale)));
        radius.setAttribute('class', 'puppet-pin-radius');
        overlay.append(radius);
      }
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

  function quickRolePin(puppet: PuppetBlock, role: 'anchor' | 'joint' | 'control'): PuppetPin | undefined {
    return puppet.pins.find((pin) => pin.role === role || new RegExp(`_${role}_pin$`, 'i').test(pin.id));
  }

  function isQuickBendAmbiguous(puppet: PuppetBlock): boolean {
    const anchor = quickRolePin(puppet, 'anchor');
    const joint = quickRolePin(puppet, 'joint');
    const control = quickRolePin(puppet, 'control');
    if (!anchor || !joint || !control) return false;
    const firstX = joint.x - anchor.x;
    const firstY = joint.y - anchor.y;
    const chainX = control.x - anchor.x;
    const chainY = control.y - anchor.y;
    const denominator = Math.hypot(firstX, firstY) * Math.hypot(chainX, chainY);
    if (denominator < 0.001) return true;
    return Math.abs(firstX * chainY - firstY * chainX) / denominator < 0.08;
  }

  function buildQuickBoneMesh(puppet: PuppetBlock, limbWidth: number): string | null {
    const anchor = quickRolePin(puppet, 'anchor');
    const joint = quickRolePin(puppet, 'joint');
    const control = quickRolePin(puppet, 'control');
    if (!anchor || !joint || !control) return null;

    const safeId = (puppet.id || puppet.target || 'quick_limb').replace(/[^A-Za-z0-9_:-]+/g, '_');
    const upperLength = Math.hypot(joint.x - anchor.x, joint.y - anchor.y);
    const lowerLength = Math.hypot(control.x - joint.x, control.y - joint.y);
    if (upperLength < 2 || lowerLength < 2) return null;
    const halfWidth = Math.max(6, Math.min(limbWidth * 0.5, Math.min(upperLength, lowerLength) * 0.42));
    const upperDirection = { x: (joint.x - anchor.x) / upperLength, y: (joint.y - anchor.y) / upperLength };
    const lowerDirection = { x: (control.x - joint.x) / lowerLength, y: (control.y - joint.y) / lowerLength };
    const upperPerpendicular = { x: -upperDirection.y, y: upperDirection.x };
    const lowerPerpendicular = { x: -lowerDirection.y, y: lowerDirection.x };
    const offset = (point: PuppetPin | MeshPoint, perpendicular: MeshPoint, amount: number): MeshPoint => ({
      x: point.x + perpendicular.x * amount,
      y: point.y + perpendicular.y * amount,
    });
    const handCenter = {
      x: control.x + lowerDirection.x * halfWidth * 1.25,
      y: control.y + lowerDirection.y * halfWidth * 1.25,
    };
    const pointLine = (id: string, point: MeshPoint, bone: string, sample?: MeshPoint) => {
      const sampleAttrs = sample
        ? ` sampleX="${formatNumber(sample.x)}" sampleY="${formatNumber(sample.y)}"`
        : '';
      return `    <Vertex id="${safeId}_${id}" x="${formatNumber(point.x)}" y="${formatNumber(point.y)}"${sampleAttrs} bone="${bone}" />`;
    };
    const triangleLine = (id: string, a: string, b: string, c: string) => (
      `    <Triangle id="${safeId}_${id}" a="${safeId}_${a}" b="${safeId}_${b}" c="${safeId}_${c}" />`
    );
    const safeMaterialHalfWidth = Math.max(2, halfWidth * 0.22);
    const shoulderSampleLeft = offset(anchor, upperPerpendicular, safeMaterialHalfWidth);
    const shoulderSampleRight = offset(anchor, upperPerpendicular, -safeMaterialHalfWidth);
    const jointUpperSampleLeft = offset(joint, upperPerpendicular, safeMaterialHalfWidth);
    const jointUpperSampleRight = offset(joint, upperPerpendicular, -safeMaterialHalfWidth);
    const jointLowerSampleLeft = offset(joint, lowerPerpendicular, safeMaterialHalfWidth);
    const jointLowerSampleRight = offset(joint, lowerPerpendicular, -safeMaterialHalfWidth);
    const vertices = [
      // A static copy of the shoulder cross-section supplies a material-sampled
      // overlap between the preserved torso and the rotating upper limb.
      pointLine('as_l', offset(anchor, upperPerpendicular, halfWidth), 'fixed', shoulderSampleLeft),
      pointLine('as_c', anchor, 'fixed', anchor),
      pointLine('as_r', offset(anchor, upperPerpendicular, -halfWidth), 'fixed', shoulderSampleRight),
      pointLine('af_l', offset(anchor, upperPerpendicular, halfWidth), 'upper', shoulderSampleLeft),
      pointLine('af_c', anchor, 'upper', anchor),
      pointLine('af_r', offset(anchor, upperPerpendicular, -halfWidth), 'upper', shoulderSampleRight),
      pointLine('a_l', offset(anchor, upperPerpendicular, halfWidth), 'upper'),
      pointLine('a_c', anchor, 'upper'),
      pointLine('a_r', offset(anchor, upperPerpendicular, -halfWidth), 'upper'),
      pointLine('ju_l', offset(joint, upperPerpendicular, halfWidth), 'upper'),
      pointLine('ju_c', joint, 'upper'),
      pointLine('ju_r', offset(joint, upperPerpendicular, -halfWidth), 'upper'),
      pointLine('jf_l', offset(joint, lowerPerpendicular, halfWidth), 'forearm'),
      pointLine('jf_c', joint, 'forearm'),
      pointLine('jf_r', offset(joint, lowerPerpendicular, -halfWidth), 'forearm'),
      pointLine('juf_l', offset(joint, upperPerpendicular, halfWidth), 'upper', jointUpperSampleLeft),
      pointLine('juf_c', joint, 'upper', joint),
      pointLine('juf_r', offset(joint, upperPerpendicular, -halfWidth), 'upper', jointUpperSampleRight),
      pointLine('jff_l', offset(joint, lowerPerpendicular, halfWidth), 'forearm', jointLowerSampleLeft),
      pointLine('jff_c', joint, 'forearm', joint),
      pointLine('jff_r', offset(joint, lowerPerpendicular, -halfWidth), 'forearm', jointLowerSampleRight),
      pointLine('w_l', offset(control, lowerPerpendicular, halfWidth * 0.78), 'forearm'),
      pointLine('w_c', control, 'forearm'),
      pointLine('w_r', offset(control, lowerPerpendicular, -halfWidth * 0.78), 'forearm'),
      pointLine('h_l', offset(handCenter, lowerPerpendicular, halfWidth * 0.9), 'hand'),
      pointLine('h_c', handCenter, 'hand'),
      pointLine('h_r', offset(handCenter, lowerPerpendicular, -halfWidth * 0.9), 'hand'),
    ];
    const triangles = [
      triangleLine('t_u0', 'a_l', 'a_c', 'ju_c'),
      triangleLine('t_u1', 'a_l', 'ju_c', 'ju_l'),
      triangleLine('t_u2', 'a_c', 'a_r', 'ju_r'),
      triangleLine('t_u3', 'a_c', 'ju_r', 'ju_c'),
      triangleLine('t_f0', 'jf_l', 'jf_c', 'w_c'),
      triangleLine('t_f1', 'jf_l', 'w_c', 'w_l'),
      triangleLine('t_f2', 'jf_c', 'jf_r', 'w_r'),
      triangleLine('t_f3', 'jf_c', 'w_r', 'w_c'),
      triangleLine('t_h0', 'w_l', 'w_c', 'h_c'),
      triangleLine('t_h1', 'w_l', 'h_c', 'h_l'),
      triangleLine('t_h2', 'w_c', 'w_r', 'h_r'),
      triangleLine('t_h3', 'w_c', 'h_r', 'h_c'),
      // Joint skin completion. These source quads contain the original
      // shoulder/elbow pixels, while their two edges follow different bones.
      // The resulting overlap fills the wedge exposed by a hard bend without
      // hard-coding a skin or clothing colour.
      triangleLine('t_shoulder_fill0', 'as_l', 'as_c', 'af_c'),
      triangleLine('t_shoulder_fill1', 'as_l', 'af_c', 'af_l'),
      triangleLine('t_shoulder_fill2', 'as_c', 'as_r', 'af_r'),
      triangleLine('t_shoulder_fill3', 'as_c', 'af_r', 'af_c'),
      triangleLine('t_joint_fill0', 'juf_l', 'juf_c', 'jff_c'),
      triangleLine('t_joint_fill1', 'juf_l', 'jff_c', 'jff_l'),
      triangleLine('t_joint_fill2', 'juf_c', 'juf_r', 'jff_r'),
      triangleLine('t_joint_fill3', 'juf_c', 'jff_r', 'jff_c'),
    ];
    return [
      `  <MeshTopology id="${safeId}_quick_bone_mesh">`,
      ...vertices,
      ...triangles,
      '  </MeshTopology>',
    ].join('\n');
  }

  function rebuildQuickBoneMesh(commit: boolean): boolean {
    if (quickRigKind !== 'ik') return false;
    const puppet = activePuppet();
    if (!puppet) return false;
    const anchor = quickRolePin(puppet, 'anchor');
    const joint = quickRolePin(puppet, 'joint');
    const control = quickRolePin(puppet, 'control');
    if (!anchor || !joint || !control) return false;
    const limbWidth = Math.max(24, Math.min(320, Number(quickRadiusInput.value) || 96));

    if (puppet.regions.length) {
      const rolePins: Record<LimbRegionRole, PuppetPin> = { anchor, joint, control };
      const invalidRegions = puppet.regions.filter((region) => !pointInPolygon(
        { x: rolePins[region.role].x, y: rolePins[region.role].y },
        region.points,
      ));
      if (invalidRegions.length) {
        status.textContent = `Redraw the ${invalidRegions.map((region) => region.role).join(', ')} Area around its matching Pin.`;
        return false;
      }
      const openTag = replaceOpenTagAttr(
        replaceOpenTagAttr(puppet.rawOpen, 'solver', 'bones'),
        'preserveOutside',
        'true',
      );
      const source = editor.value.slice(0, puppet.start) + openTag + editor.value.slice(puppet.openEnd);
      writeSource(source, commit);
      status.textContent = `${puppet.regions.length}/3 exact Bone IK regions active.`;
      return true;
    }

    // A user-authored envelope replaces the scalar-width topology, but it
    // still has to activate the bones solver once the third IK pin exists.
    if (puppet.envelope) {
      const rolePins = [anchor, joint, control];
      const outsidePins = rolePins.filter((pin) => !pointInPolygon(
        { x: pin.x, y: pin.y },
        puppet.envelope?.points || [],
      ));
      if (outsidePins.length) {
        status.textContent = `Exact Limb Area does not contain ${outsidePins.map((pin) => pin.role || pin.id).join(', ')}. Redraw it around the complete limb.`;
        return false;
      }

      let source = editor.value;
      const envelopeTag = replaceTagAttr(
        source.slice(puppet.envelope.start, puppet.envelope.end),
        'handFrom',
        control.id,
      );
      source = (
        source.slice(0, puppet.envelope.start)
        + envelopeTag
        + source.slice(puppet.envelope.end)
      );
      const openTag = replaceOpenTagAttr(
        replaceOpenTagAttr(
          replaceOpenTagAttr(puppet.rawOpen, 'solver', 'bones'),
          'jointSoftness',
          formatNumber(limbWidth * 0.5),
        ),
        'preserveOutside',
        'true',
      );
      source = source.slice(0, puppet.start) + openTag + source.slice(puppet.openEnd);
      writeSource(source, commit);
      status.textContent = 'Activated Bone IK inside the Exact Limb Area. Drag the Control pin to pose the hand.';
      return true;
    }

    const block = buildQuickBoneMesh(puppet, limbWidth);
    if (!block) return false;
    let source = editor.value;
    if (puppet.mesh) {
      source = source.slice(0, puppet.mesh.start) + block + source.slice(puppet.mesh.end);
    } else {
      source = source.slice(0, puppet.openEnd) + `\n${block}` + source.slice(puppet.openEnd);
    }
    const openTag = replaceOpenTagAttr(
      replaceOpenTagAttr(
        replaceOpenTagAttr(puppet.rawOpen, 'solver', 'bones'),
        'jointSoftness',
        formatNumber(limbWidth * 0.5),
      ),
      'preserveOutside',
      String(puppet.preserveOutside),
    );
    source = source.slice(0, puppet.start) + openTag + source.slice(puppet.openEnd);
    writeSource(source, commit);
    status.textContent = `Built a local rigid-bone mesh with material-sampled shoulder and joint overlap for a ${formatNumber(limbWidth)} px limb. Drag the control pin to pose it.`;
    return true;
  }

  function insertPin(attrs: string, preferredId = '') {
    const puppet = activePuppet();
    if (!puppet) { status.textContent = 'Create Puppet Warp before adding pins.'; return; }
    const safeTargetId = (puppet.target || 'character').replace(/[^A-Za-z0-9_:-]+/g, '_').replace(/^_+/, '') || 'layer';
    const idBase = `${safeTargetId}_pin`;
    let index = puppet.pins.length + 1;
    while (puppet.pins.some((pin) => pin.id === `${idBase}_${index}`)) index += 1;
    const safePreferredId = preferredId.replace(/[^A-Za-z0-9_:-]+/g, '_');
    selectedPinId = safePreferredId && !puppet.pins.some((pin) => pin.id === safePreferredId)
      ? safePreferredId
      : `${idBase}_${index}`;
    const indent = editor.value.slice(0, puppet.closeStart).match(/(^|\n)([ \t]*)[^\n]*$/)?.[2] || '  ';
    const bindTo = attr(attrs, 'bindTo');
    const bound = bindTo ? groups.find((group) => group.id === bindTo) : undefined;
    const boundLocal = bound ? overlayToPuppet(puppet, bound.worldX, bound.worldY) : [0, 0];
    const pinX = numberAttr(attrs, 'x', boundLocal[0]);
    const pinY = numberAttr(attrs, 'y', boundLocal[1]);
    const requestedRadius = puppetMode === 'quick'
      ? quickRigKind === 'mesh'
        ? Math.max(1, Number(meshRadiusInput.value) || 120)
        : Math.max(1, (Number(quickRadiusInput.value) || 96) * 0.5)
      : Math.max(1, Number(radiusInput.value) || 160);
    const radius = puppetMode === 'quick'
      ? requestedRadius
      : Math.max(requestedRadius, effectivePinRadius(puppet, pinX, pinY));
    if (puppetMode === 'quick' && quickRigKind === 'ik') quickRadiusOutput.value = formatNumber(Number(quickRadiusInput.value) || 96);
    else if (puppetMode === 'quick') meshRadiusOutput.value = formatNumber(requestedRadius);
    else radiusInput.value = formatNumber(radius);
    const strength = $<HTMLInputElement>('#puppet-strength').value;
    const falloff = puppetMode === 'quick' && quickRigKind === 'mesh'
      ? 'rigid'
      : $<HTMLSelectElement>('#puppet-falloff').value;
    const tag = `${indent}  <PuppetPin id="${selectedPinId}" ${attrs} radius="${radius}" strength="${strength}" falloff="${falloff}" />\n`;
    writeSource(editor.value.slice(0, puppet.closeStart) + tag + editor.value.slice(puppet.closeStart), true);
    if (!(puppetMode === 'quick' && quickRigKind === 'ik' && /_control_pin$/i.test(selectedPinId) && rebuildQuickBoneMesh(true))) {
      status.textContent = `Added ${selectedPinId}. Drag its target in Preview.`;
    }
  }

  function createWarpForTarget(forceNewQuickLimb = false): PuppetBlock | null {
    if (puppetMode === 'quick') {
      const layer = recommendedQuickLayer();
      if (!layer) {
        status.textContent = 'Quick Puppet needs a Layer containing the artwork.';
        return null;
      }
      const existing = directQuickPuppet();
      if (existing && !forceNewQuickLimb) return existing;
      const [graphWidth, graphHeight] = graphSize(editor.value);
      const safeLayerId = (layer.id || 'layer').replace(/[^A-Za-z0-9_:-]+/g, '_');
      const baseWarpId = `${safeLayerId}_puppet_warp`;
      const existingIds = new Set(puppets.map((puppet) => puppet.id));
      let limbNumber = directQuickPuppets().length + 1;
      let warpId = forceNewQuickLimb
        ? `${safeLayerId}_limb_${limbNumber}_puppet_warp`
        : baseWarpId;
      while (existingIds.has(warpId)) {
        limbNumber += 1;
        warpId = `${safeLayerId}_limb_${limbNumber}_puppet_warp`;
      }
      const closeLineStart = editor.value.lastIndexOf('\n', layer.closeStart) + 1;
      const indent = editor.value.slice(closeLineStart, layer.closeStart);
      const childIndent = `${indent}  `;
      const density = quickRigKind === 'mesh'
        ? meshDensitySelect.value
        : quickRigKind === 'chain'
          ? chainDensitySelect.value
          : '16x16';
      const block = [
        `${childIndent}<PuppetWarp id="${escapeAttr(warpId)}" target="@layer" capture="before" mesh="alpha" solver="soft" bend="auto" stretch="0" jointSoftness="48" preserveVolume="true" preserveOutside="true" width="${graphWidth}" height="${graphHeight}" density="${escapeAttr(density)}">`,
        `${childIndent}</PuppetWarp>`,
        '',
      ].join('\n');
      activeQuickPuppetId = warpId;
      // Keep the selected Bone IK authoring workflow while the new limb has
      // fewer than three pins and therefore intentionally remains solver=soft.
      autoDetectedRigKey = `${warpId}:soft`;
      writeSource(editor.value.slice(0, closeLineStart) + block + editor.value.slice(closeLineStart), true);
      placingFreePin = true;
      status.textContent = `Created ${warpId} from the current Layer. Click Preview to place the first pin.`;
      return activePuppet();
    }

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

  function installCapturedAlphaMesh(puppet: PuppetBlock, mesh: CapturedAlphaMesh): PuppetBlock | null {
    if (!mesh.points.length || !mesh.triangles.length) return puppet;
    const safeId = (puppet.id || puppet.target || 'layer')
      .replace(/[^A-Za-z0-9_:-]+/g, '_')
      .replace(/^_+/, '') || 'layer';
    const lineStart = editor.value.lastIndexOf('\n', puppet.start) + 1;
    const indent = editor.value.slice(lineStart, puppet.start);
    const childIndent = `${indent}  `;
    const itemIndent = `${childIndent}  `;
    const vertexIds = mesh.points.map((_, index) => `${safeId}_alpha_v_${index + 1}`);
    const block = [
      `${childIndent}<MeshTopology id="${safeId}_alpha_mesh" mode="alpha">`,
      ...mesh.points.map((point, index) => (
        `${itemIndent}<Vertex id="${vertexIds[index]}" x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" />`
      )),
      ...mesh.triangles.map(([a, b, c], index) => (
        `${itemIndent}<Triangle id="${safeId}_alpha_t_${index + 1}" a="${vertexIds[a]}" b="${vertexIds[b]}" c="${vertexIds[c]}" />`
      )),
      `${childIndent}</MeshTopology>`,
    ].join('\n');
    const source = puppet.mesh
      ? editor.value.slice(0, puppet.mesh.start) + block + editor.value.slice(puppet.mesh.end)
      : editor.value.slice(0, puppet.closeStart) + `${block}\n` + editor.value.slice(puppet.closeStart);
    writeSource(source, true);
    return activePuppet();
  }

  function commitDraftMesh() {
    const puppet = activePuppet();
    if (!puppet || draftMeshPoints.length < 3) return;
    const triangles = triangulatePolygon(draftMeshPoints);
    if (!triangles.length) {
      status.textContent = 'Could not triangulate this outline. Undo crossed or duplicate points, then try again.';
      return;
    }
    const safeId = (puppet.id || puppet.target || 'custom').replace(/[^A-Za-z0-9_:-]+/g, '_');
    const lineStart = editor.value.lastIndexOf('\n', puppet.start) + 1;
    const indent = editor.value.slice(lineStart, puppet.start);
    const childIndent = `${indent}  `;
    const vertexIndent = `${childIndent}  `;
    const vertexIds = draftMeshPoints.map((_, index) => `${safeId}_mesh_v_${index + 1}`);
    const lines = [
      `${childIndent}<MeshTopology id="${escapeAttr(safeId)}_custom_mesh">`,
      ...draftMeshPoints.map((point, index) => (
        `${vertexIndent}<Vertex id="${escapeAttr(vertexIds[index])}" x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" />`
      )),
      ...triangles.map(([a, b, c], index) => (
        `${vertexIndent}<Triangle id="${escapeAttr(safeId)}_mesh_t_${index + 1}" a="${escapeAttr(vertexIds[a])}" b="${escapeAttr(vertexIds[b])}" c="${escapeAttr(vertexIds[c])}" />`
      )),
      `${childIndent}</MeshTopology>`,
    ];
    const block = lines.join('\n');
    const source = editor.value;
    drawingMesh = false;
    draftMeshPoints = [];
    if (puppet.mesh) {
      writeSource(source.slice(0, puppet.mesh.start) + block + source.slice(puppet.mesh.end), true);
    } else {
      writeSource(source.slice(0, puppet.openEnd) + `\n${block}` + source.slice(puppet.openEnd), true);
    }
    status.textContent = `Saved custom mesh with ${vertexIds.length} vertices and ${triangles.length} triangles. Drag a square vertex to refine it.`;
  }

  function commitLimbEnvelope() {
    const puppet = activePuppet();
    const role = drawingLimbRegionRole;
    if (!puppet || !role) return;
    const rolePin = quickRolePin(puppet, role);
    if (!rolePin) {
      status.textContent = `Place the ${role} Pin before drawing its Area.`;
      return;
    }
    if (draftLimbEnvelopePoints.length < MIN_LIMB_REGION_POINTS) {
      status.textContent = `Add at least ${MIN_LIMB_REGION_POINTS} points around the ${role} section before closing it.`;
      return;
    }
    if (!triangulatePolygon(draftLimbEnvelopePoints).length) {
      status.textContent = `The ${role} Area crosses itself or is too narrow. Undo points and draw a clean outline.`;
      return;
    }
    if (!pointInPolygon(
      { x: rolePin.x, y: rolePin.y },
      draftLimbEnvelopePoints,
    )) {
      status.textContent = `The ${role} Area must contain the ${role} Pin. Redraw around that local section.`;
      return;
    }
    const safeId = (puppet.id || puppet.target || 'limb').replace(/[^A-Za-z0-9_:-]+/g, '_');
    const d = [
      `M ${formatNumber(draftLimbEnvelopePoints[0].x)} ${formatNumber(draftLimbEnvelopePoints[0].y)}`,
      ...draftLimbEnvelopePoints.slice(1).map((point) => (
        `L ${formatNumber(point.x)} ${formatNumber(point.y)}`
      )),
      'Z',
    ].join(' ');
    const lineStart = editor.value.lastIndexOf('\n', puppet.start) + 1;
    const indent = editor.value.slice(lineStart, puppet.start);
    const childIndent = `${indent}  `;
    const block = [
      `${childIndent}<LimbRegion`,
      `${childIndent}  id="${escapeAttr(safeId)}_${role}_area" role="${role}"`,
      `${childIndent}  d="${escapeAttr(d)}"`,
      `${childIndent}  alphaClip="true"`,
      `${childIndent}/>`,
    ].join('\n');
    let inner = editor.value.slice(puppet.openEnd, puppet.closeStart);
    // Saving one local region must not immediately replace the working limb
    // topology. The exact three-region mesh is activated atomically only after
    // Anchor, Joint, and Control are all present.
    inner = inner.replace(/<LimbRegion\b[^>]*\/>/gi, (tag) => {
      const existingRole = (attr(tag, 'role') || '').toLowerCase();
      const normalized = /^(anchor|upper|shoulder)$/.test(existingRole)
        ? 'anchor'
        : /^(joint|elbow)$/.test(existingRole)
          ? 'joint'
          : 'control';
      return normalized === role ? '' : tag;
    });
    inner = `${inner.trimEnd()}\n${block}\n`;
    const savedRoles = new Set<LimbRegionRole>();
    for (const match of inner.matchAll(/<LimbRegion\b[^>]*\/>/gi)) {
      const rawRole = (attr(match[0], 'role') || '').toLowerCase();
      if (/^(anchor|upper|shoulder)$/.test(rawRole)) savedRoles.add('anchor');
      else if (/^(joint|elbow)$/.test(rawRole)) savedRoles.add('joint');
      else if (/^(control|forearm|hand|wrist)$/.test(rawRole)) savedRoles.add('control');
    }
    const allRegionsReady = (
      savedRoles.has('anchor')
      && savedRoles.has('joint')
      && savedRoles.has('control')
    );
    if (allRegionsReady) {
      // Only now replace the legacy envelope or generated width mesh.
      inner = inner.replace(/<LimbEnvelope\b[^>]*\/>/gi, '');
      inner = inner.replace(/<MeshTopology\b[^>]*>[\s\S]*?<\/MeshTopology\s*>/gi, '');
    }
    const openTag = replaceOpenTagAttr(
      replaceOpenTagAttr(puppet.rawOpen, 'solver', 'bones'),
      'preserveOutside',
      'true',
    );
    const source = (
      editor.value.slice(0, puppet.start)
      + openTag
      + inner
      + editor.value.slice(puppet.closeStart)
    );
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    writeSource(source, true);
    if (allRegionsReady) {
      status.textContent = 'All three Exact Areas are ready. Bone IK now uses the connected Anchor, Joint, and Control regions.';
    } else {
      const missingRoles = (['anchor', 'joint', 'control'] as LimbRegionRole[])
        .filter((item) => !savedRoles.has(item));
      status.textContent = `Saved ${role} Area. Draw ${missingRoles.join(' and ')} before Exact Areas activate; the existing mesh remains unchanged.`;
    }
  }

  function commitDraftChain() {
    const puppet = activePuppet();
    if (!puppet || draftChainPoints.length < 2) return;
    const safeId = (puppet.id || 'chain_rig').replace(/[^A-Za-z0-9_:-]+/g, '_');
    const lineStart = editor.value.lastIndexOf('\n', puppet.start) + 1;
    const indent = editor.value.slice(lineStart, puppet.start);
    const childIndent = `${indent}  `;
    const pinIds = draftChainPoints.map((_, index) => `${safeId}_chain_${index + 1}`);
    const pins = draftChainPoints.map((point, index) => {
      const role = index === 0 ? 'anchor' : index === draftChainPoints.length - 1 ? 'control' : 'chain';
      const parent = index > 0 ? ` parent="${escapeAttr(pinIds[index - 1])}"` : '';
      const fixed = index === 0 ? ' fixed="true"' : '';
      return `${childIndent}<PuppetPin id="${escapeAttr(pinIds[index])}" role="${role}"${parent} x="${formatNumber(point.x)}" y="${formatNumber(point.y)}" targetX="${formatNumber(point.x)}" targetY="${formatNumber(point.y)}"${fixed} radius="48" strength="1" falloff="constant" />`;
    }).join('\n');
    let openTag = replaceOpenTagAttr(puppet.rawOpen, 'solver', 'chain');
    openTag = replaceOpenTagAttr(openTag, 'preserveLength', String(chainPreserveLengthInput.checked));
    openTag = replaceOpenTagAttr(openTag, 'stiffness', chainStiffnessInput.value);
    openTag = replaceOpenTagAttr(openTag, 'damping', chainDampingInput.value);
    openTag = replaceOpenTagAttr(openTag, 'drag', chainDragInput.value);
    openTag = replaceOpenTagAttr(openTag, 'overlap', chainOverlapInput.value);
    openTag = replaceOpenTagAttr(openTag, 'stretch', '0');
    const binding = `${indent}<SpringChain target="${escapeAttr(puppet.id)}" segments="${Math.max(1, draftChainPoints.length - 1)}" pin="start" stiffness="${chainStiffnessInput.value}" damping="${chainDampingInput.value}" gravity={[0,18]} />`;
    const source = editor.value;
    const next = source.slice(0, puppet.start)
      + openTag
      + source.slice(puppet.openEnd, puppet.closeStart)
      + `${pins}\n`
      + source.slice(puppet.closeStart, puppet.end)
      + `\n${binding}`
      + source.slice(puppet.end);
    drawingChain = false;
    draftChainPoints = [];
    selectedPinId = pinIds[pinIds.length - 1];
    writeSource(next, true);
    status.textContent = `Created ${pinIds.length} parent-linked chain pins. Drag the final control pin to pose the tail or hair.`;
  }

  function updateMeshVertexPosition(vertexId: string, x: number, y: number, commit: boolean) {
    const vertex = activePuppet()?.mesh?.vertices.find((item) => item.id === vertexId);
    if (!vertex) return;
    let tag = replaceTagAttr(vertex.raw, 'x', formatNumber(x));
    tag = replaceTagAttr(tag, 'y', formatNumber(y));
    writeSource(editor.value.slice(0, vertex.start) + tag + editor.value.slice(vertex.end), commit);
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

  function surfaceFollowerWeights(pinId: string): Array<[RegExp, number]> {
    if (/_head_pin$/i.test(pinId)) {
      return [
        [/_neck_pin$/i, 0.76],
        [/_left_shoulder_pin$/i, 0.42],
        [/_right_shoulder_pin$/i, 0.42],
        [/_chest_pin$/i, 0.28],
        [/_pelvis_pin$/i, 0.08],
      ];
    }
    if (/_left_hand_pin$/i.test(pinId)) {
      return [[/_left_elbow_pin$/i, 0.64], [/_left_shoulder_pin$/i, 0.26], [/_chest_pin$/i, 0.08]];
    }
    if (/_right_hand_pin$/i.test(pinId)) {
      return [[/_right_elbow_pin$/i, 0.64], [/_right_shoulder_pin$/i, 0.26], [/_chest_pin$/i, 0.08]];
    }
    if (/_left_elbow_pin$/i.test(pinId)) {
      return [[/_left_shoulder_pin$/i, 0.34], [/_chest_pin$/i, 0.08]];
    }
    if (/_right_elbow_pin$/i.test(pinId)) {
      return [[/_right_shoulder_pin$/i, 0.34], [/_chest_pin$/i, 0.08]];
    }
    if (/_left_foot_pin$/i.test(pinId)) {
      return [[/_left_knee_pin$/i, 0.64], [/_pelvis_pin$/i, 0.2]];
    }
    if (/_right_foot_pin$/i.test(pinId)) {
      return [[/_right_knee_pin$/i, 0.64], [/_pelvis_pin$/i, 0.2]];
    }
    if (/_left_knee_pin$/i.test(pinId) || /_right_knee_pin$/i.test(pinId)) {
      return [[/_pelvis_pin$/i, 0.26]];
    }
    return [];
  }

  function updateSurfacePinChain(pinId: string, x: number, y: number, commit: boolean): boolean {
    if (puppetMode !== 'quick' || quickRigKind !== 'mesh') return false;
    const puppet = activePuppet();
    const control = puppet?.pins.find((pin) => pin.id === pinId);
    const followerWeights = surfaceFollowerWeights(pinId);
    if (!puppet || !control || control.role !== 'position' || !followerWeights.length) return false;

    const dx = x - control.x;
    const dy = y - control.y;
    const updates = new Map<string, { x: number; y: number }>();
    updates.set(control.id, { x, y });
    for (const [pattern, weight] of followerWeights) {
      const follower = puppet.pins.find((pin) => pin.role === 'position' && pattern.test(pin.id));
      if (follower) {
        updates.set(follower.id, {
          x: follower.x + dx * weight,
          y: follower.y + dy * weight,
        });
      }
    }

    let source = editor.value;
    const replacements = puppet.pins
      .filter((pin) => updates.has(pin.id))
      .map((pin) => {
        const target = updates.get(pin.id)!;
        let tag = translateCurveAttr(pin.raw, 'targetX', pin.targetX, target.x);
        tag = translateCurveAttr(tag, 'targetY', pin.targetY, target.y);
        return { start: pin.start, end: pin.end, tag };
      })
      .sort((a, b) => b.start - a.start);
    for (const replacement of replacements) {
      source = source.slice(0, replacement.start) + replacement.tag + source.slice(replacement.end);
    }
    writeSource(source, commit);
    selectedPinId = pinId;
    if (commit) {
      status.textContent = `Moved ${pinId}; ${replacements.length - 1} nearby support Pin(s) followed to preserve the body shape.`;
    }
    return true;
  }

  function updateQuickIk(controlId: string, targetX: number, targetY: number, commit: boolean): boolean {
    if (puppetMode !== 'quick' || quickRigKind !== 'ik') return false;
    const puppet = activePuppet();
    const anchor = puppet ? quickRolePin(puppet, 'anchor') : undefined;
    const joint = puppet ? quickRolePin(puppet, 'joint') : undefined;
    const control = puppet?.pins.find((pin) => pin.id === controlId);
    if (!puppet || !anchor || !joint || !control || (control.role !== 'control' && !/_control_pin$/i.test(control.id))) return false;

    const upperLength = Math.max(1, Math.hypot(joint.x - anchor.x, joint.y - anchor.y));
    const lowerLength = Math.max(1, Math.hypot(control.x - joint.x, control.y - joint.y));
    const sourceEndX = control.x - anchor.x;
    const sourceEndY = control.y - anchor.y;
    const sourceJointX = joint.x - anchor.x;
    const sourceJointY = joint.y - anchor.y;
    const bendSign = (sourceEndX * sourceJointY - sourceEndY * sourceJointX) < 0 ? -1 : 1;

    let dx = targetX - anchor.x;
    let dy = targetY - anchor.y;
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      dx = control.x - anchor.x;
      dy = control.y - anchor.y;
      distance = Math.max(0.001, Math.hypot(dx, dy));
    }
    const minReach = Math.abs(upperLength - lowerLength) + 0.001;
    const maxReach = upperLength + lowerLength - 0.001;
    const solvedDistance = Math.max(minReach, Math.min(maxReach, distance));
    const unitX = dx / distance;
    const unitY = dy / distance;
    const solvedControlX = anchor.x + unitX * solvedDistance;
    const solvedControlY = anchor.y + unitY * solvedDistance;
    const along = (
      upperLength * upperLength
      - lowerLength * lowerLength
      + solvedDistance * solvedDistance
    ) / (2 * solvedDistance);
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    const solvedJointX = anchor.x + unitX * along - unitY * height * bendSign;
    const solvedJointY = anchor.y + unitY * along + unitX * height * bendSign;

    let jointTag = translateCurveAttr(joint.raw, 'targetX', joint.targetX, solvedJointX);
    jointTag = translateCurveAttr(jointTag, 'targetY', joint.targetY, solvedJointY);
    let controlTag = translateCurveAttr(control.raw, 'targetX', control.targetX, solvedControlX);
    controlTag = translateCurveAttr(controlTag, 'targetY', control.targetY, solvedControlY);
    const edits = [
      { start: joint.start, end: joint.end, raw: jointTag },
      { start: control.start, end: control.end, raw: controlTag },
    ].sort((a, b) => b.start - a.start);
    let source = editor.value;
    for (const edit of edits) {
      source = `${source.slice(0, edit.start)}${edit.raw}${source.slice(edit.end)}`;
    }
    writeSource(source, commit);
    selectedPinId = controlId;
    status.textContent = commit
      ? 'Moved the hand control. Quick Puppet solved the elbow automatically.'
      : 'Solving the arm from shoulder to elbow to hand…';
    return true;
  }

  function overlayPoint(event: PointerEvent): [number, number] {
    const point = new DOMPoint(event.clientX, event.clientY);
    const matrix = overlay.getScreenCTM();
    if (!matrix) return [0, 0];
    const local = point.matrixTransform(matrix.inverse());
    return [local.x, local.y];
  }

  function beginQuickPin(role: 'anchor' | 'joint' | 'control') {
    if (!quickTargetId) {
      status.textContent = 'No artwork Layer is available for Quick Puppet.';
      return;
    }
    const puppet = activePuppet() || createWarpForTarget();
    if (!puppet) return;
    const existingRolePin = quickRolePin(puppet, role);
    if (existingRolePin) {
      selectedPinId = existingRolePin.id;
      quickPinRole = role;
      placingFreePin = true;
      drawingMesh = false;
      draftMeshPoints = [];
      drawingLimbEnvelope = false;
      drawingLimbRegionRole = '';
      draftLimbEnvelopePoints = [];
      status.textContent = `Click Preview to move the ${role} source. Its role will be preserved.`;
      refresh();
      return;
    }
    quickPinRole = role;
    placingFreePin = true;
    drawingMesh = false;
    draftMeshPoints = [];
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    status.textContent = `Click Preview to place the ${role} pin.`;
    refresh();
  }

  function updateQuickPinRadius(commit: boolean) {
    const value = Math.max(24, Math.min(320, Number(quickRadiusInput.value) || 96));
    quickRadiusInput.value = formatNumber(value);
    quickRadiusOutput.value = formatNumber(value);
    const puppet = activePuppet();
    if (!puppet) return;
    if (rebuildQuickBoneMesh(commit)) return;
    const openTag = replaceOpenTagAttr(puppet.rawOpen, 'jointSoftness', formatNumber(value * 0.5));
    writeSource(editor.value.slice(0, puppet.start) + openTag + editor.value.slice(puppet.openEnd), commit);
    status.textContent = `Limb Width set to ${formatNumber(value)} px. Place all three pins to build the local mesh.`;
  }

  quickModeButton.addEventListener('click', () => setPuppetMode('quick'));
  isolateModeButton.addEventListener('click', () => setPuppetMode('isolate'));
  targetScopeSelect.addEventListener('change', () => {
    setPuppetMode(targetScopeSelect.value === 'group' ? 'isolate' : 'quick');
  });
  $('#puppet-open-isolate').addEventListener('click', () => setPuppetMode('isolate'));
  selectToolButton.addEventListener('click', () => {
    canvasTool = 'select';
    cancelCanvasAction();
    syncCanvasTool();
    status.textContent = 'Select mode: drag an existing Pin or mesh vertex without creating a new control.';
    refresh();
  });
  quickMeshKindButton.addEventListener('click', () => {
    canvasTool = 'position';
    meshPinRole = 'position';
    if (puppetMode === 'quick') setQuickRigKind('mesh');
    else {
      cancelCanvasAction();
      syncCanvasTool();
      status.textContent = 'Position Pin targets the selected Group. Create its warp, then click Place Free Pin.';
      refresh();
    }
  });
  bendToolButton.addEventListener('click', () => {
    canvasTool = 'bend';
    meshPinRole = 'bend';
    if (puppetMode !== 'quick') setPuppetMode('quick');
    setQuickRigKind('mesh');
    const puppet = activePuppet();
    if (puppet && puppet.solver !== 'bones' && puppet.solver !== 'chain') {
      placingFreePin = true;
      status.textContent = `Bend Pin armed. Click the Layer artwork, then use Bend Rotation.`;
      refresh();
    } else {
      status.textContent = 'Build the visible alpha mesh first; Bend Pin will then become available.';
    }
  });
  quickIkKindButton.addEventListener('click', () => {
    canvasTool = 'ik';
    if (puppetMode !== 'quick') setPuppetMode('quick');
    setQuickRigKind('ik');
  });
  quickChainKindButton.addEventListener('click', () => {
    canvasTool = 'chain';
    if (puppetMode !== 'quick') setPuppetMode('quick');
    setQuickRigKind('chain');
  });
  refineToolButton.addEventListener('click', () => {
    refineOpen = !refineOpen;
    syncCanvasTool();
    status.textContent = refineOpen
      ? 'Refine is open. Draw exact Bone IK regions or a tighter Group mesh only when the automatic area is inaccurate.'
      : 'Refine is closed. The automatic alpha mesh remains active.';
    refresh();
  });
  quickRadiusInput.addEventListener('input', () => updateQuickPinRadius(false));
  quickRadiusInput.addEventListener('change', () => updateQuickPinRadius(true));
  quickIkRigSelect.addEventListener('change', () => {
    activeQuickPuppetId = quickIkRigSelect.value;
    selectedPinId = '';
    quickPinRole = '';
    placingFreePin = false;
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    refresh();
    const index = directQuickPuppets().findIndex((item) => item.id === activeQuickPuppetId);
    status.textContent = `Editing Bone IK Limb ${index + 1}. Its three pins and Exact Areas are independent from the other limbs.`;
  });
  quickAddLimbButton.addEventListener('click', () => {
    const current = directQuickPuppet();
    if (!current
      || !quickRolePin(current, 'anchor')
      || !quickRolePin(current, 'joint')
      || !quickRolePin(current, 'control')) {
      status.textContent = 'Finish Anchor, Joint, and Control on the current limb first.';
      return;
    }
    const puppet = createWarpForTarget(true);
    if (!puppet) return;
    selectedPinId = '';
    quickPinRole = 'anchor';
    placingFreePin = true;
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    refresh();
    status.textContent = `Created Bone IK Limb ${directQuickPuppets().length}. Click Preview to place its Anchor.`;
  });
  quickBendSelect.addEventListener('change', () => {
    const puppet = activePuppet();
    if (!puppet) return;
    const bend = quickBendSelect.value === '-1' ? '-1' : quickBendSelect.value === '1' ? '1' : 'auto';
    const openTag = replaceOpenTagAttr(puppet.rawOpen, 'bend', bend);
    writeSource(editor.value.slice(0, puppet.start) + openTag + editor.value.slice(puppet.openEnd), true);
    status.textContent = bend === 'auto'
      ? 'Joint Bend uses the rest pin geometry. Nearly straight chains may still flip.'
      : `Joint Bend locked to ${bend === '1' ? 'counter-clockwise' : 'clockwise'}.`;
  });
  quickStartButton.addEventListener('click', () => {
    if (!quickTargetId) return;
    const existing = directQuickPuppet();
    const hadOtherLimbs = directQuickPuppets().length > 1;
    if (existing) {
      selectedPinId = '';
      writeSource(editor.value.slice(0, existing.start) + editor.value.slice(existing.end), true);
    }
    const puppet = createWarpForTarget(hadOtherLimbs);
    placingFreePin = false;
    quickPinRole = '';
    if (puppet) status.textContent = `${existing ? 'Reset' : 'Created'} Quick Puppet on the current Layer. Place an Anchor pin first.`;
    refresh();
  });
  quickAnchorButton.addEventListener('click', () => beginQuickPin('anchor'));
  quickJointButton.addEventListener('click', () => beginQuickPin('joint'));
  quickControlButton.addEventListener('click', () => beginQuickPin('control'));
  meshStartButton.addEventListener('click', async () => {
    if (!quickTargetId) return;
    const [graphWidth, graphHeight] = graphSize(editor.value);
    const capturedMesh = await captureVisibleSurfaceMesh(
      graphWidth,
      graphHeight,
      meshDensitySelect.value,
      editor.value,
    );
    const existing = activePuppet();
    if (existing) {
      selectedPinId = '';
      writeSource(editor.value.slice(0, existing.start) + editor.value.slice(existing.end), true);
    }
    let puppet = createWarpForTarget();
    if (puppet && capturedMesh) puppet = installCapturedAlphaMesh(puppet, capturedMesh);
    placingFreePin = false;
    quickPinRole = '';
    if (puppet) {
      status.textContent = capturedMesh
        ? `${existing ? 'Reset' : 'Created'} an alpha mesh with ${capturedMesh.points.length} vertices around the visible artwork.`
        : 'Could not separate the artwork from its background. The regular fallback mesh is active.';
    }
    refresh();
  });
  meshAddPinButton.addEventListener('click', () => {
    const puppet = activePuppet();
    if (!puppet || puppet.solver === 'bones') {
      status.textContent = 'Start or replace with a Multi-Pin Mesh before adding position pins.';
      return;
    }
    meshPinRole = 'position';
    quickPinRole = '';
    placingFreePin = true;
    status.textContent = `Click Preview to place Position Pin ${puppet.pins.length + 1}.`;
    refresh();
  });
  meshAddBendPinButton.addEventListener('click', () => {
    const puppet = activePuppet();
    if (!puppet || puppet.solver === 'bones') {
      status.textContent = 'Build an Alpha Mesh before adding Bend Pins.';
      return;
    }
    meshPinRole = 'bend';
    quickPinRole = '';
    placingFreePin = true;
    status.textContent = `Click Preview to place Bend Pin ${puppet.pins.length + 1}. Select it, then adjust Bend Rotation.`;
    refresh();
  });
  meshDeletePinButton.addEventListener('click', () => {
    const pin = activePin();
    if (!pin) return;
    selectedPinId = '';
    writeSource(editor.value.slice(0, pin.start) + editor.value.slice(pin.end), true);
    status.textContent = `Deleted ${pin.id}.`;
  });
  meshDensitySelect.addEventListener('change', async () => {
    const puppet = activePuppet();
    if (!puppet || quickRigKind !== 'mesh') return;
    const [graphWidth, graphHeight] = graphSize(editor.value);
    const capturedMesh = await captureVisibleSurfaceMesh(
      graphWidth,
      graphHeight,
      meshDensitySelect.value,
      editor.value,
    );
    const openTag = replaceOpenTagAttr(puppet.rawOpen, 'density', meshDensitySelect.value);
    writeSource(editor.value.slice(0, puppet.start) + openTag + editor.value.slice(puppet.openEnd), true);
    const updated = activePuppet();
    if (updated && capturedMesh) installCapturedAlphaMesh(updated, capturedMesh);
    status.textContent = capturedMesh
      ? `Rebuilt the visible-surface alpha mesh at ${meshDensitySelect.value}.`
      : `Changed density to ${meshDensitySelect.value}; alpha capture was unavailable, so the fallback mesh remains.`;
  });
  const updateMeshPinRadius = (commit: boolean) => {
    const value = Math.max(24, Math.min(480, Number(meshRadiusInput.value) || 120));
    meshRadiusInput.value = formatNumber(value);
    meshRadiusOutput.value = formatNumber(value);
    const pin = activePin();
    if (!pin || quickRigKind !== 'mesh') {
      renderOverlay();
      return;
    }
    const tag = replaceTagAttr(pin.raw, 'radius', formatNumber(value));
    writeSource(editor.value.slice(0, pin.start) + tag + editor.value.slice(pin.end), commit);
    status.textContent = `Set ${pin.id} influence radius to ${formatNumber(value)} px.`;
  };
  meshRadiusInput.addEventListener('input', () => updateMeshPinRadius(false));
  meshRadiusInput.addEventListener('change', () => updateMeshPinRadius(true));
  const updateMeshBendRotation = (commit: boolean) => {
    const value = Math.max(-180, Math.min(180, Number(meshBendRotationInput.value) || 0));
    meshBendRotationOutput.value = `${formatNumber(value)}°`;
    const pin = activePin();
    if (!pin || pin.role !== 'bend' || quickRigKind !== 'mesh') return;
    const tag = replaceTagAttr(pin.raw, 'rotation', formatNumber(value));
    writeSource(editor.value.slice(0, pin.start) + tag + editor.value.slice(pin.end), commit);
    status.textContent = `Rotated the local mesh around ${pin.id} by ${formatNumber(value)}°.`;
  };
  meshBendRotationInput.addEventListener('input', () => updateMeshBendRotation(false));
  meshBendRotationInput.addEventListener('change', () => updateMeshBendRotation(true));
  meshShowInput.addEventListener('change', renderOverlay);
  chainShowInput.addEventListener('change', renderOverlay);

  const updateChainSetting = (input: HTMLInputElement, outputId: string, attrName: string) => {
    $<HTMLOutputElement>(outputId).value = input.value;
    const puppet = activePuppet();
    if (!puppet || puppet.solver !== 'chain') return;
    let source = editor.value;
    const openTag = replaceOpenTagAttr(puppet.rawOpen, attrName, input.value);
    source = source.slice(0, puppet.start) + openTag + source.slice(puppet.openEnd);
    if (attrName === 'stiffness' || attrName === 'damping') {
      const bindingPattern = new RegExp(
        `<SpringChain\\b[^>]*\\btarget\\s*=\\s*["']${escapeRegExp(puppet.id)}["'][^>]*/>`,
        'i',
      );
      source = source.replace(bindingPattern, (tag) => replaceOpenTagAttr(tag, attrName, input.value));
    }
    writeSource(source, true);
  };
  chainStiffnessInput.addEventListener('input', () => updateChainSetting(chainStiffnessInput, '#puppet-chain-stiffness-value', 'stiffness'));
  chainDampingInput.addEventListener('input', () => updateChainSetting(chainDampingInput, '#puppet-chain-damping-value', 'damping'));
  chainDragInput.addEventListener('input', () => updateChainSetting(chainDragInput, '#puppet-chain-drag-value', 'drag'));
  chainOverlapInput.addEventListener('input', () => updateChainSetting(chainOverlapInput, '#puppet-chain-overlap-value', 'overlap'));
  chainPreserveLengthInput.addEventListener('change', () => {
    const puppet = activePuppet();
    if (!puppet || puppet.solver !== 'chain') return;
    const openTag = replaceOpenTagAttr(puppet.rawOpen, 'preserveLength', String(chainPreserveLengthInput.checked));
    writeSource(editor.value.slice(0, puppet.start) + openTag + editor.value.slice(puppet.openEnd), true);
  });
  chainStartButton.addEventListener('click', async () => {
    if (!quickTargetId) return;
    const existing = activePuppet();
    if (existing) {
      const bindingPattern = new RegExp(
        `\\s*<SpringChain\\b[^>]*\\btarget\\s*=\\s*["']${escapeRegExp(existing.id)}["'][^>]*/>`,
        'gi',
      );
      const withoutPuppet = editor.value.slice(0, existing.start) + editor.value.slice(existing.end);
      selectedPinId = '';
      writeSource(withoutPuppet.replace(bindingPattern, ''), true);
    }
    const [graphWidth, graphHeight] = graphSize(editor.value);
    const capturedMesh = await captureVisibleSurfaceMesh(
      graphWidth,
      graphHeight,
      chainDensitySelect.value,
      editor.value,
    );
    let puppet = createWarpForTarget();
    if (puppet && capturedMesh) puppet = installCapturedAlphaMesh(puppet, capturedMesh);
    placingFreePin = false;
    drawingChain = false;
    draftChainPoints = [];
    status.textContent = capturedMesh
      ? `Built a visible chain surface with ${capturedMesh.points.length} vertices. Draw its centerline from root to tip.`
      : 'Built a fallback chain surface. Draw its centerline from root to tip.';
    refresh();
  });
  chainDrawButton.addEventListener('click', () => {
    if (!activePuppet()) return;
    drawingChain = !drawingChain;
    draftChainPoints = [];
    placingFreePin = false;
    dragPinId = '';
    status.textContent = drawingChain
      ? 'Click Preview from the fixed root through each bend to the loose tip.'
      : 'Chain centerline drawing cancelled.';
    refresh();
  });
  chainFinishButton.addEventListener('click', commitDraftChain);
  chainUndoButton.addEventListener('click', () => {
    draftChainPoints.pop();
    refresh();
  });

  $('#puppet-create-warp').addEventListener('click', () => {
    const puppet = createWarpForTarget();
    if (puppet?.pins.length) {
      placingFreePin = false;
      status.textContent = `${puppet.id} already exists. Select and drag a lime pin, or choose Place Free Pin.`;
    }
  });

  drawMeshButton.addEventListener('click', () => {
    const puppet = activePuppet() || createWarpForTarget();
    if (!puppet) return;
    drawingMesh = !drawingMesh;
    draftMeshPoints = [];
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    placingFreePin = false;
    dragPinId = '';
    if (drawingMesh) status.textContent = 'Click around the deformation boundary in Preview. Use Undo Point for mistakes, then Close Mesh.';
    else status.textContent = 'Custom mesh drawing cancelled.';
    refresh();
  });
  closeMeshButton.addEventListener('click', commitDraftMesh);
  undoMeshPointButton.addEventListener('click', () => {
    if (!drawingMesh) return;
    draftMeshPoints.pop();
    refresh();
  });
  deleteMeshButton.addEventListener('click', () => {
    const mesh = activePuppet()?.mesh;
    if (!mesh) return;
    writeSource(editor.value.slice(0, mesh.start) + editor.value.slice(mesh.end), true);
    status.textContent = 'Removed MeshTopology. This warp now uses its automatic density mesh.';
  });
  function toggleLimbRegionDrawing(role: LimbRegionRole) {
    const puppet = activePuppet();
    if (!puppet) {
      status.textContent = `Start Bone IK and place the ${role} Pin before drawing its Area.`;
      return;
    }
    if (!quickRolePin(puppet, role)) {
      status.textContent = `Place the ${role} Pin first. Then draw a small Area around its local artwork.`;
      return;
    }
    const cancelling = drawingLimbEnvelope && drawingLimbRegionRole === role;
    drawingLimbEnvelope = !cancelling;
    drawingLimbRegionRole = cancelling ? '' : role;
    draftLimbEnvelopePoints = [];
    drawingMesh = false;
    placingFreePin = false;
    dragPinId = '';
    status.textContent = drawingLimbEnvelope
      ? `Draw at least ${MIN_LIMB_REGION_POINTS} points around only the ${role} section, with its Pin inside, then press Close Area.`
      : `${role} Area drawing cancelled.`;
    refresh();
  }
  drawAnchorRegionButton.addEventListener('click', () => toggleLimbRegionDrawing('anchor'));
  drawJointRegionButton.addEventListener('click', () => toggleLimbRegionDrawing('joint'));
  drawControlRegionButton.addEventListener('click', () => toggleLimbRegionDrawing('control'));
  closeLimbEnvelopeButton.addEventListener('click', commitLimbEnvelope);
  undoLimbEnvelopeButton.addEventListener('click', () => {
    if (!drawingLimbEnvelope) return;
    draftLimbEnvelopePoints.pop();
    refresh();
  });
  deleteLimbEnvelopeButton.addEventListener('click', () => {
    const puppet = activePuppet();
    if (!puppet) return;
    const ranges = [
      ...(puppet.envelope ? [{ start: puppet.envelope.start, end: puppet.envelope.end }] : []),
      ...puppet.regions.map((region) => ({ start: region.start, end: region.end })),
    ].sort((a, b) => b.start - a.start);
    let source = editor.value;
    ranges.forEach((range) => {
      source = source.slice(0, range.start) + source.slice(range.end);
    });
    writeSource(source, true);
    status.textContent = 'Removed Exact Limb Areas. Bone IK can use Limb Width again.';
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
      if (puppetMode === 'isolate' && pin.radius < safeRadius) {
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
  quickPinList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pin-id]');
    if (!button) return;
    selectedPinId = button.dataset.pinId || '';
    refresh();
  });
  targetSelect.addEventListener('change', () => {
    drawingMesh = false;
    draftMeshPoints = [];
    drawingLimbEnvelope = false;
    drawingLimbRegionRole = '';
    draftLimbEnvelopePoints = [];
    drawingChain = false;
    draftChainPoints = [];
    dragMeshVertexId = '';
    refresh();
  });

  overlay.addEventListener('pointerdown', (event) => {
    if (!active()) return;
    const meshVertex = (event.target as SVGElement).closest<SVGElement>('[data-mesh-vertex-id]');
    if (meshVertex?.dataset.meshVertexId && !drawingMesh && !drawingLimbEnvelope) {
      dragMeshVertexId = meshVertex.dataset.meshVertexId;
      historySnapshot = editor.value;
      overlay.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const target = (event.target as SVGElement).closest<SVGElement>('[data-pin-id]');
    if (target?.dataset.pinId && !drawingMesh && !drawingLimbEnvelope) {
      dragPinId = target.dataset.pinId;
      selectedPinId = dragPinId;
      historySnapshot = editor.value;
      overlay.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const puppet = activePuppet() || createWarpForTarget();
    if (!puppet) return;
    if (drawingChain) {
      const [overlayX, overlayY] = overlayPoint(event);
      const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
      draftChainPoints.push({ x, y });
      refresh();
      event.preventDefault();
      return;
    }
    if (drawingMesh) {
      const [overlayX, overlayY] = overlayPoint(event);
      const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
      draftMeshPoints.push({ x, y });
      refresh();
      event.preventDefault();
      return;
    }
    if (drawingLimbEnvelope) {
      const [overlayX, overlayY] = overlayPoint(event);
      const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
      draftLimbEnvelopePoints.push({ x, y });
      refresh();
      event.preventDefault();
      return;
    }
    if (placingFreePin || (quickRigKind === 'ik' && puppet.pins.length === 0)) {
      const [overlayX, overlayY] = overlayPoint(event);
      const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
      const existingRolePin = puppetMode === 'quick' && quickPinRole
        ? quickRolePin(puppet, quickPinRole)
        : undefined;
      if (existingRolePin) {
        let tag = removeTagAttr(existingRolePin.raw, 'vertex');
        tag = replaceTagAttr(tag, 'x', formatNumber(x));
        tag = replaceTagAttr(tag, 'y', formatNumber(y));
        tag = replaceTagAttr(tag, 'targetX', formatNumber(x));
        tag = replaceTagAttr(tag, 'targetY', formatNumber(y));
        const movedRole = quickPinRole;
        quickPinRole = '';
        placingFreePin = false;
        selectedPinId = existingRolePin.id;
        writeSource(
          editor.value.slice(0, existingRolePin.start)
            + tag
            + editor.value.slice(existingRolePin.end),
          true,
        );
        rebuildQuickBoneMesh(true);
        status.textContent = `Moved the ${movedRole} source without deleting the pin. The bones rig remains valid.`;
        event.preventDefault();
        return;
      }
      placingFreePin = false;
      const role = puppetMode === 'quick' && quickRigKind === 'ik'
        ? (quickPinRole || (puppet.pins.length === 0 ? 'anchor' : 'control'))
        : '';
      const fixed = role === 'anchor' ? ' fixed="true"' : '';
      quickPinRole = '';
      const surfaceRole = puppetMode === 'quick' && quickRigKind === 'mesh'
        ? meshPinRole
        : '';
      const roleAttr = role
        ? `role="${role}" `
        : surfaceRole
          ? `role="${surfaceRole}" `
          : '';
      const bendAttrs = surfaceRole === 'bend' ? ' rotation="0" scale="1"' : '';
      insertPin(
        `${roleAttr}x="${formatNumber(x)}" y="${formatNumber(y)}" targetX="${formatNumber(x)}" targetY="${formatNumber(y)}"${bendAttrs}${fixed}`,
        role ? `${puppet.id || puppet.target}_${role}_pin` : '',
      );
      event.preventDefault();
    }
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!active()) return;
    const puppet = activePuppet();
    if (!puppet) return;
    const [overlayX, overlayY] = overlayPoint(event);
    const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
    if (dragMeshVertexId) updateMeshVertexPosition(dragMeshVertexId, x, y, false);
    else if (
      dragPinId
      && !updateQuickIk(dragPinId, x, y, false)
      && !updateSurfacePinChain(dragPinId, x, y, false)
    ) updatePinPosition(dragPinId, x, y, false);
    else return;
    event.preventDefault();
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!dragPinId && !dragMeshVertexId) return;
    const puppet = activePuppet();
    if (!puppet) return;
    const [overlayX, overlayY] = overlayPoint(event);
    const [x, y] = overlayToPuppet(puppet, overlayX, overlayY);
    if (dragMeshVertexId) {
      updateMeshVertexPosition(dragMeshVertexId, x, y, true);
      status.textContent = `Moved mesh vertex ${dragMeshVertexId}.`;
    } else {
      if (
        !updateQuickIk(dragPinId, x, y, true)
        && !updateSurfacePinChain(dragPinId, x, y, true)
      ) updatePinPosition(dragPinId, x, y, true);
    }
    dragPinId = '';
    dragMeshVertexId = '';
    historySnapshot = '';
    event.preventDefault();
  });
  overlay.addEventListener('pointercancel', () => {
    if (historySnapshot) writeSource(historySnapshot, true);
    dragPinId = '';
    dragMeshVertexId = '';
    historySnapshot = '';
  });

  editor.addEventListener('input', refresh);
  window.addEventListener('motionloom:tool-panel-change', (event: Event) => {
    const custom = event as CustomEvent<{ panel?: string }>;
    if (custom.detail?.panel === 'puppet-warp') refresh();
    else renderOverlay();
  });
  setPuppetMode('quick');
}
