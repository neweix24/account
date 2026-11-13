import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/reset-password?error=This%20recovery%20link%20is%20invalid%20or%20has%20expired.", url.origin));
    }
    return NextResponse.redirect(new URL("/update-password", url.origin));
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(new URL("/reset-password?error=This%20recovery%20link%20is%20invalid%20or%20has%20expired.", url.origin));
    }
    return NextResponse.redirect(new URL("/update-password", url.origin));
  }

  return NextResponse.redirect(new URL("/reset-password?error=This%20recovery%20link%20is%20invalid%20or%20has%20expired.", url.origin));
}
