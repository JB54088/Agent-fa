import { redirect } from "next/navigation";
import { getAppUser } from "./chatgpt-auth";

export async function requireAppView(view: "home" | "projects" | "calendar" | "my-projects" | "messages" | "profile" | "admin", returnTo: string) {
  const user = await getAppUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (view === "admin" && user.role !== "admin") redirect("/?view=home");
  redirect(`/?view=${view}`);
}
