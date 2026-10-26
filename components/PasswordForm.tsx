"use client";

import { useActionState, useRef, useState } from "react";
import { changePassword, type SettingsState } from "@/app/actions/settings";

export default function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState<SettingsState, FormData>(async (prev, form) => {
    const result = await changePassword(prev, form);
    if (result?.saved) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={action} onChange={() => setEdited(true)} onSubmit={() => setEdited(false)} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg">Password</h2>
        <p className="text-xs text-ink-3">Changing it signs you out on your other devices. This one stays signed in.</p>
      </div>
      <label className="block max-w-sm space-y-1.5">
        <span className="eyebrow">Current password</span>
        <input name="current" type="password" required autoComplete="current-password" className="field" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">New password</span>
          <input name="next" type="password" required minLength={8} autoComplete="new-password" className="field" />
          <span className="block text-xs text-ink-3">At least 8 characters.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Repeat the new password</span>
          <input name="again" type="password" required minLength={8} autoComplete="new-password" className="field" />
        </label>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Changing…" : "Change password"}</button>
        {state?.saved && !edited && !pending && <p role="status" className="text-sm font-semibold text-go-text">Password changed</p>}
      </div>
    </form>
  );
}
