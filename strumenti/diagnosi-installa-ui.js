/* Il bottone "Installa" dentro l'app.
   Le tre situazioni non si possono emulare davvero da headless (Chrome
   lancia comunque l'invito, e display-mode non si piega), quindi le
   FORZIAMO: e' la logica che va provata, non il browser. */
const { spawn } = require('child_process');
const fs=require('fs'), path=require('path'), http=require('http');
const PORTA=9150+Math.floor(Math.random()*90), PROFILO=path.join(__dirname,'ui-'+PORTA);
const att=ms=>new Promise(r=>setTimeout(r,ms));
const get=p=>new Promise((ris,rif)=>http.get({host:'127.0.0.1',port:PORTA,path:p},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{ris(JSON.parse(d))}catch(e){rif(e)}})}).on('error',rif));

(async()=>{
  const ch=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+PORTA,'--user-data-dir='+PROFILO,'about:blank'],{stdio:'ignore'});
  let v=null; for(let i=0;i<40&&!v;i++){await att(250);try{v=await get('/json/version')}catch{}}
  const ws=new WebSocket(v.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
  let id=0; const a=new Map();
  ws.onmessage=m=>{const x=JSON.parse(m.data); if(x.id&&a.has(x.id)){a.get(x.id)(x);a.delete(x.id)}};
  const cmd=(me,p={},s)=>new Promise(r=>{const n=++id;a.set(n,r);ws.send(JSON.stringify({id:n,method:me,params:p,sessionId:s}))});
  const {targetId}=(await cmd('Target.createTarget',{url:'about:blank'})).result;
  const sid=(await cmd('Target.attachToTarget',{targetId,flatten:true})).result.sessionId;
  const S=(m,p)=>cmd(m,p,sid);
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  const val=async e=>(await S('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.result.value;

  let ok=0,ko=0; const V=(m,e,d)=>{if(e){ok++;console.log('  ok  '+m)}else{ko++;console.log('  KO  '+m+(d!==undefined?' -> '+JSON.stringify(d):''))}};

  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2000);
  await val(`(async()=>{const p=await (await fetch('/api/profiles')).json();const pro=p.find(x=>/Propriet/.test(x.name))||p[0];
    const r=await (await fetch('/api/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:pro.id,pin:'1111'})})).json();
    localStorage.setItem('bb_token',r.token);localStorage.setItem('bb_profile',JSON.stringify(r.profile||pro));
    localStorage.setItem('bb_onboarded','1');localStorage.setItem('bb_lang','it');return 1})()`);
  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2300);

  console.log('\nIL BOTTONE "INSTALLA" DENTRO L\'APP\n');

  const zona = async () => await val("(document.getElementById('inst-zona')||{}).innerHTML||''");

  /* --- 1. Chrome con l'invito pronto --- */
  await val("invitoInstalla = {prompt(){}, userChoice: Promise.resolve({outcome:'accepted'})}");
  await val("openSettings()"); await att(700);
  let z = await zona();
  V('con l invito pronto: bottone che installa', /chiediInstalla/.test(z), z.slice(0,80));

  /* --- 2. iPhone: nessun invito esiste mai --- */
  await val("invitoInstalla = null; window.__ios = true; suIOS = () => true;");
  await val("openSettings()"); await att(700);
  z = await zona();
  V('su iPhone: i passi di Safari', /Condividi/.test(z), z.slice(0,80));
  V('su iPhone: avverte che serve Safari', /Safari/.test(z));
  V('su iPhone: niente bottone che non funzionerebbe', !/chiediInstalla/.test(z));

  /* --- 3. altro browser, nessun invito --- */
  await val("suIOS = () => false; invitoInstalla = null;");
  await val("openSettings()"); await att(700);
  z = await zona();
  V('altrove: spiega come fare dal menu', /menu del browser/i.test(z), z.slice(0,80));

  /* --- 4. gia' installata: vince su tutto --- */
  await val("giaInstallata = () => true; invitoInstalla = {prompt(){}};");
  await val("openSettings()"); await att(700);
  z = await zona();
  V('gia installata: lo dice', /Gi\u00e0 installata/.test(z), z.slice(0,80));
  V('gia installata: non ripropone il bottone', !/chiediInstalla/.test(z));

  /* --- 5. la striscia --- */
  await val("closeModal&&closeModal(); giaInstallata = () => false; invitoInstalla = {prompt(){}}; localStorage.removeItem('bb_inst_no'); nascondiStrisciaInstalla(); mostraStrisciaInstalla();");
  await att(400);
  V('la striscia compare a chi non l ha installata', await val("!!document.getElementById('inst-striscia')"));
  const sb = await val("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth");
  V('la striscia non fa sbordare la pagina', sb<=1, sb);
  await val("rifiutaInstalla()"); await att(300);
  V('chiudendola sparisce', !(await val("!!document.getElementById('inst-striscia')")));
  await val("mostraStrisciaInstalla()"); await att(300);
  V('e non torna piu', !(await val("!!document.getElementById('inst-striscia')")));
  await val("giaInstallata = () => true; invitoInstalla = {prompt(){}}; localStorage.removeItem('bb_inst_no'); mostraStrisciaInstalla();"); await att(300);
  V('a chi ce l ha gia non compare mai', !(await val("!!document.getElementById('inst-striscia')")));

  console.log(`\n  ${ok} passati, ${ko} falliti\n`);
  ws.close(); ch.kill(); await att(300);
  try{fs.rmSync(PROFILO,{recursive:true,force:true})}catch{}
  process.exit(ko?1:0);
})();
