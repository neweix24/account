"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function signUp(formData: FormData) {
  const fullName = value(formData, "fullName");
  const username = value(formData, "username").toLowerCase();
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !/^[a-z0-9_][a-z0-9_.-]{2,29}$/.test(username) || !email || password.length < 12 || password !== confirmPassword) {
    redirect("/signup?error=Check%20your%20details.%20Passwords%20must%20match%20and%20contain%20at%20least%2012%20characters.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
      data: { full_name: fullName, username },
    },
  });

  if (error) redirect("/signup?error=Unable%20to%20create%20account.%20Check%20your%20details%20or%20try%20again.");
  redirect("/signup?message=Check%20your%20email%20to%20verify%20your%20Neweix%20Account.");
}

export async function signIn(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=Enter%20your%20email%20and%20password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=Sign-in%20failed.%20Check%20your%20credentials%20and%20verification.");
  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!email) redirect("/reset-password?message=If%20the%20account%20exists,%20a%20recovery%20email%20will%20be%20sent.");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/update-password`,
  });
  // Deliberately identical response prevents account enumeration.
  redirect("/reset-password?message=If%20the%20account%20exists,%20a%20recovery%20email%20will%20be%20sent.");
}
