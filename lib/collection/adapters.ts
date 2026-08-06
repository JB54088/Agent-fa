import type { FetchContext, NormalizedOpportunity, RawRecruitmentRecord, SourceListItem, SourceValidationResult } from "./types";
import { normalizeRecruitmentRecord } from "./normalize.ts";

export interface RecruitmentSourceAdapter {
  validateSource(): Promise<SourceValidationResult>;
  fetchList(context: FetchContext): Promise<SourceListItem[]>;
  fetchDetail(item: SourceListItem, context: FetchContext): Promise<RawRecruitmentRecord>;
  normalize(record: RawRecruitmentRecord): Promise<NormalizedOpportunity>;
}

export class ManualSourceAdapter implements RecruitmentSourceAdapter {
  private readonly organizationName: string | null;

  constructor(organizationName: string | null) {
    this.organizationName = organizationName;
  }

  async validateSource(): Promise<SourceValidationResult> {
    return { valid: false, status: "MANUAL_ONLY", reasons: ["该适配器只接受管理员人工录入或上传附件"], checkedAt: new Date().toISOString() };
  }

  async fetchList(): Promise<SourceListItem[]> {
    return [];
  }

  async fetchDetail(item: SourceListItem): Promise<RawRecruitmentRecord> {
    return { sourceUrl: item.url, title: item.title, text: "", publishedAt: item.publishedAt, externalId: item.externalId, attachmentUrl: item.attachmentUrl, parserName: "manual-v1" };
  }

  async normalize(record: RawRecruitmentRecord) {
    return normalizeRecruitmentRecord(record, this.organizationName);
  }
}

export type HtmlListExtractor = (html: string, baseUrl: string) => SourceListItem[];

export class HtmlListSourceAdapter implements RecruitmentSourceAdapter {
  private readonly extractItems: HtmlListExtractor;
  private readonly organizationName: string | null;

  constructor(extractItems: HtmlListExtractor, organizationName: string | null) {
    this.extractItems = extractItems;
    this.organizationName = organizationName;
  }

  async validateSource(): Promise<SourceValidationResult> {
    return { valid: true, status: "AUTO_ALLOWED", reasons: ["页面解析由调用方提供，来源访问仍必须经过SafeSourceHttpClient"], checkedAt: new Date().toISOString() };
  }

  async fetchList(context: FetchContext) {
    if (!context.source.listPageUrl) return [];
    return this.extractItems(context.html ?? "", context.source.listPageUrl);
  }

  async fetchDetail(item: SourceListItem): Promise<RawRecruitmentRecord> {
    return { sourceUrl: item.url, title: item.title, text: "", publishedAt: item.publishedAt, externalId: item.externalId, attachmentUrl: item.attachmentUrl, parserName: "html-list-v1" };
  }

  async normalize(record: RawRecruitmentRecord) {
    return normalizeRecruitmentRecord(record, this.organizationName);
  }
}

export function chooseAdapter(strategy: string | null, organizationName: string | null): RecruitmentSourceAdapter {
  if (strategy === "HTML_LIST" || strategy === "HTML_DETAIL") return new HtmlListSourceAdapter(() => [], organizationName);
  return new ManualSourceAdapter(organizationName);
}
