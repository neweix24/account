import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/account";

  if (!tokenHash || !type || !next.startsWith("/") || next.startsWith("//")) {
    return NextResponse.redirect(new URL("/login?error=Invalid%20confirmation%20link.", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=Confirmation%20link%20is%20invalid%20or%20expired.", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
