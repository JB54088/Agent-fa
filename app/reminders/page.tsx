import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  await requireAppView("messages", "/reminders");
}
