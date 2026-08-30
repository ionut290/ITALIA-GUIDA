"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BellRing, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Compass,
  ExternalLink, Globe2, Headphones, LocateFixed, Map, MapPin, Navigation, Pause,
  Play, Search, Sparkles, Square, Video, Volume2, Footprints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type PhotoAsset = {
  src: string;
  alt: string;
  credit: string;
  source?: string;
  kind: "photo" | "ai";
};

type Place = {
  id: string; name: string; short: string; story: string; narration: string; curiosity: string;
  category: string; address: string; lat: number; lng: number; minutes: number; free: boolean;
  photos: PhotoAsset[];
  wikiTitle: string;
  video?: { id: string; title: string };
};

type WikiInsight = { title: string; extract: string; pageUrl: string };

type NearbyPlace = {
  pageid: number;
  title: string;
  lat: number;
  lng: number;
  distance: number;
  extract: string;
  pageUrl: string;
  thumbnail?: string;
};

const commonsFile = (name: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1400`;
const commonsPage = (name: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`;

const places: Place[] = [
  {
    id: "nettuno", name: "Piazza del Nettuno", category: "Piazza",
    short: "Il Nettuno del Giambologna e l'ingresso alla Salaborsa.",
    story: "La piazza prende il nome dalla monumentale fontana cinquecentesca del Nettuno, uno dei simboli più riconoscibili di Bologna. Accanto si trova la Salaborsa, biblioteca pubblica ospitata nell'antica sede della Borsa, dove un pavimento trasparente lascia intravedere resti archeologici della città romana.",
    narration: `Fermati al centro della piazza e guarda la fontana come se fosse un piccolo teatro di bronzo e pietra. Fu realizzata nel Cinquecento: l'architetto Tommaso Laureti progettò la struttura, mentre lo scultore fiammingo Jean de Boulogne, conosciuto come Giambologna, modellò il Nettuno e le figure bronzee. Il dio domina la vasca con il tridente alzato. Non rappresenta soltanto il mare: nella Bologna papale evocava anche un potere capace di governare e distribuire l'acqua, una risorsa decisiva per la città. Intorno alla base osserva le ninfe, i putti e i delfini. Ogni elemento anima la composizione e trasforma l'acqua in movimento. Ora allontanati di qualche passo: la statua cambia proporzioni secondo il punto di vista, e proprio la prospettiva ha alimentato una celebre curiosità ottica. Voltandoti verso la Salaborsa incontri un'altra epoca. L'edificio, oggi biblioteca pubblica, sorge sopra strati molto più antichi; dal pavimento trasparente si intravedono resti archeologici che ricordano la Bononia romana. Questa piazza è quindi una soglia tra città monumentale e città sotterranea. Prima di proseguire ascolta il rumore dell'acqua e il passaggio delle persone: il Nettuno non è un oggetto isolato, ma il centro vivo di uno spazio civico che Bologna continua a usare ogni giorno.`,
    curiosity: "Guardando la statua da una precisa pietra della piazza, la prospettiva crea un curioso effetto ottico voluto dallo scultore.",
    wikiTitle: "Fontana_del_Nettuno_(Bologna)",
    video: { id: "JmmPxSVD0d8", title: "Piazza del Nettuno e Piazza Maggiore di notte" },
    photos: [{ src: commonsFile("(Bologna) - Fontana del Nettuno.jpg"), alt: "La Fontana del Nettuno nella piazza", credit: "Wikimedia Commons", source: commonsPage("(Bologna) - Fontana del Nettuno.jpg"), kind: "photo" }],
    address: "Piazza del Nettuno, Bologna", lat: 44.49422, lng: 11.34223, minutes: 8, free: true,
  },
  {
    id: "maggiore", name: "Piazza Maggiore", category: "Piazza",
    short: "Il salotto medievale della città, circondato dai palazzi civici.",
    story: "Cuore della vita cittadina dal Medioevo, Piazza Maggiore è incorniciata da Palazzo d'Accursio, Palazzo del Podestà, Palazzo dei Notai e Palazzo dei Banchi. Al centro si trova il Crescentone, la piattaforma in granito bianco e rosa sulla quale i bolognesi si incontrano ancora oggi.",
    narration: `Entra lentamente in Piazza Maggiore e prova a leggerla come una grande stanza all'aperto. La piazza cominciò a prendere forma nel Duecento, quando il Comune acquistò e demolì edifici per creare uno spazio destinato al mercato e alla vita pubblica. Da allora è diventata il palcoscenico civile di Bologna. Guardando intorno riconosci funzioni diverse: Palazzo d'Accursio racconta il governo cittadino; Palazzo del Podestà e Palazzo Re Enzo ricordano la giustizia e il potere medievale; Palazzo dei Notai richiama una delle corporazioni più influenti; Palazzo dei Banchi ordina il lato orientale con la sua facciata rinascimentale. La Basilica di San Petronio introduce invece la dimensione religiosa, pur essendo nata come grande impresa civica. Al centro si stende il Crescentone, la piattaforma sopraelevata in granito bianco e rosa. È un luogo semplice ma essenziale: qui ci si siede, ci si incontra e si osserva la piazza. Passa poi sotto il voltone del Podestà. Se siete in due, provate a parlare rivolti verso due angoli opposti: la forma delle volte trasporta la voce in modo sorprendente. Tornando al centro, nota come nessun edificio domini completamente gli altri. La forza della piazza nasce dall'equilibrio fra architetture costruite in secoli differenti. È proprio questa continuità d'uso, più della sola bellezza monumentale, a farne il vero salotto della città.`,
    curiosity: "Sotto il voltone del Palazzo del Podestà, due persone poste agli angoli opposti possono parlarsi a bassa voce grazie a un particolare effetto acustico.",
    wikiTitle: "Piazza_Maggiore",
    video: { id: "cJj57iXlIqw", title: "A Day in Bologna" },
    photos: [
      { src: commonsFile("Bologna Piazza Maggiore 3.JPG"), alt: "Piazza Maggiore e i suoi palazzi storici", credit: "Zairon · Wikimedia Commons · CC0", source: commonsPage("Bologna Piazza Maggiore 3.JPG"), kind: "photo" },
      { src: "/images/ai/piazza-maggiore-rinascimento.jpg", alt: "Interpretazione artistica, non documentaria, di Piazza Maggiore nel Rinascimento", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Piazza Maggiore, Bologna", lat: 44.49374, lng: 11.34303, minutes: 10, free: true,
  },
  {
    id: "san-petronio", name: "Basilica di San Petronio", category: "Chiesa",
    short: "La grande basilica dedicata al patrono di Bologna.",
    story: "La costruzione della basilica iniziò nel 1390. La facciata, celebre per il contrasto tra il rivestimento marmoreo inferiore e i mattoni della parte alta, rimase incompiuta. All'interno attraversa il pavimento una grande meridiana realizzata nel Seicento dall'astronomo Giovanni Domenico Cassini.",
    narration: `Mettiti davanti alla facciata e osserva il contrasto netto tra la parte inferiore, rivestita di marmo, e quella superiore, lasciata in mattoni. Non è un restauro incompleto: è il segno visibile di una storia lunga e di un progetto che cambiò nel tempo. La costruzione iniziò nel 1390 su disegno di Antonio di Vincenzo. San Petronio era il vescovo patrono della città e la basilica nacque per volontà del Comune, come espressione dell'identità civica bolognese. Per questo, nonostante le dimensioni monumentali, non è la cattedrale: quel ruolo appartiene a San Pietro. Avvicinandoti ai portali puoi leggere scene scolpite come pagine di pietra. All'interno lo spazio si allarga in grandi navate gotiche, scandite da pilastri e cappelle. Cerca poi la linea della meridiana: nel Seicento l'astronomo Giovanni Domenico Cassini sfruttò un piccolo foro nella copertura per proiettare sul pavimento l'immagine del Sole. A mezzogiorno il raggio luminoso attraversa la linea e permette di misurare con grande precisione il passaggio delle stagioni. È un incontro straordinario tra architettura, fede e scienza. Prima di uscire torna a guardare l'altezza della navata. La basilica non racconta soltanto ciò che fu completato; parla anche delle ambizioni, delle interruzioni e delle trasformazioni con cui una città costruisce la propria immagine nel corso dei secoli.`,
    curiosity: "Non è la cattedrale cittadina: questo ruolo appartiene alla Cattedrale di San Pietro in via Indipendenza.",
    wikiTitle: "Basilica_di_San_Petronio",
    video: { id: "ObBreSoNzZY", title: "Bologna, where every day is special" },
    photos: [{ src: commonsFile("Basilica di San Petronio - Bologna.jpg"), alt: "La facciata della Basilica di San Petronio", credit: "Wikimedia Commons", source: commonsPage("Basilica di San Petronio - Bologna.jpg"), kind: "photo" }],
    address: "Piazza Galvani 5, Bologna", lat: 44.49289, lng: 11.34322, minutes: 12, free: true,
  },
  {
    id: "archiginnasio", name: "Archiginnasio", category: "Università",
    short: "La sede storica dell'Università e il Teatro Anatomico.",
    story: "Costruito nel XVI secolo per riunire in un'unica sede le scuole universitarie, l'Archiginnasio conserva migliaia di stemmi dipinti degli studenti. Al piano superiore si trova il Teatro Anatomico, una sala lignea in cui si tenevano le lezioni di anatomia.",
    narration: `Attraversa il portico ed entra nel cortile dell'Archiginnasio. L'edificio fu costruito tra il 1562 e il 1563 per riunire in una sola sede gli insegnamenti universitari che fino ad allora erano dispersi in città. Il progetto è attribuito ad Antonio Morandi, detto il Terribilia. L'Università di Bologna era già antichissima, ma qui trovò un'immagine architettonica unitaria. Alza lo sguardo verso pareti e volte: migliaia di stemmi ricordano studenti, rettori e docenti provenienti da molte regioni d'Europa. Non sono una semplice decorazione. Costituiscono una grande mappa della comunità internazionale che studiava a Bologna, organizzata nelle scuole dei legisti e degli artisti. Salendo al piano superiore si incontra il Teatro Anatomico, realizzato nel Seicento. La sala, interamente rivestita di legno, dispone gli spettatori attorno al tavolo centrale usato per le dimostrazioni anatomiche. Le statue di medici celebri e le figure degli spellati trasformano la lezione scientifica in una rappresentazione solenne del sapere. Un altro ambiente importante è la sala dello Stabat Mater, legata alla prima esecuzione bolognese dell'opera di Rossini. Durante la seconda guerra mondiale una parte del complesso fu gravemente danneggiata e poi ricostruita. Quando torni nel cortile, pensa agli stemmi come a migliaia di firme: l'Archiginnasio racconta un'università fatta non soltanto di libri, ma di persone, viaggi e incontri attraverso i secoli.`,
    curiosity: "Gli stemmi raccontano la provenienza internazionale degli studenti che raggiungevano Bologna già molti secoli fa.",
    wikiTitle: "Archiginnasio_di_Bologna",
    photos: [{ src: commonsFile("Archiginnasio Bologna.jpg"), alt: "Il cortile dell'Archiginnasio di Bologna", credit: "Dascky81 · Wikimedia Commons", source: commonsPage("Archiginnasio Bologna.jpg"), kind: "photo" }],
    address: "Piazza Galvani 1, Bologna", lat: 44.49219, lng: 11.34369, minutes: 15, free: false,
  },
  {
    id: "quadrilatero", name: "Quadrilatero", category: "Mercato",
    short: "Antico mercato di botteghe, profumi e specialità bolognesi.",
    story: "Tra via Rizzoli, Piazza Maggiore, Piazza Minghetti e Piazza Galvani si estende l'antico quartiere mercantile. I nomi delle strade ricordano le corporazioni medievali, mentre le botteghe espongono ancora pasta fresca, salumi, formaggi, frutta e prodotti della tradizione.",
    narration: `Lascia Piazza Maggiore e imbocca le strade strette del Quadrilatero. Il cambiamento è immediato: lo spazio monumentale si trasforma in una rete compatta di botteghe, portici, banchi e insegne. Questo quartiere conserva l'impronta dell'antico mercato cittadino. I nomi delle vie sono indizi preziosi. Via delle Pescherie Vecchie ricorda i venditori di pesce; via Drapperie richiama i commercianti di stoffe; via Calzolerie e via Clavature rimandano ad altri mestieri e corporazioni. Nel Medioevo le attività si concentravano per settori, creando una geografia economica riconoscibile. Camminando, osserva la larghezza ridotta delle strade e il rapporto diretto tra vetrine e passaggio pedonale. Qui l'architettura non serve a essere guardata da lontano: accompagna il movimento, protegge sotto i portici e mette le merci quasi a portata di mano. Oggi salumi, formaggi, pasta fresca, frutta e specialità locali mantengono viva la vocazione alimentare della zona, anche se il quartiere è cambiato molte volte. Guarda in alto oltre le insegne: sopra le botteghe continuano le facciate delle case, segno che commercio e vita quotidiana hanno sempre condiviso lo stesso spazio. Il Quadrilatero si comprende soprattutto con i sensi: ascolta le voci, nota gli odori, osserva i colori dei banchi. È una parte di Bologna dove la storia non è chiusa in un museo, ma continua a essere usata, venduta, cucinata e raccontata ogni giorno.`,
    curiosity: "Via delle Pescherie Vecchie conserva nel nome e nelle insegne la memoria delle attività che occupavano questa zona.",
    wikiTitle: "Quadrilatero_(Bologna)",
    photos: [{ src: commonsFile("Bologna Via Pescherie Vecchie.jpg"), alt: "Le botteghe di via Pescherie Vecchie nel Quadrilatero", credit: "Andrzej Otrębski · Wikimedia Commons · CC BY-SA", source: commonsPage("Bologna Via Pescherie Vecchie.jpg"), kind: "photo" }],
    address: "Via delle Pescherie Vecchie, Bologna", lat: 44.49331, lng: 11.3443, minutes: 12, free: true,
  },
  {
    id: "santo-stefano", name: "Santo Stefano", category: "Chiesa",
    short: "La piazza triangolare e il complesso delle Sette Chiese.",
    story: "Il complesso di Santo Stefano è formato da edifici religiosi costruiti e trasformati nel corso dei secoli. Attraversando cortili, chiese e chiostri si compie un viaggio attraverso diversi stili e periodi della storia bolognese.",
    narration: `Fermati qualche istante nella piazza e osserva la sua forma: si allarga gradualmente verso il complesso religioso, quasi invitando a entrare. Santo Stefano non è una sola chiesa, ma un insieme di edifici costruiti, trasformati e collegati nel corso di molti secoli. Per questo i bolognesi lo chiamano spesso le Sette Chiese, anche se il numero degli ambienti è cambiato nel tempo. Varcando l'ingresso passi dalla città a un percorso simbolico ispirato ai luoghi della Gerusalemme cristiana. La chiesa del Crocifisso introduce il complesso; la basilica del Santo Sepolcro ne costituisce il cuore evocativo; la chiesa dei Santi Vitale e Agricola conserva la memoria dei primi martiri bolognesi. Proseguendo incontri il Cortile di Pilato e spazi monastici raccolti, dove pietra, mattoni e colonne di provenienze diverse raccontano continue ricostruzioni. Non cercare un'unica simmetria: il fascino nasce proprio dalle irregolarità, dai passaggi stretti e dai cambiamenti di luce. La presenza benedettina contribuì per secoli a custodire e riorganizzare questi luoghi. Uscendo, guarda di nuovo la piazza e i lunghi portici delle case nobiliari. L'esterno elegante e aperto prepara un interno complesso e silenzioso. Santo Stefano è uno dei luoghi migliori per capire come Bologna abbia sovrapposto epoche, devozioni e materiali senza cancellare del tutto ciò che esisteva prima.`,
    curiosity: "Il nome popolare “Sette Chiese” richiama un progetto simbolico ispirato ai luoghi della Gerusalemme cristiana.",
    wikiTitle: "Basilica_di_Santo_Stefano_(Bologna)",
    photos: [{ src: commonsFile("Piazza Santo Stefano - Bologna.jpg"), alt: "Piazza Santo Stefano e il complesso delle Sette Chiese", credit: "Wikimedia Commons", source: commonsPage("Piazza Santo Stefano - Bologna.jpg"), kind: "photo" }],
    address: "Via Santo Stefano 24, Bologna", lat: 44.49203, lng: 11.34877, minutes: 15, free: true,
  },
  {
    id: "due-torri", name: "Le Due Torri", category: "Monumento",
    short: "Asinelli e Garisenda, le sentinelle medievali di Bologna.",
    story: "Le torri degli Asinelli e della Garisenda sono ciò che resta del paesaggio verticale della Bologna medievale. Costruite tra XI e XII secolo, segnavano il prestigio delle famiglie cittadine e svolgevano funzioni difensive e di controllo.",
    narration: `Arrivando in piazza di Porta Ravegnana, alza lo sguardo con calma. Le torri Asinelli e Garisenda non sono soltanto due monumenti: sono ciò che resta di una Bologna medievale molto più verticale di quella attuale. Tra XI e XII secolo numerose famiglie costruirono torri come segni di prestigio, punti di osservazione e strutture difensive. L'Asinelli è la più alta e slanciata; la Garisenda è più bassa e mostra un'inclinazione molto evidente. Avvicinandoti alla base puoi percepire quanto le strade moderne siano cresciute intorno a strutture nate in un mondo completamente diverso. Immagina il profilo urbano punteggiato da torri, case lignee, tetti e campanili: non tutte avevano la stessa funzione, e molte furono abbassate, trasformate o demolite nei secoli successivi. La Garisenda entrò anche nella letteratura. Dante la cita nell'Inferno, quando paragona la sensazione prodotta dalla torre inclinata alla figura gigantesca di Anteo che sembra piegarsi verso chi osserva. Cambia posizione di qualche metro e vedrai mutare il rapporto fra le due torri: a volte sembrano separate, a volte quasi sovrapposte. È un piccolo esperimento di prospettiva urbana. Prima di proseguire verso via Rizzoli o strada Maggiore, guarda ancora una volta verso l'alto. Le Due Torri funzionano come una bussola visiva e condensano in un'unica immagine competizione familiare, tecnica costruttiva, memoria letteraria e identità contemporanea della città.`,
    curiosity: "Dante cita la Garisenda nella Divina Commedia, paragonandone l'inclinazione alla figura del gigante Anteo.",
    wikiTitle: "Torri_di_Bologna",
    video: { id: "ObBreSoNzZY", title: "Bologna, where every day is special" },
    photos: [
      { src: commonsFile("Bologna - Le due torri.jpg"), alt: "Le torri Asinelli e Garisenda viste dal basso", credit: "Bouncey2k · Pubblico dominio", source: commonsPage("Bologna - Le due torri.jpg"), kind: "photo" },
      { src: "/images/ai/bologna-torri-medievali.jpg", alt: "Interpretazione artistica dello skyline medievale ricco di torri", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Piazza di Porta Ravegnana, Bologna", lat: 44.49438, lng: 11.34657, minutes: 12, free: true,
  },
  {
    id: "piella", name: "Finestrella di via Piella", category: "Curiosità",
    short: "Un piccolo affaccio sul Canale delle Moline.",
    story: "La finestrella apre una vista inattesa sul Canale delle Moline. Bologna possedeva una fitta rete di corsi d'acqua utilizzati per alimentare mulini e attività artigianali, in particolare la lavorazione della seta.",
    narration: `Avvicinati alla piccola apertura di via Piella e guarda oltre il muro. La scena sorprende perché Bologna è conosciuta soprattutto per portici, mattoni e torri, mentre qui compare improvvisamente l'acqua del Canale delle Moline. Questa veduta non è soltanto romantica. Ricorda un sistema idraulico che per secoli ha sostenuto l'economia cittadina. Le acque dei canali Reno e Savena venivano distribuite attraverso una rete di chiuse e condotti. La corrente muoveva ruote, mulini e macchine utilizzate nelle attività artigianali. Un ruolo particolarmente importante apparteneva alla produzione della seta, che rese Bologna un centro manifatturiero di rilievo europeo. L'acqua forniva energia alle attrezzature e accompagnava diverse fasi del lavoro. Nel tempo molti tratti dei canali furono coperti dalle strade e incorporati negli edifici, ma non scomparvero: continuano a scorrere sotto e tra le case. La finestrella permette quindi di vedere per un momento un'infrastruttura nascosta. Il soprannome Piccola Venezia descrive bene l'effetto visivo, ma rischia di far dimenticare la storia industriale del luogo. Osserva le facciate affacciate sul canale e immagina il rumore delle ruote e dei laboratori. Poi chiudi e riapri idealmente la finestrella: questo gesto semplice riassume il rapporto di Bologna con l'acqua, una presenza fondamentale che la città moderna ha in gran parte nascosto senza mai eliminarla davvero.`,
    curiosity: "La veduta viene spesso chiamata “Piccola Venezia”, ma racconta soprattutto la storia produttiva e idraulica della città.",
    wikiTitle: "Finestrella_di_via_Piella",
    photos: [
      { src: commonsFile("Finestrella di Via Piella.jpg"), alt: "La finestrella affacciata sul Canale delle Moline", credit: "Donatella Bajo · Wikimedia Commons", source: commonsPage("Finestrella di Via Piella.jpg"), kind: "photo" },
      { src: "/images/ai/canale-moline-seta.jpg", alt: "Interpretazione artistica dei laboratori mossi dall'acqua lungo il Canale delle Moline", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Via Piella 18, Bologna", lat: 44.50037, lng: 11.34617, minutes: 8, free: true,
  },
  {
    id: "san-luca", name: "Santuario di San Luca", category: "Panorama",
    short: "Il santuario sui colli raggiunto dal lungo portico.",
    story: "Il Santuario della Madonna di San Luca domina Bologna dal Colle della Guardia. Da Porta Saragozza lo raggiunge un portico di circa quattro chilometri con oltre seicento arcate, parte dei Portici di Bologna riconosciuti dall'UNESCO.",
    narration: `Il Santuario di San Luca appare sul Colle della Guardia come un punto di riferimento visibile da molte parti di Bologna. Il rapporto tra il santuario e la città si comprende seguendo il lungo portico che sale da Porta Saragozza. La costruzione del percorso coperto iniziò nel Seicento e proseguì nel secolo successivo grazie anche al contributo di cittadini e devoti. Tradizionalmente si contano seicentosessantasei archi: una sequenza che accompagna per circa quattro chilometri dalla pianura fino al colle. Il passaggio più spettacolare è l'Arco del Meloncello, progettato da Carlo Francesco Dotti, dove il portico supera la strada con una curva elegante prima di affrontare la salita. Camminando, osserva come ogni arcata incornici un tratto di paesaggio e misuri il ritmo del percorso. Il portico non è soltanto una protezione dalla pioggia o dal sole: è un'architettura processionale, costruita per accompagnare la devozione legata all'immagine della Madonna di San Luca. Ancora oggi la discesa annuale dell'icona verso la città rinnova questo legame. Arrivato al santuario, guarda Bologna dall'alto e prova a riconoscere la pianura, i tetti e le colline. I portici bolognesi, compreso questo straordinario tratto, sono stati riconosciuti dall'UNESCO nel 2021. Qui il monumento non coincide con un solo edificio: è l'intero viaggio, dalla porta urbana al paesaggio del colle, a dare senso alla meta.`,
    curiosity: "Il percorso coperto ha accompagnato per secoli pellegrini e processioni e oggi è una delle passeggiate più amate dai bolognesi.",
    wikiTitle: "Santuario_della_Madonna_di_San_Luca",
    video: { id: "otllqoNgBUI", title: "Bologna Read by Londoners: San Luca" },
    photos: [{ src: commonsFile("Il Santuario di San Luca a Bologna.jpg"), alt: "Il Santuario della Madonna di San Luca sul colle", credit: "Wikimedia Commons", source: commonsPage("Il Santuario di San Luca a Bologna.jpg"), kind: "photo" }],
    address: "Via di San Luca 36, Bologna", lat: 44.47905, lng: 11.29891, minutes: 25, free: true,
  },
];

const essentialIds = ["nettuno", "maggiore", "san-petronio", "archiginnasio", "quadrilatero", "santo-stefano", "due-torri", "piella"];
const tourPlaceIds: Record<string, string[]> = {
  essential: essentialIds,
  short: ["maggiore", "san-petronio", "quadrilatero", "due-torri"],
  sanluca: ["nettuno", "maggiore", "san-luca"],
};
const tours = [
  { id: "essential", title: "Bologna essenziale", description: "Dal Nettuno alle Due Torri, passando per i luoghi simbolo del centro.", duration: "3 ore", distance: "2,5 km", stops: 8, accent: "terracotta" },
  { id: "short", title: "Un'ora nel cuore", description: "Piazza Maggiore, San Petronio, Quadrilatero e Due Torri.", duration: "1 ora", distance: "1,2 km", stops: 4, accent: "ochre" },
  { id: "sanluca", title: "Verso San Luca", description: "Il portico, la salita e il panorama dal Colle della Guardia.", duration: "2 ore 30", distance: "4 km", stops: 3, accent: "green" },
];

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function curatedAiFor(title: string) {
  const normalized = title.toLowerCase();
  const match = places.find((place) =>
    normalized.includes(place.name.toLowerCase().replace("le ", "")) ||
    normalized.includes(place.wikiTitle.replaceAll("_", " ").replace(/\s*\(.+\)$/, "").toLowerCase()),
  );
  return match?.photos.find((photo) => photo.kind === "ai") ?? null;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const [activeTab, setActiveTab] = useState("scopri");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [currentStop, setCurrentStop] = useState(0);
  const [activeTourId, setActiveTourId] = useState("essential");
  const [mapPlaceId, setMapPlaceId] = useState("maggiore");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [wikiInsight, setWikiInsight] = useState<WikiInsight | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState("");
  const [locationStatus, setLocationStatus] = useState("Trova i luoghi vicini");
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedNearby, setSelectedNearby] = useState<NearbyPlace | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [autoGuideActive, setAutoGuideActive] = useState(false);
  const [nearbyVideo, setNearbyVideo] = useState<string | null>(null);
  const [nearbyVideoLoading, setNearbyVideoLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSearchRef = useRef<{ lat: number; lng: number } | null>(null);
  const announcedRef = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
  }, []);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  useEffect(() => {
    setPhotoIndex(0);
    setWikiInsight(null);
    setWikiError("");
  }, [selected?.id]);
  useEffect(() => {
    if (!selected || speakingId !== selected.id || selected.photos.length < 2) return;
    const timer = window.setInterval(
      () => setPhotoIndex((index) => (index + 1) % selected.photos.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [selected, speakingId]);

  const filteredPlaces = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized ? places.filter((place) => [place.name, place.category, place.short].some((value) => value.toLowerCase().includes(normalized))) : places;
    if (!userPosition) return list;
    return [...list].sort((a, b) => distanceKm(userPosition.lat, userPosition.lng, a.lat, a.lng) - distanceKm(userPosition.lat, userPosition.lng, b.lat, b.lng));
  }, [query, userPosition]);

  const activeTour = tours.find((tour) => tour.id === activeTourId) ?? tours[0];
  const activeTourPlaces = tourPlaceIds[activeTourId].map((id) => places.find((place) => place.id === id)!);
  const activePlace = activeTourPlaces[currentStop];

  function speak(place: Place) {
    if (!("speechSynthesis" in window)) return;
    if (speakingId === place.id) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    setSelected(place);
    setPhotoIndex(0);
    const utterance = new SpeechSynthesisUtterance(`${place.name}. ${place.narration}`);
    utterance.lang = "it-IT"; utterance.rate = 0.93;
    utterance.onend = () => setSpeakingId(null); utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(place.id); window.speechSynthesis.speak(utterance);
  }

  async function loadWikiInsight(place: Place) {
    setWikiLoading(true);
    setWikiError("");
    try {
      const response = await fetch(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(place.wikiTitle)}`);
      if (!response.ok) throw new Error("Approfondimento non disponibile");
      const data = await response.json();
      setWikiInsight({
        title: data.title ?? place.name,
        extract: data.extract ?? "Nessun testo disponibile.",
        pageUrl: data.content_urls?.desktop?.page ?? `https://it.wikipedia.org/wiki/${encodeURIComponent(place.wikiTitle)}`,
      });
    } catch {
      setWikiError("Non è stato possibile caricare l’approfondimento. Controlla la connessione e riprova.");
    } finally {
      setWikiLoading(false);
    }
  }

  async function searchNearby(lat: number, lng: number) {
    setNearbyLoading(true);
    setNearbyError("");
    try {
      const geoUrl = new URL("https://it.wikipedia.org/w/api.php");
      geoUrl.search = new URLSearchParams({
        action: "query", list: "geosearch", gscoord: `${lat}|${lng}`,
        gsradius: "10000", gslimit: "16", gsnamespace: "0", format: "json", origin: "*",
      }).toString();
      const response = await fetch(geoUrl);
      if (!response.ok) throw new Error("Ricerca non disponibile");
      const data = await response.json();
      const nearby = data.query?.geosearch ?? [];
      const detailed: NearbyPlace[] = await Promise.all(nearby.slice(0, 12).map(async (item: any) => {
        try {
          const summaryResponse = await fetch(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`);
          const summary = summaryResponse.ok ? await summaryResponse.json() : {};
          return {
            pageid: item.pageid,
            title: summary.title ?? item.title,
            lat: item.lat,
            lng: item.lon,
            distance: item.dist,
            extract: summary.extract ?? "Apri la scheda per conoscere questo luogo.",
            pageUrl: summary.content_urls?.desktop?.page ?? `https://it.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`,
            thumbnail: summary.thumbnail?.source,
          };
        } catch {
          return {
            pageid: item.pageid, title: item.title, lat: item.lat, lng: item.lon,
            distance: item.dist, extract: "Apri la scheda per conoscere questo luogo.",
            pageUrl: `https://it.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`,
          };
        }
      }));
      setNearbyPlaces(detailed);
      const closest = detailed[0];
      if (closest && closest.distance <= 300 && !announcedRef.current.has(closest.pageid)) {
        announcedRef.current.add(closest.pageid);
        setSelectedNearby(closest);
        void loadNearbyVideo(closest.title);
      }
      return detailed;
    } catch {
      setNearbyError("Non riesco a caricare i luoghi vicini. Controlla la connessione e riprova.");
      return [];
    } finally {
      setNearbyLoading(false);
    }
  }

  async function loadNearbyVideo(title: string) {
    setNearbyVideo(null);
    setNearbyVideoLoading(true);
    try {
      const mediaUrl = new URL("https://it.wikipedia.org/w/api.php");
      mediaUrl.search = new URLSearchParams({ action: "query", prop: "images", titles: title, imlimit: "50", format: "json", origin: "*" }).toString();
      const mediaResponse = await fetch(mediaUrl);
      const mediaData = await mediaResponse.json();
      const page = Object.values(mediaData.query?.pages ?? {})[0] as any;
      const videoTitle = page?.images?.map((image: any) => image.title).find((name: string) => /\.(webm|ogv|ogg)$/i.test(name));
      if (!videoTitle) return;
      const videoUrl = new URL("https://commons.wikimedia.org/w/api.php");
      videoUrl.search = new URLSearchParams({ action: "query", prop: "videoinfo", titles: videoTitle, viprop: "url|mime", format: "json", origin: "*" }).toString();
      const videoResponse = await fetch(videoUrl);
      const videoData = await videoResponse.json();
      const videoPage = Object.values(videoData.query?.pages ?? {})[0] as any;
      setNearbyVideo(videoPage?.videoinfo?.[0]?.url ?? null);
    } catch {
      setNearbyVideo(null);
    } finally {
      setNearbyVideoLoading(false);
    }
  }

  function openNearby(place: NearbyPlace) {
    setSelectedNearby(place);
    void loadNearbyVideo(place.title);
  }

  function speakNearby(place: NearbyPlace) {
    if (!("speechSynthesis" in window)) return;
    const id = `nearby-${place.pageid}`;
    if (speakingId === id) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${place.title}. ${place.extract}`);
    utterance.lang = "it-IT";
    utterance.rate = 0.91;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }

  function toggleAutoGuide() {
    if (!navigator.geolocation) { setNearbyError("GPS non disponibile su questo dispositivo."); return; }
    if (autoGuideActive) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setAutoGuideActive(false);
      setLocationStatus("Guida automatica disattivata");
      return;
    }
    setLocationStatus("Attendo la posizione…");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserPosition(current);
        setAutoGuideActive(true);
        setLocationStatus("Guida automatica attiva");
        const previous = lastSearchRef.current;
        if (!previous || distanceKm(previous.lat, previous.lng, current.lat, current.lng) >= 0.25) {
          lastSearchRef.current = current;
          void searchNearby(current.lat, current.lng);
        }
      },
      () => { setNearbyError("Autorizza la posizione nelle impostazioni del telefono."); setLocationStatus("Posizione non autorizzata"); setAutoGuideActive(false); },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    );
  }

  function locateUser() {
    if (!navigator.geolocation) { setLocationStatus("GPS non disponibile"); return; }
    setLocationStatus("Ricerca posizione…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserPosition(current);
        setLocationStatus("Luoghi aggiornati");
        void searchNearby(current.lat, current.lng);
      },
      () => setLocationStatus("Posizione non autorizzata"), { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function startTour(tourId = "essential") {
    setActiveTourId(tourId);
    setVisited([]);
    setCurrentStop(0);
    setActiveTab("tour");
  }
  function markVisited(id: string) {
    setVisited((current) => current.includes(id) ? current : [...current, id]);
    if (currentStop < activeTourPlaces.length - 1) setCurrentStop((value) => value + 1);
  }

  const mapPlace = selected ?? places.find((place) => place.id === mapPlaceId) ?? places[1];
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapPlace.lng - 0.009}%2C${mapPlace.lat - 0.006}%2C${mapPlace.lng + 0.009}%2C${mapPlace.lat + 0.006}&layer=mapnik&marker=${mapPlace.lat}%2C${mapPlace.lng}`;
  const nearbyAiPhoto = selectedNearby ? curatedAiFor(selectedNearby.title) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActiveTab("scopri")} aria-label="Italia Guida, torna alla scoperta">
          <span className="brand-mark">I</span><span><strong>Italia</strong><small>Guida</small></span>
        </button>
        <div className={`verified-pill ${autoGuideActive ? "live" : ""}`}><LocateFixed size={14} /> {autoGuideActive ? "GPS attivo · rilevamento vicino" : "GPS spento · attivalo quando vuoi"}</div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="app-tabs">
        <TabsList className="desktop-tabs" aria-label="Sezioni principali">
          <TabsTrigger value="scopri"><Compass /> Scopri</TabsTrigger>
          <TabsTrigger value="tour"><Footprints /> Tour</TabsTrigger>
          <TabsTrigger value="mappa"><Map /> Mappa</TabsTrigger>
        </TabsList>

        <TabsContent value="scopri" className="content-area">
          <section className="hero-panel">
            <div className="hero-photo" role="img" aria-label="Piazza Maggiore, uno dei luoghi raccontati dalla guida italiana"><div className="photo-credit">Foto: Zairon · Wikimedia Commons · CC0</div></div>
            <div className="hero-copy">
              <p className="eyebrow"><MapPin size={15} /> Tutta Italia, passo dopo passo</p>
              <h1>L'Italia ti parla quando le passi accanto.</h1>
              <p>Attiva il GPS: l'app trova i luoghi culturali vicini, apre la scheda e prepara audio, fotografia e video quando disponibile.</p>
              <div className="hero-actions">
                <Button size="lg" onClick={toggleAutoGuide} className="primary-action">{autoGuideActive ? <><Square /> Ferma guida automatica</> : <><BellRing /> Attiva guida automatica</>}</Button>
                <Button size="lg" variant="outline" onClick={locateUser}><LocateFixed /> Cerca una volta</Button>
              </div>
              <div className="tour-facts"><span><LocateFixed /> entro 300 m</span><span><MapPin /> fino a 10 km</span><span><Headphones /> audio italiano</span></div>
            </div>
          </section>

          <section className="section-block nearby-section">
            <div className="section-heading compact">
              <div><p className="eyebrow">Rilevamento nazionale</p><h2>Luoghi intorno a te</h2></div>
              <div className="nearby-status">{nearbyLoading ? "Ricerca in corso…" : locationStatus}</div>
            </div>
            {nearbyError && <div className="nearby-error">{nearbyError}</div>}
            {!nearbyLoading && nearbyPlaces.length === 0 && !nearbyError && (
              <div className="nearby-empty"><LocateFixed /><div><strong>Attiva la posizione</strong><span>Quando ti avvicini a un punto culturale, la sua guida comparirà automaticamente. Il rilevamento funziona mentre l'app è aperta.</span></div></div>
            )}
            {nearbyPlaces.length > 0 && (
              <div className="nearby-grid">
                {nearbyPlaces.map((place) => (
                  <button key={place.pageid} className={`nearby-card ${place.distance <= 300 ? "very-close" : ""}`} onClick={() => openNearby(place)}>
                    {place.thumbnail ? <img src={place.thumbnail} alt="" referrerPolicy="no-referrer" /> : <span className="nearby-placeholder"><MapPin /></span>}
                    <span className="nearby-copy"><small>{place.distance < 1000 ? `${Math.round(place.distance)} m` : `${(place.distance / 1000).toFixed(1)} km`}{place.distance <= 300 ? " · Sei vicino" : ""}</small><strong>{place.title}</strong><span>{place.extract}</span></span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div><p className="eyebrow">Percorsi già curati</p><h2>Bologna in dettaglio</h2></div>
              <button className="text-link" onClick={() => setActiveTab("tour")}>Vedi percorso <ArrowRight /></button>
            </div>
            <div className="tour-grid">
              {tours.map((tour, index) => (
                <button key={tour.id} className={`tour-card ${tour.accent}`} onClick={() => startTour(tour.id)}>
                  <span className="tour-number">0{index + 1}</span><span className="tour-duration">{tour.duration}</span>
                  <strong>{tour.title}</strong><span>{tour.description}</span>
                  <small><Footprints /> {tour.distance} <MapPin /> {tour.stops} tappe <ChevronRight /></small>
                </button>
              ))}
            </div>
          </section>

          <section className="section-block places-section">
            <div className="section-heading compact">
              <div><p className="eyebrow">Vicino a te</p><h2>Luoghi da scoprire</h2></div>
              <div className="search-box"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca luogo o categoria" aria-label="Cerca un luogo" /></div>
            </div>
            <div className="place-list">
              {filteredPlaces.map((place, index) => {
                const distance = userPosition ? distanceKm(userPosition.lat, userPosition.lng, place.lat, place.lng) : null;
                return (
                  <button key={place.id} className="place-row" onClick={() => setSelected(place)}>
                    <span className="place-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="place-main"><small>{place.category}{distance !== null ? ` · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}` : ""}</small><strong>{place.name}</strong><span>{place.short}</span></span>
                    <span className="place-meta"><Headphones /> {Math.max(2, Math.ceil(place.narration.split(/\s+/).length / 125))} min audio <ChevronRight /></span>
                  </button>
                );
              })}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="tour" className="content-area">
          <section className="tour-workspace">
            <div className="tour-intro">
              <p className="eyebrow"><Footprints /> Itinerario a piedi</p><h1>{activeTour.title}</h1>
              <p>{activeTour.description}</p>
              <div className="progress-label"><span>{visited.length} di {activeTourPlaces.length} tappe visitate</span><strong>{Math.round((visited.length / activeTourPlaces.length) * 100)}%</strong></div>
              <div className="progress-track"><span style={{ width: `${(visited.length / activeTourPlaces.length) * 100}%` }} /></div>
            </div>

            <div className="current-stop-card">
              <div className="stop-badge">Tappa {currentStop + 1}</div>
              <div className="current-copy"><small>{activePlace.category} · circa {activePlace.minutes} minuti</small><h2>{activePlace.name}</h2><p>{activePlace.short}</p>
                <div className="current-actions">
                  <Button size="lg" onClick={() => speak(activePlace)} className="primary-action">{speakingId === activePlace.id ? <><Pause /> Ferma audio</> : <><Volume2 /> Ascolta la guida</>}</Button>
                  <Button size="lg" variant="outline" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${activePlace.lat},${activePlace.lng}`} target="_blank" rel="noreferrer"><Navigation /> Naviga</a></Button>
                </div>
              </div>
              <button className="story-preview" onClick={() => setSelected(activePlace)}><BookOpen /><span><small>La storia in breve</small>{activePlace.story}</span><ChevronRight /></button>
              <Button variant="secondary" size="lg" onClick={() => markVisited(activePlace.id)} disabled={visited.includes(activePlace.id)}>{visited.includes(activePlace.id) ? <><Check /> Tappa completata</> : <>Segna visitata <ArrowRight /></>}</Button>
            </div>

            <div className="route-list">
              {activeTourPlaces.map((place, index) => (
                <button key={place.id} className={`route-row ${index === currentStop ? "active" : ""}`} onClick={() => setCurrentStop(index)}>
                  <span className={visited.includes(place.id) ? "done" : ""}>{visited.includes(place.id) ? <Check /> : index + 1}</span>
                  <div><small>{place.category}</small><strong>{place.name}</strong></div><ChevronRight />
                </button>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="mappa" className="content-area map-content">
          <section className="map-header"><div><p className="eyebrow"><Map /> Orientati in città</p><h1>Mappa di Bologna</h1><p>Seleziona un luogo e avvia la navigazione.</p></div><Button variant="outline" onClick={locateUser}><LocateFixed /> {locationStatus}</Button></section>
          <section className="map-layout">
            <div className="map-frame"><iframe title={`Mappa di ${mapPlace.name}`} src={mapUrl} loading="lazy" /><div className="map-caption"><MapPin /><span><small>Luogo selezionato</small><strong>{mapPlace.name}</strong></span><Button size="sm" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${mapPlace.lat},${mapPlace.lng}`} target="_blank" rel="noreferrer">Naviga <ExternalLink /></a></Button></div></div>
            <div className="map-places">{places.map((place, index) => <button key={place.id} className={mapPlace.id === place.id ? "selected" : ""} onClick={() => { setMapPlaceId(place.id); setSelected(place); }}><span>{index + 1}</span><div><small>{place.category}</small><strong>{place.name}</strong></div><ChevronRight /></button>)}</div>
          </section>
        </TabsContent>

        <TabsList className="mobile-tabs" aria-label="Navigazione mobile">
          <TabsTrigger value="scopri"><Compass /><span>Scopri</span></TabsTrigger>
          <TabsTrigger value="tour"><Footprints /><span>Tour</span></TabsTrigger>
          <TabsTrigger value="mappa"><Map /><span>Mappa</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <Sheet open={Boolean(selectedNearby)} onOpenChange={(open) => { if (!open) { setSelectedNearby(null); setNearbyVideo(null); } }}>
        <SheetContent side="right" className="place-sheet nearby-sheet">
          {selectedNearby && <>
            <SheetHeader><p className="eyebrow">Guida rilevata vicino a te</p><SheetTitle>{selectedNearby.title}</SheetTitle><SheetDescription>{selectedNearby.distance < 1000 ? `${Math.round(selectedNearby.distance)} metri da te` : `${(selectedNearby.distance / 1000).toFixed(1)} km da te`}</SheetDescription></SheetHeader>
            <div className="sheet-scroll">
              {selectedNearby.thumbnail ? (
                <div className="guide-gallery"><img src={selectedNearby.thumbnail} alt={`Fotografia di ${selectedNearby.title}`} referrerPolicy="no-referrer" /><div className="image-kind">Fotografia reale</div><div className="image-caption"><span>{selectedNearby.title}</span><small>Fonte: Wikipedia / Wikimedia Commons</small></div></div>
              ) : (
                <div className="nearby-image-empty"><MapPin /><span>Fotografia non disponibile per questo luogo</span></div>
              )}
              <div className="audio-box"><Headphones /><div><strong>Audioguida in italiano</strong><span>Testo culturale letto dal telefono</span></div><Button size="icon-lg" onClick={() => speakNearby(selectedNearby)} aria-label={speakingId === `nearby-${selectedNearby.pageid}` ? "Ferma audioguida" : "Avvia audioguida"}>{speakingId === `nearby-${selectedNearby.pageid}` ? <Square /> : <Play />}</Button></div>
              <article><h3>Scopri il luogo</h3><p>{selectedNearby.extract}</p></article>
              {nearbyAiPhoto && <div className="guide-gallery ai-nearby"><img src={nearbyAiPhoto.src} alt={nearbyAiPhoto.alt} /><div className="image-kind ai">Ricostruzione AI</div><div className="image-caption"><span>{nearbyAiPhoto.alt}</span><small>{nearbyAiPhoto.credit}</small></div></div>}
              <section className="video-card" aria-label="Video del luogo">
                <div className="media-heading"><Video /><div><strong>Video del luogo</strong><span>Wikimedia Commons o ricerca esterna</span></div></div>
                {nearbyVideoLoading && <p>Ricerca di un video libero…</p>}
                {nearbyVideo && <div className="video-frame"><video src={nearbyVideo} controls playsInline preload="metadata" /></div>}
                {!nearbyVideoLoading && !nearbyVideo && <Button variant="outline" asChild><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${selectedNearby.title} guida turistica`)}`} target="_blank" rel="noreferrer">Cerca video su YouTube <ExternalLink /></a></Button>}
              </section>
              <div className="source-actions"><a href={selectedNearby.pageUrl} target="_blank" rel="noreferrer">Leggi la fonte completa <ExternalLink /></a><span>Le ricostruzioni generate con AI sono sempre indicate.</span></div>
            </div>
            <SheetFooter><Button size="lg" asChild className="primary-action"><a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedNearby.lat},${selectedNearby.lng}`} target="_blank" rel="noreferrer"><Navigation /> Naviga verso il luogo</a></Button></SheetFooter>
          </>}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="place-sheet">
          {selected && <>
            <SheetHeader><p className="eyebrow">{selected.category}</p><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.address}</SheetDescription></SheetHeader>
            <div className="sheet-scroll">
              <div className="guide-gallery">
                <img
                  src={selected.photos[photoIndex].src}
                  alt={selected.photos[photoIndex].alt}
                  referrerPolicy="no-referrer"
                />
                <div className={`image-kind ${selected.photos[photoIndex].kind}`}>
                  {selected.photos[photoIndex].kind === "ai" ? "Ricostruzione AI" : "Fotografia reale"}
                </div>
                <div className="image-caption">
                  <span>{selected.photos[photoIndex].alt}</span>
                  {selected.photos[photoIndex].source ? (
                    <a href={selected.photos[photoIndex].source} target="_blank" rel="noreferrer">
                      {selected.photos[photoIndex].credit} <ExternalLink />
                    </a>
                  ) : (
                    <small>{selected.photos[photoIndex].credit}</small>
                  )}
                </div>
                {selected.photos.length > 1 && (
                  <>
                    <button className="gallery-arrow previous" onClick={() => setPhotoIndex((photoIndex - 1 + selected.photos.length) % selected.photos.length)} aria-label="Foto precedente"><ChevronLeft /></button>
                    <button className="gallery-arrow next" onClick={() => setPhotoIndex((photoIndex + 1) % selected.photos.length)} aria-label="Foto successiva"><ChevronRight /></button>
                    <div className="gallery-dots">{selected.photos.map((photo, index) => <button key={`${photo.src}-${index}`} className={index === photoIndex ? "active" : ""} onClick={() => setPhotoIndex(index)} aria-label={`Mostra immagine ${index + 1}`} />)}</div>
                  </>
                )}
              </div>
              <div className="audio-box"><Headphones /><div><strong>Audioguida completa</strong><span>Circa {Math.max(2, Math.ceil(selected.narration.split(/\s+/).length / 125))} minuti di ascolto</span></div><Button size="icon-lg" onClick={() => speak(selected)} aria-label={speakingId === selected.id ? "Ferma audioguida" : "Avvia audioguida"}>{speakingId === selected.id ? <Square /> : <Play />}</Button></div>
              <article><h3>La storia</h3><p>{selected.story}</p></article>
              <article className="curiosity"><Sparkles /><div><h3>Lo sapevi?</h3><p>{selected.curiosity}</p></div></article>
              {selected.video && (
                <section className="video-card" aria-label="Video della tappa">
                  <div className="media-heading"><Video /><div><strong>Guarda Bologna</strong><span>Video ufficiale · avvio manuale</span></div></div>
                  <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${selected.video.id}`} title={selected.video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
                  <p>{selected.video.title}</p>
                </section>
              )}
              <section className="api-card" aria-label="Approfondimento online">
                <div className="media-heading"><Globe2 /><div><strong>Approfondimento online</strong><span>Dati su richiesta tramite API pubblica di Wikipedia</span></div></div>
                {!wikiInsight && <Button variant="outline" onClick={() => loadWikiInsight(selected)} disabled={wikiLoading}>{wikiLoading ? "Caricamento…" : "Carica approfondimento"}</Button>}
                {wikiError && <p className="api-error">{wikiError}</p>}
                {wikiInsight && <div className="api-result"><h3>{wikiInsight.title}</h3><p>{wikiInsight.extract}</p><a href={wikiInsight.pageUrl} target="_blank" rel="noreferrer">Continua su Wikipedia <ExternalLink /></a></div>}
              </section>
              <div className="info-row"><span>Accesso esterno</span><strong>{selected.free ? "Gratuito" : "Ingresso interno a pagamento"}</strong></div>
            </div>
            <SheetFooter><Button size="lg" asChild className="primary-action"><a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer"><Navigation /> Naviga verso il luogo</a></Button><Button size="lg" variant="outline" onClick={() => { setMapPlaceId(selected.id); setActiveTab("mappa"); setSelected(null); }}><Map /> Mostra sulla mappa</Button></SheetFooter>
          </>}
        </SheetContent>
      </Sheet>

      <footer className="site-footer"><div><strong>Italia Guida</strong><span>Guida nazionale automatica con contenuti multimediali e AI sempre dichiarata.</span></div><p>I luoghi vicini e le schede sono caricati da Wikimedia. Il GPS resta sul dispositivo e viene usato soltanto per ordinare e rilevare i punti vicini.</p><a href="https://it.wikipedia.org" target="_blank" rel="noreferrer">Fonte nazionale: Wikipedia <ExternalLink /></a></footer>
    </main>
  );
}
