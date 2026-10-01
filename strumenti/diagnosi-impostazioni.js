/* La finestra delle impostazioni: deve stare SOPRA il tutorial, e deve
   ritradursi se cambio lingua mentre e' aperta. */
const { spawn } = require('child_process');
const fs=require('fs'), path=require('path'), http=require('http');
const PORTA=9900+Math.floor(Math.random()*90), PROFILO=path.join(__dirname,'imp-'+PORTA);
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
  const val=async e=>{const r=await S('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.result.value};

  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2200);
  await val(`(async()=>{const p=await (await fetch('/api/profiles')).json();const pro=p.find(x=>/Propriet/.test(x.name))||p[0];
    const r=await (await fetch('/api/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:pro.id,pin:'1111'})})).json();
    localStorage.setItem('bb_token',r.token);localStorage.setItem('bb_profile',JSON.stringify(r.profile||pro));
    localStorage.setItem('bb_lang','it');localStorage.removeItem('bb_onboarded');return 1})()`);
  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2200);

  let ok=0,ko=0; const V=(m,e,d)=>{if(e){ok++;console.log('  ok  '+m)}else{ko++;console.log('  KO  '+m+(d!==undefined?' -> '+JSON.stringify(d):''))}};
  console.log('\nLA FINESTRA DELLE IMPOSTAZIONI\n');

  V('il tutorial del primo accesso compare', await val("!!document.querySelector('#onboarding .onb-card')"));
  const q5 = await val(`(()=>{const b=document.querySelectorAll('#onboarding .onb-card');return document.body.innerHTML.includes('Spostati al volo')})()`);

  // apro le impostazioni col tutorial ancora aperto
  await val("openSettings()"); await att(900);
  const sopra = await val(`(()=>{
    const o=document.querySelector('[data-modale="impostazioni"]'), t=document.getElementById('onboarding');
    if(!o) return 'nessuna finestra';
    if(!t || t.classList.contains('hidden')) return 'tutorial chiuso';
    return Number(getComputedStyle(o).zIndex) > Number(getComputedStyle(t).zIndex);
  })()`);
  V('le impostazioni stanno SOPRA il tutorial', sopra === true, sopra);

  // la lingua mentre e' aperta
  const prima = await val(`document.querySelector('[data-modale="impostazioni"] h3').textContent.trim()`);
  await val("toggleLang()"); await att(900);
  const dopo = await val(`(()=>{const h=document.querySelector('[data-modale="impostazioni"] h3');return h?h.textContent.trim():null})()`);
  V('cambiando lingua la finestra resta aperta', dopo !== null, dopo);
  V('e si traduce davvero', prima !== dopo, {prima, dopo});

  // il quinto passo del tutorial
  await val("localStorage.removeItem('bb_onboarded');localStorage.setItem('bb_lang','en')");
  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2200);
  const passi=[];
  for(let i=0;i<5;i++){
    passi.push(await val("(document.querySelector('#onboarding .onb-card h2')||{}).textContent"));
    await val("(Array.from(document.querySelectorAll('#onboarding button')).pop()||{click(){}}).click()"); await att(350);
  }
  console.log('     i cinque passi in inglese: '+JSON.stringify(passi));
  V('il quinto passo NON e piu in italiano', passi[4] !== 'Spostati al volo', passi[4]);

  console.log(`\n  ${ok} passati, ${ko} falliti\n`);
  ws.close(); ch.kill(); await att(300);
  try{fs.rmSync(PROFILO,{recursive:true,force:true})}catch{}
  process.exit(ko?1:0);
})();
