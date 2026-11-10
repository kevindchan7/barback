/* =====================================================================
   posta.js — Le email di Barback (link per reimpostare PIN e password).
   Usa Resend (https://resend.com, gratis fino a 3.000 email al mese).
   Serve la chiave RESEND_API_KEY su Render -> barback-app -> Environment.
   Senza chiave non parte niente e l'app lo dice chiaramente.
   ===================================================================== */
const fs = require('fs');

// nelle prove automatiche le email finiscono in un file invece di partire
const FILE_PROVA = process.env.BARBACK_PROVA === '1' ? process.env.POSTA_FILE : '';
const attiva = () => !!(process.env.RESEND_API_KEY || FILE_PROVA);

async function manda({ a, oggetto, testo }) {
  if (!a) return false;
  if (FILE_PROVA) { fs.appendFileSync(FILE_PROVA, JSON.stringify({ a, oggetto, testo }) + '\n'); return true; }
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Barback <onboarding@resend.dev>', to: [a], subject: oggetto, text: testo }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('Email non partita: ' + r.status);
    return r.ok;
  } catch (e) { console.error('Email non partita: ' + e.message); return false; }
}

module.exports = { attiva, manda };
