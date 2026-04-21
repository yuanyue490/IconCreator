#!/usr/bin/env node
// 从 Iconify 官方 collection 接口拉取图标全名单，写入 shared/config/icon-catalog/<library>/<style>/names.json。
// 运行方式：node scripts/generate-icon-names.mjs

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_ROOT = path.join(REPO_ROOT, "shared", "config", "icon-catalog");

// library/style → Iconify collection prefix（与 shared/src/constants.ts 对齐）
// filter 用于 phosphor 这种「同一 collection 多种 weight」的情形：
// - ph/regular 收录不带 -bold/-fill/-duotone/-thin/-light 后缀的基础名；
// - ph/duotone 只收录以 -duotone 结尾的名字。
const TARGETS = [
  { library: "lucide", style: "linear", prefix: "lucide" },
  { library: "heroicons", style: "linear", prefix: "heroicons-outline" },
  { library: "heroicons", style: "solid", prefix: "heroicons-solid" },
  {
    library: "ph",
    style: "regular",
    prefix: "ph",
    filter: (name) => !/-(bold|fill|duotone|thin|light)$/.test(name),
  },
  {
    library: "ph",
    style: "duotone",
    prefix: "ph",
    filter: (name) => name.endsWith("-duotone"),
  },
  { library: "tabler", style: "linear", prefix: "tabler" },
];

async function fetchCollection(prefix) {
  const url = `https://api.iconify.design/collection?prefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Iconify collection ${prefix} 返回 ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// 将 uncategorized + categories 里的所有名字聚合，不含 hidden。
function collectNames(payload) {
  const set = new Set();
  for (const n of payload?.uncategorized ?? []) set.add(n);
  for (const group of Object.values(payload?.categories ?? {})) {
    if (Array.isArray(group)) {
      for (const n of group) set.add(n);
    }
  }
  return set;
}

async function writeNames(library, style, names) {
  const dir = path.join(CATALOG_ROOT, library, style);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "names.json");
  const sorted = [...names].sort();
  const json = `${JSON.stringify(sorted, null, 2)}\n`;
  await fs.writeFile(file, json, "utf8");
  return { file, count: sorted.length };
}

async function main() {
  // 同一个 prefix 可能对应多个 style（比如 ph），复用一次网络请求。
  const cache = new Map();

  for (const target of TARGETS) {
    try {
      let payload = cache.get(target.prefix);
      if (!payload) {
        process.stdout.write(`→ fetch ${target.prefix} ... `);
        payload = await fetchCollection(target.prefix);
        cache.set(target.prefix, payload);
        console.log(`ok (total=${payload.total ?? "?"})`);
      }
      let names = collectNames(payload);
      if (target.filter) {
        names = new Set([...names].filter(target.filter));
      }
      const { file, count } = await writeNames(target.library, target.style, names);
      console.log(`  write ${path.relative(REPO_ROOT, file)}  (${count} names)`);
    } catch (error) {
      // 让单个 library 失败不影响其他，已生成的 names.json 保持原样，方便手动补救。
      console.error(`✗ ${target.library}/${target.style} 失败：${error?.message ?? error}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
