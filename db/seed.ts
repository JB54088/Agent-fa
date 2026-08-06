/**
 * Demo seed entry point.
 *
 * The front-end demo data lives in app/data.ts so the first version can run
 * without credentials. When DATABASE_URL and a Postgres client are connected,
 * this file is the single place to map the 20 fictional projects into:
 * companies → data_sources → recruitment_projects → project_majors/regions.
 */
import { projects } from "../app/data";

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
  console.log(`校招雷达：已准备 ${demoSeed.length} 条演示招聘项目。`);
  console.log("当前版本以前端演示数据运行；接入数据库后将执行同一份映射。\n");
  console.table(demoSeed.map(({ company, projectName, sourceLevel }) => ({ company, projectName, sourceLevel })));
}
