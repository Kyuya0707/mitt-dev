"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

type Factor = { id: string; friendly_name?: string; status: string };

export default function TwoFactorAuthSection() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [enrollId, setEnrollId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data }, { data: assurance }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const verified = data?.totp.find((item) => item.status === "verified") ?? null;
    setFactor(verified);
    setSessionVerified(assurance?.currentLevel === "aal2");
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  async function enroll() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "KnowValue",
    });
    if (error) setMessage(error.message);
    else {
      setEnrollId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setBusy(false);
  }

  async function verify() {
    if (!enrollId || !/^\d{6}$/.test(code)) {
      setMessage("認証アプリに表示された6桁コードを入力してください");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollId, code });
    if (error) setMessage(error.message);
    else {
      setMessage("2要素認証を有効にしました");
      setQrCode("");
      setSecret("");
      setEnrollId("");
      setCode("");
      await load();
    }
    setBusy(false);
  }

  async function remove() {
    if (!factor || !window.confirm("2要素認証を無効にしますか？")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setMessage(error ? error.message : "2要素認証を無効にしました");
    if (!error) setFactor(null);
    setBusy(false);
  }

  async function verifySession() {
    if (!factor || !/^\d{6}$/.test(code)) {
      setMessage("認証アプリに表示された6桁コードを入力してください");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setMessage(error ? error.message : "このログインの2要素認証が完了しました");
    if (!error) {
      setSessionVerified(true);
      setCode("");
      window.location.reload();
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">2要素認証</h2>
      <p className="mt-1 text-sm text-gray-600">認証アプリ（TOTP）を利用します。運営アカウントでは必須です。</p>
      {factor ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-green-700">設定済み</p>
          {!sessionVerified && (
            <div>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6桁コード" className="rounded border p-2" />
              <button disabled={busy} onClick={() => void verifySession()} className="ml-2 rounded bg-blue-600 px-4 py-2 text-sm text-white">このログインを認証</button>
            </div>
          )}
          <button disabled={busy} onClick={() => void remove()} className="rounded border px-4 py-2 text-sm">
            2要素認証を無効にする
          </button>
        </div>
      ) : !enrollId ? (
        <button disabled={busy} onClick={() => void enroll()} className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white">
          2要素認証を設定する
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Supabaseが生成したQRコードのdata URL */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="2要素認証QRコード" className="h-48 w-48" />
          <p className="break-all text-xs text-gray-600">手動登録キー: {secret}</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6桁コード" className="rounded border p-2" />
          <button disabled={busy} onClick={() => void verify()} className="ml-2 rounded bg-blue-600 px-4 py-2 text-sm text-white">確認して有効化</button>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
    </section>
  );
}
