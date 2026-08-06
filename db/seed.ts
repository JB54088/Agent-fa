/**
 * Demo seed entry point.
 *
 * The front-end demo data lives in app/data.ts so the first version can run
 * without credentials. When DATABASE_URL and a Postgres client are connected,
 * this file is the single place to map demo projects and the 100-unit source
 * registry into organizations → data_sources → opportunities.
 */
import { projects } from "../app/data.ts";
import { dataSourcesSeed } from "./seeds/data-sources.ts";
import { organizationsSeed } from "./seeds/organizations.ts";

export { dataSourcesSeed, organizationsSeed };

export const demoSeed = projects.map((project) => ({
  company: project.company,
  shortName: project.shortName,
  projectName: project.title,
  category: project.companyType,
  batch: project.batch,
  originalMajorText: project.originalMajors,
  deadline: project.deadline,
  sourceName: project.sourceName,
  sourceLevel: project.sourceLevel,
  applicationUrl: project.link,
  demoOnly: true,
}));

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`校招雷达：已准备 ${demoSeed.length} 条演示招聘项目、${organizationsSeed.length} 家目标单位和 ${dataSourcesSeed.length} 条待核验数据源档案。`);
  console.log("当前阶段所有来源均为 NEEDS_REVIEW，不写入未经核验的招聘网址。\n");
  console.table(demoSeed.map(({ company, projectName, sourceLevel }) => ({ company, projectName, sourceLevel })));
}
