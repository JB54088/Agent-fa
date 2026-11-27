import { redirect } from "next/navigation";
import { getAppUser } from "../chatgpt-auth";
import LoginPageClient from "./login-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  if (await getAppUser()) redirect("/");
  const params = searchParams ? await searchParams : {};
  const initialMode = params.mode === "register" ? "register" : "login";
  return <LoginPageClient initialMode={initialMode} />;
}
