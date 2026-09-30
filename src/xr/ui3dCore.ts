// Shared, non-component pieces of the XR UI kit (colours, geometry, text
// textures). Kept apart from ui3d.tsx so that file only exports components.
import { CanvasTexture, SRGBColorSpace, Shape, ShapeGeometry } from 'three';

export const ui = {
  panel: '#1f1b18',
  raised: '#2c2622',
  line: '#4a403a',
  hover: '#3d332d',
  accent: '#f97316',
  accentInk: '#ffffff',
  amber: '#f59e0b',
  text: '#fdf6e9',
  muted: '#bfb5ab',
};

export type V3 = [number, number, number];
const PX_PER_METRE = 1600;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const shapes = new Map<string, ShapeGeometry>();
export function roundedRect(w: number, h: number, r: number) {
  const key = `${w}:${h}:${r}`;
  let geometry = shapes.get(key);
  if (!geometry) {
    const s = new Shape();
    const x = -w / 2;
    const y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    geometry = new ShapeGeometry(s, 4);
    // ShapeGeometry UVs are in shape units; remap to 0..1 so textures fill the panel.
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - x) / w, (uv.getY(i) - y) / h);
    shapes.set(key, geometry);
  }
  return geometry;
}

// ── Canvas text ──────────────────────────────────────────────────────────────

export type TextLine = { text: string; size: number; color?: string; bold?: boolean; gapBefore?: number; align?: 'left' | 'center' };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

// Draws lines of text (sizes in metres) onto a transparent canvas texture that
// exactly covers a w×h panel.
export function makeTextTexture(w: number, h: number, lines: TextLine[], padding = 0.02): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX_PER_METRE);
  canvas.height = Math.round(h * PX_PER_METRE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;
  const pad = padding * PX_PER_METRE;
  const maxWidth = canvas.width - pad * 2;
  let y = pad;
  for (const line of lines) {
    const px = line.size * PX_PER_METRE;
    ctx.font = `${line.bold ? 700 : 400} ${px}px ${FONT}`;
    ctx.fillStyle = line.color ?? ui.text;
    ctx.textBaseline = 'top';
    y += (line.gapBefore ?? 0) * PX_PER_METRE;
    for (const row of wrap(ctx, line.text, maxWidth)) {
      if (y + px > canvas.height - pad / 2) break;
      const x = line.align === 'center' ? (canvas.width - ctx.measureText(row).width) / 2 : pad;
      ctx.fillText(row, x, y);
      y += px * 1.28;
    }
  }
  return texture;
}
