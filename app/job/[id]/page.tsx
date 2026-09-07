import { requireAppView } from "../../protected-redirect";

export const dynamic = "force-dynamic";

export default async function JobDetailPage() {
  await requireAppView("projects", "/job");
}
