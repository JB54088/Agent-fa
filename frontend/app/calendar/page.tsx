import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireAppView("calendar", "/calendar");
}
