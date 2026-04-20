import type { AppSettings, MatchRequest, MatchResponse } from "@iconcraft/shared";

export async function matchWords(input: Omit<MatchRequest, "llm"> & { llm?: Partial<AppSettings> }) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "匹配请求失败");
  }

  return (await response.json()) as MatchResponse;
}

export async function fetchSvgText(library: string, style: string, name: string) {
  const response = await fetch(`/api/icons/${library}/${style}/${name}.svg`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "SVG 获取失败");
  }

  return response.text();
}

export async function copySvgToClipboard(library: string, style: string, name: string) {
  const svg = await fetchSvgText(library, style, name);
  await navigator.clipboard.writeText(svg);
}

export async function downloadSvg(library: string, style: string, name: string) {
  const svg = await fetchSvgText(library, style, name);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadSvgBundle(library: string, style: string, names: string[]) {
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0) return;

  const files = await Promise.all(
    uniqueNames.map(async (name) => {
      const svg = await fetchSvgText(library, style, name);
      return { name, svg };
    }),
  );

  const blob = new Blob(
    files.map((file) => `<!-- ${file.name}.svg -->\n${file.svg}\n\n`),
    { type: "text/plain;charset=utf-8" },
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "iconcraft-svg-bundle.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
