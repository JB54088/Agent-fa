export type SourceDiscoveryStatus = "DISCOVERED" | "AUTO_ALLOWED" | "ATTACHMENT_ONLY" | "MANUAL_ONLY" | "NEEDS_REVIEW" | "VERIFIED" | "BLOCKED" | "INACTIVE" | "UNKNOWN";
export type SourceRunStatus = "RUNNING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "SKIPPED" | "BLOCKED";
export type CollectionReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "DUPLICATE" | "NEEDS_MORE_INFORMATION";
export type CollectionTaskType = "NEW_ITEM" | "CHANGED_ITEM" | "POSSIBLE_DUPLICATE" | "PARSE_FAILURE" | "SOURCE_AUDIT" | "SOURCE_HEALTH";

export type SourceAuditRecord = {
  id: string;
  organizationId: string;
  sourceName: string;
  sourceDomain: string | null;
  sourceUrl: string | null;
  listPageUrl: string | null;
  detailUrlPattern: string | null;
  apiUrl: string | null;
  rssUrl: string | null;
  robotsUrl: string | null;
  robotsResult: string | null;
  termsUrl: string | null;
  termsResult: string | null;
  requiresJavascript: boolean | null;
  requiresLogin: boolean | null;
  hasCaptcha: boolean | null;
  discoveryStatus: SourceDiscoveryStatus;
  automationAllowed: boolean;
  incrementalSyncEnabled?: boolean;
  requestIntervalSeconds: number;
  maxRequestsPerRun: number;
  maxRequestsPerDay: number;
  userAgent?: string | null;
  lastVerifiedAt: string | null;
  legalNotes: string | null;
  technicalNotes: string | null;
};

export type SourceListItem = {
  externalId?: string;
  title: string;
  url: string;
  publishedAt?: string;
  attachmentUrl?: string;
};

export type RawRecruitmentRecord = {
  sourceUrl: string;
  title: string;
  text: string;
  html?: string;
  attachmentUrl?: string;
  publishedAt?: string;
  externalId?: string;
  parserName: string;
};

export type NormalizedOpportunity = {
  organizationName: string | null;
  title: string;
  recruitmentYear: number | null;
  recruitmentSeason: string | null;
  batchName: string | null;
  targetGraduationYears: number[];
  description: string | null;
  educationRequirements: string[];
  majorRequirementText: string | null;
  unlimitedMajor: boolean | null;
  acceptsRelatedMajors: boolean | null;
  workLocations: string[];
  recruitmentNumber: number | null;
  officialAnnouncementUrl: string | null;
  officialApplicationUrl: string | null;
  deadlineType: "FIXED_DATE" | "UNTIL_FILLED" | "NOT_ANNOUNCED" | "LONG_TERM" | "ESTIMATED" | "OTHER";
  dataCredibility: "待评估" | "部分确认" | "已核验";
  needsManualReview: boolean;
  originalText: string;
};

export type FetchContext = {
  source: SourceAuditRecord;
  dryRun?: boolean;
  signal?: AbortSignal;
  userAgent?: string;
  html?: string;
};

export type SourceValidationResult = {
  valid: boolean;
  status: SourceDiscoveryStatus;
  reasons: string[];
  checkedAt: string;
};

export type ReviewTaskDraft = {
  rawItemId: string;
  opportunityId: string | null;
  taskType: CollectionTaskType;
  reviewStatus: "PENDING";
  automatedConfidence: number | null;
  reviewNotes: string;
};
