// =========================================
// =========================================
// src/scripts/motionloom-mesh-core.ts

export type V3 = [number, number, number];
export type Tag = { name: string; start: number; end: number; raw: string; closing: boolean };
export type MeshTarget = { modelId: string; assetId: string; users: number };
export type Snapshot = { modelId: string; assetId: string; positions: V3[]; faces: number[][];
  origin: V3; basis: V3[]; size: [number, number]; center: [number, number]; focal: number; near: number };

// Scan only actual tags, keeping quoted data URIs and comments out of source mapping.
export function tags(source: string): Tag[] {
  const result: Tag[] = [];
  for (let i = 0; i < source.length; i++) {
    if (source.startsWith('<!--', i)) { const end = source.indexOf('-->', i + 4); i = end < 0 ? source.length : end + 2; continue; }
    if (source[i] !== '<' || !/^<\/?[A-Za-z]/.test(source.slice(i, i + 3))) continue;
    const start = i; let quote = ''; let braces = 0;
    for (i++; i < source.length; i++) {
      const c = source[i];
      if (quote) { if (c === quote && source[i - 1] !== '\\') quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '{') braces++;
      else if (c === '}') braces--;
      else if (c === '>' && braces === 0) break;
    }
    const raw = source.slice(start, i + 1); const match = /^<(\/?)([\w]+)/.exec(raw);
    if (match) result.push({ name: match[2], closing: !!match[1], start, end: i + 1, raw });
  }
  return result;
}
export function attribute(raw: string, key: string): string {
  return new RegExp(`\\s${key}\\s*=\\s*["']([^"']*)["']`).exec(raw)?.[1] || '';
}
export function meshTargets(source: string): MeshTarget[] {
  const all = tags(source);
  const assets = new Set(all.filter(t => t.name === 'MeshAsset' && !t.closing).map(t => attribute(t.raw, 'id')));
  const models = all.filter(t => t.name === 'Model' && !t.closing && assets.has(attribute(t.raw, 'asset')));
  return models.filter(t => attribute(t.raw, 'id')).map(t => ({ modelId: attribute(t.raw, 'id'),
    assetId: attribute(t.raw, 'asset'), users: models.filter(m => attribute(m.raw, 'asset') === attribute(t.raw, 'asset')).length }));
}
export function rewriteVertices(source: string, assetId: string, changes: Map<number, V3>): string {
  const all = tags(source); let active = false; let index = 0; const patches: { start: number; end: number; value: string }[] = [];
  for (const tag of all) {
    if (tag.name === 'MeshAsset') { active = !tag.closing && attribute(tag.raw, 'id') === assetId; continue; }
    if (!active || tag.name !== 'Vertex' || tag.closing) continue;
    const value = changes.get(index++); if (!value) continue;
    if (!value.every(Number.isFinite)) throw new Error('Vertex coordinates must be finite.');
    const match = /\bposition\s*=\s*\{\s*\[[^\]]*\]\s*\}/.exec(tag.raw);
    if (!match) throw new Error('Vertex position must be a literal XYZ array.');
    patches.push({ start: tag.start + match.index, end: tag.start + match.index + match[0].length,
      value: `position={[${value.map(n => Number(n.toFixed(7))).join(',')}]}` });
  }
  if (patches.length !== changes.size) throw new Error('Mesh source changed. Refresh before editing.');
  for (const patch of patches.reverse()) source = source.slice(0, patch.start) + patch.value + source.slice(patch.end);
  return source;
}
export function view(s: Snapshot, p: V3): V3 {
  return s.origin.map((v, i) => v + s.basis.reduce((sum, b, j) => sum + b[i] * p[j], 0)) as V3;
}
export function project(s: Snapshot, p: V3): [number, number] | null {
  const v = view(s, p); if (v[2] <= s.near) return null;
  return [s.center[0] + v[0] * s.focal / v[2], s.center[1] - v[1] * s.focal / v[2]];
}
export function dragDelta(s: Snapshot, p: V3, dx: number, dy: number, axis: string): V3 {
  const v = view(s, p);
  if (axis !== 'free') {
    const a = ['x', 'y', 'z'].indexOf(axis); const b = s.basis[a];
    const sx = s.focal * (b[0]*v[2]-v[0]*b[2])/(v[2]*v[2]);
    const sy = -s.focal * (b[1]*v[2]-v[1]*b[2])/(v[2]*v[2]);
    const denom = sx*sx+sy*sy;
    if (denom < 1e-8) throw new Error('This axis points into the camera. Use its numeric input or another view.');
    const delta: V3 = [0,0,0]; delta[a] = (dx*sx+dy*sy)/denom; return delta;
  }
  // Runtime model normalization is a uniform scale and rotation: transpose/length² is its inverse.
  const d = [dx*v[2]/s.focal, -dy*v[2]/s.focal, 0];
  return s.basis.map(b => b.reduce((sum,n,i)=>sum+n*d[i],0)/b.reduce((sum,n)=>sum+n*n,0)) as V3;
}
