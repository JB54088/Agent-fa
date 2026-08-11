import fs from "node:fs";

const sources = [
  ["data/major-directory/undergraduate-2026.json", 883, "undergraduate"],
  ["data/major-directory/graduate-2022.json", 181, "graduate"],
];

for (const [file, expectedCount, type] of sources) {
  const directory = JSON.parse(fs.readFileSync(file, "utf8"));
  if (directory.directoryType !== type) throw new Error(`${file}: directory type mismatch`);
  if (directory.itemCount !== expectedCount || directory.items.length !== expectedCount) {
    throw new Error(`${file}: expected ${expectedCount} items, received ${directory.items.length}`);
  }
  if (!/^https:\/\//.test(directory.sourceUrl) || !/^https:\/\//.test(directory.noticeUrl)) {
    throw new Error(`${file}: official source URLs are required`);
  }
  const codes = directory.items.map((item) => item.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${file}: duplicate professional codes found`);
  for (const item of directory.items) {
    if (!item.code || !item.name || !item.disciplineCode || !item.disciplineName) {
      throw new Error(`${file}: incomplete row ${JSON.stringify(item)}`);
    }
  }
  console.log(`${file}: ${directory.items.length} rows, ${directory.version}, source verified`);
}
