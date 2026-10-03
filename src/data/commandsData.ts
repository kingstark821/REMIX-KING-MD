export interface CommandCategory {
  name: string;
  badge?: string;
  iconName?: string;
  commands: {
    name: string;
    syntax: string;
    desc: string;
  }[];
}

// 30+ Available commands cleanly organized
export const AVAILABLE_30_COMMANDS: Record<string, { syntax: string; desc: string }[]> = {
  '⚙️ 𝐒𝐘𝐒𝐓𝐄̀𝐌𝐄 & 𝐒𝐓𝐀𝐓𝐔𝐓': [
    { syntax: 'menu', desc: 'Affiche le menu stylisé complet avec image de profil' },
    { syntax: 'menu2', desc: 'Affiche la liste rapide et concise des commandes' },
    { syntax: 'ping', desc: 'Mesure la latence et la réactivité du bot' },
    { syntax: 'runtime', desc: 'Affiche le temps de fonctionnement actif du bot' },
    { syntax: 'status', desc: 'Rapport de sécurité Protect-MD et état du compte' }
  ],
  '🛡️ 𝐆𝐑𝐎𝐔𝐏𝐄 & 𝐒𝐄𝐂𝐔𝐑𝐈𝐓𝐘': [
    { syntax: 'antilink on/off', desc: 'Protection automatique anti-liens' },
    { syntax: 'antispam on/off', desc: 'Protection anti-flood et messages répétés' },
    { syntax: 'antidelete on/off', desc: 'Surveillance des messages supprimés' },
    { syntax: 'antipromote on/off', desc: 'Annule automatiquement les promotions non autorisées' },
    { syntax: 'antidemote on/off', desc: 'Restaure automatiquement les admins rétrogradés' },
    { syntax: 'promot @user', desc: 'Promouvoir un membre administrateur du groupe' },
    { syntax: 'kick @user', desc: 'Expulser un membre du groupe WhatsApp' },
    { syntax: 'kickall', desc: 'Expulser tous les membres non-administrateurs du groupe' },
    { syntax: 'tagall <texte>', desc: 'Mentionner tous les membres avec un message' }
  ],
  '🛠️ 𝐔𝐓𝐈𝐋𝐈𝐓𝐀𝐈𝐑𝐄𝐒': [
    { syntax: 'say <texte>', desc: 'Faire répéter un message par le bot' },
    { syntax: 'calc <calcul>', desc: 'Calculatrice instantanée (+, -, *, /, ^)' },
    { syntax: 'qrcode <texte>', desc: 'Générer un QR Code scannable en image' },
    { syntax: 'shorturl <url>', desc: 'Raccourcir un lien long via TinyURL' },
    { syntax: 'weather <ville>', desc: 'Météo en direct pour n’importe quelle ville' },
    { syntax: 'tr <lang> <texte>', desc: 'Traducteur multilingue instantané' }
  ],
  '🧠 𝐈𝐀 & 𝐑𝐄𝐂𝐇𝐄𝐑𝐂𝐇𝐄': [
    { syntax: 'ai <question>', desc: 'Poser une question à l’intelligence artificielle' },
    { syntax: 'wiki <sujet>', desc: 'Recherche et résumé d’un article Wikipédia' },
    { syntax: 'google <recherche>', desc: 'Lien direct et astuces de recherche Google' },
    { syntax: 'crypto <symbole>', desc: 'Cours en temps réel (BTC, ETH, SOL, USDT)' }
  ],
  '🎲 𝐅𝐔𝐍 & 𝐉𝐄𝐔𝐗': [
    { syntax: 'quote', desc: 'Citation inspirante ou philosophique aléatoire' },
    { syntax: 'joke', desc: 'Blague amusante pour détendre la conversation' },
    { syntax: 'fact', desc: 'Fait scientifique ou insolite méconnu' },
    { syntax: '8ball <question>', desc: 'Boule magique prédictive 8-Ball' },
    { syntax: 'dice', desc: 'Lancer un dé virtuel (résultat de 1 à 6)' },
    { syntax: 'coinflip', desc: 'Tirage à pile ou face aléatoire' }
  ],
  '👑 𝐎𝐖𝐍𝐄𝐑 & 𝐂𝐎𝐍𝐅𝐈𝐆': [
    { syntax: 'owner', desc: 'Contact et informations du propriétaire' },
    { syntax: 'channel', desc: 'Lien d’invitation à la chaîne WhatsApp' },
    { syntax: 'setprefix <symbole>', desc: 'Changer le préfixe de commande du bot' },
    { syntax: 'alive', desc: 'Vérifier si le bot est actif et opérationnel' },
    { syntax: 'block <numéro>', desc: 'Bloquer un expéditeur indésirable' }
  ]
};

// Simplified flat record for compatibility
export const BOT_COMMANDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(AVAILABLE_30_COMMANDS).map(([cat, list]) => [
    cat,
    list.map((item) => item.syntax)
  ])
);

export const TOTAL_COMMAND_COUNT = Object.values(BOT_COMMANDS).reduce(
  (acc, curr) => acc + curr.length,
  0
);
