/* La finestra delle impostazioni su un telefono: deve scorrere LEI,
   e si deve poter arrivare fino al bottone "Chiudi" in fondo. */
const { spawn } = require('child_process');
const fs=require('fs'), path=require('path'), http=require('http');
const PORTA=9420+Math.floor(Math.random()*90), PROFILO=path.join(__dirname,'sc-'+PORTA);
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
  const val=async e=>(await S('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.result.value;

  let ok=0,ko=0; const V=(m,e,d)=>{if(e){ok++;console.log('  ok  '+m)}else{ko++;console.log('  KO  '+m+(d!==undefined?' -> '+JSON.stringify(d):''))}};

  for (const [w,h,nome] of [[390,844,'telefono normale'],[360,640,'telefono piccolo']]) {
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true});
    await S('Page.navigate',{url:'http://localhost:3000/'}); await att(1800);
    await val(`(async()=>{const p=await (await fetch('/api/profiles')).json();const pro=p.find(x=>/Propriet/.test(x.name))||p[0];
      const r=await (await fetch('/api/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:pro.id,pin:'1111'})})).json();
      localStorage.setItem('bb_token',r.token);localStorage.setItem('bb_profile',JSON.stringify(r.profile||pro));
      localStorage.setItem('bb_onboarded','1');localStorage.setItem('bb_lang','it');localStorage.setItem('bb_inst_no','1');return 1})()`);
    await S('Page.navigate',{url:'http://localhost:3000/'}); await att(2200);

    console.log('\n  --- ' + nome + ' (' + w + 'x' + h + ') ---');
    await val("openSettings()"); await att(900);

    const m = await val(`(()=>{
      const o=document.querySelector('.overlay'); if(!o) return null;
      const md=o.querySelector('.modal');
      return {altezzaFinestra: Math.round(md.getBoundingClientRect().height),
              altezzaSchermo: window.innerHeight,
              scorrevole: o.scrollHeight > o.clientHeight + 1,
              overflow: getComputedStyle(o).overflowY,
              contenimento: getComputedStyle(o).overscrollBehaviorY};
    })()`);
    console.log('     finestra ' + m.altezzaFinestra + 'px su schermo ' + m.altezzaSchermo + 'px');

    V('la finestra e piu alta dello schermo (quindi il caso si verifica)', m.altezzaFinestra > m.altezzaSchermo, m);
    V('la finestra puo scorrere', m.overflow === 'auto' || m.overflow === 'scroll', m.overflow);
    V('lo scorrimento non sfonda sullo sfondo', m.contenimento === 'contain', m.contenimento);

    /* si arriva davvero in fondo, al bottone Chiudi? */
    const fondo = await val(`(()=>{
      const o=document.querySelector('.overlay');
      o.scrollTop = o.scrollHeight;
      const b=Array.from(o.querySelectorAll('button')).pop();
      const r=b.getBoundingClientRect();
      return {testo:b.textContent.trim(), visibile: r.top>=0 && r.bottom<=window.innerHeight+1, top:Math.round(r.top), bottom:Math.round(r.bottom)};
    })()`);
    V('scorrendo si arriva al bottone in fondo ("'+fondo.testo+'")', fondo.visibile===true, fondo);

    /* e la pagina dietro non si e' mossa */
    const dietro = await val("Math.round(window.scrollY)");
    V('la pagina dietro non si e mossa', dietro === 0, dietro);
  }

  const sh=await S('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync(path.join(__dirname,'shot'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'shot','impostazioni-fondo.png'),Buffer.from(sh.result.data,'base64'));
  console.log('\n  immagine del fondo: shot/impostazioni-fondo.png');

  console.log(`\n  ${ok} passati, ${ko} falliti\n`);
  ws.close(); ch.kill(); await att(300);
  try{fs.rmSync(PROFILO,{recursive:true,force:true})}catch{}
  process.exit(ko?1:0);
})();
