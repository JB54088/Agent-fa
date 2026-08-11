import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const directories = [
  ["data/major-directory/undergraduate-2026.json", 883, "undergraduate"],
  ["data/major-directory/graduate-2022.json", 181, "graduate"],
];

for (const [file, expectedCount, type] of directories) {
  test(`${type} official directory is complete and versioned`, () => {
    const directory = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(directory.directoryType, type);
    assert.equal(directory.items.length, expectedCount);
    assert.equal(directory.itemCount, expectedCount);
    assert.match(directory.sourceUrl, /^https:\/\//);
    assert.match(directory.noticeUrl, /^https:\/\//);
    assert.equal(new Set(directory.items.map((item) => item.code)).size, expectedCount);
    assert.ok(directory.items.every((item) => item.name && item.disciplineCode && item.directoryVersion === directory.version));
  });
}
