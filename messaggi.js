/* =====================================================================
   messaggi.js — I testi che nascono dal server, nelle tre lingue.

   Sono di due tipi:
   - i messaggi di errore, che il browser mostra quando qualcosa non va;
   - il contenuto del manuale del dipendente (regole del locale e
     preparazione dei cocktail).

   La lingua arriva dal browser nell'intestazione X-Lang. Se non la
   conosciamo, resta l'italiano.
   ===================================================================== */

const LINGUE = ['it', 'en', 'es'];
const linguaDi = (req) => {
  const l = String((req && req.headers && req.headers['x-lang']) || '').toLowerCase();
  return LINGUE.includes(l) ? l : 'it';
};

/* ---- messaggi di errore: chiave = testo italiano esatto ---- */
const ERRORI = {
  'Token mancante':        { en: 'Missing token', es: 'Falta el token' },
  'Token non valido':      { en: 'Invalid token', es: 'Token no válido' },
  'PIN errato':            { en: 'Wrong PIN', es: 'PIN incorrecto' },
  'Prodotto non trovato':  { en: 'Product not found', es: 'Producto no encontrado' },
  'Dipendente non trovato':{ en: 'Staff member not found', es: 'Empleado no encontrado' },
  'Profilo non trovato':   { en: 'Profile not found', es: 'Perfil no encontrado' },
  'Richiesta non trovata': { en: 'Request not found', es: 'Petición no encontrada' },
  'Sessione non trovata':  { en: 'Stocktake not found', es: 'Inventario no encontrado' },
  'Sessione non aperta':   { en: 'Stocktake is not open', es: 'El inventario no está abierto' },
  'Quantità non valida':   { en: 'Invalid quantity', es: 'Cantidad no válida' },
  'Tipo non valido':       { en: 'Invalid type', es: 'Tipo no válido' },
  'Ruolo non valido':      { en: 'Invalid role', es: 'Puesto no válido' },
  'Decisione non valida':  { en: 'Invalid decision', es: 'Decisión no válida' },
  'Codice vuoto':          { en: 'Empty barcode', es: 'Código vacío' },
  'Serve il nome':         { en: 'A name is required', es: 'Hace falta el nombre' },
  'Serve la postazione':   { en: 'An area is required', es: 'Hace falta la zona' },
  'Scegli il dipendente':  { en: 'Choose the staff member', es: 'Elige el empleado' },
  'Serve la data di inizio': { en: 'A start date is required', es: 'Hace falta la fecha de inicio' },
  'Serve il nome del prodotto':   { en: 'The product name is required', es: 'Hace falta el nombre del producto' },
  'Serve il nome del fornitore':  { en: 'The supplier name is required', es: 'Hace falta el nombre del proveedor' },
  'Serve il nome del profilo':    { en: 'The profile name is required', es: 'Hace falta el nombre del perfil' },
  'Serve il nome della postazione': { en: 'The area name is required', es: 'Hace falta el nombre de la zona' },
  'Tipo di movimento non valido': { en: 'Invalid movement type', es: 'Tipo de movimiento no válido' },
  'Il PIN deve essere di 4 cifre':      { en: 'The PIN must be 4 digits', es: 'El PIN debe tener 4 cifras' },
  'Il nuovo PIN deve essere di 4 cifre':{ en: 'The new PIN must be 4 digits', es: 'El PIN nuevo debe tener 4 cifras' },
  'Il PIN attuale non e\' giusto':      { en: 'The current PIN is wrong', es: 'El PIN actual no es correcto' },
  'Puoi cambiare solo il tuo PIN':      { en: 'You can only change your own PIN', es: 'Solo puedes cambiar tu propio PIN' },
  'Non puoi eliminare il profilo con cui sei entrato':
    { en: 'You cannot delete the profile you are logged in with', es: 'No puedes eliminar el perfil con el que has entrado' },
  'Deve restare almeno un profilo':     { en: 'At least one profile must remain', es: 'Debe quedar al menos un perfil' },
  'E\' l\'unico profilo con accesso completo: non puoi declassarlo':
    { en: 'It is the only profile with full access: you cannot downgrade it',
      es: 'Es el único perfil con acceso completo: no puedes bajarlo de nivel' },
  'C\'e\' gia\' un prodotto con questo nome':   { en: 'A product with this name already exists', es: 'Ya existe un producto con este nombre' },
  'C\'e\' gia\' un dipendente con questo nome': { en: 'A staff member with this name already exists', es: 'Ya existe un empleado con este nombre' },
  'C\'e\' gia\' un profilo con questo nome':    { en: 'A profile with this name already exists', es: 'Ya existe un perfil con este nombre' },
  'C\'e\' gia\' una richiesta in attesa che copre quei giorni':
    { en: 'There is already a pending request covering those days', es: 'Ya hay una petición pendiente que cubre esos días' },
  'La data di fine viene prima di quella di inizio':
    { en: 'The end date comes before the start date', es: 'La fecha de fin es anterior a la de inicio' },
  'Si possono ritirare solo le richieste in attesa':
    { en: 'Only pending requests can be withdrawn', es: 'Solo se pueden retirar las peticiones pendientes' },
  'Si possono annullare solo le sessioni aperte':
    { en: 'Only open stocktakes can be cancelled', es: 'Solo se pueden cancelar los inventarios abiertos' },
  'Postazione usata in un inventario: non si puo\' eliminare':
    { en: 'This area is used in a stocktake: it cannot be deleted', es: 'Esta zona se usa en un inventario: no se puede eliminar' },
  'Codice a barre già usato da un altro prodotto':
    { en: 'Barcode already used by another product', es: 'Código de barras ya usado por otro producto' },
  'Codice non associato a nessun prodotto':
    { en: 'Barcode not linked to any product', es: 'Código no vinculado a ningún producto' },
  'Per svuotare serve la conferma':
    { en: 'Confirmation is required to erase', es: 'Hace falta confirmación para borrar' },
  'Permesso negato (ferie.view)': { en: 'Permission denied (ferie.view)', es: 'Permiso denegado (ferie.view)' },
  'Permesso negato (task.check)': { en: 'Permission denied (task.check)', es: 'Permiso denegado (task.check)' },
};

/* ---- messaggi che finiscono con un pezzo variabile ---- */
const PREFISSI = [
  ['Permesso negato (',            { en: 'Permission denied (',  es: 'Permiso denegado (' }],
  ['Giacenza insufficiente: ',     { en: 'Not enough stock: ',   es: 'Existencias insuficientes: ' }],
  ['Codice già associato a: ',     { en: 'Barcode already linked to: ', es: 'Código ya vinculado a: ' }],
  ['Usato nella ricetta di: ',     { en: 'Used in the recipe of: ',    es: 'Se usa en la receta de: ' }],
  ['Richiesta gia\' decisa (',     { en: 'Request already decided (',  es: 'Petición ya decidida (' }],
];

function traduciErrore(msg, lang) {
  if (lang === 'it' || !msg) return msg;
  const esatto = ERRORI[msg];
  if (esatto && esatto[lang]) return esatto[lang];
  for (const [pre, trad] of PREFISSI) {
    if (msg.startsWith(pre) && trad[lang]) return trad[lang] + msg.slice(pre.length);
  }
  return msg;   // non tradotto: meglio l'italiano che niente
}

/* ---- manuale del dipendente ---- */
const REGOLE = {
  it: [
    'Lavare le mani a inizio turno e indossare la divisa pulita.',
    'HACCP: registrare le temperature dei frigoriferi due volte al giorno.',
    'Vietato fumare nelle aree interne del locale.',
    'Bicchieri/bottiglie rotti vanno segnalati subito al responsabile.',
    'A fine serata: conteggio vuoti, chiusura cassa e pulizia banco.',
    'Servire alcolici solo a maggiorenni; in caso di dubbio chiedere documento.',
  ],
  en: [
    'Wash your hands at the start of the shift and wear a clean uniform.',
    'Food safety: record the fridge temperatures twice a day.',
    'No smoking anywhere inside the venue.',
    'Report broken glasses and bottles to the manager straight away.',
    'End of the night: count the empties, close the till, clean the bar.',
    'Serve alcohol only to adults; if in doubt, ask for ID.',
  ],
  es: [
    'Lávate las manos al empezar el turno y lleva el uniforme limpio.',
    'Seguridad alimentaria: registra las temperaturas de las neveras dos veces al día.',
    'Prohibido fumar dentro del local.',
    'Avisa enseguida al responsable si se rompe un vaso o una botella.',
    'Al cierre: recuento de vacíos, cierre de caja y limpieza de la barra.',
    'Sirve alcohol solo a mayores de edad; en caso de duda, pide el documento.',
  ],
};

const PREPARAZIONI = {
  it: {
    'Negroni': 'Versare gin, bitter e vermouth nel bicchiere con ghiaccio. Mescolare e guarnire con scorza d\'arancia.',
    'Spritz': 'Ghiaccio nel calice, Aperol, prosecco, spruzzo di soda. Guarnire con fetta d\'arancia.',
    'Gin Tonic': 'Gin su ghiaccio abbondante, colmare con tonica fredda. Guarnire con lime.',
    'Americano': 'Bitter e vermouth su ghiaccio, allungare con soda. Guarnire con arancia.',
  },
  en: {
    'Negroni': 'Pour gin, bitter and vermouth over ice. Stir and garnish with an orange twist.',
    'Spritz': 'Ice in the glass, Aperol, prosecco, a splash of soda. Garnish with an orange slice.',
    'Gin Tonic': 'Gin over plenty of ice, top up with cold tonic. Garnish with lime.',
    'Americano': 'Bitter and vermouth over ice, lengthen with soda. Garnish with orange.',
  },
  es: {
    'Negroni': 'Vierte ginebra, bitter y vermut sobre hielo. Remueve y decora con una piel de naranja.',
    'Spritz': 'Hielo en la copa, Aperol, prosecco, un chorrito de soda. Decora con una rodaja de naranja.',
    'Gin Tonic': 'Ginebra sobre hielo abundante, completa con tónica fría. Decora con lima.',
    'Americano': 'Bitter y vermut sobre hielo, alarga con soda. Decora con naranja.',
  },
};

module.exports = { linguaDi, traduciErrore, REGOLE, PREPARAZIONI };
