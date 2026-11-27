import { requireAppView } from "../protected-redirect";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  await requireAppView("my-projects", "/favorites");
}
