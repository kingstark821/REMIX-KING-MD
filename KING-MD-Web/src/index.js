import express from 'express';
import P from 'pino';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore, saveStore } from './store.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const sessionDir=path.join(root,'auth_info');
const dataFile=path.join(root,'data','settings.json');
const app=express();
const logger=P({level:'silent'});
const PORT=Number(process.env.PORT||3000);
const WEB_TOKEN=process.env.WEB_TOKEN||'';
const MAX_ATTEMPTS=Math.max(1,Math.min(5,Number(process.env.MAX_PAIRING_ATTEMPTS||3)));
const store=loadStore(dataFile);
let sock=null;
let state=null;
let saveCreds=null;
let starting=false;
let reconnectTimer=null;
let pairingBusy=false;
let currentCode=null;
let lastError=null;
let attempts=0;
let connected=false;
let lastNumber=null;

app.use(express.json());
app.use(express.static(path.join(root,'public')));

function cleanNumber(v){return String(v||'').replace(/[^0-9]/g,'');}
function validNumber(n){return /^\d{8,15}$/.test(n);}
function auth(req,res,next){
  if(!WEB_TOKEN) return next();
  const got=req.get('x-web-token') || String(req.query.token||'');
  if(got!==WEB_TOKEN) return res.status(401).json({ok:false,error:'Token Web invalide.'});
  next();
}

app.get('/api/status',(req,res)=>res.json({
  ok:true,connected, pairingBusy, currentCode, lastError, attempts, maxAttempts:MAX_ATTEMPTS, number:lastNumber
}));

app.post('/api/pair',auth,async(req,res)=>{
  const number=cleanNumber(req.body?.number);
  const requestedAttempts=Math.max(1,Math.min(MAX_ATTEMPTS,Number(req.body?.attempts||1)));
  if(!validNumber(number)) return res.status(400).json({ok:false,error:'Numéro invalide. Utilise le format international sans + (ex: 509XXXXXXXX).'});
  if(pairingBusy) return res.status(409).json({ok:false,error:'Une demande de pairing est déjà en cours.'});
  if(state?.creds?.registered || connected) return res.status(409).json({ok:false,error:'Le compte WhatsApp est déjà connecté. Déconnecte la session avant un nouveau pairing.'});

  pairingBusy=true; currentCode=null; lastError=null; attempts=0; lastNumber=number;
  try {
    await ensureSocket();
    // Wait until the WebSocket has had time to enter its connection phase.
    await new Promise(r=>setTimeout(r,5000));
    for(let i=0;i<requestedAttempts;i++){
      attempts=i+1;
      try{
        if(!sock || !state || state.creds.registered) break;
        const code=await sock.requestPairingCode(number);
        currentCode=String(code||'').match(/.{1,4}/g)?.join('-') || code;
        lastError=null;
        return res.json({ok:true,code:currentCode,attempt:attempts,message:'Code généré. Dans WhatsApp: Appareils connectés → Connecter un appareil → Connecter avec un numéro de téléphone.'});
      }catch(e){
        lastError=e?.message||String(e);
        if(i+1<requestedAttempts){
          await restartSocket();
          await new Promise(r=>setTimeout(r,5000));
        }
      }
    }
    return res.status(502).json({ok:false,error:lastError||'WhatsApp n’a pas généré de code.',attempts});
  }finally{pairingBusy=false;}
});

app.post('/api/logout',auth,async(req,res)=>{
  try{
    if(sock) sock.end(undefined);
  }catch{}
  sock=null; state=null; saveCreds=null; connected=false; currentCode=null; lastError=null;
  fs.rmSync(sessionDir,{recursive:true,force:true});
  fs.mkdirSync(sessionDir,{recursive:true});
  return res.json({ok:true,message:'Session locale supprimée. Tu peux refaire un pairing.'});
});

async function ensureSocket(){
  if(sock && state && !state.creds.registered) return sock;
  const auth=await useMultiFileAuthState(sessionDir);
  state=auth.state; saveCreds=auth.saveCreds;
  sock=makeWASocket({
    auth:state,
    browser:Browsers.macOS('Chrome'),
    printQRInTerminal:false,
    logger,
    markOnlineOnConnect:true,
    connectTimeoutMs:60000,
    defaultQueryTimeoutMs:60000
  });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',onConnectionUpdate);
  sock.ev.on('messages.upsert',async({messages})=>{
    // The original bot command handlers can be added here. This web package
    // focuses on public pairing and keeps the pairing/session layer isolated.
  });
  return sock;
}

async function onConnectionUpdate(update){
  const {connection,lastDisconnect}=update;
  if(connection==='open'){
    connected=true; currentCode=null; lastError=null;
  }
  if(connection==='close'){
    connected=false;
    const code=lastDisconnect?.error?.output?.statusCode;
    const loggedOut=code===DisconnectReason.loggedOut;
    if(loggedOut){lastError='Session déconnectée. Utilise le bouton Réinitialiser puis refais le pairing.';return;}
    if(!state?.creds?.registered){
      // Do not loop aggressively while a public pairing request is in progress.
      if(pairingBusy) return;
    }
    scheduleReconnect();
  }
}

function scheduleReconnect(){
  if(reconnectTimer) return;
  reconnectTimer=setTimeout(async()=>{
    reconnectTimer=null;
    try{await restartSocket();}catch(e){lastError=e?.message||String(e);}
  },3000);
}

async function restartSocket(){
  try{sock?.end(undefined);}catch{}
  sock=null;
  state=null;
  saveCreds=null;
  return ensureSocket();
}

app.listen(PORT,'0.0.0.0',async()=>{
  fs.mkdirSync(sessionDir,{recursive:true});
  console.log(`\n👑 BANNED BY KING — WEB PAIRING`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔐 WEB_TOKEN: ${WEB_TOKEN?'enabled':'disabled (set WEB_TOKEN before public deployment)'}`);
  try{await ensureSocket();}catch(e){console.error('Socket init:',e);}
});
