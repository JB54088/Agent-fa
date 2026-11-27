export type ExistingOpportunityStatus = {
  display_type: string | null;
  publication_status: string | null;
};

/**
 * A source refresh may create a generic official-entry only when the source
 * has never had a concrete opportunity. A concrete opportunity can be
 * offline, pending review, or otherwise not currently public; creating a new
 * published placeholder in that case would bypass the operator's decision
 * and make an offline record appear to return.
 */
export function shouldCreateOfficialEntry(existing: ExistingOpportunityStatus[]) {
  return !existing.some((item) => item.display_type === "RECRUITMENT_PROJECT");
}
