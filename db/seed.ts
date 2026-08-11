/**
 * Formal seed manifest.
 *
 * This module only describes records that an authenticated database adapter
 * may persist. It intentionally does not create demo users, fake projects or
 * fabricated notifications.
 */
import { officialMajorDirectories } from "../app/major-directory.ts";
import { projects } from "../app/data.ts";
import { dataSourcesSeed } from "./seeds/data-sources.ts";
import { organizationsSeed } from "./seeds/organizations.ts";

export { dataSourcesSeed, organizationsSeed };

export const directorySeed = officialMajorDirectories.map((directory) => ({
  directoryType: directory.directoryType,
  educationLevel: directory.educationLevel,
  version: directory.version,
  title: directory.title,
  publisher: directory.publisher,
  sourceUrl: directory.sourceUrl,
  noticeUrl: directory.noticeUrl,
  effectiveFrom: directory.effectiveFrom,
  itemCount: directory.itemCount,
  items: directory.items,
}));

export const curatedRecruitmentSeed = projects.map((project) => ({
  company: project.company,
  shortName: project.shortName,
  projectName: project.title,
  category: project.companyType,
  batch: project.batch,
  originalMajorText: project.originalMajors,
  deadline: project.deadline || null,
  sourceName: project.sourceName,
  sourceLevel: project.sourceLevel,
  announcementUrl: project.announcementUrl ?? null,
  applicationUrl: project.applicationUrl ?? project.link,
  publicationStatus: "published",
  verificationStatus: project.officialPageStatus === "待复核" ? "needs_review" : "verified",
  isDemo: false,
}));

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`校招雷达：已准备 ${curatedRecruitmentSeed.length} 条人工核验招聘记录、${organizationsSeed.length} 家目标单位、${dataSourcesSeed.length} 条数据源档案。`);
  console.log(`专业目录：本科 ${directorySeed.find((item) => item.directoryType === "undergraduate")?.itemCount ?? 0} 条，研究生 ${directorySeed.find((item) => item.directoryType === "graduate")?.itemCount ?? 0} 条。`);
}
