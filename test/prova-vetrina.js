/* =====================================================================
   prova-vetrina.js — La demo pubblica.
   Chi la apre puo' fare qualunque danno: svuotare il magazzino,
   cambiare il PIN del proprietario, rinominare il locale. La notte
   dopo deve essere tornata identica, sennò il secondo visitatore
   trova le macerie del primo — o peggio, non riesce nemmeno a entrare.
   Si lancia con:  npm run prova-vetrina
   ===================================================================== */
process.env.SEED_DEMO = '1';
const os = require('os'), path = require('path'), fs = require('fs');
const dbFile = path.join(os.tmpdir(), `vetrina-${Date.now()}.db`);
process.env.DB_PATH = dbFile;

const bcrypt = require('bcryptjs');
const db = require('../db');

let ok = 0, ko = 0;
const conta = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
const verifica = (m, esito, dato) => {
  if (esito) { ok++; console.log('  ok  ' + m); }
  else { ko++; console.log('  KO  ' + m + (dato !== undefined ? '  -> ' + JSON.stringify(dato) : '')); }
};

console.log('\nLA VETRINA PUBBLICA\n');

const prima = { prodotti: conta('products'), fornitori: conta('vendors'),
  postazioni: conta('locations'), profili: conta('profiles') };
verifica('la demo nasce piena di roba da guardare',
  prima.prodotti > 0 && prima.fornitori > 0 && prima.postazioni > 0, prima);

/* un visitatore fa il peggio che puo' fare */
db.exec('DELETE FROM products');
const pro = db.prepare("SELECT id FROM profiles WHERE name='Proprietario'").get();
db.prepare('UPDATE profiles SET pin_hash=?, pin_default=0 WHERE id=?')
  .run(bcrypt.hashSync('9999', 10), pro.id);
db.prepare(`INSERT INTO impostazioni (chiave,valore) VALUES ('locale_nome','SCRITTO DA UN PASSANTE')
  ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`).run();
verifica('il visitatore ha svuotato il magazzino', conta('products') === 0);

db.riseminaDemo();

verifica('i prodotti sono tornati', conta('products') === prima.prodotti, conta('products'));
verifica('i fornitori sono tornati', conta('vendors') === prima.fornitori, conta('vendors'));
verifica('le postazioni sono tornate', conta('locations') === prima.postazioni, conta('locations'));
verifica('i profili sono tornati', conta('profiles') === prima.profili, conta('profiles'));

const pro2 = db.prepare("SELECT * FROM profiles WHERE name='Proprietario'").get();
verifica('col PIN 1111 si rientra', bcrypt.compareSync('1111', pro2.pin_hash));
verifica('il PIN messo dal passante non vale piu\'', !bcrypt.compareSync('9999', pro2.pin_hash));
verifica('il profilo e\' di nuovo segnato come di fabbrica', pro2.pin_default === 1, pro2.pin_default);

const nome = db.prepare("SELECT valore v FROM impostazioni WHERE chiave='locale_nome'").get();
verifica('il nome scritto dal passante e\' sparito',
  !nome || nome.v !== 'SCRITTO DA UN PASSANTE', nome);
verifica('gli id ripartono da 1, la demo sembra nuova',
  db.prepare('SELECT MIN(id) m FROM products').get().m === 1);

try { fs.rmSync(dbFile, { force: true }); } catch {}
try { ['-wal', '-shm'].forEach(e => fs.rmSync(dbFile + e, { force: true })); } catch {}

console.log(`\n${ok} passati, ${ko} falliti\n`);
process.exit(ko ? 1 : 0);
