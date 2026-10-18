import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataFile = path.join(root, 'data', 'settings.json');
const TELEGRAM_API = 'https://api.telegram.org';
const PROFILE_URL = 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg';
const PAIR_DISPLAY_SECONDS = 30;
const MAX_REQUESTS_PER_NUMBER = 4;
const COOLDOWN_MS = 2 * 60 * 60 * 1000;

const attemptsByNumber = new Map<string, { count: number; blockedUntil: number }>();

function loadSettings(): any {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch { return {}; }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatNumber(number: string) { return number.startsWith('+') ? number : `+${number}`; }

function formatCooldown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

async function tg(token: string, method: string, body: any = {}) {
  const r = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await r.json() as any;
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

function startKeyboard(s: any) {
  return { inline_keyboard: [
    [{ text: '📢 CHAÎNE WHATSAPP', url: s.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O' }],
    [{ text: '💬 GROUPE WHATSAPP', url: s.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H' }],
    [{ text: '👑 KING GENERATOR', url: 'https://king-generator-ai.lovable.app/' }]
  ]};
}

function pairKeyboard(code: string) {
  return { inline_keyboard: [[{ text: '📋 COPIER LE CODE', copy_text: { text: code } }]] };
}

function pairText(number: string, code: string, seconds: number) {
  return `🔑 <b>PAIRING CODE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n📞 <b>Number:</b> ${escapeHtml(formatNumber(number))}\n🔢 <b>Code:</b> <code>${escapeHtml(code)}</code>\n⏰ <b>Expires:</b> ${seconds}s\n\n📋 <b>Steps</b>\nWhatsApp → Settings → Linked Devices\n→ Link a Device → Use phone number\n→ Enter: <code>${escapeHtml(code)}</code>\n\n✅ Connection is automatic once entered.`;
}

function expiredText(number: string, code: string) {
  return `🔑 <b>PAIRING CODE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n📞 <b>Number:</b> ${escapeHtml(formatNumber(number))}\n🔢 <b>Code:</b> <code>${escapeHtml(code)}</code>\n⏰ <b>Expires:</b> 0s — <b>EXPIRED</b>\n\n⚠️ Demande un nouveau code avec /pair si la protection le permet.`;
}

async function countdown(token: string, chatId: number, messageId: number, number: string, code: string) {
  for (let seconds = 25; seconds > 0; seconds -= 5) {
    await new Promise(r => setTimeout(r, 5000));
    try { await tg(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text: pairText(number, code, seconds), parse_mode: 'HTML', reply_markup: pairKeyboard(code) }); }
    catch { return; }
  }
  try { await tg(token, 'editMessageText', { chat_id: chatId, message_id: messageId, text: expiredText(number, code), parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }); } catch {}
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) { console.log('ℹ️ TELEGRAM_BOT_TOKEN non défini — Telegram désactivé.'); return; }

  void (async () => {
    try {
      await tg(token, 'deleteWebhook', { drop_pending_updates: true });
      await tg(token, 'setMyCommands', { commands: [
        { command: 'start', description: 'Ouvrir le Royaume KING-MD' },
        { command: 'pair', description: 'Générer un Pairing Code WhatsApp' },
        { command: 'menu', description: 'Afficher le menu' },
        { command: 'ping', description: 'Tester le bot' }
      ]});
      console.log('🟣 KING-MD Telegram démarré.');

      let offset = 0;
      while (true) {
        try {
          const updates = await tg(token, 'getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
          for (const update of updates as any[]) {
            offset = Number(update.update_id) + 1;
            void handleUpdate(token, update);
          }
        } catch (e: any) {
          console.error('❌ Telegram polling:', e?.message || e);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (e: any) { console.error('❌ Telegram init:', e?.message || e); }
  })();
}

async function handleUpdate(token: string, update: any) {
  const message = update.message;
  if (!message?.text) return;
  const chatId = Number(message.chat.id);
  const text = String(message.text).trim();
  const [raw, ...args] = text.split(/\s+/);
  const command = raw.split('@')[0].toLowerCase();
  const argument = args.join(' ').trim();
  const s = loadSettings();

  try {
    if (command === '/start') {
      const caption = `👑 <b>KING-MD</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ <b>BIENVENUE DANS LE ROYAUME</b> ⚜️\n\n🤖 Assistant officiel de connexion KING-MD.\n\n🔐 Utilise <code>/pair 509XXXXXXXX</code> pour générer ton Pairing Code WhatsApp.\n\n⚡ Rapide • Sécurisé • Royal\n\n👑 <i>BY KING STARK</i>`;
      await tg(token, 'sendPhoto', { chat_id: chatId, photo: PROFILE_URL, caption, parse_mode: 'HTML', reply_markup: startKeyboard(s) });
      return;
    }

    if (command === '/menu') {
      await tg(token, 'sendMessage', { chat_id: chatId, text: `👑 <b>KING-MD — MENU</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n/start — accueil\n/pair 509XXXXXXXX — Pairing Code\n/ping — tester le bot`, parse_mode: 'HTML', reply_markup: startKeyboard(s) });
      return;
    }

    if (command === '/ping') { await tg(token, 'sendMessage', { chat_id: chatId, text: '🏓 <b>PONG</b> — KING-MD est en ligne.', parse_mode: 'HTML' }); return; }

    if (command === '/pair' || command === '/connect') {
      const number = argument.replace(/\D/g, '');
      if (!/^\d{8,15}$/.test(number)) { await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ Format invalide. Exemple : <code>/pair 509XXXXXXXX</code>', parse_mode: 'HTML' }); return; }

      const now = Date.now();
      const record = attemptsByNumber.get(number) || { count: 0, blockedUntil: 0 };
      if (record.blockedUntil > now) {
        await tg(token, 'sendMessage', { chat_id: chatId, text: `🛡️ <b>PROTECTION ACTIVE</b>\n\nLe numéro ${escapeHtml(formatNumber(number))} a atteint la limite de 4 demandes.\n\n⏳ Réessaie dans <b>${formatCooldown(record.blockedUntil - now)}</b>.`, parse_mode: 'HTML' });
        return;
      }
      if (record.blockedUntil && record.blockedUntil <= now) record.count = 0;
      record.count += 1;
      if (record.count >= MAX_REQUESTS_PER_NUMBER) record.blockedUntil = now + COOLDOWN_MS;
      attemptsByNumber.set(number, record);

      const waiting = await tg(token, 'sendMessage', { chat_id: chatId, text: `⏳ <b>GÉNÉRATION DU PAIRING CODE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n📞 ${escapeHtml(formatNumber(number))}\n\nConnexion au moteur WhatsApp…`, parse_mode: 'HTML' });
      try {
        const port = process.env.PORT || '3000';
        const headers: Record<string,string> = { 'content-type': 'application/json' };
        if (process.env.WEB_TOKEN) headers['x-web-token'] = process.env.WEB_TOKEN;
        const response = await fetch(`http://127.0.0.1:${port}/api/pair`, { method: 'POST', headers, body: JSON.stringify({ number, attempts: 1 }) });
        const data = await response.json() as any;
        if (!response.ok || !data.ok) {
          await tg(token, 'editMessageText', { chat_id: chatId, message_id: waiting.message_id, text: `❌ <b>PAIRING IMPOSSIBLE</b>\n\n${escapeHtml(data.error || 'Erreur inconnue.')}`, parse_mode: 'HTML' });
          return;
        }
        const code = String(data.code || '');
        await tg(token, 'editMessageText', { chat_id: chatId, message_id: waiting.message_id, text: pairText(number, code, PAIR_DISPLAY_SECONDS), parse_mode: 'HTML', reply_markup: pairKeyboard(code) });
        void countdown(token, chatId, waiting.message_id, number, code);
      } catch (e: any) {
        await tg(token, 'editMessageText', { chat_id: chatId, message_id: waiting.message_id, text: `❌ <b>Erreur du service de pairing.</b>\n\n${escapeHtml(e?.message || 'Réessaie plus tard.')}`, parse_mode: 'HTML' });
      }
      return;
    }

    if (text.startsWith('/')) await tg(token, 'sendMessage', { chat_id: chatId, text: '👑 Commande inconnue. Utilise /menu.' });
  } catch (e: any) { console.error('❌ Telegram update:', e?.message || e); }
}
