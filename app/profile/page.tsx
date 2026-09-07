import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireAppView("profile", "/profile");
}
