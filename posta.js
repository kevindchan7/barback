/* =====================================================================
   posta.js — Le email di Barback (link per reimpostare PIN e password).
   Arrivano all'email che il titolare ha scritto quando ha registrato il locale.

   Due modi, basta uno:
   1. Gmail (consigliato, nessun dominio da comprare):
        GMAIL_USER         = l'indirizzo Gmail che spedisce (es. barback@gmail.com)
        GMAIL_APP_PASSWORD = "password per le app" di Google (16 lettere)
   2. Resend: RESEND_API_KEY (serve un dominio verificato per scrivere a tutti)
   Senza nessuno dei due non parte niente e l'app lo dice chiaramente.
   ===================================================================== */
const fs = require('fs');

// nelle prove automatiche le email finiscono in un file invece di partire
const FILE_PROVA = process.env.BARBACK_PROVA === '1' ? process.env.POSTA_FILE : '';
const gmail = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const attiva = () => !!(FILE_PROVA || gmail() || process.env.RESEND_API_KEY);

let trasporto = null;
function postino() {
  if (!trasporto) {
    const nodemailer = require('nodemailer');
    trasporto = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s/g, '') },
    });
  }
  return trasporto;
}

async function manda({ a, oggetto, testo }) {
  if (!a) return false;
  if (FILE_PROVA) { fs.appendFileSync(FILE_PROVA, JSON.stringify({ a, oggetto, testo }) + '\n'); return true; }
  try {
    if (gmail()) {
      await postino().sendMail({ from: `"Barback" <${process.env.GMAIL_USER}>`, to: a, subject: oggetto, text: testo });
      return true;
    }
    if (!process.env.RESEND_API_KEY) return false;
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
