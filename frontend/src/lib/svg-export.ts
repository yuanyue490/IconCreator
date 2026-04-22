/**
 * 在浏览器内对 Iconify 拉取的 SVG 文本做导出用处理：统一边长与单色（含 currentColor 链）。
 * Phosphor duotone 等多为同一色 + 透明度，根上 `color` 即可延续层次。
 */

export interface SvgExportOptions {
  sizePx: number;
  /** 如 #fafafa */
  color: string;
}

const SIZE_MIN = 4;
const SIZE_MAX = 512;

function normalizeHex(input: string): string {
  const t = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1];
    const g = t[2];
    const b = t[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "#fafafa";
}

/**
 * 拉取到的原始 SVG 字符串 → 应用尺寸与单色，供下载/复制/ZIP。
 */
export function applySvgExportOptions(svg: string, options: SvgExportOptions): string {
  const sizePx = Math.round(
    Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number.isFinite(options.sizePx) ? options.sizePx : 24)),
  );
  const color = normalizeHex(options.color || "#fafafa");

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return svg;
    }

    const root = doc.querySelector("svg");
    if (!root) {
      return svg;
    }

    root.setAttribute("width", String(sizePx));
    root.setAttribute("height", String(sizePx));

    const prevStyle = root.getAttribute("style")?.trim() ?? "";
    const colorDecl = `color: ${color}`;
    root.setAttribute("style", prevStyle ? `${prevStyle}; ${colorDecl}` : colorDecl);

    const walk = (el: Element) => {
      for (const name of ["stroke", "fill"] as const) {
        const v = el.getAttribute(name);
        if (v === "currentColor") {
          el.setAttribute(name, color);
        }
      }
      for (let i = 0; i < el.children.length; i += 1) {
        walk(el.children[i]!);
      }
    };
    walk(root);

    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
}

export { normalizeHex };
