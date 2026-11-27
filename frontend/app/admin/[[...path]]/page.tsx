import { requireAppView } from "../../protected-redirect";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAppView("admin", "/admin");
}
