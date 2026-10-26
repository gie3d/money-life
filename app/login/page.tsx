import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page() {
  if (await getUser()) redirect("/");
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <AuthForm mode="login" />
    </div>
  );
}
