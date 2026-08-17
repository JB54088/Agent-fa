import { sha256, normalizeOrganizationName, normalizeUrl } from "../source-pool/normalize.ts";
import type { DiscoveryCandidate } from "./types.ts";

export function discoveryQueueFingerprint(candidate: DiscoveryCandidate) {
  return sha256([
    normalizeOrganizationName(candidate.name),
    candidate.possibleCategory,
    normalizeOrganizationName(candidate.parentOrganizationName ?? ""),
    normalizeUrl(candidate.candidateUrl),
  ].join("|"));
}
