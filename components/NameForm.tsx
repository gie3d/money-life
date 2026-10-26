"use client";

import { useActionState, useState } from "react";
import { updateName, type SettingsState } from "@/app/actions/settings";

export default function NameForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateName, undefined);
  const [edited, setEdited] = useState(false);
  return (
    // Editing again hides the "Saved" note, so it never claims more than was saved.
    <form action={action} onChange={() => setEdited(true)} onSubmit={() => setEdited(false)} className="card space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Name</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" required maxLength={80} defaultValue={name} autoComplete="name" className="field" />
        </label>
        <div className="block space-y-1.5">
          <span className="eyebrow">Email</span>
          <p className="field text-ink-3">{email}</p>
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-miss-soft px-3 py-2 text-sm font-medium text-miss-text">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save name"}</button>
        {state?.saved && !edited && !pending && <p role="status" className="text-sm font-semibold text-go-text">Saved</p>}
      </div>
    </form>
  );
}
