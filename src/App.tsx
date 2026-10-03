import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Shield,
  ShieldCheck,
  Terminal,
  Settings as SettingsIcon,
  RefreshCw,
  Copy,
  Check,
  Search,
  AlertTriangle,
  Activity,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Power,
  Image as ImageIcon,
  MessageSquareQuote,
  ExternalLink,
  Users,
  Zap,
  Lock,
  Sparkles,
  Radio,
  Globe
} from 'lucide-react';
import { BOT_COMMANDS, TOTAL_COMMAND_COUNT, AVAILABLE_30_COMMANDS } from './data/commandsData';

interface SystemStatus {
  ok: boolean;
  connected: boolean;
  pairingBusy: boolean;
  currentCode: string | null;
  lastError: string | null;
  attempts: number;
  maxAttempts: number;
  number: string | null;
  score: number;
  threat: string;
  stats: {
    analyzed: number;
    deleted: number;
    blocked: number;
    suspicious: number;
    spam: number;
    antivirus: number;
    lastEvent: string;
  };
  features?: {
    antilink: boolean;
    antispam: boolean;
    antidelete: boolean;
    antipromote: boolean;
    antidemote: boolean;
  };
  uptime: number;
  webTokenRequired: boolean;
}

interface BotSettings {
  prefix: string;
  mode: string;
  owner: string;
  botName: string;
  version: string;
  botUser: string;
  botNumber: string;
  menuImage?: string;
  channel?: string;
  autoJoinGroup?: string;
  hasAutoJoinedGroup?: boolean;
  alive?: string;
}

interface SecurityLog {
  id: string;
  time: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  details?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'pairing' | 'menu' | 'community' | 'security' | 'commands' | 'settings' | 'scanner'>('pairing');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<BotSettings>({
    prefix: '.',
    mode: 'private',
    owner: '50932271346',
    botName: 'KING-MD',
    version: '3.0.0',
    botUser: 'KING',
    botNumber: '50936903971',
    menuImage: 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg',
    channel: 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O',
    autoJoinGroup: 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
    hasAutoJoinedGroup: true,
    alive: 'KING-MD is online! 🟢'
  });
  const [logs, setLogs] = useState<SecurityLog[]>([]);

  // Pairing state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [attemptCount, setAttemptCount] = useState(2);
  const [webToken, setWebToken] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [pairingNotice, setPairingNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMenu, setCopiedMenu] = useState(false);
  const [copiedGroupLink, setCopiedGroupLink] = useState(false);

  // Commands state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Scanner state
  const [scanText, setScanText] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Settings save state
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedAlert, setSettingsSavedAlert] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.currentCode) {
          setGeneratedCode(data.currentCode);
        }
      }
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setLogs(data.logs);
      }
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            menuImage: data.settings.menuImage || 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg',
            autoJoinGroup: data.settings.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H',
            mode: 'private'
          }));
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchSettings();

    const interval = setInterval(() => {
      fetchStatus();
      if (activeTab === 'security') fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      setPairingNotice({
        type: 'error',
        text: 'Veuillez saisir un numéro valide avec indicatif pays sans "+" (ex: 509XXXXXXXX).'
      });
      return;
    }

    setIsPairing(true);
    setPairingNotice({
      type: 'info',
      text: 'Connexion aux serveurs WhatsApp et négociation du code de couplage… (patientez quelques secondes)'
    });
    setGeneratedCode(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webToken) headers['x-web-token'] = webToken;

      const res = await fetch('/api/pair', {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: clean, attempts: attemptCount })
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Impossible de générer le code.');
      }

      setGeneratedCode(data.code);
      setPairingNotice({
        type: 'success',
        text: `Code généré avec succès ! Entrez-le immédiatement dans WhatsApp. Le bot rejoindra également automatiquement le groupe officiel.`
      });
      fetchStatus();
      fetchLogs();
    } catch (err: any) {
      setPairingNotice({
        type: 'error',
        text: err.message || 'Une erreur est survenue lors de la demande de pairing.'
      });
    } finally {
      setIsPairing(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser la session WhatsApp locale (auth_info) ?')) {
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webToken) headers['x-web-token'] = webToken;

      const res = await fetch('/api/logout', { method: 'POST', headers });
      const data = await res.json();
      setGeneratedCode(null);
      setPairingNotice({
        type: 'info',
        text: data.message || 'Session réinitialisée avec succès.'
      });
      fetchStatus();
      fetchLogs();
    } catch (err: any) {
      setPairingNotice({
        type: 'error',
        text: err.message || 'Échec de réinitialisation de la session.'
      });
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'cmd' | 'menu' | 'group') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === 'menu') {
      setCopiedMenu(true);
      setTimeout(() => setCopiedMenu(false), 2000);
    } else if (type === 'group') {
      setCopiedGroupLink(true);
      setTimeout(() => setCopiedGroupLink(false), 2000);
    } else {
      setCopiedCmd(text);
      setTimeout(() => setCopiedCmd(null), 1500);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webToken) headers['x-web-token'] = webToken;

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...settings, mode: 'private' })
      });
      if (res.ok) {
        setSettingsSavedAlert(true);
        setTimeout(() => setSettingsSavedAlert(false), 3000);
        fetchSettings();
      }
    } catch {} finally {
      setIsSavingSettings(false);
    }
  };

  const handleScanText = async () => {
    if (!scanText.trim()) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/security/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scanText })
      });
      const data = await res.json();
      setScanResult(data);
      fetchStatus();
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const formatRuntime = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const rem = sec % 86400;
    const h = Math.floor(rem / 3600);
    const m = Math.floor((rem % 3600) / 60);
    const s = rem % 60;
    return `${d > 0 ? `${d}d ` : ''}${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
  };

  const channelLink = settings.channel || 'https://whatsapp.com/channel/0029VbCY0ob7YSd0Oc9d650O';
  const groupLink = settings.autoJoinGroup || 'https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H?mode=gi_t';
  const avatarUrl = settings.menuImage || 'https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg';

  const liveMenuText = `╔═════════════════════════╗
   ✧ 𝐊𝐈𝐍𝐆𝐌𝐃 𝐕𝟏 ✧
╚═════════════════════════╝

╭━━〔 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍𝐒 〕━━━
┃ 👑 ᴏᴡɴᴇʀ : +${settings.owner}
┃ 🤖 ʙᴏᴛ : ${settings.botName}
┃ 👤 ᴜsᴇʀ : ${settings.botUser}
┃ ⏱️ ᴜᴘᴛɪᴍᴇ : ${status ? formatRuntime(status.uptime) : '01h 45m 12s'}
┃ ⚙️ ᴍᴏᴅᴇ : PRIVÉ
┃ ⚡ ᴘʀᴇғɪx : [ ${settings.prefix} ]
┃ 👥 sᴛᴀᴛᴜs : ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ
┃ 💻 ʜᴏsᴛ : ᴘᴛᴇʀᴏᴅᴀᴄᴛʏʟ
┃ 📢 ᴄʜᴀɴɴᴇʟ :
┃ ${channelLink}
╰━━━━━━━━━━━━━━━━━━━━━━━

  ✦ ━━━━━━━━━━━━━━━━━━━━ ✦
   ✨ 𝐌𝐄𝐍𝐔 𝐃𝐄𝐒 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄𝐒 ✨
  ✦ ━━━━━━━━━━━━━━━━━━━━ ✦
${Object.entries(AVAILABLE_30_COMMANDS).map(([name, list]) => `\n╭─「 ${name} 」\n${list.map((item) => `│ ⭓ ${settings.prefix}${item.syntax.split(' ')[0]}`).join('\n')}\n╰──────────────────`).join('\n')}

╭━━〔 📢 ʀᴇᴊᴏɪɢɴᴇᴢ ɴᴏᴛʀᴇ ᴄʜᴀɪ̂ɴᴇ 〕━━━
┃ ${channelLink}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> 𝐁𝐘 𝐊𝐈𝐍𝐆 𝐒𝐓𝐀𝐑𝐊 · 𝐊𝐈𝐍𝐆-𝐌𝐃`;

  const filteredCategories = selectedCategory === 'ALL'
    ? Object.keys(AVAILABLE_30_COMMANDS)
    : [selectedCategory];

  return (
    <div className="min-h-screen bg-[#07080c] text-neutral-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Cyber Ambient Glow Backdrops */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[500px] bg-rose-600/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-1/3 -right-32 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[160px]"></div>
        <div className="absolute bottom-10 -left-20 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
      </div>

      {/* Top Floating Glass Header */}
      <header className="relative z-20 border-b border-white/[0.08] bg-[#0c0e14]/85 backdrop-blur-2xl sticky top-0 px-4 sm:px-8 py-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Brand & Bot Profile Mini Avatar */}
          <div className="flex items-center gap-3.5">
            <div className="relative group cursor-pointer" onClick={() => setActiveTab('menu')}>
              <div className="w-11 h-11 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 shadow-lg shadow-rose-950/40">
                <img
                  src={avatarUrl}
                  alt="Avatar Bot KING-MD"
                  className="w-full h-full object-cover rounded-[14px] bg-neutral-900"
                />
              </div>
              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0c0e14] ${status?.connected ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`}></span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wider text-white flex items-center gap-1.5">
                  KING-MD <span className="bg-gradient-to-r from-rose-400 via-rose-300 to-amber-300 bg-clip-text text-transparent font-mono text-sm font-bold">V1</span>
                </h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                  PRIVÉ 🔒
                </span>
                <span className="hidden md:inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  AUTO-JOIN ACTIF 👥
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                <span>WhatsApp Multi-Device</span>
                <span>·</span>
                <span>Protect-MD</span>
                <span>·</span>
                <span className="text-neutral-300 font-mono">+{settings.owner}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            {/* Direct Join WhatsApp Official Group Button */}
            <a
              href={groupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-emerald-400/40 hover:scale-[1.02] cursor-pointer"
              title="Groupe d'auto-intégration officiel"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Groupe Officiel</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            {/* Status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`}></span>
              <span className={status?.connected ? 'text-emerald-300' : 'text-rose-300'}>
                {status?.connected ? 'Connecté' : 'Non Connecté'}
              </span>
            </div>

            {/* Reset auth_info session */}
            <button
              onClick={handleResetSession}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/40 text-xs font-semibold transition-all cursor-pointer"
              title="Réinitialiser le dossier auth_info"
            >
              <Power className="w-3 h-3 text-rose-400" />
              <span>Reset Session</span>
            </button>

            <button
              onClick={() => { fetchStatus(); fetchLogs(); }}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 transition-colors border border-white/[0.08] cursor-pointer"
              title="Rafraîchir"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase Model Card */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-2 w-full">
        <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-white/[0.05] via-[#10131d]/90 to-[#0b0d14]/95 border border-white/[0.1] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-rose-500/20 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
            {/* Left: Avatar & Title info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
              {/* Highlighted Bot Profile Photo */}
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 shadow-[0_0_30px_rgba(244,63,94,0.35)] transition-transform duration-300 group-hover:scale-105">
                  <img
                    src={avatarUrl}
                    alt="Photo du Bot KING-MD"
                    className="w-full h-full object-cover rounded-[22px] bg-neutral-900"
                  />
                </div>
                <div className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2.5 py-0.5 rounded-full bg-[#0c0e14] border border-white/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 shadow-md">
                  VÉRIFIÉ ✓
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {settings.botName}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/[0.08] text-xs font-mono text-neutral-300 border border-white/[0.1]">
                    v{settings.version}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
                    🔒 MODE PRIVÉ
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 max-w-xl leading-relaxed">
                  Système de couplage automatique et robot de sécurité WhatsApp avec 30 commandes actives, réponse <code className="text-rose-400 font-mono">.menu</code> multimédia avec photo de profil et intégration automatique au groupe communautaire.
                </p>

                {/* Badges bar */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>30 Commandes Disponibles</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Protect-MD V1 Actif</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>Auto-Join Groupe : Activé</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Cards */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto shrink-0">
              <a
                href={groupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-[0_10px_25px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Rejoindre le Groupe WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setActiveTab('menu')}
                className="px-5 py-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-white/[0.1] cursor-pointer"
              >
                <MessageSquareQuote className="w-4 h-4 text-rose-400" />
                <span>Voir le Profil & Aperçu .menu</span>
              </button>
            </div>
          </div>

          {/* Auto-join Highlight Notice */}
          <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-neutral-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <b>Système d'auto-intégration :</b> Dès qu'une connexion WhatsApp est établie, le bot rejoint directement et intègre l'utilisateur dans le groupe officiel !
              </span>
            </div>

            <button
              onClick={() => copyToClipboard(groupLink, 'group')}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40"
            >
              {copiedGroupLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedGroupLink ? 'Lien copié !' : 'Copier le lien du groupe'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Futuristic Segmented Navigation Tabs */}
      <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-2 w-full">
        <div className="p-1.5 rounded-2xl bg-[#0e111a]/90 border border-white/[0.08] backdrop-blur-xl flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-lg">
          <button
            onClick={() => setActiveTab('pairing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pairing'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pairing WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Profil & .menu</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-mono">
              q90yag.jpg
            </span>
          </button>

          <button
            onClick={() => setActiveTab('community')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'community'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_4px_15px_rgba(16,185,129,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Groupe Officiel</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
              Auto-Join
            </span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Protect-MD</span>
            {status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.08] text-emerald-400 font-mono">
                {status.score}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('commands')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'commands'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>30 Commandes</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)]'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Paramètres</span>
          </button>
        </div>
      </nav>

      {/* Main Container Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {/* ======================================================== */}
        {/* TAB 1: PAIRING WHATSAPP */}
        {/* ======================================================== */}
        {activeTab === 'pairing' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Card: Pairing Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="p-3 bg-gradient-to-br from-rose-500/20 to-red-600/30 border border-rose-500/40 rounded-2xl text-rose-400 shadow-md">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-wide">
                      Générateur de Code de Pairing
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Liez votre numéro WhatsApp. Dès connexion, vous rejoignez automatiquement le groupe officiel !
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePair} className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                        Numéro WhatsApp à connecter
                      </label>
                      <div className="flex gap-1.5 text-[11px] text-neutral-400">
                        <span className="cursor-pointer hover:text-rose-400 transition-colors" onClick={() => setPhoneNumber('509')}>🇭🇹 Haïti (509)</span>
                        <span>·</span>
                        <span className="cursor-pointer hover:text-rose-400 transition-colors" onClick={() => setPhoneNumber('33')}>🇫🇷 France (33)</span>
                        <span>·</span>
                        <span className="cursor-pointer hover:text-rose-400 transition-colors" onClick={() => setPhoneNumber('1')}> 🇺🇸 usa
                         (1)</span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: 50933890079 ou 33612345678"
                        className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-2xl px-4 py-4 text-white placeholder-neutral-600 text-base font-mono outline-none transition-all shadow-inner"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1">
                      <span>💡 Indicatif pays obligatoire sans signe « + » ni espaces (ex: 50933890079).</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                        Tentatives de négociation
                      </label>
                      <select
                        value={attemptCount}
                        onChange={(e) => setAttemptCount(Number(e.target.value))}
                        className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3.5 text-neutral-200 text-sm outline-none transition-all"
                      >
                        <option value={1}>1 tentative standard</option>
                        <option value={2}>2 tentatives (recommandé)</option>
                        <option value={3}>3 tentatives (résilience max)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                        Jeton de sécurité Web (Optionnel)
                      </label>
                      <input
                        type="password"
                        value={webToken}
                        onChange={(e) => setWebToken(e.target.value)}
                        placeholder="Clé WEB_TOKEN si définie"
                        className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3.5 text-neutral-200 placeholder-neutral-600 text-sm outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPairing}
                    className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black py-4 px-6 rounded-2xl shadow-[0_10px_30px_rgba(225,29,72,0.4)] transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                  >
                    {isPairing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Négociation du code avec WhatsApp en cours…</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 text-amber-300" />
                        <span>GÉNÉRER LE CODE DE PAIRING WHATSAPP</span>
                      </>
                    )}
                  </button>
                </form>

                {pairingNotice && (
                  <div
                    className={`mt-5 p-4 rounded-2xl border text-sm flex items-start gap-3 backdrop-blur-md ${
                      pairingNotice.type === 'error'
                        ? 'bg-rose-950/60 border-rose-800/60 text-rose-200'
                        : pairingNotice.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
                        : 'bg-white/[0.04] border-white/[0.1] text-neutral-200'
                    }`}
                  >
                    {pairingNotice.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
                    {pairingNotice.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    {pairingNotice.type === 'info' && <RefreshCw className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5 animate-spin" />}
                    <div className="flex-1 font-medium">{pairingNotice.text}</div>
                  </div>
                )}

                {/* Cyber Code Display Area */}
                <div className="mt-6 p-6 bg-gradient-to-b from-[#08090e] to-[#0d0f17] border border-white/[0.12] rounded-3xl text-center relative shadow-2xl">
                  <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 block mb-2">
                    Code de Jumelage WhatsApp Actif
                  </span>

                  <div className="text-3xl sm:text-5xl font-mono font-black tracking-[0.25em] text-white py-3 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    {generatedCode || '---- · ----'}
                  </div>

                  {generatedCode ? (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        onClick={() => copyToClipboard(generatedCode, 'code')}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedCode ? 'Code copié avec succès !' : 'Copier le code'}</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Entrez votre numéro ci-dessus pour générer votre code en temps réel.
                    </p>
                  )}
                </div>

                {/* Session Reset Danger Box */}
                <div className="mt-6 p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left space-y-1">
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-2">
                      <Power className="w-4 h-4 text-rose-400" />
                      <span>Réinitialiser la session WhatsApp (auth_info)</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Efface les identifiants locaux pour changer de numéro ou renouveler le pairing.
                    </p>
                  </div>
                  <button
                    onClick={handleResetSession}
                    type="button"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    <span>Réinitialiser</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Official Instructions & Group Highlights */}
            <div className="lg:col-span-5 space-y-6">
              {/* Official Group Callout */}
              <div className="bg-gradient-to-br from-emerald-950/50 via-[#0e111a] to-[#0e111a] border border-emerald-500/30 rounded-3xl p-6 backdrop-blur-2xl shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Groupe WhatsApp Officiel
                    </h3>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Intégration automatique à la connexion
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed mb-4">
                  Dès que votre numéro est appairé, le bot rejoint automatiquement la communauté officielle pour vous connecter aux mises à jour et à l'assistance.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                  >
                    <span>Rejoindre le Groupe</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(groupLink, 'group')}
                    className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 text-xs font-bold border border-white/[0.1] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copiedGroupLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedGroupLink ? 'Copié' : 'Copier lien'}</span>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-2xl">
                <div className="flex items-center gap-2 mb-5 text-rose-400 font-black text-xs uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" />
                  <span>Procédure de Jumelage WhatsApp</span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3.5">
                    <span className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-xs text-rose-300 shrink-0">
                      1
                    </span>
                    <div className="text-xs text-neutral-300 leading-relaxed pt-1">
                      Ouvrez <b>WhatsApp</b> sur votre téléphone.
                    </div>
                  </div>

                  <div className="flex gap-3.5">
                    <span className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-xs text-rose-300 shrink-0">
                      2
                    </span>
                    <div className="text-xs text-neutral-300 leading-relaxed pt-1">
                      Allez dans <b>Paramètres</b> → <b>Appareils connectés</b> → <b>Connecter un appareil</b>.
                    </div>
                  </div>

                  <div className="flex gap-3.5">
                    <span className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-xs text-rose-300 shrink-0">
                      3
                    </span>
                    <div className="text-xs text-neutral-300 leading-relaxed pt-1">
                      Sélectionnez <b>« Se connecter plutôt avec un numéro de téléphone »</b>.
                    </div>
                  </div>

                  <div className="flex gap-3.5">
                    <span className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-xs text-rose-300 shrink-0">
                      4
                    </span>
                    <div className="text-xs text-neutral-300 leading-relaxed pt-1">
                      Entrez le code à 8 chiffres généré sur cet écran.
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-neutral-300 leading-relaxed flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Dès l'association terminée, écrivez <code className="text-rose-400 font-mono font-bold">.menu</code> dans WhatsApp pour recevoir instantanément votre menu illustré !
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MENU PREVIEW (PHOTO + TEXTE EXACT) */}
        {/* ======================================================== */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Top Bar for Menu Preview */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-[#121622] via-[#0e111a] to-[#0e111a] border border-white/[0.1] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-gradient-to-br from-rose-600 to-rose-700 rounded-2xl text-white shadow-lg shadow-rose-950/50">
                  <MessageSquareQuote className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Réponse Multimédia à la Commande « .menu »</h3>
                  <p className="text-xs text-neutral-300">
                    Photo officielle liée : <span className="font-mono text-amber-300">{avatarUrl}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(liveMenuText, 'menu')}
                className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-bold border border-white/[0.15] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {copiedMenu ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMenu ? 'Texte copié !' : 'Copier tout le texte du menu'}</span>
              </button>
            </div>

            {/* Side-by-side WhatsApp Bubble Simulation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* WhatsApp Simulated Bubble */}
              <div className="lg:col-span-8 bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-2xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Aperçu Réel du Message WhatsApp</span>
                  </span>
                  <span className="text-[11px] text-neutral-400">Mode Privé · Photo + Légende</span>
                </div>

                <div className="max-w-xl mx-auto bg-[#101d24] border border-[#23353e] rounded-2xl p-3.5 shadow-2xl overflow-hidden text-neutral-200">
                  {/* Photo de profil attachée */}
                  <div className="rounded-xl overflow-hidden border border-[#23353e] bg-black/60 mb-3 flex items-center justify-center relative group">
                    <img
                      src={avatarUrl}
                      alt="Profil Bot KING-MD"
                      className="w-full max-h-84 object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-white border border-white/20">
                      PHOTO OFFICIELLE
                    </div>
                  </div>

                  {/* Menu text */}
                  <div className="p-3 bg-[#18252d] rounded-xl font-mono text-[13px] leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto border border-[#2a3c46] text-[#e9edef] select-text">
                    {liveMenuText}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-neutral-400 pr-2">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[#53bdeb] font-bold">✓✓</span>
                  </div>

                  {/* Bouton vers la chaîne */}
                  <div className="border-t border-[#23353e] mt-2 pt-2.5 pb-1">
                    <a
                      href={channelLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center py-2 text-center text-[#25D366] hover:text-[#2fe572] hover:bg-[#18252d]/60 rounded-lg font-bold text-sm tracking-wide transition-all cursor-pointer select-none"
                    >
                      Voir la chaîne
                    </a>
                  </div>
                </div>
              </div>

              {/* Right: Quick Image URL controller */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-2xl">
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-rose-400" />
                    <span>Photo de Profil Active</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.1] overflow-hidden bg-black/60 p-2 flex items-center justify-center">
                      <img
                        src={avatarUrl}
                        alt="Miniature profil"
                        className="w-40 h-40 object-cover rounded-xl shadow-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-400 mb-1.5">
                        URL de l'image (Catbox)
                      </label>
                      <input
                        type="text"
                        value={settings.menuImage || ''}
                        onChange={(e) => setSettings({ ...settings, menuImage: e.target.value })}
                        className="w-full bg-[#08090e] border border-white/[0.1] rounded-xl px-3 py-2 text-xs font-mono text-neutral-200 outline-none focus:border-rose-500"
                      />
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Enregistrer l'image de profil</span>
                    </button>
                  </div>
                </div>

                {/* Groupe Officiel Link Box */}
                <div className="bg-gradient-to-br from-emerald-950/40 via-[#0e111a] to-[#0e111a] border border-emerald-500/30 rounded-3xl p-6 backdrop-blur-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      Groupe WhatsApp Lié
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
                    Ce groupe est automatiquement rejoint par le bot dès la première connexion.
                  </p>
                  <a
                    href={groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <span>Ouvrir le Groupe WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: GROUPE OFFICIEL WHATSAPP (DÉDIÉ) */}
        {/* ======================================================== */}
        {activeTab === 'community' && (
          <div className="space-y-6">
            <div className="p-7 sm:p-9 rounded-3xl bg-gradient-to-br from-emerald-950/50 via-[#0e121a] to-[#0c0f16] border border-emerald-500/40 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  <span>Système d'Auto-Intégration WhatsApp</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Groupe WhatsApp Officiel KING-MD
                </h2>

                <p className="text-sm text-neutral-300 leading-relaxed">
                  Quand quelqu'un est connecté pour la première fois avec le bot, ce système rejoint automatiquement ce groupe officiel et vous y intègre pour bénéficier de l'assistance, des nouvelles mises à jour et du support direct.
                </p>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.1] font-mono text-xs text-emerald-300 break-all select-all flex items-center justify-between gap-3">
                  <span>{groupLink}</span>
                  <button
                    onClick={() => copyToClipboard(groupLink, 'group')}
                    className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0"
                    title="Copier le lien"
                  >
                    {copiedGroupLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-[0_10px_25px_rgba(16,185,129,0.3)] flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Rejoindre le Groupe Maintenant</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => copyToClipboard(groupLink, 'group')}
                    className="px-5 py-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold border border-white/[0.12] transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedGroupLink ? 'Lien copié !' : 'Copier l\'invitation'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  1
                </div>
                <h3 className="font-bold text-white text-sm">Ajout Automatique</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Dès que votre session WhatsApp locale est liée via le code de jumelage, le socket Baileys exécute l'acceptation d'invitation automatiquement.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  2
                </div>
                <h3 className="font-bold text-white text-sm">Support & Alertes</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Recevez les annonces d'améliorations, corrections d'erreurs (Bad MAC, Signal keys) et nouveaux modules Protect-MD directement dans WhatsApp.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold">
                  3
                </div>
                <h3 className="font-bold text-white text-sm">Chaîne + Groupe Liés</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Le bot intègre les métadonnées officielles de la chaîne WhatsApp et du groupe dans chaque commande <code className="text-rose-400 font-mono">.menu</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CENTRE PROTECT-MD SÉCURITÉ */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-5 backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium">Messages Analysés</span>
                <div className="text-2xl font-black text-white mt-2 flex items-center justify-between">
                  <span>{status?.stats.analyzed ?? 0}</span>
                  <Activity className="w-5 h-5 text-neutral-500" />
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Surveillance active des flux</span>
              </div>

              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-5 backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium">Messages Supprimés</span>
                <div className="text-2xl font-black text-rose-400 mt-2 flex items-center justify-between">
                  <span>{status?.stats.deleted ?? 0}</span>
                  <XCircle className="w-5 h-5 text-rose-500/40" />
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Spams & flood bloqués</span>
              </div>

              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-5 backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium">Menaces Identifiées</span>
                <div className="text-2xl font-black text-amber-400 mt-2 flex items-center justify-between">
                  <span>{status?.stats.suspicious ?? 0}</span>
                  <AlertTriangle className="w-5 h-5 text-amber-500/40" />
                </div>
                <span className="text-[11px] text-neutral-500 mt-1 block">Liens suspects & anomalies</span>
              </div>

              <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-5 backdrop-blur-2xl">
                <span className="text-xs text-neutral-400 font-medium">Indice Fiabilité Locale</span>
                <div className="text-2xl font-black text-emerald-400 mt-2 flex items-center justify-between">
                  <span>{status?.score ?? 100}/100</span>
                  <ShieldCheck className="w-5 h-5 text-emerald-500/40" />
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${status?.score ?? 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Logs feed */}
            <div className="bg-[#0e111a]/85 border border-white/[0.08] rounded-3xl p-6 backdrop-blur-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Journal des Événements Protect-MD en Direct</span>
                </h3>
                <span className="text-[11px] text-neutral-500">Flux temps réel</span>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {logs.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-6">Aucun log récent pour le moment.</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.type === 'success'
                                ? 'bg-emerald-400'
                                : log.type === 'danger'
                                ? 'bg-rose-500'
                                : log.type === 'warning'
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                            }`}
                          ></span>
                          <span className="font-semibold text-neutral-200">{log.message}</span>
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-neutral-400 pl-4">{log.details}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500 shrink-0">{log.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CATALOGUE DES 30 COMMANDES */}
        {/* ======================================================== */}
        {activeTab === 'commands' && (
          <div className="space-y-6">
            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Rechercher une commande (.menu, .ping...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#08090e] border border-white/[0.1] rounded-2xl text-xs text-white placeholder-neutral-500 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                  }`}
                >
                  Toutes ({TOTAL_COMMAND_COUNT})
                </button>
                {Object.keys(AVAILABLE_30_COMMANDS).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat.split(' ')[1] || cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Commands Grid */}
            <div className="space-y-6">
              {filteredCategories.map((category) => {
                const list = (AVAILABLE_30_COMMANDS as any)[category] || [];
                const filteredList = list.filter((item: any) =>
                  item.syntax.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.desc.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filteredList.length === 0) return null;

                return (
                  <div key={category} className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>{category}</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredList.map((item: any) => (
                        <div
                          key={item.syntax}
                          className="p-4 rounded-2xl bg-[#0e111a]/85 border border-white/[0.08] hover:border-rose-500/40 transition-all flex flex-col justify-between gap-3 group"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <code className="text-sm font-mono font-bold text-white group-hover:text-rose-400 transition-colors">
                                {settings.prefix}{item.syntax}
                              </code>
                              <button
                                onClick={() => copyToClipboard(`${settings.prefix}${item.syntax}`, 'cmd')}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
                                title="Copier la commande"
                              >
                                {copiedCmd === `${settings.prefix}${item.syntax}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: ANALYSEUR HEURISTIQUE */}
        {/* ======================================================== */}
        {activeTab === 'scanner' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/20 border border-orange-500/40 rounded-2xl text-orange-400">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Scanner Heuristique Anti-Phishing & Flood</h3>
                  <p className="text-xs text-neutral-400">
                    Testez la détection Protect-MD sur n'importe quel texte ou lien WhatsApp suspect.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  placeholder="Collez ici un message WhatsApp, lien court ou texte suspect..."
                  className="w-full bg-[#08090e] border border-white/[0.1] rounded-2xl p-4 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-rose-500"
                ></textarea>
                <button
                  onClick={handleScanText}
                  disabled={isScanning || !scanText.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isScanning ? 'Analyse heuristique en cours…' : 'Analyser le message'}
                </button>
              </div>

              {scanResult && (
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      Verdict du Système
                    </span>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                        scanResult.riskScore >= 50
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : scanResult.isSuspicious
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {scanResult.verdict}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Score de risque calculé :</span>
                    <span className="font-mono font-bold">{scanResult.riskScore}%</span>
                  </div>

                  {scanResult.reasons && scanResult.reasons.length > 0 && (
                    <div className="text-xs text-neutral-400">
                      <b>Détails :</b> {scanResult.reasons.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: PARAMÈTRES DU BOT */}
        {/* ======================================================== */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0e111a]/85 border border-white/[0.08] backdrop-blur-2xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
                <div className="p-3 bg-white/[0.05] border border-white/[0.1] rounded-2xl text-white">
                  <SettingsIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Configuration du Bot KING-MD</h3>
                  <p className="text-xs text-neutral-400">
                    Modifiez le profil, les liens et le comportement général du bot.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Nom du Bot
                    </label>
                    <input
                      type="text"
                      value={settings.botName}
                      onChange={(e) => setSettings({ ...settings, botName: e.target.value })}
                      className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Préfixe des Commandes
                    </label>
                    <input
                      type="text"
                      value={settings.prefix}
                      onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
                      className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Numéro Owner (Propriétaire)
                    </label>
                    <input
                      type="text"
                      value={settings.owner}
                      onChange={(e) => setSettings({ ...settings, owner: e.target.value })}
                      className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                      Mode Opérationnel
                    </label>
                    <select
                      value="private"
                      onChange={(e) => setSettings({ ...settings, mode: 'private' })}
                      className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-rose-300 font-bold text-sm outline-none cursor-default"
                    >
                      <option value="private">🔒 Privé (Owner uniquement)</option>
                    </select>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Mode public retiré — Seul le propriétaire peut exécuter les commandes.
                    </p>
                  </div>
                </div>

                {/* Photo de profil URL & Live Preview */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    URL de la photo de profil du bot (.menu)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <input
                      type="text"
                      value={settings.menuImage || ''}
                      onChange={(e) => setSettings({ ...settings, menuImage: e.target.value })}
                      className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none"
                      placeholder="https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg"
                    />
                    <div className="w-12 h-12 rounded-xl border border-white/20 overflow-hidden shrink-0 bg-black">
                      <img src={avatarUrl} alt="Miniature" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Actuel : <span className="text-amber-300 font-mono">https://i.ibb.co/Cpsr8XQJ/jawadmd.jpg</span>
                  </p>
                </div>

                {/* Auto-join WhatsApp Group URL */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    Lien du Groupe WhatsApp Officiel (Auto-Join)
                  </label>
                  <input
                    type="text"
                    value={settings.autoJoinGroup || ''}
                    onChange={(e) => setSettings({ ...settings, autoJoinGroup: e.target.value })}
                    className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none"
                    placeholder="https://chat.whatsapp.com/LD552OxNd8S66blj7Jgo8H"
                  />
                  <p className="text-[11px] text-emerald-400 mt-1">
                    Groupe rejoint automatiquement par le bot à la première connexion : <span className="font-mono">IQqIqslYEEY0HnDv7KWGlD</span>
                  </p>
                </div>

                {/* Channel Link */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    Lien de la Chaîne WhatsApp (Channel)
                  </label>
                  <input
                    type="text"
                    value={settings.channel || ''}
                    onChange={(e) => setSettings({ ...settings, channel: e.target.value })}
                    className="w-full bg-[#08090e] border border-white/[0.1] focus:border-rose-500 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-xs disabled:opacity-50"
                  >
                    {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Enregistrer la Configuration</span>
                  </button>
                </div>

                {settingsSavedAlert && (
                  <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-xs text-center font-bold">
                    ✓ Configuration et profil enregistrés avec succès !
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modern Sleek Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#0c0e14]/85 backdrop-blur-2xl py-5 px-6 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>KING-MD V1 · Architecture Sécurisée Baileys Multi-Device</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={groupLink} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Groupe Officiel
            </a>
            <span>·</span>
            <a href={channelLink} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Chaîne WhatsApp
            </a>
            <span>·</span>
            <span className="text-neutral-500">Mode Privé Actif</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
