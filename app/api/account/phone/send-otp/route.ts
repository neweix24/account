import { forwardPhoneApi } from "@/lib/cloudflare/neweix-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return forwardPhoneApi(request, "/api/account/phone/send-otp", { mutation: true });
}
