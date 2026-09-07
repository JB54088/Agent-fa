import { redirect } from "next/navigation";
import RadarApp, { type RadarView } from "./radar-client";
import { getAppUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

const allowedViews: RadarView[] = ["home", "projects", "calendar", "my-projects", "messages", "profile", "admin", "about"];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const user = await getAppUser();
  if (!user) redirect("/login?returnTo=/");

  const params = searchParams ? await searchParams : {};
  const rawView = typeof params.view === "string" ? params.view : "home";
  const initialView = allowedViews.includes(rawView as RadarView) ? rawView as RadarView : "home";
  if (initialView === "admin" && user.role !== "admin") redirect("/?view=home");

  return <RadarApp initialView={initialView} />;
}
