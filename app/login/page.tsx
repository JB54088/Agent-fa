import { redirect } from "next/navigation";
import { getAppUser } from "../chatgpt-auth";
import LoginPageClient from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAppUser()) redirect("/");
  return <LoginPageClient />;
}
