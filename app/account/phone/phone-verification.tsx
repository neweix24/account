"use client";

import { useEffect, useState } from "react";

type ApiPayload = {
  error?: string;
  message?: string;
  challengeId?: string;
  challenge_id?: string;
  data?: {
    challengeId?: string;
    challenge_id?: string;
    phone?: string;
    verified?: boolean;
    isVerified?: boolean;
    is_verified?: boolean;
    status?: string;
  };
  phone?: string;
  verified?: boolean;
  isVerified?: boolean;
  is_verified?: boolean;
  status?: string;
};

async function apiRequest(path: string, init?: RequestInit): Promise<ApiPayload> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => ({})) as ApiPayload;
  if (!response.ok) {
    throw new Error(payload.error || payload.message || (response.status === 401
      ? "Your session has expired. Sign in again."
      : "The phone verification service could not complete the request."));
  }
  return payload;
}

function getChallengeId(payload: ApiPayload) {
  return payload.challengeId || payload.challenge_id ||
    payload.data?.challengeId || payload.data?.challenge_id || "";
}

function isVerified(payload: ApiPayload) {
  return payload.verified === true || payload.isVerified === true ||
    payload.is_verified === true || payload.data?.verified === true ||
    payload.data?.isVerified === true || payload.data?.is_verified === true ||
    payload.status === "verified" || payload.data?.status === "verified";
}

export default function PhoneVerification() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/account/phone/status")
      .then((payload) => {
        if (!active) return;
        setVerified(isVerified(payload));
        setVerifiedPhone(payload.phone || payload.data?.phone || "");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load phone status.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function sendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const normalized = phone.replace(/[\s()-]/g, "");
    if (!/^(?:\+?8801|01)[3-9]\d{8}$/.test(normalized)) {
      setError("Enter a valid Bangladesh mobile number, such as 01XXXXXXXXX.");
      return;
    }

    setBusy(true);
    try {
      const payload = await apiRequest("/api/account/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: normalized }),
      });
      const id = getChallengeId(payload);
      if (!id) throw new Error("The SMS service did not return a verification challenge. No OTP screen can continue safely.");
      setChallengeId(id);
      setOtp("");
      setMessage(payload.message || "A verification code was requested. Check your phone.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!challengeId || !/^\d{6}$/.test(otp)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setBusy(true);
    try {
      const payload = await apiRequest("/api/account/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({ challengeId, otp }),
      });
      if (!isVerified(payload) && payload.status !== "success" && payload.data?.status !== "success") {
        throw new Error(payload.message || "The code was not confirmed as verified. Check your account status before retrying.");
      }
      setVerified(true);
      setVerifiedPhone(phone);
      setChallengeId("");
      setOtp("");
      setMessage(payload.message || "Your phone number is verified.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wide">
      <p className="eyebrow">ACCOUNT CONTACT</p>
      <h1>Phone verification</h1>
      <p className="muted">Verify a Bangladesh mobile number using the existing Neweix SMS service.</p>
      {loading && <p className="notice" role="status">Loading phone verification status…</p>}
      {!loading && verified && (
        <div className="notice success" role="status">
          Phone number verified{verifiedPhone ? `: ${verifiedPhone}` : "."}
        </div>
      )}
      {!loading && !verified && (
        <>
          <form onSubmit={sendOtp}>
            <label>
              Bangladesh mobile number
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                disabled={busy || Boolean(challengeId)}
              />
            </label>
            <button className="button primary full" type="submit" disabled={busy || Boolean(challengeId)}>
              {busy ? "Please wait…" : "Send verification code"}
            </button>
          </form>
          {challengeId && (
            <form onSubmit={verifyOtp}>
              <label>
                Six-digit verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={busy}
                />
              </label>
              <button className="button primary full" type="submit" disabled={busy || otp.length !== 6}>
                {busy ? "Verifying…" : "Verify phone"}
              </button>
              <button className="button secondary full" type="button" disabled={busy} onClick={() => { setChallengeId(""); setOtp(""); setError(""); setMessage("You can request a new code when the service cooldown allows it."); }}>
                Cancel verification
              </button>
            </form>
          )}
        </>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <p className="fine">Codes expire after five minutes. Resend cooldown and daily limits are enforced by the existing SMS service.</p>
    </section>
  );
}
