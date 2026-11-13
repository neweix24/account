const MAX_BODY_BYTES = 16 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;
const SMS_ENDPOINT = "https://bulksmsbd.net/api/smsapi";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function verifyHookSignature(rawBody: string, headers: Headers, configuredSecret: string): Promise<boolean> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader || !/^\\d+$/.test(timestamp)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) return false;

  const prefix = "v1,whsec_";
  if (!configuredSecret.startsWith(prefix)) return false;

  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(configuredSecret.slice(prefix.length));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedContent));

  return signatureHeader.split(" ").some((part) => {
    const [version, encoded] = part.split(",");
    if (version !== "v1" || !encoded) return false;
    try {
      return safeEqual(expected, decodeBase64(encoded));
    } catch {
      return false;
    }
  });
}

function normalizeBangladeshMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\\s()-]/g, "").replace(/^\\+/, "");
  if (/^01[3-9]\\d{8}$/.test(digits)) return `88${digits}`;
  if (/^8801[3-9]\\d{8}$/.test(digits)) return digits;
  return null;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const apiKey = Deno.env.get("BULKSMSBD_API_KEY");
  const senderId = Deno.env.get("BULKSMSBD_SENDER_ID");
  if (!hookSecret || !apiKey || !senderId) {
    // Do not include environment values or provider details in responses/logs.
    return json(503, { error: "SMS delivery is not configured" });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return json(413, { error: "Payload too large" });
  }

  let signatureIsValid = false;
  try {
    signatureIsValid = await verifyHookSignature(rawBody, request.headers, hookSecret);
  } catch {
    signatureIsValid = false;
  }
  if (!signatureIsValid) return json(401, { error: "Invalid webhook signature" });

  let event: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid hook payload" });
  }

  const phone = normalizeBangladeshMobile(event.user?.phone);
  const otp = typeof event.sms?.otp === "string" ? event.sms.otp : "";
  if (!phone || !/^\\d{4,10}$/.test(otp)) {
    return json(400, { error: "Invalid SMS recipient or verification code" });
  }

  const message = `Neweix verification code: ${otp}. Do not share this code with anyone.`;
  const form = new URLSearchParams({
    api_key: apiKey,
    senderid: senderId,
    number: phone,
    message,
    type: "text",
  });

  let providerResponse: Response;
  try {
    providerResponse = await fetch(SMS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return json(502, { error: "SMS provider is temporarily unavailable" });
  }

  const providerText = await providerResponse.text();
  let providerResult: Record<string, unknown> = {};
  try {
    providerResult = JSON.parse(providerText);
  } catch {
    // A non-JSON response is never treated as a successful submission.
  }

  const responseCode = Number(providerResult.response_code ?? providerResult.code ?? "");
  if (!providerResponse.ok || responseCode !== 202) {
    // Provider payloads may contain recipient details; never echo or log them.
    return json(502, { error: "SMS provider rejected the message" });
  }

  return new Response(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
});
