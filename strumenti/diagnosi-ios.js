/* I tre casi iPhone: Safari vero, Chrome su iOS, browser dentro
   un'altra app. Le firme sono quelle reali dei browser. */
const { spawn } = require('child_process');
const fs=require('fs'), path=require('path'), http=require('http');
const PORTA=9600+Math.floor(Math.random()*90), PROFILO=path.join(__dirname,'ios-'+PORTA);
const att=ms=>new Promise(r=>setTimeout(r,ms));
const get=p=>new Promise((ris,rif)=>http.get({host:'127.0.0.1',port:PORTA,path:p},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{ris(JSON.parse(d))}catch(e){rif(e)}})}).on('error',rif));

const UA = {
  safari:   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chrome:   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  whatsapp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  instagram:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113',
};

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
  console.log('\nI TRE CASI IPHONE\n');

  await S('Emulation.setUserAgentOverride',{userAgent:UA.safari});
  await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2000);
  await val(`(async()=>{const p=await (await fetch('/api/profiles')).json();const pro=p.find(x=>/Propriet/.test(x.name))||p[0];
    const r=await (await fetch('/api/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:pro.id,pin:'1111'})})).json();
    localStorage.setItem('bb_token',r.token);localStorage.setItem('bb_profile',JSON.stringify(r.profile||pro));
    localStorage.setItem('bb_onboarded','1');localStorage.setItem('bb_lang','it');localStorage.setItem('bb_inst_no','1');return 1})()`);

  const prova = async (nome, ua, atteso) => {
    await S('Emulation.setUserAgentOverride',{userAgent:ua});
    await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2000);
    await val("invitoInstalla = null");          // su iPhone non esiste mai
    const caso = await val("situazioneIOS()");
    V(nome + ': riconosciuto come "' + atteso + '"', caso===atteso, caso);
    await val("openSettings()"); await att(700);
    return await val("(document.getElementById('inst-zona')||{}).innerHTML||''");
  };

  let z = await prova('Safari vero', UA.safari, 'safari');
  V('  Safari: mostra Condividi -> Aggiungi a Home', /Condividi/.test(z) && /Aggiungi a Home/.test(z), z.slice(0,70));

  z = await prova('Chrome su iPhone', UA.chrome, 'altroBrowser');
  V('  Chrome: avverte che la voce non esiste', /non c/.test(z), z.slice(0,70));
  V('  Chrome: offre di copiare l indirizzo', /copiaIndirizzo/.test(z));

  z = await prova('browser dentro WhatsApp', UA.whatsapp, 'dentroUnApp');
  V('  WhatsApp: dice di aprire in Safari', /Apri in Safari/.test(z), z.slice(0,70));
  V('  WhatsApp: rassicura che l app non e rotta', /[Nn]on .{0,3} un difetto/.test(z));

  z = await prova('browser dentro Instagram', UA.instagram, 'dentroUnApp');
  V('  Instagram: stesso rimedio', /Apri in Safari/.test(z));

  console.log(`\n  ${ok} passati, ${ko} falliti\n`);
  ws.close(); ch.kill(); await att(300);
  try{fs.rmSync(PROFILO,{recursive:true,force:true})}catch{}
  process.exit(ko?1:0);
})();
