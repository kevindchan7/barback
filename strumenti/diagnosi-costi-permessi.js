/* Il caso che fa danno: un profilo che PUO' modificare i prodotti ma
   NON puo' vedere i costi. Se il server azzerasse quello che non gli
   arriva, quel profilo cancellerebbe il listino del proprietario
   semplicemente correggendo una soglia di riordino. */
const B='http://localhost:3098/api';
const chiama=async(p,{metodo='GET',token,corpo}={})=>{
  const r=await fetch(B+p,{method:metodo,headers:Object.assign({'Content-Type':'application/json'},token?{Authorization:'Bearer '+token}:{}),body:corpo?JSON.stringify(corpo):undefined});
  let d=null;try{d=await r.json()}catch{}; return {stato:r.status,dati:d};};
let ok=0,ko=0; const V=(m,e,d)=>{if(e){ok++;console.log('  ok  '+m)}else{ko++;console.log('  KO  '+m+(d!==undefined?' -> '+JSON.stringify(d):''))}};
(async()=>{
  console.log('\nCHI MODIFICA MA NON VEDE I COSTI\n');
  const prof=(await chiama('/profiles')).dati;
  const PROP=(await chiama('/auth/pin',{metodo:'POST',corpo:{profileId:prof.find(p=>/Propriet/i.test(p.name)).id,pin:'1111'}})).dati.token;

  // creo un profilo magazziniere: tocca i prodotti, non vede i soldi
  const np=await chiama('/profiles',{metodo:'POST',token:PROP,corpo:{name:'Magazziniere',pin:'7777',ruolo:'bar manager'}});
  V('creato un profilo che modifica ma non vede i costi', np.stato===200, np);
  const MAG=(await chiama('/auth/pin',{metodo:'POST',corpo:{profileId:np.dati.id,pin:'7777'}})).dati.token;

  const prodotti=(await chiama('/products',{token:PROP})).dati;
  const g=prodotti.find(p=>p.name==='Gin Mare');
  V('il prodotto di prova ha costo 24.5 e prezzo 9', g.cost===24.5&&g.price===9, {c:g.cost,p:g.price});

  V('il magazziniere NON vede il food cost', (await chiama('/foodcost',{token:MAG})).stato===403);

  // modifica la soglia senza mandare i costi: e' quello che farebbe l'app
  const r=await chiama('/products/'+g.id,{metodo:'PUT',token:MAG,corpo:{name:'Gin Mare',threshold:8,par_level:16}});
  V('il magazziniere puo cambiare la soglia', r.stato===200, r);
  const dopo=((await chiama('/products',{token:PROP})).dati).find(p=>p.id===g.id);
  V('la soglia e cambiata', dopo.threshold===8, dopo.threshold);
  V('IL COSTO NON E STATO AZZERATO', dopo.cost===24.5, dopo.cost);
  V('IL PREZZO NON E STATO AZZERATO', dopo.price===9, dopo.price);
  V('IL VOLUME NON E STATO AZZERATO', dopo.volume_ml===700, dopo.volume_ml);

  console.log('\n  '+ok+' passati, '+ko+' falliti\n');
  process.exit(ko?1:0);
})();
