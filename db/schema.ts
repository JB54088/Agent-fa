import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const companyTypeEnum = pgEnum("company_type", ["央企", "地方国企", "互联网公司", "科技企业", "制造业企业", "金融企业", "知名企业"]);
export const sourceLevelEnum = pgEnum("source_level", ["A级", "B级", "C级", "D级"]);
export const projectStatusEnum = pgEnum("project_status", ["upcoming", "recruiting", "ending", "closed", "pending_review"]);
export const matchLevelEnum = pgEnum("match_level", ["明确匹配", "专业大类匹配", "不限专业", "可能匹配", "暂无匹配依据"]);
export const applicationStatusEnum = pgEnum("application_status", ["暂未处理", "准备报名", "已报名", "已完成测评", "已参加笔试", "已进入面试", "已结束"]);
export const correctionTypeEnum = pgEnum("correction_type", ["时间错误", "官方链接失效", "招聘已截止", "专业要求错误", "招聘信息重复", "其他问题"]);
export const sourceTypeEnum = pgEnum("source_type", ["企业官网", "招聘官网", "政府官网", "官方公众号", "高校就业网", "第三方网站"]);
export const collectionMethodEnum = pgEnum("collection_method", ["人工录入", "HTML页面", "公开API", "PDF附件", "Excel附件"]);
export const sourceStatusEnum = pgEnum("source_status", ["active", "paused", "invalid"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "success", "partial", "failed"]);
export const rawReviewStatusEnum = pgEnum("raw_review_status", ["pending", "in_review", "approved", "rejected", "snoozed", "converted"]);
export const duplicateStatusEnum = pgEnum("duplicate_status", ["pending", "unique", "suspected", "confirmed", "not_duplicate"]);
export const publishStatusEnum = pgEnum("publish_status", ["draft", "pending_review", "approved", "published", "rejected", "withdrawn"]);
export const verificationStatusEnum = pgEnum("verification_status", ["unverified", "pending", "verified", "needs_review", "expired"]);
export const officialPageStatusEnum = pgEnum("official_page_status", ["unknown", "accessible", "unreachable", "redirected", "blocked", "expired"]);
export const adminTaskStatusEnum = pgEnum("admin_task_status", ["open", "claimed", "in_progress", "completed", "rejected", "snoozed"]);
export const adminTaskTypeEnum = pgEnum("admin_task_type", ["new_recruitment", "page_changed", "official_link_invalid", "deadline_soon", "verification_overdue", "user_correction", "suspected_duplicate", "parse_failed"]);
export const eventTimeStatusEnum = pgEnum("event_time_status", ["待公布", "预计时间", "已确认", "已变更", "已结束"]);
export const personalTaskStatusEnum = pgEnum("personal_task_status", ["待处理", "进行中", "已完成", "已取消"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["pending", "delivered", "cancelled", "failed", "skipped"]);
export const opportunityTypeEnum = pgEnum("opportunity_type", ["ENTERPRISE_CAMPUS", "CENTRAL_SOE", "LOCAL_SOE", "NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE", "SELECTED_GRADUATE", "PUBLIC_INSTITUTION", "MILITARY_CIVILIAN", "BANK_CAMPUS", "OTHER"]);
export const deadlineTypeEnum = pgEnum("deadline_type", ["FIXED_DATE", "UNTIL_FILLED", "NOT_ANNOUNCED", "LONG_TERM", "ESTIMATED", "OTHER"]);
export const opportunityEventTimeStatusEnum = pgEnum("opportunity_event_time_status", ["CONFIRMED", "ESTIMATED", "NOT_ANNOUNCED", "CHANGED", "ENDED"]);
export const opportunityRequirementTypeEnum = pgEnum("opportunity_requirement_type", ["EDUCATION", "DEGREE", "MAJOR", "MAJOR_CATEGORY", "DISCIPLINE", "GRADUATION_YEAR", "FRESH_GRADUATE_STATUS", "AGE", "HOUSEHOLD_REGISTRATION", "POLITICAL_STATUS", "WORK_EXPERIENCE", "BASIC_LEVEL_EXPERIENCE", "CERTIFICATE", "LANGUAGE_LEVEL", "GENDER", "PHYSICAL_CONDITION", "WORK_REGION", "OTHER"]);
export const adminRoleEnum = pgEnum("admin_role", ["SUPER_ADMIN", "CONTENT_ADMIN", "DATA_ENTRY", "REVIEWER", "READ_ONLY"]);
export const sourceDiscoveryStatusEnum = pgEnum("source_discovery_status", ["DISCOVERED", "AUTO_ALLOWED", "ATTACHMENT_ONLY", "MANUAL_ONLY", "NEEDS_REVIEW", "VERIFIED", "BLOCKED", "INACTIVE", "UNKNOWN"]);
export const sourceRunStatusEnum = pgEnum("source_run_status", ["RUNNING", "SUCCESS", "PARTIAL_SUCCESS", "FAILED", "SKIPPED", "BLOCKED"]);
export const collectionReviewStatusEnum = pgEnum("collection_review_status", ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "DUPLICATE", "NEEDS_MORE_INFORMATION"]);
export const collectionReviewTaskTypeEnum = pgEnum("collection_review_task_type", ["NEW_ITEM", "CHANGED_ITEM", "POSSIBLE_DUPLICATE", "PARSE_FAILURE", "SOURCE_AUDIT", "SOURCE_HEALTH"]);
export const sourceCategoryEnum = pgEnum("source_category", ["ENTERPRISE", "CENTRAL_SOE", "LOCAL_SOE", "NATIONAL_CIVIL_SERVICE", "PROVINCIAL_CIVIL_SERVICE", "GOVERNMENT", "UNIVERSITY_EMPLOYMENT", "OTHER_OFFICIAL", "ENTERPRISE_DISCOVERY"]);
export const sourceFrequencyEnum = pgEnum("source_frequency", ["DAILY", "EVERY_7_DAYS", "MANUAL"]);
export const stagingReviewStatusEnum = pgEnum("staging_review_status", ["PENDING", "IN_REVIEW", "AUTO_APPROVED", "APPROVED", "REJECTED", "DUPLICATE", "NEEDS_MORE_INFORMATION"]);
export const opportunityRelevanceStatusEnum = pgEnum("opportunity_relevance_status", ["CURRENT_OPEN", "UPCOMING", "RECENT_CLOSED", "HISTORICAL", "PUBLIC_NOTICE", "RESULT_NOTICE", "NOT_AN_OPPORTUNITY"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_uidx").on(table.email), uniqueIndex("users_phone_uidx").on(table.phone)]);

export const majorCategories = pgTable("major_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  directoryVersionId: uuid("directory_version_id").references(() => majorDirectoryVersions.id),
  sourceId: uuid("source_id").references(() => majorSources.id),
  isCurrent: boolean("is_current").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("major_categories_code_version_uidx").on(table.code, table.directoryVersionId), index("major_categories_current_idx").on(table.isCurrent)]);

export const majors = pgTable("majors", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => majorCategories.id),
  name: text("name").notNull(),
  code: text("code"),
  aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id),
  directoryVersionId: uuid("directory_version_id").references(() => majorDirectoryVersions.id),
  sourceId: uuid("source_id").references(() => majorSources.id),
  educationLevel: text("education_level").default("undergraduate").notNull(),
  entryType: text("entry_type").default("major").notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  status: text("status").default("active").notNull(),
  effectiveFrom: date("effective_from"),
  deprecatedAt: date("deprecated_at"),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("majors_category_name_version_uidx").on(table.categoryId, table.name, table.directoryVersionId), index("majors_name_idx").on(table.name), index("majors_code_level_version_idx").on(table.code, table.educationLevel, table.directoryVersionId), index("majors_current_idx").on(table.isCurrent, table.educationLevel)]);

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  code: text("code").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("regions_code_uidx").on(table.code), index("regions_parent_idx").on(table.parentId)]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  logo: text("logo"),
  companyType: companyTypeEnum("company_type").notNull(),
  industry: text("industry"),
  officialWebsite: text("official_website"),
  recruitmentWebsite: text("recruitment_website"),
  description: text("description"),
  status: text("status").default("active").notNull(),
  ...timestamps,
}, (table) => [index("companies_name_idx").on(table.name), index("companies_type_idx").on(table.companyType)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id").references(() => organizations.id),
  regionId: uuid("region_id").references(() => regions.id),
  name: text("name").notNull(),
  shortName: text("short_name"),
  organizationType: text("organization_type").notNull(),
  industry: text("industry"),
  level: text("level"),
  officialWebsite: text("official_website"),
  recruitmentWebsite: text("recruitment_website"),
  logoUrl: text("logo_url"),
  priority: text("priority").default("P2").notNull(),
  status: text("status").default("active").notNull(),
  monitoringEnabled: boolean("monitoring_enabled").default(false).notNull(),
  monitoringSource: text("monitoring_source"),
  monitoringCategory: text("monitoring_category"),
  monitoringRegionName: text("monitoring_region_name"),
  poolNormalizedName: text("pool_normalized_name"),
  poolAliases: jsonb("pool_aliases").$type<string[]>().default([]).notNull(),
  poolCategory: text("pool_category"),
  poolSubcategory: text("pool_subcategory"),
  poolOrganizationFingerprint: text("pool_organization_fingerprint"),
  poolOfficialStatus: text("pool_official_status"),
  poolFirstDiscoveredAt: timestamp("pool_first_discovered_at", { withTimezone: true }),
  poolLastVerifiedAt: timestamp("pool_last_verified_at", { withTimezone: true }),
  poolDiscoveryMethod: text("pool_discovery_method"),
  poolDiscoveryQuery: text("pool_discovery_query"),
  poolDiscoveredFromUrl: text("pool_discovered_from_url"),
  initialSyncStatus: text("initial_sync_status").default("NOT_CHECKED").notNull(),
  initialSyncLastCheckedAt: timestamp("initial_sync_last_checked_at", { withTimezone: true }),
  initialSyncNextCheckAt: timestamp("initial_sync_next_check_at", { withTimezone: true }),
  initialSyncOfficialUrl: text("initial_sync_official_url"),
  initialSyncRecruitmentUrl: text("initial_sync_recruitment_url"),
  initialSyncFailureType: text("initial_sync_failure_type"),
  initialSyncRetryCount: integer("initial_sync_retry_count").default(0).notNull(),
  initialSyncLastResult: jsonb("initial_sync_last_result"),
  initialSyncBatch: text("initial_sync_batch"),
  initialSyncCompletedAt: timestamp("initial_sync_completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("organizations_name_uidx").on(table.name), uniqueIndex("organizations_pool_fingerprint_uidx").on(table.poolOrganizationFingerprint), index("organizations_type_idx").on(table.organizationType), index("organizations_parent_idx").on(table.parentId), index("organizations_region_idx").on(table.regionId), index("organizations_pool_category_idx").on(table.poolCategory)]);

export const organizationInitialSyncChecks = pgTable("organization_initial_sync_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  batchName: text("batch_name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  officialUrl: text("official_url"),
  recruitmentUrl: text("recruitment_url"),
  failureType: text("failure_type"),
  retryCount: integer("retry_count").default(0).notNull(),
  discoveredCount: integer("discovered_count").default(0).notNull(),
  formalAdded: integer("formal_added").default(0).notNull(),
  errorMessage: text("error_message"),
  details: jsonb("details"),
  ...timestamps,
}, (table) => [index("organization_initial_sync_checks_org_idx").on(table.organizationId, table.finishedAt), index("organization_initial_sync_checks_status_idx").on(table.status)]);

export const dataSources = pgTable("data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  regionId: uuid("region_id").references(() => regions.id),
  companyId: uuid("company_id").references(() => companies.id),
  level: sourceLevelEnum("level").notNull(),
  sourceCategory: sourceCategoryEnum("source_category"),
  sourceType: sourceTypeEnum("source_type"),
  collectionMethod: collectionMethodEnum("collection_method"),
  sourceUrl: text("source_url"),
  poolCategory: text("pool_category"),
  poolSubcategory: text("pool_subcategory"),
  poolSourceType: text("pool_source_type"),
  poolOfficialStatus: text("pool_official_status"),
  poolWebsiteName: text("pool_website_name"),
  poolUrl: text("pool_url"),
  poolCareerUrl: text("pool_career_url"),
  poolNormalizedUrl: text("pool_normalized_url"),
  poolSourceFingerprint: text("pool_source_fingerprint"),
  poolFirstDiscoveredAt: timestamp("pool_first_discovered_at", { withTimezone: true }),
  poolLastVerifiedAt: timestamp("pool_last_verified_at", { withTimezone: true }),
  poolVerificationIntervalDays: integer("pool_verification_interval_days").default(30),
  poolDiscoveryMethod: text("pool_discovery_method"),
  poolDiscoveryQuery: text("pool_discovery_query"),
  poolDiscoveredFromUrl: text("pool_discovered_from_url"),
  poolStatus: text("pool_status").default("active"),
  poolNotes: text("pool_notes"),
  sourceDomain: text("source_domain"),
  crawlerStrategy: text("crawler_strategy"),
  listPageUrl: text("list_page_url"),
  detailUrlPattern: text("detail_url_pattern"),
  apiUrl: text("api_url"),
  rssUrl: text("rss_url"),
  robotsUrl: text("robots_url"),
  robotsCheckedAt: timestamp("robots_checked_at", { withTimezone: true }),
  robotsResult: text("robots_result"),
  termsUrl: text("terms_url"),
  termsCheckedAt: timestamp("terms_checked_at", { withTimezone: true }),
  termsResult: text("terms_result"),
  requiresJavascript: boolean("requires_javascript").default(false).notNull(),
  requiresLogin: boolean("requires_login").default(false).notNull(),
  hasCaptcha: boolean("has_captcha").default(false).notNull(),
  allowedPaths: jsonb("allowed_paths").$type<string[]>().default([]).notNull(),
  prohibitedPaths: jsonb("prohibited_paths").$type<string[]>().default([]).notNull(),
  requestIntervalSeconds: integer("request_interval_seconds").default(10).notNull(),
  maxRequestsPerRun: integer("max_requests_per_run").default(20).notNull(),
  maxRequestsPerDay: integer("max_requests_per_day").default(100).notNull(),
  userAgent: text("user_agent"),
  contactEmail: text("contact_email"),
  lastFailedFetchAt: timestamp("last_failed_fetch_at", { withTimezone: true }),
  consecutiveFailureCount: integer("consecutive_failure_count").default(0).notNull(),
  legalNotes: text("legal_notes"),
  technicalNotes: text("technical_notes"),
  discoveryStatus: sourceDiscoveryStatusEnum("discovery_status").default("NEEDS_REVIEW").notNull(),
  automationAllowed: boolean("automation_allowed").default(false).notNull(),
  lastVerifiedAt: timestamp("source_last_verified_at", { withTimezone: true }),
  publisher: text("publisher"),
  checkFrequency: text("check_frequency").default("manual").notNull(),
  normalFrequency: sourceFrequencyEnum("normal_frequency").default("MANUAL").notNull(),
  activeFrequency: sourceFrequencyEnum("active_frequency").default("DAILY").notNull(),
  incrementalSyncEnabled: boolean("incremental_sync_enabled").default(false).notNull(),
  syncActiveMonths: jsonb("sync_active_months").$type<number[]>().default([2, 3, 4, 5, 7, 8, 9, 10, 11, 12]).notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastSuccessfulCollectedAt: timestamp("last_successful_collected_at", { withTimezone: true }),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
  failureCount: integer("failure_count").default(0).notNull(),
  contentFingerprint: text("content_fingerprint"),
  requiresManualReview: boolean("requires_manual_review").default(true).notNull(),
  status: sourceStatusEnum("status").default("active").notNull(),
  nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
  lastError: text("last_error"),
  adminNote: text("admin_note"),
  recruitmentLinkStatus: text("recruitment_link_status").default("NEEDS_REVIEW").notNull(),
  officialUrlStatus: text("official_url_status").default("UNREGISTERED").notNull(),
  officialUrlRegisteredAt: timestamp("official_url_registered_at", { withTimezone: true }),
  officialUrlRegisteredBy: uuid("official_url_registered_by").references(() => users.id),
  officialUrlPublishedAt: timestamp("official_url_published_at", { withTimezone: true }),
  officialUrlPublishedBy: uuid("official_url_published_by").references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("data_sources_pool_fingerprint_uidx").on(table.poolSourceFingerprint), index("data_sources_level_idx").on(table.level), index("data_sources_company_idx").on(table.companyId), index("data_sources_organization_idx").on(table.organizationId), index("data_sources_region_idx").on(table.regionId), index("data_sources_category_idx").on(table.sourceCategory), index("data_sources_status_idx").on(table.status), index("data_sources_discovery_status_idx").on(table.discoveryStatus), index("data_sources_recruitment_link_status_idx").on(table.recruitmentLinkStatus), index("data_sources_next_check_idx").on(table.nextCheckAt), index("data_sources_pool_category_idx").on(table.poolCategory), index("data_sources_pool_normalized_url_idx").on(table.poolNormalizedUrl)]);

export const sourceDiscoveries = pgTable("source_discoveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sourceUrl: text("source_url"),
  sourceDomain: text("source_domain"),
  sourceCategory: sourceCategoryEnum("source_category").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  regionId: uuid("region_id").references(() => regions.id),
  discoveryMethod: text("discovery_method").notNull(),
  discoveryStatus: sourceDiscoveryStatusEnum("discovery_status").default("DISCOVERED").notNull(),
  promotedSourceId: uuid("promoted_source_id").references(() => dataSources.id),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  notes: text("notes"),
  ...timestamps,
}, (table) => [index("source_discoveries_status_idx").on(table.discoveryStatus), index("source_discoveries_category_idx").on(table.sourceCategory), index("source_discoveries_region_idx").on(table.regionId)]);

/** Long-lived queue for organization/source candidates discovered by Playwright. */
export const discoveryQueue = pgTable("discovery_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  organizationFingerprint: text("organization_fingerprint"),
  possibleCategory: text("possible_category"),
  subcategory: text("subcategory"),
  parentOrganizationId: uuid("parent_organization_id").references(() => organizations.id),
  parentOrganizationName: text("parent_organization_name"),
  province: text("province"),
  city: text("city"),
  discoveredFrom: text("discovered_from").notNull(),
  discoveredFromUrl: text("discovered_from_url"),
  candidateUrl: text("candidate_url"),
  candidateNormalizedUrl: text("candidate_normalized_url"),
  queueFingerprint: text("queue_fingerprint").notNull(),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  priority: integer("priority").default(50).notNull(),
  status: text("status").default("pending").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  lastError: text("last_error"),
  verifiedOrganizationId: uuid("verified_organization_id").references(() => organizations.id),
  verifiedSourceId: uuid("verified_source_id").references(() => dataSources.id),
  notes: text("notes"),
  ...timestamps,
}, (table) => [uniqueIndex("discovery_queue_fingerprint_uidx").on(table.queueFingerprint), index("discovery_queue_status_priority_idx").on(table.status, table.priority), index("discovery_queue_category_region_idx").on(table.possibleCategory, table.province), index("discovery_queue_next_attempt_idx").on(table.nextAttemptAt)]);

export const discoveryRuns = pgTable("discovery_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  triggerType: text("trigger_type").default("scheduled").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").default("running").notNull(),
  maxNewCandidates: integer("max_new_candidates").default(200).notNull(),
  maxVerifications: integer("max_verifications").default(100).notNull(),
  maxBrowserPages: integer("max_browser_pages").default(100).notNull(),
  candidatesFound: integer("candidates_found").default(0).notNull(),
  queueAdded: integer("queue_added").default(0).notNull(),
  verifiedSources: integer("verified_sources").default(0).notNull(),
  newSources: integer("new_sources").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  reportPath: text("report_path"),
  errorMessage: text("error_message"),
  details: jsonb("details"),
  ...timestamps,
}, (table) => [index("discovery_runs_started_idx").on(table.startedAt), index("discovery_runs_status_idx").on(table.status)]);

export const discoveryQueries = pgTable("discovery_queries", {
  id: uuid("id").defaultRandom().primaryKey(),
  query: text("query").notNull(),
  category: text("category").notNull(),
  province: text("province").default("").notNull(),
  strategy: text("strategy").notNull(),
  priority: integer("priority").default(50).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  resultCount: integer("result_count").default(0).notNull(),
  newSourceCount: integer("new_source_count").default(0).notNull(),
  zeroResultStreak: integer("zero_result_streak").default(0).notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => [uniqueIndex("discovery_queries_query_scope_uidx").on(table.query, table.category, table.province), index("discovery_queries_priority_idx").on(table.priority, table.lastRunAt)]);

export const organizationRelations = pgTable("organization_relations", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentOrganizationId: uuid("parent_organization_id").notNull().references(() => organizations.id),
  childOrganizationId: uuid("child_organization_id").notNull().references(() => organizations.id),
  relationType: text("relation_type").notNull(),
  sourceUrl: text("source_url"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => [uniqueIndex("organization_relations_edge_uidx").on(table.parentOrganizationId, table.childOrganizationId, table.relationType), index("organization_relations_parent_idx").on(table.parentOrganizationId), index("organization_relations_child_idx").on(table.childOrganizationId)]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  displayType: text("display_type").default("RECRUITMENT_PROJECT").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  opportunityType: opportunityTypeEnum("opportunity_type").notNull(),
  recruitmentSeason: text("recruitment_season"),
  recruitmentYear: integer("recruitment_year"),
  targetGraduationYears: jsonb("target_graduation_years").$type<number[]>().default([]).notNull(),
  batchName: text("batch_name"),
  description: text("description"),
  workLocations: jsonb("work_locations").$type<string[]>().default([]).notNull(),
  recruitmentNumber: integer("recruitment_number"),
  educationRequirements: jsonb("education_requirements").$type<string[]>().default([]).notNull(),
  degreeRequirements: jsonb("degree_requirements").$type<string[]>().default([]).notNull(),
  majorRequirementText: text("major_requirement_text"),
  unlimitedMajor: boolean("unlimited_major").default(false).notNull(),
  acceptsRelatedMajors: boolean("accepts_related_majors").default(false).notNull(),
  officialAnnouncementUrl: text("official_announcement_url"),
  officialApplicationUrl: text("official_application_url"),
  sourceId: uuid("source_id").references(() => dataSources.id),
  sourceLevel: sourceLevelEnum("source_level"),
  dSpecialApproval: boolean("d_special_approval").default(false).notNull(),
  dSpecialApprovalReason: text("d_special_approval_reason"),
  dSpecialApprovedBy: uuid("d_special_approved_by").references(() => users.id),
  verificationStatus: verificationStatusEnum("verification_status").default("unverified").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by").references(() => users.id),
  nextVerifyAt: timestamp("next_verify_at", { withTimezone: true }),
  officialPageStatus: officialPageStatusEnum("official_page_status").default("unknown").notNull(),
  publicationStatus: publishStatusEnum("publication_status").default("draft").notNull(),
  calculatedStatus: projectStatusEnum("calculated_status").default("pending_review").notNull(),
  manualStatus: projectStatusEnum("manual_status"),
  statusOverride: boolean("status_override").default(false).notNull(),
  deadlineType: deadlineTypeEnum("deadline_type").default("NOT_ANNOUNCED").notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  opportunityRelevanceStatus: opportunityRelevanceStatusEnum("opportunity_relevance_status").default("CURRENT_OPEN").notNull(),
  dataCredibility: text("data_credibility").default("待评估").notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
  ...timestamps,
}, (table) => [index("opportunities_type_status_idx").on(table.opportunityType, table.calculatedStatus), index("opportunities_display_type_idx").on(table.displayType), index("opportunities_org_idx").on(table.organizationId), index("opportunities_year_idx").on(table.recruitmentYear), index("opportunities_source_idx").on(table.sourceId)]);

export const opportunityEvents = pgTable("opportunity_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  eventType: text("event_type").notNull(),
  eventName: text("event_name").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  timeStatus: opportunityEventTimeStatusEnum("time_status").default("NOT_ANNOUNCED").notNull(),
  description: text("description"),
  originalText: text("original_text"),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  sourceUrl: text("source_url"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("opportunity_events_opportunity_idx").on(table.opportunityId, table.startTime), index("opportunity_events_type_idx").on(table.eventType)]);

export const opportunityRequirements = pgTable("opportunity_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  requirementType: opportunityRequirementTypeEnum("requirement_type").notNull(),
  operator: text("operator").notNull(),
  requirementValue: text("requirement_value").notNull(),
  originalText: text("original_text").notNull(),
  isMandatory: boolean("is_mandatory").default(true).notNull(),
  requiresManualReview: boolean("requires_manual_review").default(true).notNull(),
  ...timestamps,
}, (table) => [index("opportunity_requirements_opportunity_idx").on(table.opportunityId), index("opportunity_requirements_type_idx").on(table.requirementType)]);

export const opportunityMajors = pgTable("opportunity_majors", {
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  majorId: uuid("major_id").notNull().references(() => majors.id),
  matchRule: text("match_rule").default("exact").notNull(),
  requiresManualReview: boolean("requires_manual_review").default(false).notNull(),
}, (table) => [primaryKey({ columns: [table.opportunityId, table.majorId] }), index("opportunity_majors_major_idx").on(table.majorId)]);

export const opportunityRegions = pgTable("opportunity_regions", {
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
}, (table) => [primaryKey({ columns: [table.opportunityId, table.regionId] }), index("opportunity_regions_region_idx").on(table.regionId)]);

export const opportunityPositions = pgTable("opportunity_positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  organizationName: text("organization_name"),
  departmentName: text("department_name"),
  positionName: text("position_name").notNull(),
  positionCode: text("position_code"),
  department: text("department"),
  recruitmentCount: integer("recruitment_count"),
  educationRequirement: text("education_requirement"),
  degreeRequirement: text("degree_requirement"),
  majorRequirementRaw: text("major_requirement_raw"),
  politicalStatusRequirement: text("political_status_requirement"),
  freshGraduateRequirement: text("fresh_graduate_requirement"),
  ageRequirement: text("age_requirement"),
  householdRequirement: text("household_requirement"),
  workExperienceRequirement: text("work_experience_requirement"),
  certificateRequirement: text("certificate_requirement"),
  regionId: uuid("region_id").references(() => regions.id),
  location: text("location"),
  description: text("description"),
  requirements: text("requirements"),
  remarks: text("remarks"),
  sourceUrl: text("source_url"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => [index("opportunity_positions_opportunity_idx").on(table.opportunityId), index("opportunity_positions_code_idx").on(table.positionCode), index("opportunity_positions_region_idx").on(table.regionId)]);

export const recruitmentProjects = pgTable("recruitment_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  sourceId: uuid("source_id").notNull().references(() => dataSources.id),
  projectName: text("project_name").notNull(),
  category: text("category").notNull(),
  companyNature: text("company_nature"),
  batch: text("batch"),
  intro: text("intro"),
  graduationYears: jsonb("graduation_years").$type<string[]>().default([]).notNull(),
  degreeRequirements: jsonb("degree_requirements").$type<string[]>().default([]).notNull(),
  originalMajorText: text("original_major_text").notNull(),
  majorCategories: jsonb("major_categories").$type<string[]>().default([]).notNull(),
  noMajorLimit: boolean("no_major_limit").default(false).notNull(),
  acceptsRelatedMajor: boolean("accepts_related_major").default(false).notNull(),
  publishedAt: date("published_at"),
  startAt: date("start_at"),
  deadline: date("deadline"),
  opportunityRelevanceStatus: opportunityRelevanceStatusEnum("opportunity_relevance_status").default("CURRENT_OPEN").notNull(),
  announcementUrl: text("announcement_url").notNull(),
  applicationUrl: text("application_url").notNull(),
  status: projectStatusEnum("status").default("pending_review").notNull(),
  calculatedStatus: projectStatusEnum("calculated_status").default("pending_review").notNull(),
  manualStatus: projectStatusEnum("manual_status"),
  statusOverride: boolean("status_override").default(false).notNull(),
  statusReason: text("status_reason"),
  publishStatus: publishStatusEnum("publish_status").default("pending_review").notNull(),
  isRecommended: boolean("is_recommended").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  adminNote: text("admin_note"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verificationStatus: verificationStatusEnum("verification_status").default("unverified").notNull(),
  nextVerifyAt: timestamp("next_verify_at", { withTimezone: true }),
  officialPageStatus: officialPageStatusEnum("official_page_status").default("unknown").notNull(),
  dedupeKey: text("dedupe_key"),
  dSpecialApproval: boolean("d_special_approval").default(false).notNull(),
  dSpecialApprovalReason: text("d_special_approval_reason"),
  dSpecialApprovedBy: uuid("d_special_approved_by").references(() => users.id),
  ...timestamps,
}, (table) => [index("projects_status_deadline_idx").on(table.status, table.deadline), index("projects_company_idx").on(table.companyId), index("projects_published_idx").on(table.publishedAt), index("projects_dedupe_key_idx").on(table.dedupeKey)]);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  graduationYear: integer("graduation_year").notNull(),
  degree: text("degree").notNull(),
  majorId: uuid("major_id").references(() => majors.id),
  otherMajor: text("other_major"),
  pendingMajorText: text("pending_major_text"),
  majorSelectionStatus: text("major_selection_status").default("unselected").notNull(),
  acceptNationwide: boolean("accept_nationwide").default(false).notNull(),
  acceptAnyMajor: boolean("accept_any_major").default(false).notNull(),
  preferenceTypes: jsonb("preference_types").$type<string[]>().default([]).notNull(),
  reminderPreference: jsonb("reminder_preference").$type<string[]>().default([]).notNull(),
  ...timestamps,
});

export const recruitmentProjectMajors = pgTable("recruitment_project_majors", {
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  majorId: uuid("major_id").notNull().references(() => majors.id),
  matchWeight: integer("match_weight").default(100).notNull(),
}, (table) => [primaryKey({ columns: [table.projectId, table.majorId] }), index("project_majors_major_idx").on(table.majorId)]);

export const recruitmentProjectRegions = pgTable("recruitment_project_regions", {
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
}, (table) => [primaryKey({ columns: [table.projectId, table.regionId] }), index("project_regions_region_idx").on(table.regionId)]);

export const favorites = pgTable("favorites", {
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.projectId] }), index("favorites_project_idx").on(table.projectId)]);

export const applicationTrackers = pgTable("application_trackers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  status: applicationStatusEnum("status").default("暂未处理").notNull(),
  note: text("note"),
  ...timestamps,
}, (table) => [uniqueIndex("trackers_user_project_uidx").on(table.userId, table.projectId), index("trackers_status_idx").on(table.userId, table.status)]);

export const opportunityFavorites = pgTable("opportunity_favorites", {
  userId: uuid("user_id").notNull().references(() => users.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.opportunityId] }), index("opportunity_favorites_opportunity_idx").on(table.opportunityId)]);

export const opportunityApplicationTrackers = pgTable("opportunity_application_trackers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  status: text("status").default("准备报名").notNull(),
  note: text("note"),
  ...timestamps,
}, (table) => [uniqueIndex("opportunity_trackers_user_opportunity_uidx").on(table.userId, table.opportunityId), index("opportunity_trackers_status_idx").on(table.userId, table.status)]);

export const opportunityReminderSettings = pgTable("opportunity_reminder_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  remind7Days: boolean("remind_7_days").default(true).notNull(),
  remind3Days: boolean("remind_3_days").default(true).notNull(),
  remind1Day: boolean("remind_1_day").default(true).notNull(),
  remindSameDay: boolean("remind_same_day").default(false).notNull(),
  beforeDays: jsonb("before_days").$type<number[]>().default([7, 3, 1]).notNull(),
  eventTypes: jsonb("event_types").$type<string[]>().default(["DEADLINE"]).notNull(),
  changeNotificationEnabled: boolean("change_notification_enabled").default(true).notNull(),
  autoCreated: boolean("auto_created").default(true).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("opportunity_reminders_user_opportunity_uidx").on(table.userId, table.opportunityId)]);

export const reminderSettings = pgTable("reminder_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  remind7Days: boolean("remind_7_days").default(true).notNull(),
  remind3Days: boolean("remind_3_days").default(true).notNull(),
  remind1Day: boolean("remind_1_day").default(true).notNull(),
  remindSameDay: boolean("remind_same_day").default(false).notNull(),
  onStart: boolean("on_start").default(true).notNull(),
  beforeDays: jsonb("before_days").$type<number[]>().default([7, 3, 1]).notNull(),
  onChange: boolean("on_change").default(true).notNull(),
  autoCreated: boolean("auto_created").default(true).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("reminders_user_project_uidx").on(table.userId, table.projectId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => recruitmentProjects.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  actionUrl: text("action_url"),
  readAt: timestamp("read_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("notifications_user_read_idx").on(table.userId, table.readAt), index("notifications_schedule_idx").on(table.scheduledFor)]);

export const recruitmentChanges = pgTable("recruitment_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: uuid("changed_by").references(() => users.id),
  changeType: text("change_type").notNull(),
  changeDescription: text("change_description"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  notifyUsers: boolean("notify_users").default(false).notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  ...timestamps,
}, (table) => [index("recruitment_changes_project_idx").on(table.projectId, table.createdAt)]);

export const opportunityChanges = pgTable("opportunity_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changeType: text("change_type").notNull(),
  changeDescription: text("change_description"),
  notifyUsers: boolean("notify_users").default(false).notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [index("opportunity_changes_opportunity_idx").on(table.opportunityId, table.changedAt)]);

export const correctionReports = pgTable("correction_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  userId: uuid("user_id").references(() => users.id),
  type: correctionTypeEnum("type").notNull(),
  content: text("content").notNull(),
  status: text("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("correction_reports_status_idx").on(table.status), index("correction_reports_project_idx").on(table.projectId)]);

export const adminUsers = pgTable("admin_users", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  role: text("role").default("editor").notNull(),
  ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: adminRoleEnum("name").notNull(),
  description: text("description"),
  ...timestamps,
}, (table) => [uniqueIndex("roles_name_uidx").on(table.name)]);

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  description: text("description"),
  ...timestamps,
}, (table) => [uniqueIndex("permissions_code_uidx").on(table.code)]);

export const adminUserRoles = pgTable("admin_user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
  ...timestamps,
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const systemConfigs = pgTable("system_configs", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  ...timestamps,
});

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  triggerType: text("trigger_type").default("scheduled").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").default("running").notNull(),
  fetchedCount: integer("fetched_count").default(0).notNull(),
  createdCount: integer("created_count").default(0).notNull(),
  changedCount: integer("changed_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => [index("collection_runs_source_idx").on(table.dataSourceId, table.startedAt), index("collection_runs_status_idx").on(table.status)]);

export const sourceFetchRuns = pgTable("source_fetch_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  runStatus: sourceRunStatusEnum("run_status").default("RUNNING").notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  discoveredCount: integer("discovered_count").default(0).notNull(),
  createdCount: integer("created_count").default(0).notNull(),
  updatedCount: integer("updated_count").default(0).notNull(),
  skippedCount: integer("skipped_count").default(0).notNull(),
  duplicateCount: integer("duplicate_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  httpStatusSummary: jsonb("http_status_summary"),
  errorMessage: text("error_message"),
  logPath: text("log_path"),
  ...timestamps,
}, (table) => [index("source_fetch_runs_source_idx").on(table.dataSourceId, table.startedAt), index("source_fetch_runs_status_idx").on(table.runStatus)]);

export const rawCollectedItems = pgTable("raw_collected_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  collectionRunId: uuid("collection_run_id").references(() => collectionRuns.id),
  sourceUrl: text("source_url").notNull(),
  originalTitle: text("original_title"),
  originalContent: text("original_content"),
  originalHtml: text("original_html"),
  attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  contentHash: text("content_hash").notNull(),
  previousContentHash: text("previous_content_hash"),
  contentSummary: text("content_summary"),
  previousContentSummary: text("previous_content_summary"),
  parserName: text("parser_name"),
  parserResult: jsonb("parser_result"),
  normalizedPayload: jsonb("normalized_payload"),
  parseStatus: parseStatusEnum("parse_status").default("pending").notNull(),
  reviewStatus: rawReviewStatusEnum("review_status").default("pending").notNull(),
  duplicateStatus: duplicateStatusEnum("duplicate_status").default("pending").notNull(),
  promotedProjectId: uuid("promoted_project_id").references(() => recruitmentProjects.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => [index("raw_items_source_collected_idx").on(table.dataSourceId, table.collectedAt), index("raw_items_review_idx").on(table.reviewStatus), index("raw_items_hash_idx").on(table.contentHash)]);

/**
 * Canonical raw layer for new collection batches. raw_collected_items remains
 * as a compatibility table until every historical record has been migrated.
 */
export const rawSourceItems = pgTable("raw_source_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  collectionRunId: uuid("collection_run_id").references(() => collectionRuns.id),
  sourceUrl: text("source_url").notNull(),
  originalTitle: text("original_title"),
  originalContent: text("original_content"),
  originalHtml: text("original_html"),
  attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  contentHash: text("content_hash").notNull(),
  previousContentHash: text("previous_content_hash"),
  contentSummary: text("content_summary"),
  previousContentSummary: text("previous_content_summary"),
  parserName: text("parser_name"),
  parserResult: jsonb("parser_result"),
  normalizedPayload: jsonb("normalized_payload"),
  parseStatus: parseStatusEnum("parse_status").default("pending").notNull(),
  reviewStatus: rawReviewStatusEnum("review_status").default("pending").notNull(),
  duplicateStatus: duplicateStatusEnum("duplicate_status").default("pending").notNull(),
  promotedOpportunityId: uuid("promoted_opportunity_id").references(() => opportunities.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => [index("raw_source_items_source_collected_idx").on(table.dataSourceId, table.collectedAt), index("raw_source_items_review_idx").on(table.reviewStatus), index("raw_source_items_hash_idx").on(table.contentHash)]);

export const stagingOpportunities = pgTable("staging_opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawSourceItemId: uuid("raw_source_item_id").references(() => rawSourceItems.id),
  dataSourceId: uuid("data_source_id").references(() => dataSources.id),
  importBatchId: uuid("import_batch_id").references(() => importBatches.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  companyName: text("company_name").notNull(),
  projectName: text("project_name").notNull(),
  opportunityType: opportunityTypeEnum("opportunity_type"),
  recruitmentSeason: text("recruitment_season"),
  recruitmentYear: integer("recruitment_year"),
  recruitmentBatch: text("recruitment_batch"),
  graduationYears: jsonb("graduation_years").$type<number[]>().default([]).notNull(),
  degreeRequirements: jsonb("degree_requirements").$type<string[]>().default([]).notNull(),
  originalMajorText: text("original_major_text").notNull(),
  normalizedMajorNames: jsonb("normalized_major_names").$type<string[]>().default([]).notNull(),
  majorCategories: jsonb("major_categories").$type<string[]>().default([]).notNull(),
  workLocations: jsonb("work_locations").$type<string[]>().default([]).notNull(),
  publishedAt: date("published_at"),
  startAt: date("start_at"),
  deadline: date("deadline"),
  announcementUrl: text("announcement_url"),
  applicationUrl: text("application_url"),
  deadlineType: deadlineTypeEnum("deadline_type"),
  relevanceStatus: opportunityRelevanceStatusEnum("relevance_status").default("CURRENT_OPEN").notNull(),
  validationErrors: jsonb("validation_errors").$type<string[]>().default([]).notNull(),
  dedupeKey: text("dedupe_key"),
  reviewStatus: stagingReviewStatusEnum("review_status").default("PENDING").notNull(),
  reviewerNote: text("reviewer_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  promotedOpportunityId: uuid("promoted_opportunity_id").references(() => opportunities.id),
  ...timestamps,
}, (table) => [index("staging_opportunities_review_idx").on(table.reviewStatus, table.createdAt), index("staging_opportunities_dedupe_idx").on(table.dedupeKey), index("staging_opportunities_raw_idx").on(table.rawSourceItemId)]);

export const sourceChangeEvents = pgTable("source_change_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  rawItemId: uuid("raw_item_id").notNull().references(() => rawCollectedItems.id),
  previousHash: text("previous_hash"),
  currentHash: text("current_hash").notNull(),
  previousSummary: text("previous_summary"),
  currentSummary: text("current_summary"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  reviewTaskId: uuid("review_task_id"),
  ...timestamps,
}, (table) => [index("source_changes_source_idx").on(table.dataSourceId, table.detectedAt)]);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  fileStorageKey: text("file_storage_key"),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  status: text("status").default("uploaded").notNull(),
  fieldMapping: jsonb("field_mapping"),
  totalRows: integer("total_rows").default(0).notNull(),
  validRows: integer("valid_rows").default(0).notNull(),
  errorRows: integer("error_rows").default(0).notNull(),
  duplicateRows: integer("duplicate_rows").default(0).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("import_batches_uploader_idx").on(table.uploadedBy, table.createdAt), index("import_batches_status_idx").on(table.status)]);

export const importRows = pgTable("import_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull().references(() => importBatches.id),
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").notNull(),
  normalizedData: jsonb("normalized_data"),
  validationErrors: jsonb("validation_errors").$type<string[]>().default([]).notNull(),
  companyMatchStatus: text("company_match_status").default("pending").notNull(),
  majorMatchStatus: text("major_match_status").default("pending").notNull(),
  duplicateStatus: duplicateStatusEnum("duplicate_status").default("pending").notNull(),
  reviewStatus: rawReviewStatusEnum("review_status").default("pending").notNull(),
  promotedProjectId: uuid("promoted_project_id").references(() => recruitmentProjects.id),
  ...timestamps,
}, (table) => [uniqueIndex("import_rows_batch_row_uidx").on(table.batchId, table.rowNumber), index("import_rows_review_idx").on(table.reviewStatus)]);

export const adminTasks = pgTable("admin_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskType: adminTaskTypeEnum("task_type").notNull(),
  status: adminTaskStatusEnum("status").default("open").notNull(),
  priority: text("priority").default("medium").notNull(),
  rawItemId: uuid("raw_item_id").references(() => rawCollectedItems.id),
  projectId: uuid("project_id").references(() => recruitmentProjects.id),
  importRowId: uuid("import_row_id").references(() => importRows.id),
  correctionReportId: uuid("correction_report_id").references(() => correctionReports.id),
  assigneeId: uuid("assignee_id").references(() => users.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  resolution: text("resolution"),
  adminNote: text("admin_note"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("admin_tasks_status_idx").on(table.status, table.priority), index("admin_tasks_assignee_idx").on(table.assigneeId, table.status), index("admin_tasks_due_idx").on(table.dueAt)]);

export const collectionReviewTasks = pgTable("collection_review_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  rawItemId: uuid("raw_item_id").notNull().references(() => rawCollectedItems.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  taskType: collectionReviewTaskTypeEnum("task_type").notNull(),
  reviewStatus: collectionReviewStatusEnum("review_status").default("PENDING").notNull(),
  assignedAdminId: uuid("assigned_admin_id").references(() => users.id),
  automatedConfidence: integer("automated_confidence"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("collection_review_tasks_status_idx").on(table.reviewStatus), index("collection_review_tasks_assignee_idx").on(table.assignedAdminId, table.reviewStatus), index("collection_review_tasks_raw_idx").on(table.rawItemId)]);

export const projectVerificationRecords = pgTable("project_verification_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  dataSourceId: uuid("data_source_id").references(() => dataSources.id),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verificationStatus: verificationStatusEnum("verification_status").notNull(),
  officialPageStatus: officialPageStatusEnum("official_page_status").notNull(),
  observedContentHash: text("observed_content_hash"),
  verificationNote: text("verification_note"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow().notNull(),
  nextVerifyAt: timestamp("next_verify_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("verification_records_project_idx").on(table.projectId, table.verifiedAt), index("verification_records_next_idx").on(table.nextVerifyAt)]);

export const recruitmentProjectSources = pgTable("recruitment_project_sources", {
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  dataSourceId: uuid("data_source_id").notNull().references(() => dataSources.id),
  sourceUrl: text("source_url").notNull(),
  sourceRole: text("source_role").default("other").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.projectId, table.dataSourceId, table.sourceUrl] }), index("project_sources_source_idx").on(table.dataSourceId)]);

export const projectTargetYears = pgTable("project_target_years", {
  projectId: uuid("project_id").notNull().references(() => recruitmentProjects.id),
  graduationYear: integer("graduation_year").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
}, (table) => [primaryKey({ columns: [table.projectId, table.graduationYear] }), uniqueIndex("project_target_year_dedupe_uidx").on(table.dedupeKey), index("project_target_year_idx").on(table.graduationYear)]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  ...timestamps,
}, (table) => [index("admin_audit_actor_idx").on(table.actorId, table.createdAt), index("admin_audit_entity_idx").on(table.entityType, table.entityId)]);

export const majorAliases = pgTable("major_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  majorId: uuid("major_id").notNull().references(() => majors.id),
  aliasName: text("alias_name").notNull(),
  aliasType: text("alias_type").notNull(),
  source: text("source"),
  sourceId: uuid("source_id").references(() => majorSources.id),
  confidence: integer("confidence"),
  isOfficial: boolean("is_official").default(false).notNull(),
  status: text("status").default("active").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("major_aliases_major_name_uidx").on(table.majorId, table.aliasName), index("major_aliases_name_idx").on(table.aliasName)]);

export const majorMappings = pgTable("major_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  majorId: uuid("major_id").notNull().references(() => majors.id),
  majorCategoryId: uuid("major_category_id").notNull().references(() => majorCategories.id),
  disciplineId: text("discipline_id"),
  educationLevel: text("education_level"),
  version: text("version").notNull(),
  source: text("source"),
  status: text("status").default("active").notNull(),
  ...timestamps,
}, (table) => [index("major_mappings_major_idx").on(table.majorId), index("major_mappings_version_idx").on(table.version)]);

export const recruitmentMajorRules = pgTable("recruitment_major_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  recruitmentProjectId: uuid("recruitment_project_id").notNull().references(() => recruitmentProjects.id),
  ruleType: text("rule_type").notNull(),
  ruleValue: text("rule_value").notNull(),
  majorId: uuid("major_id").references(() => majors.id),
  majorCategoryId: uuid("major_category_id").references(() => majorCategories.id),
  confidence: integer("confidence"),
  originalText: text("original_text").notNull(),
  confidenceLevel: text("confidence_level").default("manual").notNull(),
  requiresManualReview: boolean("requires_manual_review").default(true).notNull(),
  ...timestamps,
}, (table) => [index("recruitment_major_rules_project_idx").on(table.recruitmentProjectId), index("recruitment_major_rules_type_idx").on(table.ruleType)]);

export const recruitmentEvents = pgTable("recruitment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  recruitmentProjectId: uuid("recruitment_project_id").notNull().references(() => recruitmentProjects.id),
  eventType: text("event_type").notNull(),
  eventName: text("event_name").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  timeStatus: eventTimeStatusEnum("time_status").default("待公布").notNull(),
  description: text("description"),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  sourceUrl: text("source_url"),
  ...timestamps,
}, (table) => [index("recruitment_events_project_idx").on(table.recruitmentProjectId, table.startTime), index("recruitment_events_type_idx").on(table.eventType)]);

export const personalTasks = pgTable("personal_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => recruitmentProjects.id),
  title: text("title").notNull(),
  status: personalTaskStatusEnum("status").default("待处理").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  nextAction: text("next_action"),
  suggested: boolean("suggested").default(false).notNull(),
  ...timestamps,
}, (table) => [index("personal_tasks_user_status_idx").on(table.userId, table.status), index("personal_tasks_project_idx").on(table.projectId)]);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  recruitmentProjectId: uuid("recruitment_project_id").references(() => recruitmentProjects.id),
  recruitmentEventId: uuid("recruitment_event_id").references(() => recruitmentEvents.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  opportunityEventId: uuid("opportunity_event_id").references(() => opportunityEvents.id),
  reminderType: text("reminder_type").notNull(),
  channel: text("channel").default("in_app").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  deliveryStatus: deliveryStatusEnum("delivery_status").default("pending").notNull(),
  deduplicationKey: text("deduplication_key").notNull(),
  failureReason: text("failure_reason"),
  ...timestamps,
}, (table) => [uniqueIndex("notification_deliveries_dedupe_uidx").on(table.deduplicationKey), index("notification_deliveries_user_idx").on(table.userId, table.scheduledAt)]);

/** Versioned official directory sources. Raw PDFs are kept outside the app bundle; the import checksum is the audit anchor. */
export const majorSources = pgTable("major_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  sourceUrl: text("source_url").notNull(),
  noticeUrl: text("notice_url"),
  sourceFileName: text("source_file_name"),
  contentHash: text("content_hash"),
  publishedAt: date("published_at"),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("major_sources_hash_uidx").on(table.contentHash), index("major_sources_publisher_idx").on(table.publisher)]);

export const majorDirectoryVersions = pgTable("major_directory_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  directoryType: text("directory_type").notNull(),
  version: text("version").notNull(),
  sourceId: uuid("source_id").notNull().references(() => majorSources.id),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  isCurrent: boolean("is_current").default(false).notNull(),
  itemCount: integer("item_count").default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("major_directory_type_version_uidx").on(table.directoryType, table.version), index("major_directory_current_idx").on(table.directoryType, table.isCurrent)]);

export const disciplines = pgTable("disciplines", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  educationLevel: text("education_level").notNull(),
  directoryVersionId: uuid("directory_version_id").notNull().references(() => majorDirectoryVersions.id),
  isCurrent: boolean("is_current").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("disciplines_code_version_level_uidx").on(table.code, table.directoryVersionId, table.educationLevel), index("disciplines_parent_idx").on(table.parentId), index("disciplines_name_idx").on(table.name)]);

export const professionalDegreeCategories = pgTable("professional_degree_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  disciplineId: uuid("discipline_id").references(() => disciplines.id),
  directoryVersionId: uuid("directory_version_id").notNull().references(() => majorDirectoryVersions.id),
  masterOnly: boolean("master_only").default(false).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("professional_degree_code_version_uidx").on(table.code, table.directoryVersionId), index("professional_degree_name_idx").on(table.name)]);

export const majorSuccessorMappings = pgTable("major_successor_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromMajorId: uuid("from_major_id").notNull().references(() => majors.id),
  toMajorId: uuid("to_major_id").notNull().references(() => majors.id),
  mappingType: text("mapping_type").notNull(),
  sourceId: uuid("source_id").references(() => majorSources.id),
  note: text("note"),
  ...timestamps,
}, (table) => [uniqueIndex("major_successor_pair_uidx").on(table.fromMajorId, table.toMajorId), index("major_successor_from_idx").on(table.fromMajorId), index("major_successor_to_idx").on(table.toMajorId)]);

export const majorImportRuns = pgTable("major_import_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => majorSources.id),
  directoryVersionId: uuid("directory_version_id").notNull().references(() => majorDirectoryVersions.id),
  inputFileName: text("input_file_name").notNull(),
  inputHash: text("input_hash").notNull(),
  rowCount: integer("row_count").default(0).notNull(),
  acceptedCount: integer("accepted_count").default(0).notNull(),
  rejectedCount: integer("rejected_count").default(0).notNull(),
  status: text("status").default("pending").notNull(),
  errorSummary: text("error_summary"),
  importedBy: uuid("imported_by").references(() => users.id),
  ...timestamps,
}, (table) => [index("major_import_runs_version_idx").on(table.directoryVersionId, table.createdAt), index("major_import_runs_hash_idx").on(table.inputHash)]);

export const opportunityMajorRules = pgTable("opportunity_major_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  ruleType: text("rule_type").notNull(),
  ruleValue: text("rule_value"),
  majorId: uuid("major_id").references(() => majors.id),
  majorCategoryId: uuid("major_category_id").references(() => majorCategories.id),
  disciplineId: uuid("discipline_id").references(() => disciplines.id),
  professionalDegreeCategoryId: uuid("professional_degree_category_id").references(() => professionalDegreeCategories.id),
  originalText: text("original_text").notNull(),
  confidence: integer("confidence"),
  requiresManualReview: boolean("requires_manual_review").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps,
}, (table) => [index("opportunity_major_rules_opportunity_idx").on(table.opportunityId), index("opportunity_major_rules_major_idx").on(table.majorId), index("opportunity_major_rules_discipline_idx").on(table.disciplineId)]);
