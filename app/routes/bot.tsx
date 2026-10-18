import React, { useState } from "react";

export default function BotPage() {
  const [command, setCommand] = useState("/ping");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    // Build body: allow user to type `/pair 509123...` or fill number field
    let cmd = String(command || "").trim();
    let body: any = {};

    if (!cmd) {
      setError("Commande vide");
      setLoading(false);
      return;
    }

    const parts = cmd.split(/\s+/);
    const base = parts[0];

    if (base === "/pair" || base === "/connect") {
      const supplied = parts[1] || number;
      if (!supplied) {
        setError("Numéro requis pour /pair (ex: 50912345678)");
        setLoading(false);
        return;
      }
      body = { command: base, args: { number: supplied } };
    } else {
      body = { command: base, args: { number: number || undefined } };
    }

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setResult({ status: res.status, ok: res.ok, body: data });
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>KING‑MD — Web Bot tester</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Envoie des commandes au bot web (POST /api/bot).</p>

      <form onSubmit={handleSend} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "block" }}>
          Commande
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="/ping or /pair 50912345678 or /start"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block" }}>
          Numéro (optionnel — utilisé par /pair si non fourni dans la commande)
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="50912345678"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
            {loading ? "Envoi..." : "Envoyer"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCommand("/ping");
              setNumber("");
              setResult(null);
              setError(null);
            }}
            style={{ padding: "8px 12px" }}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      <section style={{ marginTop: 18 }}>
        <h3>Résultat</h3>
        {error && <pre style={{ background: "#fee", padding: 12 }}>{error}</pre>}
        {result && (
          <pre style={{ background: "#f6f8fa", padding: 12, overflowX: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
        )}
        {!result && !error && <p style={{ color: "#666" }}>Aucun résultat — envoie une commande.</p>}
      </section>

      <section style={{ marginTop: 20, color: "#444" }}>
        <h4>Astuce</h4>
        <ul>
          <li>Pas besoin de token si tu ne définis pas WEB_TOKEN / WEB_BOT_TOKEN.</li>
          <li>Tester /pair nécessite que le service WhatsApp pairing (/api/pair) fonctionne côté serveur.</li>
          <li>La session WhatsApp est stockée dans auth_info/ — pense à la persistance si tu veux garder la session après redéploiement.</li>
        </ul>
      </section>
    </div>
  );
}
