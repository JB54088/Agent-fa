import assert from "node:assert/strict";
import test from "node:test";

const { getReviewErrorMessage, isReviewValidationError } = await import("../lib/review-errors.ts");

test("审核校验错误返回明确的业务提示而不是权限错误", () => {
  assert.equal(getReviewErrorMessage("official_source_url_required"), "请先补充官方公告链接或官方报名链接。");
  assert.equal(isReviewValidationError("official_source_url_required"), true);
  assert.equal(isReviewValidationError("major_requirement_required"), false);
});

test("未知审核错误仍然保留原始错误，便于定位", () => {
  assert.equal(getReviewErrorMessage("database_timeout"), "database_timeout");
});
