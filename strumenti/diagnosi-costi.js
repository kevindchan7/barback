const B='http://localhost:3098/api';
const chiama=async(p,{metodo='GET',token,corpo}={})=>{
  const r=await fetch(B+p,{method:metodo,headers:Object.assign({'Content-Type':'application/json'},token?{Authorization:'Bearer '+token}:{}),body:corpo?JSON.stringify(corpo):undefined});
  let d=null;try{d=await r.json()}catch{}; return {stato:r.status,dati:d};};
let ok=0,ko=0; const V=(m,e,d)=>{if(e){ok++;console.log('  ok  '+m)}else{ko++;console.log('  KO  '+m+(d!==undefined?' -> '+JSON.stringify(d):''))}};
(async()=>{
  console.log('\nCOSTI E PREZZI NEI PRODOTTI\n');
  const prof=(await chiama('/profiles')).dati;
  const entra=async(nome,pin)=>(await chiama('/auth/pin',{metodo:'POST',corpo:{profileId:prof.find(p=>new RegExp(nome,'i').test(p.name)).id,pin}})).dati.token;
  const PROP=await entra('Propriet','1111');
  const BARMAN=await entra('Barman','3333');

  // il proprietario crea un prodotto COI numeri
  const c=await chiama('/products',{metodo:'POST',token:PROP,corpo:{name:'Gin Mare',format:'70cl',stock:3,threshold:2,cost:24.50,price:0,volume_ml:700}});
  V('il proprietario crea un prodotto col costo', c.stato===200, c);
  const id=c.dati.id;
  const leggi=async(tok)=>((await chiama('/products',{token:tok})).dati||[]).find(p=>p.id===id);
  let p=await leggi(PROP);
  V('il costo e stato salvato', p.cost===24.5, p&&p.cost);
  V('il volume e stato salvato', p.volume_ml===700, p&&p.volume_ml);

  // il proprietario mette il prezzo
  await chiama('/products/'+id,{metodo:'PUT',token:PROP,corpo:{name:'Gin Mare',cost:24.50,price:9,volume_ml:700,threshold:2,par_level:4}});
  p=await leggi(PROP);
  V('il proprietario puo mettere il prezzo', p.price===9, p&&p.price);

  // IL PUNTO: il barman modifica la soglia e NON deve azzerare i costi
  const b=await chiama('/products/'+id,{metodo:'PUT',token:BARMAN,corpo:{name:'Gin Mare',threshold:5,par_level:10}});
  if(b.stato===200){
    p=await leggi(PROP);
    V('il barman cambia la soglia', p.threshold===5, p&&p.threshold);
    V('...e il COSTO resta intatto', p.cost===24.5, p&&p.cost);
    V('...e il PREZZO resta intatto', p.price===9, p&&p.price);
    V('...e il VOLUME resta intatto', p.volume_ml===700, p&&p.volume_ml);
  } else {
    V('il barman non puo nemmeno modificare (permesso negato)', b.stato===403, b.stato);
  }

  // il food cost ora funziona sul prodotto nuovo
  const fc=await chiama('/foodcost',{token:PROP});
  V('il food cost risponde al proprietario', fc.stato===200, fc.stato);
  const bott=(fc.dati.bottiglie||[]).find(x=>x.nome==='Gin Mare');
  V('il nuovo prodotto non risulta incompleto', bott && bott.incompleto===false, bott);
  V('ne calcola il costo al ml', bott && Math.abs(bott.costoMl-0.035)<0.001, bott&&bott.costoMl);
  V('il barman NON vede il food cost', (await chiama('/foodcost',{token:BARMAN})).stato===403);

  console.log('\n  '+ok+' passati, '+ko+' falliti\n');
  process.exit(ko?1:0);
})();
