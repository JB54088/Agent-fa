import type { SourcePoolCategory } from "../source-pool/types.ts";

export type DiscoveryStrategy = {
  name: string;
  category: SourcePoolCategory;
  province: string | null;
  query: string;
  priority: number;
};

export const discoveryStrategies: DiscoveryStrategy[] = [
  { name: "央企关系扩张", category: "central_soe", province: "全国", query: "成员单位 招聘官网", priority: 30 },
  { name: "地方国企缺口补全", category: "local_soe", province: null, query: "地方国资委 监管企业 招聘", priority: 40 },
  { name: "大厂行业扩张", category: "big_company", province: "全国", query: "人工智能 半导体 新能源 龙头企业 招聘官网", priority: 50 },
  { name: "省考来源补全", category: "provincial_civil_service", province: null, query: "省委组织部 人事考试网 公务员招录", priority: 20 },
  { name: "军队文职来源补全", category: "military_civilian", province: "全国", query: "军队人才 招聘 官方", priority: 20 },
];
