"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { beginTotpEnrollment, removeTotpFactor, verifyTotp } from "@/app/mfa/actions";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
};

export default function MfaPanel({
  mode,
  factors = [],
}: {
  mode: "settings" | "challenge";
  factors?: Factor[];
}) {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const verified = factors.filter((factor) => factor.status === "verified" && factor.factor_type === "totp");

  function startSetup() {
    setError("");
    startTransition(() => {
      void (async () => {
        const result = await beginTotpEnrollment();
        if (!result.ok) return setError(result.error);
        setFactorId(result.factorId);
        setQrCode(result.qrCode);
        setSecret(result.secret);
      })();
    });
  }

  function submitCode() {
    setError("");
    startTransition(() => {
      void (async () => {
        const result = await verifyTotp(factorId || verified[0]?.id || "", code.trim());
        if (!result.ok) return setError(result.error);
        router.replace("/account");
      })();
    });
  }

  function remove(factor: Factor) {
    if (!window.confirm("Remove this authenticator from your Neweix Account?")) return;
    setError("");
    startTransition(() => {
      void (async () => {
        const result = await removeTotpFactor(factor.id);
        if (!result.ok) return setError(result.error);
        window.location.reload();
      })();
    });
  }

  return (
    <section className="panel mfa-panel">
      <p className="eyebrow">ACCOUNT SECURITY</p>
      <h2>{mode === "challenge" ? "Two-step verification" : "Authenticator app"}</h2>
      <p className="muted">
        {mode === "challenge"
          ? "Enter the current code from your authenticator app to continue."
          : "Add an authenticator app for an additional layer of account protection."}
      </p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {mode === "challenge" ? (
        <>
          {verified.length === 0 ? (
            <p className="notice error">No verified authenticator was found. Contact Neweix Account support for recovery.</p>
          ) : (
            <>
              <label>
                Authentication code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="6-digit code"
                />
              </label>
              <button className="button primary full" type="button" disabled={busy || code.length < 6} onClick={submitCode}>
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {verified.length > 0 && (
            <div className="factor-list">
              {verified.map((factor) => (
                <div className="factor-row" key={factor.id}>
                  <div>
                    <strong>{factor.friendly_name || "Authenticator app"}</strong>
                    <p className="fine">Verified TOTP authenticator</p>
                  </div>
                  <button className="button secondary" type="button" disabled={busy} onClick={() => remove(factor)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {!factorId ? (
            <button className="button primary" type="button" disabled={busy} onClick={startSetup}>
              {busy ? "Preparing…" : verified.length ? "Add another authenticator" : "Set up authenticator"}
            </button>
          ) : (
            <>
              <p className="muted">Scan this QR code using an authenticator app, then enter the generated code.</p>
              <div className="qr-wrap">
                <Image
                  alt="Authenticator setup QR code"
                  src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrCode)}
                  width={240}
                  height={240}
                  unoptimized
                />
              </div>
              <p className="fine">Cannot scan? Enter this setup key manually:</p>
              <code className="secret-key">{secret}</code>
              <label>
                Authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="6-digit code"
                />
              </label>
              <button className="button primary full" type="button" disabled={busy || code.length < 6} onClick={submitCode}>
                {busy ? "Verifying…" : "Enable authenticator"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
