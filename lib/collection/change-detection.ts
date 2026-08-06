export type ChangeField = "deadline" | "start" | "status" | "major_requirement" | "education_requirement" | "work_location" | "official_announcement_url" | "official_application_url" | "batch" | "deadline_type";

export type ChangeRecord = { fieldName: ChangeField; oldValue: string | null; newValue: string | null; notifyUsers: boolean; description: string };

const importantFields: ChangeField[] = ["deadline", "start", "status", "major_requirement", "education_requirement", "work_location", "official_announcement_url", "official_application_url", "batch", "deadline_type"];

export function detectOpportunityChanges(before: Record<string, unknown>, after: Record<string, unknown>): ChangeRecord[] {
  return importantFields.flatMap((fieldName) => {
    const oldValue = before[fieldName] == null ? null : String(before[fieldName]);
    const newValue = after[fieldName] == null ? null : String(after[fieldName]);
    if (oldValue === newValue) return [];
    return [{ fieldName, oldValue, newValue, notifyUsers: ["deadline", "start", "status", "official_announcement_url", "official_application_url", "deadline_type"].includes(fieldName), description: `${fieldName}发生变化，需人工核验后再通知用户` }];
  });
}
