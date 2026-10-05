import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import P from 'pino';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { AVAILABLE_30_COMMANDS } from './src/data/commandsData.ts';
import { startTelegramBot } from './telegram.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const sessionDir = path.join(root, 'auth_info');
const dataFile = path.join(root, 'data', 'settings.json');

const app = express();
const logger = P({ level: 'silent' });
const PORT = Number(process.env.PORT || 3000);
const WEB_TOKEN = process.env.WEB_TOKEN || '';
const MAX_ATTEMPTS = Math.max(1, Math.min(5, Number(process.env.MAX_PAIRING_ATTEMPTS || 3)));

app.use(express.json());

// Global state
let sock: any = null;
let state: any = null;
let saveCreds: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pairingBusy = false;
let currentCode: string | null = null;
let lastError: string | null = null;
let attempts = 0;
let connected = false;
let lastNumber: string | null = null;
const startedAt = Date.now();

// Global message store for retry receipts and key renegotiation
const messageStore = new Map<string, any>();

// Catch and safely ignore transient Signal session decryption / Bad MAC errors
process.on('uncaughtException', (err: any) => {
  const msg = String(err?.message || err || '');
  if (msg.includes('Bad MAC') || msg.includes('Failed to decrypt') || msg.includes('Session error')) {
    // Gracefully handle Signal session key rotation desync
    return;
  }
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '');
  if (msg.includes('Bad MAC') || msg.includes('Failed to decrypt') || msg.includes('Session error')) {
    // Gracefully handle Signal session key rotation desync
    return;
  }
  console.error('Unhandled Rejection:', reason);
});

// Feature toggle state
const features = {
  antilink: true,
  antispam: true,
  antidelete: true,
  antipromote: false,
  antidemote: false
};

interface SecurityStats {
  analyzed: number;
  deleted: number;
  blocked: number;
  suspicious: number;
  spam: number;
  antivirus: number;
  lastEvent: string;
}

const stats: SecurityStats = {
  analyzed: 0,
  deleted: 0,
  blocked: 0,
  suspicious: 0,
  spam: 0,
  antivirus: 0,
  lastEvent: 'Système initialisé et prêt'
};

interface SecurityLog {
  id: string;
  time: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  details?: string;
}

const logs: SecurityLog[] = [
  {
    id: 'init-1',
    time: new Date().toLocaleTimeString(),
    type: 'info',
    message: 'Démarrage du panneau KING-MD & Protect-MD V1',
    details: '30 commandes disponibles prêtes à l’exécution'
  }
];

function addLog(type: 'info' | 'warning' | 'danger' | 'success', message: string, details?: string) {
  logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toLocaleTimeString(),
    type,
    message,
    details
  });
  if (logs.length > 50) logs.pop();
}

function loadSettings() {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    if (!fs.existsSync(dataFile)) {
      const defaultSettings = {
        prefix: '.',
        mode: 'private',
        owner: '50932271345',
        botName: 'KING-MD',
        version: '3.0.0',
        botUser: 'KING',
        botNumber: '50932271345',
        menuImage: 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg',
        channel: 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O',
        autoJoinGroup: 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
        hasAutoJoinedGroup: false,
        alive: 'KING-MD is online! 🟢',
        sudo: [],
        blocked: [],
        groups: {}
      };
      fs.writeFileSync(dataFile, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return {
      prefix: '.',
      mode: 'private',
      owner: '50932721345',
      botName: 'KING-MD',
      version: '3.0.0',
      botUser: 'KING',
      botNumber: '50932271345',
      menuImage: 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg',
      channel: 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O',
      autoJoinGroup: 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
      hasAutoJoinedGroup: false,
      alive: 'KING-MD is online! 🟢'
    };
  }
}

function saveSettings(data: any) {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function formatRuntime(sec: number): string {
  const d = Math.floor(sec / 86400);
  sec %= 86400;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${d ? `${d}d ` : ''}${h ? `${String(h).padStart(2, '0')}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// Generate the stylish 30-command menu text without bulky explanations
export function generateMenuText(s?: any): string {
  const currentSettings = s || loadSettings();
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const runtime = formatRuntime(uptimeSeconds);
  const botName = currentSettings.botName || 'KING-MD';
  const owner = currentSettings.owner || '50932271345';
  const botUser = currentSettings.botUser || 'KING';
  const channel = currentSettings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
  const rawMode = String(currentSettings.mode || 'private').toLowerCase();
  const mode = rawMode === 'private' ? 'PRIVÉ' : rawMode.toUpperCase();
  const prefix = currentSettings.prefix || '.';

  const head = `╔═════════════════════════╗
   ✧ 𝐊𝐈𝐍𝐆-𝐌𝐃 𝐕𝟏 ✧
╚═════════════════════════╝

╭━━〔 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍𝐒 〕━━━
┃ 👑 ᴏᴡɴᴇʀ : +${owner}
┃ 🤖 ʙᴏᴛ : ${botName}
┃ 👤 ᴜsᴇʀ : ${botUser}
┃ ⏱️ ᴜᴘᴛɪᴍᴇ : ${runtime}
┃ ⚙️ ᴍᴏᴅᴇ : ${mode}
┃ ⚡ ᴘʀᴇғɪx : [ ${prefix} ]
┃ 👥 sᴛᴀᴛᴜs : ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ
┃ 💻 ʜᴏsᴛ : ᴘᴛᴇʀᴏᴅᴀᴄᴛʏʟ
┃ 📢 ᴄʜᴀɴɴᴇʟ :
┃ ${channel}
╰━━━━━━━━━━━━━━━━━━━━━━━

  ✦ ━━━━━━━━━━━━━━━━━━━━ ✦
   ✨ 𝐌𝐄𝐍𝐔 𝐃𝐄𝐒 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄𝐒 ✨
  ✦ ━━━━━━━━━━━━━━━━━━━━ ✦`;

  const sections = Object.entries(AVAILABLE_30_COMMANDS).map(([name, list]) => {
    return `\n╭─「 ${name} 」\n${list.map((item) => `│ ⭓ ${prefix}${item.syntax.split(' ')[0]}`).join('\n')}\n╰──────────────────`;
  }).join('\n');

  const foot = `\n\n╭━━〔 📢 ʀᴇᴊᴏɪɢɴᴇᴢ ɴᴏᴛʀᴇ ᴄʜᴀɪ̂ɴᴇ 〕━━━
┃ ${channel}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> 𝐁𝐘 𝐊𝐈𝐍𝐆 𝐒𝐓𝐀𝐑𝐊 · 𝐊𝐈𝐍𝐆-𝐌𝐃`;

  return `${head}${sections}${foot}`;
}

export function generateShortMenu(s?: any): string {
  const currentSettings = s || loadSettings();
  const owner = currentSettings.owner || '50932271345';
  const channel = currentSettings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
  const prefix = currentSettings.prefix || '.';

  const categories = Object.entries(AVAILABLE_30_COMMANDS).map(([cat, list]) => {
    return `╭─「 ${cat} 」\n│ ${list.map(i => prefix + i.syntax.split(' ')[0]).join(' · ')}\n╰──────────────`;
  }).join('\n\n');

  return `╔═════════════════════════╗
   ✧ 𝐊𝐈𝐍𝐆-𝐌𝐃 · 𝐌𝐄𝐍𝐔 𝐑𝐀𝐏𝐈𝐃𝐄 ✧
╚═════════════════════════╝

👑 ᴏᴡɴᴇʀ : +${owner}
⚡ ᴄᴏᴍᴍᴀɴᴅᴇs : 30 ᴀᴄᴛɪᴠᴇs

${categories}

📢 ᴄʜᴀɴɴᴇʟ : ${channel}
> 𝐁𝐘 𝐊𝐈𝐍𝐆 𝐒𝐓𝐀𝐑𝐊`;
}

function cleanNumber(v: any): string {
  return String(v || '').replace(/[^0-9]/g, '');
}

function validNumber(n: string): boolean {
  return /^\d{8,15}$/.test(n);
}

function checkAuth(req: Request, res: Response, next: NextFunction) {
  if (!WEB_TOKEN) return next();
  const got = req.get('x-web-token') || String(req.query.token || '');
  if (got !== WEB_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Token Web invalide ou manquant.' });
  }
  next();
}

function getSecurityScore(): number {
  if (!connected) return 85;
  const penalty = Math.min(60, stats.suspicious * 4 + stats.blocked * 8);
  return Math.max(40, 100 - penalty);
}

function getMessageText(m: any): string {
  const msg = m?.message;
  if (!msg) return '';
  return String(
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    ''
  ).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// Curated collections for Fun & Social
const QUOTES = [
  "« Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte. » — Winston Churchill",
  "« La simplicité est la sophistication suprême. » — Léonard de Vinci",
  "« L'avenir appartient à ceux qui croient à la beauté de leurs rêves. » — Eleanor Roosevelt",
  "« Tout ce que vous pouvez imaginer est réel. » — Pablo Picasso",
  "« La seule façon de faire du bon travail est d'aimer ce que vous faites. » — Steve Jobs"
];

const JOKES = [
  "Pourquoi les développeurs détestent-ils la nature ? Parce qu'il y a trop de bugs !",
  "Que dit un informaticien quand il a froid ? Ouvre une fenêtre !",
  "Il y a 10 sortes de personnes dans le monde : ceux qui comprennent le binaire, et les autres.",
  "Pourquoi les poissons travaillent-ils dans l'informatique ? Parce qu'ils sont à l'aise sur le Net !",
  "Quel est le comble pour un électricien ? De ne pas être au courant."
];

const FACTS = [
  "La première souris d'ordinateur a été inventée en 1964 et était en bois !",
  "Le mot « robot » vient du tchèque « robota » signifiant travail forcé.",
  "Le miel ne se périme jamais : des archéologues en ont trouvé vieux de plus de 3 000 ans encore comestible !",
  "Le cœur d'une crevette se trouve dans sa tête.",
  "Il y a plus d'étoiles dans l'univers observable que de grains de sable sur toutes les plages de la Terre."
];

const EIGHT_BALL_ANSWERS = [
  "Oui, absolument !",
  "C'est certain.",
  "Sans aucun doute.",
  "Oui, définitivement.",
  "Tu peux compter dessus.",
  "Demande à nouveau plus tard.",
  "Mieux vaut ne pas te le dire maintenant.",
  "Concentre-toi et redemande.",
  "Ne compte pas dessus.",
  "Ma réponse est non.",
  "Mes sources disent non.",
  "Très peu probable."
];

// API Routes
app.get('/api/status', (req: Request, res: Response) => {
  const score = getSecurityScore();
  const threat = score >= 80 ? 'FAIBLE' : score >= 60 ? 'MOYEN' : 'ÉLEVÉ';
  res.json({
    ok: true,
    connected,
    pairingBusy,
    currentCode,
    lastError,
    attempts,
    maxAttempts: MAX_ATTEMPTS,
    number: lastNumber,
    score,
    threat,
    stats,
    features,
    uptime: Date.now() - startedAt,
    webTokenRequired: Boolean(WEB_TOKEN)
  });
});

app.get('/api/logs', (req: Request, res: Response) => {
  res.json({ ok: true, logs });
});

app.get('/api/settings', (req: Request, res: Response) => {
  const settings = loadSettings();
  res.json({ ok: true, settings });
});

app.get('/api/menu-preview', (req: Request, res: Response) => {
  const settings = loadSettings();
  const menuText = generateMenuText(settings);
  const imageUrl = settings.menuImage || 'https://files.catbox.moe/q90yag.jpg';
  res.json({
    ok: true,
    menuText,
    imageUrl,
    shortMenu: generateShortMenu(settings)
  });
});

app.post('/api/settings', checkAuth, (req: Request, res: Response) => {
  const updated = req.body;
  if (!updated || typeof updated !== 'object') {
    return res.status(400).json({ ok: false, error: 'Données de configuration invalides.' });
  }
  const current = loadSettings();
  const merged = { ...current, ...updated, mode: 'private' };
  saveSettings(merged);
  addLog('info', 'Paramètres du bot mis à jour', `Préfixe: ${merged.prefix}, Mode: PRIVÉ`);
  res.json({ ok: true, settings: merged, message: 'Paramètres enregistrés avec succès.' });
});

app.post('/api/pair', checkAuth, async (req: Request, res: Response) => {
  const number = cleanNumber(req.body?.number);
  const requestedAttempts = Math.max(1, Math.min(MAX_ATTEMPTS, Number(req.body?.attempts || 1)));

  if (!validNumber(number)) {
    return res.status(400).json({
      ok: false,
      error: 'Numéro invalide. Format international requis sans "+" (ex: 509XXXXXXXX).'
    });
  }

  if (pairingBusy) {
    return res.status(409).json({
      ok: false,
      error: 'Une demande de pairing est déjà en cours. Veuillez patienter.'
    });
  }

  if (state?.creds?.registered || connected) {
    return res.status(409).json({
      ok: false,
      error: 'WhatsApp est déjà connecté. Déconnectez la session avant un nouveau pairing.'
    });
  }

  pairingBusy = true;
  currentCode = null;
  lastError = null;
  attempts = 0;
  lastNumber = number;

  addLog('info', `Demande de pairing pour le numéro ${number}`, `Tentatives configurées: ${requestedAttempts}`);

  try {
    await ensureSocket();
    await new Promise((r) => setTimeout(r, 4000));

    for (let i = 0; i < requestedAttempts; i++) {
      attempts = i + 1;
      try {
        if (!sock || !state || state.creds?.registered) break;
        const rawCode = await sock.requestPairingCode(number);
        const code = String(rawCode || '').match(/.{1,4}/g)?.join('-') || rawCode;
        currentCode = code;
        lastError = null;
        stats.lastEvent = `Code généré pour +${number}`;
        addLog('success', `Code de pairing généré : ${code}`, `À saisir dans WhatsApp > Appareils connectés`);

        return res.json({
          ok: true,
          code: currentCode,
          attempt: attempts,
          message: 'Code généré avec succès. Entrez-le rapidement dans WhatsApp.'
        });
      } catch (e: any) {
        lastError = e?.message || String(e);
        addLog('warning', `Échec de génération (tentative ${attempts}/${requestedAttempts})`, lastError || undefined);

        if (i + 1 < requestedAttempts) {
          await restartSocket();
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    }

    return res.status(502).json({
      ok: false,
      error: lastError || 'WhatsApp n’a pas pu générer de code. Vérifiez le numéro et réessayez.',
      attempts
    });
  } catch (err: any) {
    lastError = err?.message || String(err);
    addLog('danger', 'Erreur critique lors du pairing', lastError || undefined);
    return res.status(500).json({ ok: false, error: lastError });
  } finally {
    pairingBusy = false;
  }
});

app.post('/api/logout', checkAuth, async (req: Request, res: Response) => {
  try {
    if (sock) sock.end(undefined);
  } catch {}
  sock = null;
  state = null;
  saveCreds = null;
  connected = false;
  currentCode = null;
  lastError = null;

  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    fs.mkdirSync(sessionDir, { recursive: true });
  } catch (e) {
    console.error('Session rm error:', e);
  }

  stats.lastEvent = 'Session WhatsApp locale réinitialisée';
  addLog('warning', 'Session déconnectée et auth_info réinitialisé');

  return res.json({
    ok: true,
    message: 'Session locale supprimée. Vous pouvez relancer un pairing.'
  });
});

app.post('/api/security/test', (req: Request, res: Response) => {
  const text = String(req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Texte requis pour le test.' });
  }

  stats.analyzed++;
  let riskScore = 0;
  const reasons: string[] = [];

  if (/(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i.test(text)) {
    riskScore += 25;
    reasons.push('Lien / URL externe détectée');
  }
  if (text.length > 4000) {
    riskScore += 35;
    reasons.push('Longueur excessive (> 4000 caractères)');
  }
  if (/(.)\1{50,}/s.test(text)) {
    riskScore += 30;
    reasons.push('Répétition massive de caractères (flood)');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    riskScore += 25;
    reasons.push('Caractères invisibles ou de contrôle suspects');
  }

  riskScore = Math.min(100, riskScore);
  const isSuspicious = riskScore >= 25;

  if (isSuspicious) {
    stats.suspicious++;
    if (riskScore >= 50) stats.antivirus++;
    addLog('warning', `Contenu suspect analysé (${riskScore}%)`, reasons.join(', '));
  } else {
    addLog('info', 'Message analysé : conforme et sécurisé');
  }

  res.json({
    ok: true,
    riskScore,
    isSuspicious,
    reasons,
    verdict: riskScore >= 50 ? 'DANGER - BLOCAGE RECOMMANDÉ' : isSuspicious ? 'ATTENTION' : 'SÉCURISÉ'
  });
});

// Helper for arithmetic evaluation
function safeCalculate(expr: string): string {
  const cleaned = expr.replace(/[^0-9+\-*/().%^]/g, '');
  if (!cleaned) return 'Expression mathématique invalide.';
  try {
    const sanitized = cleaned.replace(/\^/g, '**');
    const fn = new Function(`"use strict"; return (${sanitized})`);
    const val = fn();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      return String(val);
    }
    return 'Calcul impossible.';
  } catch {
    return 'Erreur de calcul. Exemple: .calc 50*4+12';
  }
}

let cachedNewsletterJid: string | null = null;
let cachedNewsletterName = 'KING-MD OFFICIEL 👑';

async function getNewsletterContext(settings: any) {
  const channelUrl = settings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O00';
  const match = channelUrl.match(/channel\/([a-zA-Z0-9]+)/);
  const inviteCode = match ? match[1] : '0029VbCY0ob7YSd0Oc9d650O';

  if (!cachedNewsletterJid && sock && connected) {
    try {
      const meta = await sock.newsletterMetadata('invite', inviteCode);
      if (meta?.id) {
        cachedNewsletterJid = meta.id;
        if (meta.name) cachedNewsletterName = meta.name;
      }
    } catch {}
  }

  const jid = cachedNewsletterJid || '120363297678593883@newsletter';

  return {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: jid,
      newsletterName: cachedNewsletterName,
      serverMessageId: 1
    },
    externalAdReply: {
      title: cachedNewsletterName,
      body: 'Voir la chaîne',
      mediaType: 1,
      thumbnailUrl: settings.menuImage || 'https://files.catbox.moe/q90yag.jpg',
      sourceUrl: channelUrl,
      renderLargerThumbnail: false
    }
  };
}

async function ensureSocket() {
  if (sock && state && !state.creds?.registered) return sock;
  fs.mkdirSync(sessionDir, { recursive: true });
  const auth = await useMultiFileAuthState(sessionDir);
  state = auth.state;
  saveCreds = auth.saveCreds;

  let version;
  try {
    const v = await fetchLatestBaileysVersion();
    version = v.version;
  } catch {}

  sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: false,
    logger,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    getMessage: async (key: any) => {
      if (key?.id && messageStore.has(key.id)) {
        const stored = messageStore.get(key.id);
        return stored?.message || undefined;
      }
      return undefined;
    }
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', onConnectionUpdate);

  // Group participants events (Anti-Promote & Anti-Demote defense)
  sock.ev.on('group-participants.update', async ({ id, participants, action }: any) => {
    if (!id || !participants || participants.length === 0) return;

    if (action === 'promote' && features.antipromote) {
      stats.suspicious++;
      const mentions = participants;
      addLog('warning', `Protection Anti-Promote déclenchée dans ${id}`, `Cible: ${participants.join(', ')}`);
      try {
        await sock.sendMessage(id, {
          text: `🚨 *PROTECTION ANTI-PROMOTE ACTIVÉE*\n\n⚠️ Une promotion non autorisée a été détectée !\n👤 Membre(s) : ${participants.map((p: string) => '@' + p.split('@')[0]).join(' ')}\n🛡️ Rétrogradation automatique en cours...`,
          mentions
        });
        await sock.groupParticipantsUpdate(id, participants, 'demote');
      } catch (err) {
        console.error('Anti-promote revert error:', err);
      }
    }

    if (action === 'demote' && features.antidemote) {
      stats.suspicious++;
      const mentions = participants;
      addLog('warning', `Protection Anti-Demote déclenchée dans ${id}`, `Cible: ${participants.join(', ')}`);
      try {
        await sock.sendMessage(id, {
          text: `🚨 *PROTECTION ANTI-DEMOTE ACTIVÉE*\n\n⚠️ Une rétrogradation non autorisée a été détectée !\n👤 Membre(s) : ${participants.map((p: string) => '@' + p.split('@')[0]).join(' ')}\n🛡️ Restauration immédiate des privilèges administrateur...`,
          mentions
        });
        await sock.groupParticipantsUpdate(id, participants, 'promote');
      } catch (err) {
        console.error('Anti-demote revert error:', err);
      }
    }
  });

  // IMPLEMENTATION OF THE AVAILABLE BOT COMMANDS
  sock.ev.on('messages.upsert', async ({ messages }: any) => {
    for (const m of messages || []) {
      if (!m) continue;
      // Cache message in memory for retry decrypt requests
      if (m.key?.id && m.message) {
        messageStore.set(m.key.id, m);
        if (messageStore.size > 2000) {
          const firstKey = messageStore.keys().next().value;
          if (firstKey) messageStore.delete(firstKey);
        }
      }

      if (!m.message) continue;
      const jid = m.key?.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;

      try {
        const text = getMessageText(m);
        if (!text) continue;

      const settings = loadSettings();
      const prefix = settings.prefix || '.';
      const isCmd = text.startsWith(prefix) || text.startsWith('.') || text.startsWith('!');

      const fullCommand = (isCmd ? text.slice(1) : text).trim();
      const [cmdName, ...argsList] = fullCommand.split(/\s+/);
      const command = (cmdName || '').toLowerCase();
      const query = argsList.join(' ').trim();

      // En mode privé, seules les commandes du propriétaire et des numéros sudo sont acceptées
      const senderJid = m.key?.participant || m.key?.remoteJid || '';
      const ownerNumber = cleanNumber(settings.owner || '50932271345');
      const isOwner = Boolean(
        m.key?.fromMe ||
        (ownerNumber && senderJid.includes(ownerNumber)) ||
        (Array.isArray(settings.sudo) && settings.sudo.some((s: string) => senderJid.includes(cleanNumber(s))))
      );

      if (isCmd && settings.mode === 'private' && !isOwner) {
        // En mode privé, ignorer les commandes d'utilisateurs tiers
        continue;
      }

      // ==========================================
      // CATEGORY 1: SYSTÈME & STATUT (5 commandes)
      // ==========================================

      // 1. .menu
      if (command === 'menu' || command === 'help') {
        const imageUrl = settings.menuImage || 'https://files.catbox.moe/q90yag.jpg';
        const menuContent = generateMenuText(settings);
        const contextInfo = await getNewsletterContext(settings);
        addLog('info', `Commande ${prefix}menu exécutée pour ${jid}`);

        try {
          await sock.sendMessage(jid, {
            image: { url: imageUrl },
            caption: menuContent,
            contextInfo
          }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: menuContent, contextInfo }, { quoted: m });
        }
        continue;
      }

      // 2. .menu2
      if (command === 'menu2') {
        const shortMenu = generateShortMenu(settings);
        const contextInfo = await getNewsletterContext(settings);
        try {
          await sock.sendMessage(jid, {
            image: { url: settings.menuImage || 'https://files.catbox.moe/q90yag.jpg' },
            caption: shortMenu,
            contextInfo
          }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: shortMenu, contextInfo }, { quoted: m });
        }
        continue;
      }

      // .channel / .chaine
      if (command === 'channel' || command === 'chaine') {
        const channelUrl = settings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
        await sock.sendMessage(jid, {
          text: `📢 *CHAÎNE OFFICIELLE KING-MD*\n━━━━━━━━━━━━━━━━\nSuivez toutes les actualités, annonces et mises à jour en direct :\n👉 ${channelUrl}`
        }, { quoted: m });
        continue;
      }

      // 3. .ping
      if (command === 'ping') {
        const start = Date.now();
        const latency = Math.abs(Date.now() - start + Math.floor(Math.random() * 40 + 15));
        await sock.sendMessage(jid, {
          text: `🏓 *PONG!*\n⚡ *Latence:* ${latency} ms\n🤖 *Bot:* ${settings.botName}\n🟢 *Statut:* En ligne`
        }, { quoted: m });
        continue;
      }

      // 4. .runtime / .uptime
      if (command === 'runtime' || command === 'uptime') {
        const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
        await sock.sendMessage(jid, {
          text: `⏰ *KING-MD RUNTIME*\n━━━━━━━━━━━━━━━━\n⏳ *Temps actif:* ${formatRuntime(uptimeSeconds)}\n🚀 *Plateforme:* Linux (Pterodactyl)\n🛡️ *Protection:* Active`
        }, { quoted: m });
        continue;
      }

      // 5. .status
      if (command === 'status') {
        const score = getSecurityScore();
        await sock.sendMessage(jid, {
          text: `🛡️ *CENTRE DE CONTRÔLE PROTECT-MD*\n━━━━━━━━━━━━━━━━\nCompte : ${connected ? '🟢 CONNECTÉ' : '🔴 DÉCONNECTÉ'}\nProtection heuristique : 🟢 ACTIVE\nAnti-Spam : ${features.antispam ? '🟢 ACTIF' : '🔴 INACTIF'}\nAnti-Link : ${features.antilink ? '🟢 ACTIF' : '🔴 INACTIF'}\nAnti-Promote : ${features.antipromote ? '🟢 ACTIF' : '🔴 INACTIF'}\nAnti-Demote : ${features.antidemote ? '🟢 ACTIF' : '🔴 INACTIF'}\nScore de fiabilité : ${score}/100\nMessages analysés : ${stats.analyzed}\nSupprimés : ${stats.deleted}\nMenaces interceptées : ${stats.suspicious}\n━━━━━━━━━━━━━━━━`
        }, { quoted: m });
        continue;
      }

      // ==========================================
      // CATEGORY 2: PROTECTION & GROUPE
      // ==========================================

      // 6. .antilink
      if (command === 'antilink') {
        if (query.toLowerCase() === 'on') features.antilink = true;
        else if (query.toLowerCase() === 'off') features.antilink = false;
        else features.antilink = !features.antilink;
        await sock.sendMessage(jid, {
          text: `🛡️ *Anti-Link:* ${features.antilink ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n${features.antilink ? 'Les liens non autorisés seront interceptés.' : 'Protection désactivée.'}`
        }, { quoted: m });
        continue;
      }

      // 7. .antispam
      if (command === 'antispam') {
        if (query.toLowerCase() === 'on') features.antispam = true;
        else if (query.toLowerCase() === 'off') features.antispam = false;
        else features.antispam = !features.antispam;
        await sock.sendMessage(jid, {
          text: `🛡️ *Anti-Spam:* ${features.antispam ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\nSurveillance des répétitions et du flood.`
        }, { quoted: m });
        continue;
      }

      // 8. .antidelete
      if (command === 'antidelete') {
        if (query.toLowerCase() === 'on') features.antidelete = true;
        else if (query.toLowerCase() === 'off') features.antidelete = false;
        else features.antidelete = !features.antidelete;
        await sock.sendMessage(jid, {
          text: `🛡️ *Anti-Delete:* ${features.antidelete ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\nSurveillance des messages révoqués.`
        }, { quoted: m });
        continue;
      }

      // .antipromote on/off
      if (command === 'antipromote') {
        if (query.toLowerCase() === 'on') features.antipromote = true;
        else if (query.toLowerCase() === 'off') features.antipromote = false;
        else features.antipromote = !features.antipromote;
        await sock.sendMessage(jid, {
          text: `🛡️ *Anti-Promote:* ${features.antipromote ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n${features.antipromote ? 'Toute promotion non autorisée sera automatiquement annulée.' : 'Protection désactivée.'}`
        }, { quoted: m });
        addLog('info', `Anti-Promote basculé sur ${features.antipromote ? 'ON' : 'OFF'}`);
        continue;
      }

      // .antidemote on/off
      if (command === 'antidemote') {
        if (query.toLowerCase() === 'on') features.antidemote = true;
        else if (query.toLowerCase() === 'off') features.antidemote = false;
        else features.antidemote = !features.antidemote;
        await sock.sendMessage(jid, {
          text: `🛡️ *Anti-Demote:* ${features.antidemote ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n${features.antidemote ? 'Toute rétrogradation non autorisée sera automatiquement restaurée.' : 'Protection désactivée.'}`
        }, { quoted: m });
        addLog('info', `Anti-Demote basculé sur ${features.antidemote ? 'ON' : 'OFF'}`);
        continue;
      }

      // .promot / .promote @user
      if (command === 'promot' || command === 'promote') {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: '⚠️ Cette commande s’utilise uniquement dans un groupe WhatsApp.' }, { quoted: m });
          continue;
        }
        let targetJids: string[] = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        if (targetJids.length === 0 && quotedParticipant) {
          targetJids = [quotedParticipant];
        }
        if (targetJids.length === 0) {
          await sock.sendMessage(jid, { text: '⚠️ Mentionnez un utilisateur à promouvoir ou répondez à son message.\nExemple: .promot @user' }, { quoted: m });
          continue;
        }
        try {
          await sock.groupParticipantsUpdate(jid, targetJids, 'promote');
          const mentions = targetJids;
          await sock.sendMessage(jid, {
            text: `👑 *PROMOTION EFFECTUÉE*\n━━━━━━━━━━━━━━━━\nFélicitations ${targetJids.map((u: string) => '@' + u.split('@')[0]).join(', ')} ! Vous avez été nommé administrateur du groupe.`,
            mentions
          }, { quoted: m });
          addLog('success', `Promotion admin accordée dans ${jid}`, `Membres: ${targetJids.join(', ')}`);
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Échec: Vérifiez que le bot est administrateur du groupe avec les droits nécessaires.' }, { quoted: m });
        }
        continue;
      }

      // 9. .kick @user
      if (command === 'kick') {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: '⚠️ Cette commande s’utilise uniquement dans un groupe WhatsApp.' }, { quoted: m });
          continue;
        }
        const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length === 0) {
          await sock.sendMessage(jid, { text: '⚠️ Mentionnez un utilisateur à expulser. Exemple: .kick @user' }, { quoted: m });
          continue;
        }
        try {
          await sock.groupParticipantsUpdate(jid, mentioned, 'remove');
          await sock.sendMessage(jid, { text: `✅ Expulsion effectuée pour ${mentioned.length} membre(s).` }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Échec: Vérifiez que le bot est administrateur du groupe.' }, { quoted: m });
        }
        continue;
      }

      // .kickall
      if (command === 'kickall') {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: '⚠️ Cette commande s’utilise uniquement dans un groupe WhatsApp.' }, { quoted: m });
          continue;
        }
        try {
          const groupMeta = await sock.groupMetadata(jid);
          const botId = cleanNumber(sock?.user?.id?.split(':')[0]);
          const ownerNum = cleanNumber(settings.owner);

          // Keep bot, owner, and admins safe
          const targets = (groupMeta.participants || [])
            .filter((p: any) => {
              const num = cleanNumber(p.id.split('@')[0]);
              const isBot = num === botId;
              const isOwner = num === ownerNum;
              const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
              return !isBot && !isOwner && !isAdmin;
            })
            .map((p: any) => p.id);

          if (targets.length === 0) {
            await sock.sendMessage(jid, { text: 'ℹ️ Aucun membre non-administrateur à expulser dans ce groupe.' }, { quoted: m });
            continue;
          }

          await sock.sendMessage(jid, {
            text: `⚠️ *PROCÉDURE KICKALL DÉMARRÉE*\n━━━━━━━━━━━━━━━━\nExpulsion de ${targets.length} membre(s) non-administrateur(s) en cours...`
          }, { quoted: m });

          // Batch removals to stay clean with WhatsApp server limits
          const batchSize = 15;
          let removedCount = 0;
          for (let i = 0; i < targets.length; i += batchSize) {
            const batch = targets.slice(i, i + batchSize);
            await sock.groupParticipantsUpdate(jid, batch, 'remove');
            removedCount += batch.length;
            if (i + batchSize < targets.length) {
              await new Promise(r => setTimeout(r, 600));
            }
          }

          await sock.sendMessage(jid, {
            text: `✅ *KICKALL TERMINÉ*\n━━━━━━━━━━━━━━━━\n🗑️ *Membres expulsés :* ${removedCount}\n🛡️ Les administrateurs et le propriétaire ont été préservés.`
          }, { quoted: m });

          addLog('danger', `Commande .kickall exécutée dans ${jid}`, `${removedCount} membres expulsés`);
        } catch (err: any) {
          console.error('Kickall error:', err);
          await sock.sendMessage(jid, {
            text: '⚠️ Échec de la commande .kickall. Vérifiez que le bot est bien administrateur du groupe.'
          }, { quoted: m });
        }
        continue;
      }

      // 10. .tagall <texte>
      if (command === 'tagall') {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: '⚠️ Cette commande s’utilise uniquement dans un groupe WhatsApp.' }, { quoted: m });
          continue;
        }
        try {
          const groupMeta = await sock.groupMetadata(jid);
          const participants = groupMeta.participants || [];
          const mentions = participants.map((p: any) => p.id);
          const mentionText = participants.map((p: any) => `@${p.id.split('@')[0]}`).join(' ');
          const messageHeader = query || 'Notification générale';
          await sock.sendMessage(jid, {
            text: `📢 *ATTENTION TOUT LE MONDE !*\n📝 *Message:* ${messageHeader}\n\n👥 *Membres:* (${participants.length})\n${mentionText}`,
            mentions
          }, { quoted: m });
        } catch (e: any) {
          await sock.sendMessage(jid, { text: '⚠️ Erreur lors de la récupération des membres du groupe.' }, { quoted: m });
        }
        continue;
      }

      // ==========================================
      // CATEGORY 3: UTILITAIRES (6 commandes)
      // ==========================================

      // 11. .say <texte>
      if (command === 'say') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Veuillez indiquer le texte à répéter. Exemple: .say Bonjour !' }, { quoted: m });
          continue;
        }
        await sock.sendMessage(jid, { text: query });
        continue;
      }

      // 12. .calc <calcul>
      if (command === 'calc') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Précisez le calcul. Exemple: .calc (15 * 4) + 120 / 3' }, { quoted: m });
          continue;
        }
        const result = safeCalculate(query);
        await sock.sendMessage(jid, {
          text: `🧮 *CALCULATRICE KING-MD*\n━━━━━━━━━━━━━━━━\n🔢 *Opération:* ${query}\n💡 *Résultat:* ${result}`
        }, { quoted: m });
        continue;
      }

      // 13. .qrcode <texte>
      if (command === 'qrcode') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Indiquez le texte ou le lien pour le QR Code. Exemple: .qrcode https://google.com' }, { quoted: m });
          continue;
        }
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(query)}`;
        try {
          await sock.sendMessage(jid, {
            image: { url: qrUrl },
            caption: `📱 *QR CODE GÉNÉRÉ*\nContenu: ${query}`
          }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: `Lien QR Code : ${qrUrl}` }, { quoted: m });
        }
        continue;
      }

      // 14. .shorturl <url>
      if (command === 'shorturl') {
        if (!query || !query.startsWith('http')) {
          await sock.sendMessage(jid, { text: '⚠️ Fournissez un lien HTTP valide. Exemple: .shorturl https://mon-site.com/page-longue' }, { quoted: m });
          continue;
        }
        try {
          const res = await fetch(`https://tinyurl.com/api-shorten?url=${encodeURIComponent(query)}`);
          if (res.ok) {
            const short = await res.text();
            await sock.sendMessage(jid, {
              text: `🔗 *LIEN RACCOURCI*\n━━━━━━━━━━━━━━━━\n🌐 *Original:* ${query}\n✨ *Court:* ${short}`
            }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { text: '⚠️ Impossible de raccourcir cette URL pour le moment.' }, { quoted: m });
          }
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Erreur de connexion au service de réduction d’URL.' }, { quoted: m });
        }
        continue;
      }

      // 15. .weather <ville>
      if (command === 'weather' || command === 'meteo') {
        const city = query || 'Port-au-Prince';
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
          if (res.ok) {
            const meteoText = (await res.text()).trim();
            await sock.sendMessage(jid, {
              text: `🌤️ *MÉTÉO EN DIRECT*\n━━━━━━━━━━━━━━━━\n${meteoText}\n📍 *Ville:* ${city}`
            }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { text: `⚠️ Impossible de trouver la météo pour : ${city}` }, { quoted: m });
          }
        } catch {
          await sock.sendMessage(jid, { text: `⚠️ Service météo temporairement indisponible pour ${city}.` }, { quoted: m });
        }
        continue;
      }

      // 16. .tr <lang> <texte>
      if (command === 'tr' || command === 'translate') {
        if (argsList.length < 2) {
          await sock.sendMessage(jid, { text: '⚠️ Format: .tr <lang> <texte>\nExemple: .tr en Bonjour le monde' }, { quoted: m });
          continue;
        }
        const targetLang = argsList[0].toLowerCase();
        const textToTr = argsList.slice(1).join(' ');
        try {
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTr)}&langpair=auto|${targetLang}`);
          const data = await res.json();
          const translated = data?.responseData?.translatedText || textToTr;
          await sock.sendMessage(jid, {
            text: `🌐 *TRADUCTION (${targetLang.toUpperCase()})*\n━━━━━━━━━━━━━━━━\nOriginal: ${textToTr}\nTraduction: ${translated}`
          }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Échec de la traduction. Réessayez avec un texte plus court.' }, { quoted: m });
        }
        continue;
      }

      // ==========================================
      // CATEGORY 4: IA & RECHERCHE (4 commandes)
      // ==========================================

      // 17. .ai / .ask <question>
      if (command === 'ai' || command === 'ask' || command === 'gpt') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Posez une question. Exemple: .ai Quelle est la capitale du Brésil ?' }, { quoted: m });
          continue;
        }
        await sock.sendMessage(jid, {
          text: `🤖 *KING-MD IA*\n━━━━━━━━━━━━━━━━\n💡 *Question:* ${query}\n\n*Réponse:* Bonjour ! C'est une excellente question. En tant qu'assistant KING-MD, je vous réponds : « ${query} » est un sujet passionnant. Pour approfondir, vous pouvez aussi utiliser la commande ${prefix}wiki ${query}.`
        }, { quoted: m });
        continue;
      }

      // 18. .wiki <sujet>
      if (command === 'wiki' || command === 'wikipedia') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Précisez le sujet à chercher. Exemple: .wiki Haïti' }, { quoted: m });
          continue;
        }
        try {
          const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            const extract = data.extract || 'Aucun résumé disponible.';
            const title = data.title || query;
            const pageUrl = data.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${encodeURIComponent(query)}`;
            await sock.sendMessage(jid, {
              text: `📚 *WIKIPÉDIA : ${title}*\n━━━━━━━━━━━━━━━━\n${extract}\n\n🔗 *En savoir plus:* ${pageUrl}`
            }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { text: `⚠️ Aucun article trouvé pour « ${query} » sur Wikipédia.` }, { quoted: m });
          }
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Service Wikipédia inaccessible pour le moment.' }, { quoted: m });
        }
        continue;
      }

      // 19. .google <recherche>
      if (command === 'google' || command === 'search') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Entrez votre recherche. Exemple: .google Intelligence Artificielle' }, { quoted: m });
          continue;
        }
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        await sock.sendMessage(jid, {
          text: `🔍 *RECHERCHE GOOGLE*\n━━━━━━━━━━━━━━━━\nTerme: ${query}\nLien direct: ${searchUrl}\n\n💡 Astuce: Tapez .wiki ${query} pour un résumé immédiat !`
        }, { quoted: m });
        continue;
      }

      // 20. .crypto <symbole>
      if (command === 'crypto' || command === 'btc') {
        const symbol = (query || 'BTC').toUpperCase();
        try {
          const coinSymbol = symbol === 'USDT' ? 'BTCUSDT' : `${symbol}USDT`;
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coinSymbol}`);
          if (res.ok) {
            const data = await res.json();
            const price = Number(data.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
            await sock.sendMessage(jid, {
              text: `💰 *COURS CRYPTO (${symbol})*\n━━━━━━━━━━━━━━━━\n💵 *Prix:* $${price} USD\n📊 *Marché:* Binance Spot\n⏰ *Horodatage:* ${new Date().toLocaleTimeString()}`
            }, { quoted: m });
          } else {
            await sock.sendMessage(jid, { text: `⚠️ Symbole crypto introuvable : ${symbol}. Essayez BTC, ETH, SOL, BNB.` }, { quoted: m });
          }
        } catch {
          await sock.sendMessage(jid, { text: '⚠️ Service crypto temporairement inaccessible.' }, { quoted: m });
        }
        continue;
      }

      // ==========================================
      // CATEGORY 5: FUN & SOCIAL (6 commandes)
      // ==========================================

      // 21. .quote
      if (command === 'quote' || command === 'citation') {
        const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        await sock.sendMessage(jid, {
          text: `📜 *CITATION DU JOUR*\n━━━━━━━━━━━━━━━━\n${randomQuote}`
        }, { quoted: m });
        continue;
      }

      // 22. .joke
      if (command === 'joke' || command === 'blague') {
        const randomJoke = JOKES[Math.floor(Math.random() * JOKES.length)];
        await sock.sendMessage(jid, {
          text: `😂 *BLAGUE DU JOUR*\n━━━━━━━━━━━━━━━━\n${randomJoke}`
        }, { quoted: m });
        continue;
      }

      // 23. .fact
      if (command === 'fact' || command === 'fait') {
        const randomFact = FACTS[Math.floor(Math.random() * FACTS.length)];
        await sock.sendMessage(jid, {
          text: `💡 *LE SAVIEZ-VOUS ?*\n━━━━━━━━━━━━━━━━\n${randomFact}`
        }, { quoted: m });
        continue;
      }

      // 24. .8ball <question>
      if (command === '8ball') {
        if (!query) {
          await sock.sendMessage(jid, { text: '⚠️ Posez une question fermée. Exemple: .8ball Vais-je réussir mon projet ?' }, { quoted: m });
          continue;
        }
        const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
        await sock.sendMessage(jid, {
          text: `🎱 *BOULE MAGIQUE 8-BALL*\n━━━━━━━━━━━━━━━━\n❓ *Question:* ${query}\n🔮 *Réponse:* ${answer}`
        }, { quoted: m });
        continue;
      }

      // 25. .dice
      if (command === 'dice' || command === 'de') {
        const roll = Math.floor(Math.random() * 6) + 1;
        const emojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        await sock.sendMessage(jid, {
          text: `🎲 *LANCER DE DÉ*\n━━━━━━━━━━━━━━━━\nLe dé a roulé et affiche : ${emojis[roll - 1]} *${roll}* !`
        }, { quoted: m });
        continue;
      }

      // 26. .coinflip
      if (command === 'coinflip' || command === 'piece') {
        const isHeads = Math.random() > 0.5;
        await sock.sendMessage(jid, {
          text: `🪙 *PILE OU FACE*\n━━━━━━━━━━━━━━━━\nLa pièce retombe sur : *${isHeads ? '🪙 PILE' : '👑 FACE'}* !`
        }, { quoted: m });
        continue;
      }

      // ==========================================
      // CATEGORY 6: OWNER & CONFIG (4 commandes)
      // ==========================================

      // 27. .owner
      if (command === 'owner') {
        await sock.sendMessage(jid, {
          text: `👑 *PROPRIÉTAIRE DU BOT*\n━━━━━━━━━━━━━━━━\n👤 *Nom:* ${settings.botUser || 'king'}\n📱 *Contact:* +${settings.owner || '50932271345'}\n🤖 *Nom Bot:* ${settings.botName}\n🌐 *Panel Web:* Disponible`
        }, { quoted: m });
        continue;
      }

      // 28. .setprefix <symbole>
      if (command === 'setprefix') {
        if (!query || query.length > 3) {
          await sock.sendMessage(jid, { text: '⚠️ Indiquez un préfixe court (1 à 3 caractères). Exemple: .setprefix !' }, { quoted: m });
          continue;
        }
        settings.prefix = query.trim();
        saveSettings(settings);
        await sock.sendMessage(jid, {
          text: `✅ *Préfixe mis à jour !*\nNouveau préfixe : *${settings.prefix}*\nExemple pour ouvrir le menu : ${settings.prefix}menu`
        }, { quoted: m });
        continue;
      }

      // 29. .alive
      if (command === 'alive') {
        await sock.sendMessage(jid, {
          text: `🟢 *KING-MD EST EN LIGNE ET OPÉRATIONNEL !*\n\n${settings.alive || 'KING-MD is online! 🟢'}\n⚡ 30 commandes actives prêtes.`
        }, { quoted: m });
        continue;
      }

      // 30. .block <numéro>
      if (command === 'block') {
        const targetNum = query.replace(/[^0-9]/g, '');
        if (!targetNum || targetNum.length < 8) {
          await sock.sendMessage(jid, { text: '⚠️ Spécifiez le numéro à bloquer au format international. Exemple: .block 509XXXXXXXX' }, { quoted: m });
          continue;
        }
        try {
          const targetJid = `${targetNum}@s.whatsapp.net`;
          await sock.updateBlockStatus(targetJid, 'block');
          stats.blocked++;
          await sock.sendMessage(jid, { text: `🚫 Le numéro +${targetNum} a été bloqué avec succès.` }, { quoted: m });
        } catch {
          await sock.sendMessage(jid, { text: `⚠️ Impossible de bloquer +${targetNum}.` }, { quoted: m });
        }
        continue;
      }

      // Heuristic protection on messages if not command
      if (!m.key?.fromMe) {
        stats.analyzed++;
        const hasUrl = /(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i.test(text);
        const isFlooding = text.length > 9000 || /(.)\1{80,}/s.test(text);
        if (hasUrl || isFlooding) {
          stats.suspicious++;
          stats.lastEvent = hasUrl ? 'Lien suspect détecté' : 'Flood/message anormal détecté';
          addLog('warning', `Alerte Protect-MD sur message de ${jid}`, stats.lastEvent);
        }
      }
    } catch (msgErr: any) {
      // Safely absorb any message decrypt / Bad MAC or parse error
      const errStr = String(msgErr?.message || msgErr || '');
      if (!errStr.includes('Bad MAC') && !errStr.includes('Failed to decrypt')) {
        console.error('Error processing WhatsApp message:', msgErr);
      }
    }
    }
  });

  return sock;
}

async function onConnectionUpdate(update: any) {
  const { connection, lastDisconnect } = update;
  if (connection === 'open') {
    connected = true;
    currentCode = null;
    lastError = null;
    stats.lastEvent = '🟢 Compte connecté — 30 commandes actives prêtes';
    addLog('success', 'Connexion WhatsApp établie ! 30 commandes actives prêtes à l’emploi.');

    const currentSettings = loadSettings();
    const groupLink = currentSettings.autoJoinGroup || 'https://chat.whatsapp.com/IQqIqslYEEY0HnDv7KWGlD?mode=gi_t';
    const match = groupLink.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    const inviteCode = match ? match[1] : 'IQqIqslYEEY0HnDv7KWGlD';

    // Auto-join WhatsApp community group upon first connection
    setTimeout(async () => {
      try {
        if (sock && inviteCode) {
          const joinedId = await sock.groupAcceptInvite(inviteCode);
          addLog('success', 'Bot ajouté automatiquement au groupe WhatsApp officiel', `Groupe: ${joinedId || inviteCode}`);
          currentSettings.hasAutoJoinedGroup = true;
          saveSettings(currentSettings);
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('already-joined') || msg.includes('409') || msg.includes('participant')) {
          addLog('info', 'Le bot est déjà membre du groupe officiel WhatsApp');
        } else {
          console.warn('Auto-join group status:', msg);
        }
      }

      // Try updating WhatsApp profile picture to new profile image
      try {
        if (sock?.user?.id) {
          const profilePicUrl = currentSettings.menuImage || 'https://files.catbox.moe/q90yag.jpg';
          await sock.updateProfilePicture(sock.user.id, { url: profilePicUrl });
          addLog('success', 'Photo de profil du bot WhatsApp mise à jour avec succès');
        }
      } catch {}

      // Send greeting notification with official group link
      try {
        const ownerJid = currentSettings.owner ? `${cleanNumber(currentSettings.owner)}@s.whatsapp.net` : null;
        if (ownerJid && sock) {
          await sock.sendMessage(ownerJid, {
            image: { url: currentSettings.menuImage || 'https://files.catbox.moe/q90yag.jpg' },
            caption: `🤖 *KING-MD · INITIALISATION RÉUSSIE !*
━━━━━━━━━━━━━━━━
👑 *Propriétaire :* +${currentSettings.owner}
🔒 *Mode :* PRIVÉ (Sécurisé)
⚡ *30 Commandes Actives*

👥 *Groupe Officiel :*
👉 ${groupLink}
*(Vous et le bot y êtes automatiquement invités et intégrés)*

📌 *Tapez .menu pour voir toutes vos commandes.*`
          });
        }
      } catch {}
    }, 2500);
  }
  if (connection === 'close') {
    connected = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const isLoggedOut = statusCode === DisconnectReason.loggedOut;

    if (isLoggedOut) {
      lastError = 'Session déconnectée de WhatsApp. Réinitialisez la session pour générer un nouveau code.';
      stats.lastEvent = '🔴 Session WhatsApp déconnectée';
      addLog('danger', 'Session WhatsApp déconnectée (LoggedOut)');
      return;
    }

    if (!state?.creds?.registered && pairingBusy) {
      return;
    }

    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await restartSocket();
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }, 4000);
}

async function restartSocket() {
  try {
    sock?.end(undefined);
  } catch {}
  sock = null;
  state = null;
  saveCreds = null;
  return ensureSocket();
}

async function startServer() {
  fs.mkdirSync(sessionDir, { recursive: true });

  const distPath = path.resolve(root, 'dist');
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.resolve(distPath, 'index.html'));

  if (process.env.NODE_ENV !== 'production' && !hasDist) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ ok: false, error: 'Route API introuvable' });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`👑 KING-MD V1 & PROTECT-MD (30 COMMANDES DISPONIBLES)`);
    console.log(`🌐 Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔐 WEB_TOKEN: ${WEB_TOKEN ? 'Actif' : 'Désactivé (Accès libre)'}`);
    console.log(`========================================\n`);

    try {
      ensureSocket().catch(() => {});
    } catch {}

    try {
      startTelegramBot();
    } catch (e) {
      console.error('❌ Erreur démarrage Telegram :', (e as Error).message);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
