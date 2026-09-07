import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await requireAppView("projects", "/jobs");
}
