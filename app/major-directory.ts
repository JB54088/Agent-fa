import undergraduateDirectory from "../data/major-directory/undergraduate-2026.json";
import graduateDirectory from "../data/major-directory/graduate-2022.json";

export type MajorDirectoryItem = {
  code: string;
  name: string;
  notes: string | null;
  disciplineCode: string;
  disciplineName: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  educationLevel: "undergraduate" | "graduate";
  directoryVersion: string;
  isSpecial?: boolean;
  isNationalControl?: boolean;
  entryType?: "discipline" | "professional_degree";
  isMasterOnly?: boolean;
};

export type MajorDirectory = {
  directoryType: "undergraduate" | "graduate";
  educationLevel: "undergraduate" | "graduate";
  version: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  noticeUrl: string;
  effectiveFrom: string;
  importedAt: string;
  itemCount: number;
  items: MajorDirectoryItem[];
};

export const officialMajorDirectories: MajorDirectory[] = [
  undergraduateDirectory as MajorDirectory,
  graduateDirectory as MajorDirectory,
];

export const undergraduateMajors = officialMajorDirectories[0].items;
export const graduateDisciplines = officialMajorDirectories[1].items;

export const majorOptions = Array.from(
  undergraduateMajors.reduce((groups, item) => {
    const existing = groups.get(item.disciplineName) ?? [];
    existing.push(item.name);
    groups.set(item.disciplineName, existing);
    return groups;
  }, new Map<string, string[]>())
).map(([category, majors]) => ({ category, majors }));

export function searchMajorDirectory(query: string, educationLevel: "undergraduate" | "graduate" = "undergraduate") {
  const normalized = query.trim().toLowerCase();
  const source = educationLevel === "undergraduate" ? undergraduateMajors : graduateDisciplines;
  if (!normalized) return source.slice(0, 30);
  return source.filter((item) => `${item.code} ${item.name} ${item.disciplineName}`.toLowerCase().includes(normalized)).slice(0, 50);
}

export const majorDirectorySummary = officialMajorDirectories.map((directory) => ({
  type: directory.directoryType,
  version: directory.version,
  title: directory.title,
  sourceUrl: directory.sourceUrl,
  itemCount: directory.itemCount,
}));
