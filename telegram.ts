// Bot Telegram pour KING-MD — autonome, lit la même config que le bot WhatsApp
// (data/settings.json) pour rester cohérent niveau marque/liens, sans toucher
// au fichier server.ts existant plus que nécessaire.
//
// ⚠️ Non testé contre un vrai token Telegram (pas d'accès réseau dans mon
// environnement). La structure suit l'API officielle de la librairie "grammy",
// à vérifier en conditions réelles après déploiement.
//
// Format HTML (pas Markdown) partout : Markdown casse dès qu'une valeur
// dynamique contient _ * [ ] etc. (ex: un username Telegram avec underscores).
// HTML + échappement systématique des valeurs dynamiques évite ce problème.

import { Bot, InlineKeyboard } from 'grammy';
import fs from 'fs';
import path from 'path';

// 👑 Message "royal" affiché quand une commande échoue ou qu'un cas n'est pas géré.
const ROYAL_FALLBACK =
  "👑 Commande invalide ou échouée : cette action n'existe pas dans le Royaume. Vérifie la commande et réessaie.";

const root = process.cwd();
const dataFile = path.join(root, 'data', 'settings.json');

function loadSettings() {
  try {
    if (!fs.existsSync(dataFile)) {
      return {
        prefix: '.',
        botName: 'KING-MD',
        owner: '50932271345',
        botUser: 'KING',
        channel: 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O',
        autoJoinGroup: 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
        alive: 'KING-MD is online! 🟢'
      };
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return { botName: 'KING-MD', owner: '50932271345' };
  }
}

// Échappe les caractères spéciaux HTML pour toute valeur dynamique injectée
// dans un message (settings.json, variables d'env) — évite de casser le parsing.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const startedAt = Date.now();

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('ℹ️ TELEGRAM_BOT_TOKEN non défini — bot Telegram désactivé.');
    return;
  }

  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const s = loadSettings();
    const channelUrl = s.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
    const groupUrl = s.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H';
    const botName = escapeHtml(s.botName || 'KING-MD');
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;

    // ⚠️ Telegram ne permet pas de couleur de fond personnalisée sur les boutons —
    // les émojis 🟢🔵🔴 servent de repère visuel, ce n'est pas une vraie couleur.
    const keyboard = new InlineKeyboard()
      .url('🔵 Chaîne WhatsApp', channelUrl)
      .url('🟢 Groupe WhatsApp', groupUrl)
      .row()
      .url('🔴 KING GENERATOR', 'https://king-generator-ai.lovable.app');

    await ctx.reply(
      `👑 <b>${botName}</b>${botUsername ? ` (@${escapeHtml(botUsername)})` : ''}\n\n` +
      `Bienvenue sur le bot Telegram officiel.\n` +
      `Tape /menu pour voir les commandes disponibles.`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  bot.command('menu', async (ctx) => {
    const s = loadSettings();
    const botName = escapeHtml(s.botName || 'KING-MD');
    await ctx.reply(
      `👑 <b>${botName} — Menu Telegram</b>\n\n` +
      `/start — démarrer\n` +
      `/menu — ce menu\n` +
      `/ping — tester si le bot répond\n` +
      `/alive — statut + uptime\n` +
      `/channel — lien de la chaîne WhatsApp officielle\n` +
      `/group — lien du groupe WhatsApp officiel\n` +
      `/owner — contact du propriétaire`,
      { parse_mode: 'HTML' }
    );
  });

  bot.command('ping', async (ctx) => {
    const start = Date.now();
    const sent = await ctx.reply('🏓 Pong...');
    const latency = Date.now() - start;
    await ctx.api.editMessageText(sent.chat.id, sent.message_id, `🏓 Pong ! (${latency}ms)`);
  });

  bot.command('alive', async (ctx) => {
    const s = loadSettings();
    const uptime = formatUptime(Math.floor((Date.now() - startedAt) / 1000));
    await ctx.reply(
      `${escapeHtml(s.alive || 'KING-MD is online! 🟢')}\n\n` +
      `⏱️ Uptime : ${uptime}`
    );
  });

  bot.command('channel', async (ctx) => {
    const s = loadSettings();
    const url = s.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
    await ctx.reply(`📢 <b>Chaîne officielle</b>\n${escapeHtml(url)}`, { parse_mode: 'HTML' });
  });

  bot.command('group', async (ctx) => {
    const s = loadSettings();
    const url = s.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H';
    await ctx.reply(`💬 <b>Groupe officiel</b>\n${escapeHtml(url)}`, { parse_mode: 'HTML' });
  });

  bot.command('owner', async (ctx) => {
    await ctx.reply(`👑 <b>Propriétaire</b>\n✈️ Telegram : https://t.me/king_stark821`, { parse_mode: 'HTML' });
  });

  bot.catch((err) => {
    console.error('❌ Erreur bot Telegram :', err.message);
    try {
      err.ctx.reply(ROYAL_FALLBACK);
    } catch {}
  });

  // Commande inconnue (tapée mais aucune des commandes ci-dessus ne correspond)
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply(ROYAL_FALLBACK);
    }
  });

  bot.start();
  console.log('🟣 Bot Telegram démarré.');
}
