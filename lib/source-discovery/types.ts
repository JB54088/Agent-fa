import type { SourcePoolCategory } from "../source-pool/types.ts";

export type DiscoverySeed = {
  organizationName: string;
  category: SourcePoolCategory;
  province: string | null;
  url: string;
  sourceId?: string | null;
  parentOrganizationName?: string | null;
};

export type DiscoveryCandidate = {
  name: string;
  possibleCategory: SourcePoolCategory;
  parentOrganizationName: string | null;
  province: string | null;
  city: string | null;
  discoveredFrom: "official_internal_link" | "official_recruitment_link" | "search_result";
  discoveredFromUrl: string;
  candidateUrl: string;
  candidateType: "organization" | "source";
  priority: number;
  notes: string;
};

export type DiscoveryQuerySeed = {
  query: string;
  category: SourcePoolCategory;
  province: string | null;
  strategy: string;
  priority?: number;
};

export type DiscoveryFailure = {
  seed: DiscoverySeed;
  error: string;
};

export type DiscoveryRunResult = {
  candidates: DiscoveryCandidate[];
  failures: DiscoveryFailure[];
  pagesVisited: number;
};

export type DiscoveryBudget = {
  maxNewCandidatesPerDay: number;
  maxVerificationsPerDay: number;
  maxBrowserPages: number;
  timeoutMs: number;
};
