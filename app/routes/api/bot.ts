import { json } from "@remix-run/node";
import type { ActionArgs } from "@remix-run/node";

export async function action({ request }: ActionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, { status: 405 });

  // Optional simple token check to protect the endpoint in production.
  const auth = request.headers.get("x-web-token") || request.headers.get("authorization");
  if (process.env.WEB_BOT_TOKEN && auth !== process.env.WEB_BOT_TOKEN) {
    return json({ ok: false, error: "Unauthorized: missing or invalid WEB_BOT_TOKEN" }, { status: 401 });
  }

  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }

  const raw = String(body.command || "").trim();
  const command = raw.split("@")[0].toLowerCase();
  const args = body.args || body; // allow different shapes

  if (command === "ping") {
    return json({ ok: true, reply: "🏓 PONG — KING-MD web bot actif." });
  }

  if (command === "start") {
    return json({ ok: true, reply: {
      title: "👑 KING-MD — Web Bot",
      text: "Bienvenue — envoie /pair {number} pour générer un pairing code WhatsApp (ex: /pair 509XXXXXXXX)."
    }});
  }

  if (command === "pair" || command === "connect") {
    const maybeNumber = String((args.number || args || body.number || "")).replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(maybeNumber)) {
      return json({ ok: false, error: "Format invalide. Exemple : /pair 509XXXXXXXX" }, { status: 400 });
    }

    try {
      const port = process.env.PORT || "3000";
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (process.env.WEB_TOKEN) headers["x-web-token"] = process.env.WEB_TOKEN;

      const response = await fetch(`http://127.0.0.1:${port}/api/pair`, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: maybeNumber, attempts: 1 })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return json({ ok: false, error: data.error || "Pairing failed" }, { status: 502 });
      }

      // Return the pairing code and some helper info
      return json({ ok: true, reply: {
        number: maybeNumber,
        code: String(data.code || ""),
        expires_in_seconds: Number(data.expires_in_seconds || 30)
      }});
    } catch (e: any) {
      return json({ ok: false, error: e?.message || String(e) }, { status: 500 });
    }
  }

  return json({ ok: false, error: "Commande inconnue. Utilise /start, /ping, ou /pair." }, { status: 400 });
}
