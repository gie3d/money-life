"use server";

import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/session";
import { CATEGORY_COLORS, CURRENCIES, STARTER_CATEGORIES } from "@/lib/types";

export type FormState = { error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const currency = String(form.get("currency") ?? "THB");

  if (!name) return { error: "Tell us your name." };
  if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Pick a currency from the list." };

  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, currency) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [email, name, await hashPassword(password), currency],
  );
  if (!rows[0]) return { error: "An account with that email already exists." };

  await pool.query("INSERT INTO categories (user_id, name, type, color) SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[])",
    [rows[0].id, STARTER_CATEGORIES.map((c) => c.name), STARTER_CATEGORIES.map((c) => c.type), STARTER_CATEGORIES.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length])]);
  await createSession(Number(rows[0].id));
  redirect("/");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const { rows } = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email]);
  // Same message whether the email or the password is wrong, so the form does not reveal which emails exist.
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    return { error: "Email or password is wrong." };
  }
  await createSession(Number(rows[0].id));
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
