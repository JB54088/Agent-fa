import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeSourcePoolRecord } from "./normalize.ts";
import type { NormalizedSourcePoolRecord, SourcePoolImportRecord } from "./types.ts";

type SourcePoolFile = { verified?: SourcePoolImportRecord[] };

export type SourcePoolImportPlan = {
  records: NormalizedSourcePoolRecord[];
  duplicateSourceRecords: number;
  organizationCount: number;
  byCategory: Record<string, number>;
};

export async function readSourcePoolRecords(projectRoot = process.cwd()): Promise<SourcePoolImportRecord[]> {
  const files = [
    resolve(projectRoot, "docs/data-sources/verified-official-opportunity-sites.json"),
    resolve(projectRoot, "docs/data-sources/verified-source-pool-additions.json"),
  ];
  const records: SourcePoolImportRecord[] = [];
  for (const file of files) {
    try {
      const payload = JSON.parse(await readFile(file, "utf8")) as SourcePoolFile;
      records.push(...(payload.verified ?? []));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return records.filter((record) => record.status === "verified_accessible" && Boolean(record.website || record.listedUrl || record.finalUrl));
}

export async function buildSourcePoolImportPlan(projectRoot = process.cwd()): Promise<SourcePoolImportPlan> {
  const sourceRecords = await readSourcePoolRecords(projectRoot);
  const seen = new Set<string>();
  const records: NormalizedSourcePoolRecord[] = [];
  let duplicateSourceRecords = 0;
  for (const record of sourceRecords) {
    const normalized = normalizeSourcePoolRecord(record);
    if (seen.has(normalized.sourceFingerprint)) {
      duplicateSourceRecords += 1;
      continue;
    }
    seen.add(normalized.sourceFingerprint);
    records.push(normalized);
  }
  const byCategory = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.poolCategory] = (counts[record.poolCategory] ?? 0) + 1;
    return counts;
  }, {});
  return {
    records,
    duplicateSourceRecords,
    organizationCount: new Set(records.map((record) => record.organizationFingerprint)).size,
    byCategory,
  };
}
