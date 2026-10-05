import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const settingsFile = path.join(root, 'data', 'settings.json');
const BOT_LOGO_URL = 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg';

const TELEGRAM_API = 'https://api.telegram.org';
const PAIR_DISPLAY_SECONDS = 30;

function loadSettings(): any {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {
    return {
      botName: 'KING-MD',
      channel: 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O',
      autoJoinGroup: 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
      kingGenerator: 'https://king-generator-ai.lovable.app/'
    };
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(number: string): string {
  return number.startsWith('+') ? number : `+${number}`;
}

function formatCooldown(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}

async function telegramRequest(token: string, method: string, body?: any): Promise<any> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  const data = await response.json() as any;
  if (!data.ok) throw new Error(data.description || `Telegram API error on ${method}`);
  return data.result;
}

async function sendPhoto(token: string, chatId: number, caption: string, keyboard: any) {
  return telegramRequest(token, 'sendPhoto', {
    chat_id: chatId,
    photo: BOT_LOGO_URL,
    caption,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

async function editMessage(token: string, chatId: number, messageId: number, text: string, keyboard?: any) {
  return telegramRequest(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard } : {})
  });
}

function startKeyboard(settings: any) {
  const channel = settings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
  const group = settings.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H';
  const kingGenerator = settings.kingGenerator || 'https://king-generator-ai.lovable.app/';
  return {
    inline_keyboard: [
      [{ text: '🔵 Chaîne WhatsApp', url: channel }],
      [{ text: '🟢 Groupe WhatsApp', url: group }],
      [{ text: '🟣 KING GENERATOR', url: kingGenerator }],
      [{ text: '👑 MENU', callback_data: 'menu' }]
    ]
  };
}

function pairingKeyboard(code: string) {
  return {
    inline_keyboard: [
      [{ text: '📋 COPIER LE CODE', copy_text: { text: code } }]
    ]
  };
}

function pairingMessage(number: string, code: string, seconds: number) {
  return `🔑 <b>PAIRING CODE</b>
━━━━━━━━━━━━━━━━━━━━━

` +
    `📞 <b>Number:</b> ${escapeHtml(formatNumber(number))}
` +
    `🔢 <b>Code:</b> <code>${escapeHtml(code)}</code>
` +
    `⏰ <b>Expires:</b> ${seconds}s

` +
    `📋 <b>Steps</b>
` +
    `WhatsApp → Settings → Linked Devices
` +
    `→ Link a Device → Use phone number
` +
    `→ Enter: <code>${escapeHtml(code)}</code>

` +
    `✅ Connection is automatic once entered.`;
}

function expiredPairingMessage(number: string, code: string) {
  return `🔑 <b>PAIRING CODE</b>
━━━━━━━━━━━━━━━━━━━━━

` +
    `📞 <b>Number:</b> ${escapeHtml(formatNumber(number))}
` +
    `🔢 <b>Code:</b> <code>${escapeHtml(code)}</code>
` +
    `⏰ <b>Expires:</b> 0s — <b>EXPIRED</b>

` +
    `⚠️ Ce code n’est plus présenté comme actif. Utilise /pair pour demander un nouveau code si le délai de protection le permet.`;
}

async function countdown(token: string, chatId: number, messageId: number, number: string, code: string) {
  // UI countdown only. WhatsApp/Baileys remains the authority on actual code validity.
  for (let seconds = PAIR_DISPLAY_SECONDS - 5; seconds > 0; seconds -= 5) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    try {
      await editMessage(token, chatId, messageId, pairingMessage(number, code, seconds), pairingKeyboard(code));
    } catch {
      return;
    }
  }
  try {
    await editMessage(token, chatId, messageId, expiredPairingMessage(number, code), { inline_keyboard: [] });
  } catch {}
}

export async function startTelegramBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.log('ℹ️ TELEGRAM_BOT_TOKEN non défini — Telegram désactivé.');
    return;
  }

  try {
    await telegramRequest(token, 'deleteWebhook', { drop_pending_updates: true });
    await telegramRequest(token, 'setMyCommands', {
      commands: [
        { command: 'start', description: 'Ouvrir le Royaume KING-MD' },
        { command: 'pair', description: 'Générer un code WhatsApp' },
        { command: 'connect', description: 'Alias de /pair' },
        { command: 'delpair', description: 'Réinitialiser la session WhatsApp' },
        { command: 'menu', description: 'Afficher le menu' },
        { command: 'ping', description: 'Tester le bot' },
        { command: 'alive', description: 'Voir le statut et uptime' },
        { command: 'channel', description: 'Ouvrir la chaîne WhatsApp' },
        { command: 'group', description: 'Ouvrir le groupe WhatsApp' },
        { command: 'owner', description: 'Contacter le propriétaire' }
      ]
    });

    console.log('🟣 KING-MD Telegram démarré.');
  } catch (error) {
    console.error('❌ Initialisation Telegram échouée:', error);
    return;
  }

  let offset = 0;
  let running = true;

  const processUpdate = async (update: any) => {
    const message = update.message;
    const callback = update.callback_query;

    if (callback) {
      try {
        await telegramRequest(token, 'answerCallbackQuery', { callback_query_id: callback.id });
        if (callback.data === 'menu') {
          const chatId = callback.message?.chat?.id;
          if (chatId) {
            await telegramRequest(token, 'sendMessage', {
              chat_id: chatId,
              text: `👑 <b>KING-MD — MENU TELEGRAM</b>
━━━━━━━━━━━━━━━━━━━━

` +
                `/start — ouvrir l’accueil
` +
                `/pair 509XXXXXXXX — demander un code
` +
                `/delpair — réinitialiser la session
` +
                `/ping — tester le bot
` +
                `/alive — statut + uptime
` +
                `/channel — chaîne WhatsApp
` +
                `/group — groupe WhatsApp
` +
                `/owner — propriétaire`,
              parse_mode: 'HTML'
            });
          }
        }
      } catch (error) {
        console.error('Telegram callback error:', error);
      }
      return;
    }

    if (!message?.text) return;
    const chatId = Number(message.chat.id);
    const text = message.text.trim();
    if (!text.startsWith('/')) return;

    const [rawCommand, ...args] = text.split(/\s+/);
    const command = rawCommand.split('@')[0].toLowerCase();
    const argument = args.join(' ').trim();
    const settings = loadSettings();

    try {
      if (command === '/start') {
        const botName = escapeHtml(settings.botName || 'KING-MD');
        const username = process.env.TELEGRAM_BOT_USERNAME?.trim();
        const caption = `👑 <b>${botName}</b>${username ? ` · @${escapeHtml(username)}` : ''}

` +
          `Bienvenue dans le Royaume.

` +
          `⚡ <b>Connexion WhatsApp</b>
` +
          `Utilise <code>/pair 509XXXXXXXX</code> pour générer ton Pairing Code.

` +
          `🔐 Après génération, le code sera affiché avec un bouton de copie et un compteur de 30 secondes.`;
        await sendPhoto(token, chatId, caption, startKeyboard(settings));
        return;
      }

      if (command === '/menu') {
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: `👑 <b>KING-MD — MENU TELEGRAM</b>
━━━━━━━━━━━━━━━━━━━━

` +
            `/start — ouvrir l’accueil
` +
            `/pair 509XXXXXXXX — demander un code
` +
            `/connect 509XXXXXXXX — alias de /pair
` +
            `/delpair — réinitialiser la session WhatsApp
` +
            `/ping — tester le bot
` +
            `/alive — statut + uptime
` +
            `/channel — chaîne WhatsApp
` +
            `/group — groupe WhatsApp
` +
            `/owner — propriétaire`,
          parse_mode: 'HTML',
          reply_markup: startKeyboard(settings)
        });
        return;
      }

      if (command === '/ping') {
        const started = Date.now();
        const sent = await telegramRequest(token, 'sendMessage', { chat_id: chatId, text: '🏓 Pong…' });
        const latency = Date.now() - started;
        await editMessage(token, chatId, sent.message_id, `🏓 <b>Pong !</b>
⚡ Latence: ${latency} ms`);
        return;
      }

      if (command === '/alive') {
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: `👑 <b>KING-MD ONLINE</b>
🟢 Telegram: actif
🟢 Pairing: prêt
⏱️ Uptime: ${formatUptime(Math.floor((Date.now() - startedAt) / 1000))}`,
          parse_mode: 'HTML'
        });
        return;
      }

      if (command === '/channel' || command === '/group') {
        const url = command === '/channel'
          ? (settings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O')
          : (settings.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H');
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: command === '/channel' ? '📢 <b>Chaîne WhatsApp officielle</b>' : '💬 <b>Groupe WhatsApp officiel</b>',
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: command === '/channel' ? '🔵 Ouvrir la chaîne' : '🟢 Ouvrir le groupe', url }]] }
        });
        return;
      }

      if (command === '/owner') {
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: '👑 <b>OWNER</b>\nTelegram: @king_stark821',
          parse_mode: 'HTML'
        });
        return;
      }

      if (command === '/delpair') {
        const port = process.env.PORT || '3000';
        const headers: Record<string,string> = {};
        if (process.env.WEB_TOKEN) headers['x-web-token'] = process.env.WEB_TOKEN;
        const response = await fetch(`http://127.0.0.1:${port}/api/logout`, { method: 'POST', headers });
        const data = await response.json() as any;
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: data.ok ? `👑 <b>Session réinitialisée.</b>\n${escapeHtml(data.message || 'Tu peux demander un nouveau code.')}` : `❌ ${escapeHtml(data.error || 'Impossible de réinitialiser la session.')}`,
          parse_mode: 'HTML'
        });
        return;
      }

      if (command === '/pair' || command === '/connect') {
        const number = argument.replace(/[^0-9]/g, '');
        if (!/^\d{8,15}$/.test(number)) {
          await telegramRequest(token, 'sendMessage', {
            chat_id: chatId,
            text: '❌ <b>Numéro invalide.</b>\n\nExemple : <code>/pair 509XXXXXXXX</code>\nSans le signe +.',
            parse_mode: 'HTML'
          });
          return;
        }

        const waiting = await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: `⏳ <b>Préparation du Pairing Code</b>\n━━━━━━━━━━━━━━━━━━━━\n📞 ${escapeHtml(formatNumber(number))}\n\nConnexion au moteur WhatsApp…`,
          parse_mode: 'HTML'
        });

        try {
          const port = process.env.PORT || '3000';
          const headers: Record<string,string> = { 'content-type': 'application/json' };
          if (process.env.WEB_TOKEN) headers['x-web-token'] = process.env.WEB_TOKEN;
          const response = await fetch(`http://127.0.0.1:${port}/api/pair`, {
            method: 'POST', headers, body: JSON.stringify({ number, attempts: 1 })
          });
          const data = await response.json() as any;

          if (!response.ok || !data.ok) {
            const cooldown = Number(data.retryAfterMs || 0);
            const suffix = cooldown > 0 ? `\n\n⏳ Réessaie dans environ <b>${escapeHtml(formatCooldown(cooldown))}</b>.` : '';
            await editMessage(token, chatId, waiting.message_id, `❌ <b>Impossible de générer le Pairing Code.</b>\n\n${escapeHtml(data.error || 'Erreur inconnue.')}${suffix}`);
            return;
          }

          const code = String(data.code || '');
          await editMessage(token, chatId, waiting.message_id, pairingMessage(number, code, PAIR_DISPLAY_SECONDS), pairingKeyboard(code));
          void countdown(token, chatId, waiting.message_id, number, code);
        } catch (error: any) {
          await editMessage(token, chatId, waiting.message_id, `❌ <b>Erreur du service de pairing.</b>\n\n${escapeHtml(error?.message || 'Réessaie plus tard.')}`);
        }
        return;
      }

      await telegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: '👑 Commande inconnue. Utilise /menu pour voir les commandes disponibles.'
      });
    } catch (error) {
      console.error('Telegram update error:', error);
    }
  };

  while (running) {
    try {
      const updates = await telegramRequest(token, 'getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });
      for (const update of updates as any[]) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        void processUpdate(update);
      }
    } catch (error: any) {
      console.error('Telegram polling error:', error?.message || error);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

const startedAt = Date.now();
