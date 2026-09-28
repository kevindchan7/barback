/* =====================================================================
   i18n.js — Barback in tre lingue: italiano, inglese, spagnolo.

   Come funziona:
   - nell'HTML si mette  data-i18n="chiave"  sull'elemento: il testo
     viene sostituito. Per i campi:  data-i18n-ph  (placeholder) e
     data-i18n-title  (suggerimento al passaggio del mouse).
   - nel JavaScript si scrive  t('chiave')  oppure  t('chiave', {n: 3})
     per i testi con parti variabili.
   - il bottone nel banner gira fra IT, EN e ES e salva la scelta.

   La lingua viene mandata anche al server (intestazione X-Lang), che
   traduce i suoi messaggi di errore e il manuale del dipendente.
   ===================================================================== */

const LINGUE = ['it', 'en', 'es'];

const I18N = {
  it: {
    /* --- generale --- */
    app_nome: 'Barback', app_sotto: 'Magazzino & Turni',
    esci: 'Esci', annulla: 'Annulla', salva: 'Salva', chiudi: 'Chiudi',
    aggiungi: '+ Aggiungi', elimina: 'Elimina', modifica: 'Modifica',
    indietro: '← Torna indietro', cerca_prodotto: '🔍 Cerca prodotto…',
    nome: 'Nome', nome_obbl: 'Nome *', tipo: 'Tipo', data: 'Data', stato: 'Stato',
    ruolo: 'Ruolo', telefono: 'Telefono', email: 'Email', quantita: 'Quantità',
    prodotto: 'Prodotto', dipendente: 'Dipendente', fornitore: 'Fornitore',
    giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese', vista: 'Vista',
    inizio: 'Inizio', fine: 'Fine', unita: 'Unità', formato: 'Formato',
    cambia_tema: 'Cambia tema', impostazioni: 'Impostazioni', cambia_lingua: 'Cambia lingua',

    /* --- accesso --- */
    scegli_profilo: 'Scegli il tuo profilo', cambia_profilo: '← Cambia profilo',
    pin_per: 'PIN per', accesso_completo: 'accesso completo', permessi_n: '{n} permessi',
    ciao: 'Ciao! Sono Barback. Scegli un profilo per entrare.',
    bentornato: 'Bentornato, {nome}! Ecco cosa puoi gestire.',

    /* --- navigazione --- */
    nav_home: 'Home', nav_vuoti: 'Vuoti', nav_turni: 'Turni', nav_ferie: 'Ferie',
    nav_magazzino: 'Magazz.', nav_inventario: 'Invent.', nav_ordini: 'Ordini', nav_manuale: 'Manuale',
    sez_vuoti: 'Conteggio vuoti', sez_turni: 'Turni & Task', sez_ferie: 'Ferie e permessi',
    sez_magazzino: 'Magazzino & Giacenze', sez_inventario: 'Inventario',
    sez_ordini: 'Ordini ai fornitori', sez_manuale: 'Manuale dipendente',
    d_vuoti: 'Bottiglie consumate', d_turni: 'Personale e obiettivi', d_ferie: 'Chiedi e approva',
    d_magazzino: 'Giacenze e consumi', d_inventario: 'Conta e verifica le giacenze',
    d_ordini: 'Cosa ordinare e da chi', d_manuale: 'Regole e ricettario',

    /* --- panoramica --- */
    giacenza_pezzi: 'Giacenza (bott.)', entrate_mese: 'Entrate (mese)', uscite_mese: 'Uscite (mese)',
    sotto_soglia: 'Sotto soglia', primo_avvio: 'Primo avvio: questo è lo stato iniziale del magazzino.',

    /* --- vuoti --- */
    registra_vuoti: 'Registra bottiglie consumate', vuoti_qta: 'Quantità (vuoti)',
    origine: 'Origine', manuale_o: 'Manuale', da_scontrino: 'Da scontrino', da_giacenza: 'Da giacenza iniziale',
    btn_registra_vuoti: '+ Registra vuoti', resoconto: 'Resoconto', residuo: 'Residuo',
    griglia_mese: 'Griglia del mese (vuoti giorno per giorno)', vuoti: 'Vuoti',

    /* --- magazzino --- */
    carico_scarico: 'Carico / Scarico rapido', btn_registra_mov: '+ Registra movimento',
    carico_forn: 'Carico (fornitore)', scarico: 'Scarico', vuoto: 'Vuoto',
    giacenze_consumi: 'Giacenze e consumi', entrato: 'Entrato', uscito: 'Uscito',
    netto: 'Netto', residua: 'Residua', da_ordinare: 'Da ordinare',
    agg_prodotto: 'Aggiungi un prodotto',
    agg_prodotto_aiuto: 'Serve solo il nome. Il resto lo puoi mettere dopo con la matita.',
    giacenza_iniziale: 'Giacenza iniziale', soglia_riordino: 'Soglia riordino',
    scorta_ideale: 'Scorta ideale', doppio_soglia: 'doppio soglia',
    btn_agg_prodotto: '+ Aggiungi prodotto',
    soglia_aiuto: 'Sotto la soglia l\'app propone l\'ordine per tornare alla scorta ideale.',
    nessuno: '— nessuno —', nessun_prodotto: 'Nessun prodotto trovato.',
    csv_magazzino: '⬇ CSV magazzino', excel_magazzino: '⬇ Excel magazzino',

    /* --- ordini --- */
    ordini_hello: 'Ti dico cosa sta finendo e quanto ordinare. Poi lo mandi al fornitore.',
    prodotti_da_ordinare: 'Prodotti da ordinare', fornitori: 'Fornitori',
    nuovo_fornitore: 'Nuovo fornitore', btn_agg_fornitore: '+ Aggiungi fornitore',
    ideale: 'Ideale', giacenza: 'Giacenza', n_prodotti: '{n} prodotti',
    copia_testo: '📋 Copia testo', manda_whatsapp: '💬 WhatsApp',
    niente_da_ordinare: 'Non c\'è niente da ordinare: nessun prodotto è arrivato alla soglia. 👍',
    nessun_fornitore: 'Nessun fornitore. Aggiungine uno qui sotto.',
    ordine_intestazione: 'Ordine Barback — {data}', ordine_fornitore: 'Fornitore: {nome}',

    /* --- inventario --- */
    inv_hello: 'Conta una postazione alla volta. Puoi fermarti e riprendere: non perdi niente.',
    inv_nessuno: 'Nessun inventario in corso',
    inv_nessuno_aiuto: 'Si conta una postazione alla volta. Puoi interromperti e riprendere quando vuoi: niente si perde.',
    inv_inizia: '▶ Inizia inventario', inv_in_corso: 'Inventario in corso',
    postazione: 'Postazione', ordine: 'Ordine', come_ultima: 'Come l\'ultima volta',
    alfabetico: 'Alfabetico', cursore: '🎚 Cursore', tastierino: '⌨ Tastierino',
    codice_barre: '📷 Codice a barre', contati_su: '{fatti} / {tot} contati',
    in_memoria: 'in memoria: {n}', bottiglia_aperta: 'bottiglia aperta',
    inv_rivedi: '✓ Rivedi e chiudi', inv_annulla: 'Annulla inventario',
    revisione: 'Revisione', contati: 'Contati', non_contati: 'Non contati',
    con_scostamento: 'Con scostamento', differenze: 'Differenze', differenza: 'Differenza',
    atteso: 'Atteso', contato: 'Contato',
    non_contati_aiuto: 'Questi prodotti non li hai contati. Decidi cosa farne.',
    cosa_non_contati: 'Cosa faccio con i non contati',
    tieni_giacenza: 'Lascia la giacenza com\'è (consigliato)', azzera_giacenza: 'Azzera la giacenza',
    inv_chiudi: '🔒 Chiudi inventario e allinea le giacenze', inv_torna: '← Torna al conteggio',
    storico_inventari: 'Storico inventari', quando: 'Quando', chi: 'Chi',
    parziale: 'parziale', nessun_inventario: 'Nessun inventario ancora. Il primo che chiudi finisce qui.',
    postazioni: 'Postazioni', postazioni_aiuto: 'I posti dove conti separatamente: banco, frigo, cantina.',
    nuova_postazione: 'Nuova postazione', nessuna_postazione: 'Nessuna postazione.',
    non_contato_niente: 'Non hai contato niente.',

    /* --- turni e task --- */
    gestione_turni: 'Gestione turni', btn_agg_turno: '+ Aggiungi turno',
    task_oggi: 'Task di oggi', nuova_task: 'Nuova task', nessuna_task: 'Nessuna task per oggi.',
    griglia_aiuto: 'Nella griglia, tocca un turno per eliminarlo.',
    riferimento: 'Riferimento', csv_turni: '⬇ CSV turni', excel_turni: '⬇ Excel turni',
    personale: 'Personale', personale_aiuto: 'Chi lavora nel locale. Servono per assegnare turni e task.',
    nessun_dipendente: 'Nessun dipendente. Aggiungine uno qui sotto.',

    /* --- ferie --- */
    rq_hello_capo: 'Qui decidi le richieste del personale. Ti dico anche quali turni restano scoperti.',
    rq_hello_dip: 'Chiedi ferie, un permesso o un cambio turno. Il responsabile riceve la richiesta.',
    nuova_richiesta: 'Nuova richiesta', ferie: 'Ferie', permesso: 'Permesso', cambio_turno: 'Cambio turno',
    dal_giorno: 'Dal giorno', al_giorno: 'Al giorno', motivo_fac: 'Motivo (facoltativo)',
    invia_richiesta: '↔ Invia richiesta', da_approvare: 'Da approvare',
    da_approvare_aiuto: 'Per ogni richiesta vedi i turni che resterebbero scoperti.',
    tutte_richieste: 'Tutte le richieste', periodo: 'Periodo', deciso_da: 'Deciso da',
    giorni: '{n} giorni', giorno_uno: '1 giorno',
    turni_coprire: '{n} turni da coprire:', turno_coprire: '1 turno da coprire:',
    nessun_turno_periodo: 'Nessun turno assegnato in quei giorni.',
    approva: '✓ Approva', rifiuta: '✕ Rifiuta',
    nessuna_attesa: 'Nessuna richiesta in attesa. 👍', nessuna_richiesta: 'Nessuna richiesta.',
    in_attesa: 'in attesa', approvato: 'approvato', rifiutato: 'rifiutato',

    /* --- manuale --- */
    man_hello: 'Tutto quello che ti serve per il turno: regole del locale e ricette.',
    regole_locale: '📋 Regole del locale', ricettario: '🍸 Ricettario cocktail',

    /* --- impostazioni --- */
    tuo_pin: 'Il tuo PIN', sei_entrato: 'Sei entrato come {nome}.',
    pin_attuale: 'PIN attuale', pin_nuovo: 'Nuovo PIN', cambia_mio_pin: 'Cambia il mio PIN',
    profili_accesso: 'Profili di accesso', accesso: 'Accesso', completo: 'completo',
    nuovo_profilo: 'Nuovo profilo', pin_4_cifre: 'PIN (4 cifre)', crea_profilo: '+ Crea profilo',
    reimposta_pin: 'Reimposta PIN',
    ricomincia: 'Ricominciare da zero',
    ricomincia_aiuto: 'Cancella prodotti, giacenze, movimenti, dipendenti, turni, richieste, fornitori, postazioni e inventari. I profili e i PIN restano. Serve quando hai finito di provare e vuoi mettere i dati veri del locale.',
    svuota_tutto: '🗑 Svuota tutti i dati',
    prodotti: 'Prodotti', cerca_prodotto2: '🔍 Cerca prodotto...',
    ph_formato: 'es. 70cl', ph_nome_prod: 'es. Gin Mare', ph_nome_dip: 'es. Chiara',
    ph_ruolo: 'es. barista', ph_fornitore: 'es. Distribuzione Rossi',
    ph_postazione: 'es. Frigo vini', ph_task: 'es. Pulizia banco',
    ph_motivo: 'es. matrimonio, visita medica, scambio con Marco',
    ph_tel: '+39 ...', ph_email: 'ordini@...', ph_unita: 'bott.', ph_pin: 'es. 5555',
    ph_profilo: 'es. Barman sera',
  },

  en: {
    app_nome: 'Barback', app_sotto: 'Stock & Shifts',
    esci: 'Log out', annulla: 'Cancel', salva: 'Save', chiudi: 'Close',
    aggiungi: '+ Add', elimina: 'Delete', modifica: 'Edit',
    indietro: '← Back', cerca_prodotto: '🔍 Search product…',
    nome: 'Name', nome_obbl: 'Name *', tipo: 'Type', data: 'Date', stato: 'Status',
    ruolo: 'Role', telefono: 'Phone', email: 'Email', quantita: 'Quantity',
    prodotto: 'Product', dipendente: 'Staff member', fornitore: 'Supplier',
    giorno: 'Day', settimana: 'Week', mese: 'Month', vista: 'View',
    inizio: 'Start', fine: 'End', unita: 'Unit', formato: 'Size',
    cambia_tema: 'Switch theme', impostazioni: 'Settings', cambia_lingua: 'Change language',

    scegli_profilo: 'Choose your profile', cambia_profilo: '← Change profile',
    pin_per: 'PIN for', accesso_completo: 'full access', permessi_n: '{n} permissions',
    ciao: 'Hi! I am Barback. Pick a profile to get in.',
    bentornato: 'Welcome back, {nome}! Here is what you can manage.',

    nav_home: 'Home', nav_vuoti: 'Empties', nav_turni: 'Shifts', nav_ferie: 'Leave',
    nav_magazzino: 'Stock', nav_inventario: 'Count', nav_ordini: 'Orders', nav_manuale: 'Manual',
    sez_vuoti: 'Empties count', sez_turni: 'Shifts & Tasks', sez_ferie: 'Leave and time off',
    sez_magazzino: 'Stock & Inventory', sez_inventario: 'Stocktake',
    sez_ordini: 'Supplier orders', sez_manuale: 'Staff manual',
    d_vuoti: 'Bottles used', d_turni: 'Staff and to-dos', d_ferie: 'Request and approve',
    d_magazzino: 'Stock and usage', d_inventario: 'Count and check your stock',
    d_ordini: 'What to order and from whom', d_manuale: 'House rules and recipes',

    giacenza_pezzi: 'In stock (bottles)', entrate_mese: 'In (month)', uscite_mese: 'Out (month)',
    sotto_soglia: 'Below par', primo_avvio: 'First run: this is the starting stock.',

    registra_vuoti: 'Record bottles used', vuoti_qta: 'Quantity (empties)',
    origine: 'Source', manuale_o: 'Manual', da_scontrino: 'From receipt', da_giacenza: 'From opening stock',
    btn_registra_vuoti: '+ Record empties', resoconto: 'Summary', residuo: 'Left',
    griglia_mese: 'Month grid (empties day by day)', vuoti: 'Empties',

    carico_scarico: 'Quick stock in / out', btn_registra_mov: '+ Record movement',
    carico_forn: 'Stock in (supplier)', scarico: 'Stock out', vuoto: 'Empty',
    giacenze_consumi: 'Stock and usage', entrato: 'In', uscito: 'Out',
    netto: 'Net', residua: 'Left', da_ordinare: 'To order',
    agg_prodotto: 'Add a product',
    agg_prodotto_aiuto: 'Only the name is required. You can fill in the rest later with the pencil.',
    giacenza_iniziale: 'Opening stock', soglia_riordino: 'Reorder point',
    scorta_ideale: 'Par level', doppio_soglia: 'twice the reorder point',
    btn_agg_prodotto: '+ Add product',
    soglia_aiuto: 'Below the reorder point the app suggests an order back up to the par level.',
    nessuno: '— none —', nessun_prodotto: 'No products found.',
    csv_magazzino: '⬇ Stock CSV', excel_magazzino: '⬇ Stock Excel',

    ordini_hello: 'I tell you what is running out and how much to order. Then you send it to the supplier.',
    prodotti_da_ordinare: 'Products to order', fornitori: 'Suppliers',
    nuovo_fornitore: 'New supplier', btn_agg_fornitore: '+ Add supplier',
    ideale: 'Par', giacenza: 'In stock', n_prodotti: '{n} products',
    copia_testo: '📋 Copy text', manda_whatsapp: '💬 WhatsApp',
    niente_da_ordinare: 'Nothing to order: no product has hit its reorder point. 👍',
    nessun_fornitore: 'No suppliers yet. Add one below.',
    ordine_intestazione: 'Barback order — {data}', ordine_fornitore: 'Supplier: {nome}',

    inv_hello: 'Count one area at a time. You can stop and pick up later: nothing is lost.',
    inv_nessuno: 'No stocktake in progress',
    inv_nessuno_aiuto: 'You count one area at a time. Stop and resume whenever you like: nothing is lost.',
    inv_inizia: '▶ Start stocktake', inv_in_corso: 'Stocktake in progress',
    postazione: 'Area', ordine: 'Order', come_ultima: 'Same as last time',
    alfabetico: 'A to Z', cursore: '🎚 Slider', tastierino: '⌨ Keypad',
    codice_barre: '📷 Barcode', contati_su: '{fatti} / {tot} counted',
    in_memoria: 'on record: {n}', bottiglia_aperta: 'open bottle',
    inv_rivedi: '✓ Review and close', inv_annulla: 'Cancel stocktake',
    revisione: 'Review', contati: 'Counted', non_contati: 'Not counted',
    con_scostamento: 'With variance', differenze: 'Differences', differenza: 'Difference',
    atteso: 'Expected', contato: 'Counted',
    non_contati_aiuto: 'You did not count these. Decide what to do with them.',
    cosa_non_contati: 'What to do with the uncounted',
    tieni_giacenza: 'Leave the stock as it is (recommended)', azzera_giacenza: 'Set the stock to zero',
    inv_chiudi: '🔒 Close stocktake and update stock', inv_torna: '← Back to counting',
    storico_inventari: 'Stocktake history', quando: 'When', chi: 'Who',
    parziale: 'partial', nessun_inventario: 'No stocktakes yet. The first one you close lands here.',
    postazioni: 'Areas', postazioni_aiuto: 'The places you count separately: bar, fridge, cellar.',
    nuova_postazione: 'New area', nessuna_postazione: 'No areas yet.',
    non_contato_niente: 'You have not counted anything.',

    gestione_turni: 'Manage shifts', btn_agg_turno: '+ Add shift',
    task_oggi: 'Today\'s tasks', nuova_task: 'New task', nessuna_task: 'No tasks for today.',
    griglia_aiuto: 'In the grid, tap a shift to delete it.',
    riferimento: 'Reference day', csv_turni: '⬇ Shifts CSV', excel_turni: '⬇ Shifts Excel',
    personale: 'Staff', personale_aiuto: 'Who works here. Needed to assign shifts and tasks.',
    nessun_dipendente: 'No staff yet. Add someone below.',

    rq_hello_capo: 'Here you decide the staff requests. I also show which shifts would be left uncovered.',
    rq_hello_dip: 'Request leave, time off or a shift swap. Your manager gets the request.',
    nuova_richiesta: 'New request', ferie: 'Leave', permesso: 'Time off', cambio_turno: 'Shift swap',
    dal_giorno: 'From', al_giorno: 'To', motivo_fac: 'Reason (optional)',
    invia_richiesta: '↔ Send request', da_approvare: 'To approve',
    da_approvare_aiuto: 'For each request you see the shifts that would be left uncovered.',
    tutte_richieste: 'All requests', periodo: 'Period', deciso_da: 'Decided by',
    giorni: '{n} days', giorno_uno: '1 day',
    turni_coprire: '{n} shifts to cover:', turno_coprire: '1 shift to cover:',
    nessun_turno_periodo: 'No shifts assigned on those days.',
    approva: '✓ Approve', rifiuta: '✕ Reject',
    nessuna_attesa: 'No pending requests. 👍', nessuna_richiesta: 'No requests.',
    in_attesa: 'pending', approvato: 'approved', rifiutato: 'rejected',

    man_hello: 'Everything you need for your shift: house rules and recipes.',
    regole_locale: '📋 House rules', ricettario: '🍸 Cocktail recipes',

    tuo_pin: 'Your PIN', sei_entrato: 'You are logged in as {nome}.',
    pin_attuale: 'Current PIN', pin_nuovo: 'New PIN', cambia_mio_pin: 'Change my PIN',
    profili_accesso: 'Access profiles', accesso: 'Access', completo: 'full',
    nuovo_profilo: 'New profile', pin_4_cifre: 'PIN (4 digits)', crea_profilo: '+ Create profile',
    reimposta_pin: 'Reset PIN',
    ricomincia: 'Start over',
    ricomincia_aiuto: 'Deletes products, stock, movements, staff, shifts, requests, suppliers, areas and stocktakes. Profiles and PINs stay. Use it when you are done trying the app and want to put in your real data.',
    svuota_tutto: '🗑 Erase all data',
    prodotti: 'Products', cerca_prodotto2: '🔍 Search product...',
    ph_formato: 'e.g. 70cl', ph_nome_prod: 'e.g. Bombay Gin', ph_nome_dip: 'e.g. Sarah',
    ph_ruolo: 'e.g. bartender', ph_fornitore: 'e.g. City Drinks Ltd',
    ph_postazione: 'e.g. Wine fridge', ph_task: 'e.g. Clean the bar',
    ph_motivo: 'e.g. wedding, doctor appointment, swap with Mark',
    ph_tel: '+44 ...', ph_email: 'orders@...', ph_unita: 'btl', ph_pin: 'e.g. 5555',
    ph_profilo: 'e.g. Evening bartender',
  },

  es: {
    app_nome: 'Barback', app_sotto: 'Almacén y turnos',
    esci: 'Salir', annulla: 'Cancelar', salva: 'Guardar', chiudi: 'Cerrar',
    aggiungi: '+ Añadir', elimina: 'Eliminar', modifica: 'Editar',
    indietro: '← Volver', cerca_prodotto: '🔍 Buscar producto…',
    nome: 'Nombre', nome_obbl: 'Nombre *', tipo: 'Tipo', data: 'Fecha', stato: 'Estado',
    ruolo: 'Puesto', telefono: 'Teléfono', email: 'Correo', quantita: 'Cantidad',
    prodotto: 'Producto', dipendente: 'Empleado', fornitore: 'Proveedor',
    giorno: 'Día', settimana: 'Semana', mese: 'Mes', vista: 'Vista',
    inizio: 'Inicio', fine: 'Fin', unita: 'Unidad', formato: 'Formato',
    cambia_tema: 'Cambiar tema', impostazioni: 'Ajustes', cambia_lingua: 'Cambiar idioma',

    scegli_profilo: 'Elige tu perfil', cambia_profilo: '← Cambiar perfil',
    pin_per: 'PIN de', accesso_completo: 'acceso completo', permessi_n: '{n} permisos',
    ciao: '¡Hola! Soy Barback. Elige un perfil para entrar.',
    bentornato: '¡Bienvenido, {nome}! Esto es lo que puedes gestionar.',

    nav_home: 'Inicio', nav_vuoti: 'Vacíos', nav_turni: 'Turnos', nav_ferie: 'Permisos',
    nav_magazzino: 'Almacén', nav_inventario: 'Inventario', nav_ordini: 'Pedidos', nav_manuale: 'Manual',
    sez_vuoti: 'Recuento de vacíos', sez_turni: 'Turnos y tareas', sez_ferie: 'Vacaciones y permisos',
    sez_magazzino: 'Almacén y existencias', sez_inventario: 'Inventario',
    sez_ordini: 'Pedidos a proveedores', sez_manuale: 'Manual del empleado',
    d_vuoti: 'Botellas consumidas', d_turni: 'Personal y tareas', d_ferie: 'Pide y aprueba',
    d_magazzino: 'Existencias y consumo', d_inventario: 'Cuenta y comprueba las existencias',
    d_ordini: 'Qué pedir y a quién', d_manuale: 'Normas y recetario',

    giacenza_pezzi: 'Existencias (bot.)', entrate_mese: 'Entradas (mes)', uscite_mese: 'Salidas (mes)',
    sotto_soglia: 'Bajo mínimo', primo_avvio: 'Primer arranque: estas son las existencias iniciales.',

    registra_vuoti: 'Registrar botellas consumidas', vuoti_qta: 'Cantidad (vacíos)',
    origine: 'Origen', manuale_o: 'Manual', da_scontrino: 'Del ticket', da_giacenza: 'De existencias iniciales',
    btn_registra_vuoti: '+ Registrar vacíos', resoconto: 'Resumen', residuo: 'Resto',
    griglia_mese: 'Cuadro del mes (vacíos día a día)', vuoti: 'Vacíos',

    carico_scarico: 'Entrada / salida rápida', btn_registra_mov: '+ Registrar movimiento',
    carico_forn: 'Entrada (proveedor)', scarico: 'Salida', vuoto: 'Vacío',
    giacenze_consumi: 'Existencias y consumo', entrato: 'Entrado', uscito: 'Salido',
    netto: 'Neto', residua: 'Resto', da_ordinare: 'A pedir',
    agg_prodotto: 'Añadir un producto',
    agg_prodotto_aiuto: 'Solo hace falta el nombre. El resto lo puedes poner después con el lápiz.',
    giacenza_iniziale: 'Existencias iniciales', soglia_riordino: 'Punto de pedido',
    scorta_ideale: 'Stock ideal', doppio_soglia: 'doble del mínimo',
    btn_agg_prodotto: '+ Añadir producto',
    soglia_aiuto: 'Por debajo del mínimo la app propone el pedido para volver al stock ideal.',
    nessuno: '— ninguno —', nessun_prodotto: 'No se encontraron productos.',
    csv_magazzino: '⬇ CSV almacén', excel_magazzino: '⬇ Excel almacén',

    ordini_hello: 'Te digo qué se está acabando y cuánto pedir. Luego se lo envías al proveedor.',
    prodotti_da_ordinare: 'Productos a pedir', fornitori: 'Proveedores',
    nuovo_fornitore: 'Nuevo proveedor', btn_agg_fornitore: '+ Añadir proveedor',
    ideale: 'Ideal', giacenza: 'Existencias', n_prodotti: '{n} productos',
    copia_testo: '📋 Copiar texto', manda_whatsapp: '💬 WhatsApp',
    niente_da_ordinare: 'No hay nada que pedir: ningún producto ha llegado al mínimo. 👍',
    nessun_fornitore: 'Ningún proveedor todavía. Añade uno aquí abajo.',
    ordine_intestazione: 'Pedido Barback — {data}', ordine_fornitore: 'Proveedor: {nome}',

    inv_hello: 'Cuenta una zona cada vez. Puedes parar y seguir después: no se pierde nada.',
    inv_nessuno: 'Ningún inventario en curso',
    inv_nessuno_aiuto: 'Se cuenta una zona cada vez. Puedes parar y retomarlo cuando quieras: no se pierde nada.',
    inv_inizia: '▶ Empezar inventario', inv_in_corso: 'Inventario en curso',
    postazione: 'Zona', ordine: 'Orden', come_ultima: 'Como la última vez',
    alfabetico: 'Alfabético', cursore: '🎚 Deslizador', tastierino: '⌨ Teclado',
    codice_barre: '📷 Código de barras', contati_su: '{fatti} / {tot} contados',
    in_memoria: 'en sistema: {n}', bottiglia_aperta: 'botella abierta',
    inv_rivedi: '✓ Revisar y cerrar', inv_annulla: 'Cancelar inventario',
    revisione: 'Revisión', contati: 'Contados', non_contati: 'Sin contar',
    con_scostamento: 'Con desviación', differenze: 'Diferencias', differenza: 'Diferencia',
    atteso: 'Esperado', contato: 'Contado',
    non_contati_aiuto: 'Estos productos no los has contado. Decide qué hacer con ellos.',
    cosa_non_contati: 'Qué hago con los no contados',
    tieni_giacenza: 'Dejar las existencias como están (recomendado)', azzera_giacenza: 'Poner las existencias a cero',
    inv_chiudi: '🔒 Cerrar inventario y ajustar existencias', inv_torna: '← Volver al recuento',
    storico_inventari: 'Historial de inventarios', quando: 'Cuándo', chi: 'Quién',
    parziale: 'parcial', nessun_inventario: 'Aún no hay inventarios. El primero que cierres aparecerá aquí.',
    postazioni: 'Zonas', postazioni_aiuto: 'Los sitios donde cuentas por separado: barra, nevera, bodega.',
    nuova_postazione: 'Nueva zona', nessuna_postazione: 'Ninguna zona.',
    non_contato_niente: 'No has contado nada.',

    gestione_turni: 'Gestión de turnos', btn_agg_turno: '+ Añadir turno',
    task_oggi: 'Tareas de hoy', nuova_task: 'Nueva tarea', nessuna_task: 'No hay tareas para hoy.',
    griglia_aiuto: 'En el cuadro, toca un turno para eliminarlo.',
    riferimento: 'Día de referencia', csv_turni: '⬇ CSV turnos', excel_turni: '⬇ Excel turnos',
    personale: 'Personal', personale_aiuto: 'Quién trabaja en el local. Hace falta para asignar turnos y tareas.',
    nessun_dipendente: 'Ningún empleado. Añade uno aquí abajo.',

    rq_hello_capo: 'Aquí decides las peticiones del personal. También te digo qué turnos quedarían sin cubrir.',
    rq_hello_dip: 'Pide vacaciones, un permiso o un cambio de turno. El responsable recibe la petición.',
    nuova_richiesta: 'Nueva petición', ferie: 'Vacaciones', permesso: 'Permiso', cambio_turno: 'Cambio de turno',
    dal_giorno: 'Desde el día', al_giorno: 'Hasta el día', motivo_fac: 'Motivo (opcional)',
    invia_richiesta: '↔ Enviar petición', da_approvare: 'Por aprobar',
    da_approvare_aiuto: 'En cada petición ves los turnos que quedarían sin cubrir.',
    tutte_richieste: 'Todas las peticiones', periodo: 'Periodo', deciso_da: 'Decidido por',
    giorni: '{n} días', giorno_uno: '1 día',
    turni_coprire: '{n} turnos por cubrir:', turno_coprire: '1 turno por cubrir:',
    nessun_turno_periodo: 'Ningún turno asignado esos días.',
    approva: '✓ Aprobar', rifiuta: '✕ Rechazar',
    nessuna_attesa: 'Ninguna petición pendiente. 👍', nessuna_richiesta: 'Ninguna petición.',
    in_attesa: 'pendiente', approvato: 'aprobada', rifiutato: 'rechazada',

    man_hello: 'Todo lo que necesitas para el turno: normas del local y recetas.',
    regole_locale: '📋 Normas del local', ricettario: '🍸 Recetario de cócteles',

    tuo_pin: 'Tu PIN', sei_entrato: 'Has entrado como {nome}.',
    pin_attuale: 'PIN actual', pin_nuovo: 'PIN nuevo', cambia_mio_pin: 'Cambiar mi PIN',
    profili_accesso: 'Perfiles de acceso', accesso: 'Acceso', completo: 'completo',
    nuovo_profilo: 'Nuevo perfil', pin_4_cifre: 'PIN (4 cifras)', crea_profilo: '+ Crear perfil',
    reimposta_pin: 'Restablecer PIN',
    ricomincia: 'Empezar de cero',
    ricomincia_aiuto: 'Borra productos, existencias, movimientos, empleados, turnos, peticiones, proveedores, zonas e inventarios. Los perfiles y los PIN se mantienen. Úsalo cuando hayas terminado de probar y quieras poner los datos reales del local.',
    svuota_tutto: '🗑 Borrar todos los datos',
    prodotti: 'Productos', cerca_prodotto2: '🔍 Buscar producto...',
    ph_formato: 'ej. 70cl', ph_nome_prod: 'ej. Gin Mare', ph_nome_dip: 'ej. Clara',
    ph_ruolo: 'ej. camarero', ph_fornitore: 'ej. Distribuciones Rossi',
    ph_postazione: 'ej. Nevera de vinos', ph_task: 'ej. Limpiar la barra',
    ph_motivo: 'ej. boda, cita médica, cambio con Marcos',
    ph_tel: '+34 ...', ph_email: 'pedidos@...', ph_unita: 'bot.', ph_pin: 'ej. 5555',
    ph_profilo: 'ej. Camarero de noche',
  },
};

/* ---------------- motore ---------------- */
function linguaCorrente() {
  try { const l = localStorage.getItem('bb_lang'); if (LINGUE.includes(l)) return l; } catch {}
  // se non ha mai scelto, proviamo con la lingua del telefono
  const n = (navigator.language || 'it').slice(0, 2).toLowerCase();
  return LINGUE.includes(n) ? n : 'it';
}
let LANG = linguaCorrente();

// t('chiave') oppure t('chiave', {n: 3}) per i testi con parti variabili
function t(chiave, parti) {
  let s = (I18N[LANG] && I18N[LANG][chiave]) || (I18N.it && I18N.it[chiave]) || chiave;
  if (parti) Object.keys(parti).forEach(k => { s = s.split('{' + k + '}').join(parti[k]); });
  return s;
}
// la lingua da usare per date e numeri
const locale = () => ({ it: 'it-IT', en: 'en-GB', es: 'es-ES' })[LANG] || 'it-IT';

// riscrive tutto il testo statico della pagina
function applicaLingua() {
  document.documentElement.setAttribute('lang', LANG);
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle); });
  document.querySelectorAll('.langbtn').forEach(b => {
    b.textContent = LANG.toUpperCase();
    b.title = t('cambia_lingua');
  });
}

// il bottone gira fra le tre lingue
function toggleLang() {
  LANG = LINGUE[(LINGUE.indexOf(LANG) + 1) % LINGUE.length];
  try { localStorage.setItem('bb_lang', LANG); } catch {}
  applicaLingua();
  // ridisegna la schermata aperta, cosi' cambiano anche i testi generati
  if (typeof ricaricaVista === 'function') ricaricaVista();
}
