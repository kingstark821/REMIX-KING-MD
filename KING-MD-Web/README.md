# 👑 BANNED BY KING — KING-MD-V1 Pairing FIX V2 WEB

Version Web publique du système de pairing. Le bot expose une page web, mais le pairing est protégé par `WEB_TOKEN` si tu le définis.

## Installation VPS / Pterodactyl

Node.js 20+ requis.

```bash
npm install
cp .env.example .env
```

Définis au minimum :

```env
PORT=3000
WEB_TOKEN=un-token-long-et-secret
MAX_PAIRING_ATTEMPTS=3
```

Puis :

```bash
npm start
```

La page est disponible sur `http://IP_DU_SERVEUR:3000`.

## Pterodactyl

- Startup: `npm start`
- Port: expose le port choisi par le panel, généralement via la variable `PORT`.
- Node.js: 20 ou supérieur.
- Ne publie jamais `auth_info/`.

## Pairing

1. Ouvre la page web.
2. Entre le numéro WhatsApp au format international sans `+`.
3. Choisis 1 à 3 tentatives.
4. Clique sur Générer.
5. Dans WhatsApp: Appareils connectés → Connecter un appareil → Connecter avec un numéro de téléphone.
6. Entre le code affiché.

Le champ « tentatives » signifie des **reprises en cas d'échec**, pas du pairing massif de plusieurs comptes.

## Important

- Le code de pairing donne accès au compte WhatsApp qui le valide : ne le partage pas.
- Pour un déploiement réellement public, garde `WEB_TOKEN` activé et utilise HTTPS/reverse proxy.
- Cette version fournit la couche Web de pairing. Les handlers de commandes de ton ancienne version doivent être fusionnés dans `src/index.js` pour retrouver toutes les commandes du bot.
