import type { SourceListItem } from "./types";

function decodeHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function extractHtmlListItems(html: string, baseUrl: string): SourceListItem[] {
  const items: SourceListItem[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decodeHtml(match[2]);
    if (!title || !/招聘|校招|校园|应届|春招|秋招/.test(title)) continue;
    try {
      items.push({ title, url: new URL(match[1], baseUrl).toString() });
    } catch {
      // Ignore malformed links and leave the source item for manual review.
    }
  }
  return items;
}

export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}
