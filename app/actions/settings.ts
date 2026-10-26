"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { hashPassword, requireUser, revokeOtherSessions, verifyPassword } from "@/lib/session";
import { CATEGORY_COLORS, STARTER_CATEGORIES } from "@/lib/types";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

export async function updateName(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "Use a name of 1 to 80 characters." };

  await pool.query("UPDATE users SET name = $2 WHERE id = $1", [user.id, name]);
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function changePassword(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const again = String(form.get("again") ?? "");

  if (next.length < 8) return { error: "Use a new password of at least 8 characters." };
  if (next !== again) return { error: "The new password and its repeat don't match." };

  const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) return { error: "Your current password is wrong." };
  if (next === current) return { error: "Choose a password different from the current one." };

  await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, await hashPassword(next)]);
  // Anyone else signed in with the old password, on another device, is signed out; this browser stays.
  await revokeOtherSessions(user.id);
  return { saved: true };
}

/**
 * Deletes everything the user entered: assets with their values, trades and prices, categories and plans.
 * The account itself, and the sign-in, stay. The starter categories come back so adding an asset still works.
 */
export async function deleteAllData(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== "delete") return { error: "Type DELETE to confirm." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM plans WHERE user_id = $1", [user.id]);
    await client.query("DELETE FROM accounts WHERE user_id = $1", [user.id]); // takes entries, trades, prices with it
    await client.query("DELETE FROM categories WHERE user_id = $1", [user.id]);
    await client.query(
      "INSERT INTO categories (user_id, name, type, color) SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[])",
      [user.id, STARTER_CATEGORIES.map((c) => c.name), STARTER_CATEGORIES.map((c) => c.type), STARTER_CATEGORIES.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length])],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
