"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Settings = { wifi_ssid?: string; wifi_password?: string; wifi_instructions?: string; manual_mode?: string };

export default function Settings() {
  const [s, setS] = useState<Settings>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>("/admin/settings").then((r) => setS(r.settings)).catch((e) => setMsg(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(""); setSaved(false);
    try {
      const r = await api<{ settings: Settings }>("/admin/settings", { method: "PUT", body: s });
      setS(r.settings); setSaved(true);
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setS({ ...s, [k]: e.target.value });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-slate-400 mb-6">
        Manual mode: these Wi-Fi credentials are revealed to customers on their dashboard
        after a successful payment. Keep the Huawei Wi-Fi password secret until then.
      </p>

      <form onSubmit={save} className="card p-6 space-y-4">
        <div>
          <label className="label">Wi-Fi network name (SSID)</label>
          <input className="input" value={s.wifi_ssid || ""} onChange={set("wifi_ssid")} placeholder="MyWiFi" />
        </div>
        <div>
          <label className="label">Wi-Fi password</label>
          <input className="input" value={s.wifi_password || ""} onChange={set("wifi_password")} placeholder="shown to paying customers only" />
        </div>
        <div>
          <label className="label">Instructions shown after payment</label>
          <textarea className="input min-h-20" value={s.wifi_instructions || ""} onChange={set("wifi_instructions")} />
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={s.manual_mode || "true"} onChange={set("manual_mode")}>
            <option value="true">Manual (show password after payment)</option>
            <option value="false">Captive portal (openNDS gateway)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Set to captive portal once the openNDS router is live.</p>
        </div>
        {msg && <p className="text-sm text-red-400">{msg}</p>}
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      </form>
    </div>
  );
}
