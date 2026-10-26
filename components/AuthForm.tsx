"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type FormState } from "@/app/actions/auth";
import { CURRENCIES } from "@/lib/types";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";

  return (
    <form action={action} className="card mx-auto w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
      {isSignup && (
        <label className="block space-y-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" autoComplete="name" required className="field" />
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="eyebrow">Email</span>
        <input name="email" type="email" autoComplete="email" required className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow">Password</span>
        <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required className="field" />
        {isSignup && <span className="block text-xs text-ink-3">At least 8 characters.</span>}
      </label>
      {isSignup && (
        <label className="block space-y-1.5">
          <span className="eyebrow">Currency</span>
          <select name="currency" defaultValue="THB" className="field">
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}</button>
      <p className="text-center text-sm text-ink-3">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-brand">{isSignup ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
