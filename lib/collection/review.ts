import type { ReviewTaskDraft } from "./types";

export function createReviewTask(rawItemId: string, taskType: ReviewTaskDraft["taskType"], confidence: number | null = null, notes = "所有采集结果必须经过管理员审核后才能发布。"): ReviewTaskDraft {
  return { rawItemId, opportunityId: null, taskType, reviewStatus: "PENDING", automatedConfidence: confidence, reviewNotes: notes };
}

export function canPublishCollectionItem(reviewStatus: string) {
  return reviewStatus === "APPROVED";
}
