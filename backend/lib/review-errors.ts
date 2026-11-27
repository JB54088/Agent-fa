const reviewErrorMessages: Record<string, string> = {
  admin_authentication_required: "当前登录账号不是管理员，无法执行审核操作。",
  raw_item_not_found: "这条待审核记录不存在或已经被处理。",
  recruitment_project_name_required: "请先补充招聘项目名称。",
  official_source_url_required: "请先补充官方公告链接或官方报名链接。",
  company_and_project_required: "请先补充企业名称和招聘项目名称。",
  staging_opportunity_not_found: "这条记录没有对应的暂存招聘信息。",
  D_level_source_blocked: "D级来源不能直接发布，请先补充更高等级官方来源或特别确认。",
};

export function getReviewErrorMessage(code: string | undefined, fallback = "审核操作失败，请稍后重试。") {
  if (!code) return fallback;
  return reviewErrorMessages[code] ?? code;
}

export function isReviewValidationError(code: string | undefined) {
  return Boolean(code && [
    "recruitment_project_name_required",
    "official_source_url_required",
    "company_and_project_required",
    "staging_opportunity_not_found",
    "D_level_source_blocked",
  ].includes(code));
}
