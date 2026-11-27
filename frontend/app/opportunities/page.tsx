import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  await requireAppView("projects", "/opportunities");
}
