"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BadgeCheck, BatteryLow, BellRing, BookOpen, Camera, Check, ChevronLeft, ChevronRight, CloudRain, Compass,
  Download, ExternalLink, Headphones, LoaderCircle, LocateFixed, Map, MapPin, Navigation, Pause,
  Play, Search, Share2, Shuffle, Sparkles, Square, Stamp, Video, Volume2, Footprints, WandSparkles, ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PoiMap, type PoiMapPoint, type PoiMapViewport } from "@/components/poi-map";

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

type NearbyVideo = {
  url: string;
  title: string;
  type: "video" | "youtube";
};

type NearbyImage = {
  url: string;
  originalUrl?: string;
  title?: string;
};

type GeoSearchItem = { pageid: number; title: string; lat: number; lon: number; dist: number };
type IziNearbyItem = { id: string; iziId: string; name: string; lat: number; lon: number; distance: number; category: string };
type WikiImagesPage = { images?: Array<{ title: string }> };
type WikiVideoPage = { videoinfo?: Array<{ url?: string }> };
type WikiExtractPage = { extract?: string };

type NearbyPlace = {
  pageid: number | string;
  source: "wikipedia" | "izi" | "openstreetmap";
  iziId?: string;
  title: string;
  lat: number;
  lng: number;
  distance: number;
  extract: string;
  pageUrl: string;
  thumbnail?: string;
  category?: string;
  audioUrl?: string;
  images?: NearbyImage[];
  videos?: NearbyVideo[];
  attribution?: string;
};

type OsmPoiItem = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  wikipediaTitle?: string;
  sourceUrl: string;
};

type SmartStop = {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  distance: number;
  nearby?: NearbyPlace;
  curated?: Place;
};

type VisitRecord = {
  id: string;
  title: string;
  category: string;
  visitedAt: string;
  lat: number;
  lng: number;
};

type TravelConditions = {
  temperature?: number;
  rainProbabilityNextHours?: number;
  condition: "good" | "rain" | "severe";
  message: string;
};

type LandmarkRecognition = {
  title: string;
  confidence: number;
  lat?: number;
  lng?: number;
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
    photos: [
      { src: commonsFile("(Bologna) - Fontana del Nettuno.jpg"), alt: "La Fontana del Nettuno nella piazza", credit: "Wikimedia Commons", source: commonsPage("(Bologna) - Fontana del Nettuno.jpg"), kind: "photo" },
      { src: "/images/ai/nettuno-cinquecento.jpg", alt: "Interpretazione artistica della Piazza del Nettuno nel tardo Cinquecento", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
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
    photos: [
      { src: commonsFile("Basilica di San Petronio - Bologna.jpg"), alt: "La facciata della Basilica di San Petronio", credit: "Wikimedia Commons", source: commonsPage("Basilica di San Petronio - Bologna.jpg"), kind: "photo" },
      { src: "/images/ai/piazza-maggiore-rinascimento.jpg", alt: "Interpretazione artistica del contesto storico di San Petronio e Piazza Maggiore", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Piazza Galvani 5, Bologna", lat: 44.49289, lng: 11.34322, minutes: 12, free: true,
  },
  {
    id: "archiginnasio", name: "Archiginnasio", category: "Università",
    short: "La sede storica dell'Università e il Teatro Anatomico.",
    story: "Costruito nel XVI secolo per riunire in un'unica sede le scuole universitarie, l'Archiginnasio conserva migliaia di stemmi dipinti degli studenti. Al piano superiore si trova il Teatro Anatomico, una sala lignea in cui si tenevano le lezioni di anatomia.",
    narration: `Attraversa il portico ed entra nel cortile dell'Archiginnasio. L'edificio fu costruito tra il 1562 e il 1563 per riunire in una sola sede gli insegnamenti universitari che fino ad allora erano dispersi in città. Il progetto è attribuito ad Antonio Morandi, detto il Terribilia. L'Università di Bologna era già antichissima, ma qui trovò un'immagine architettonica unitaria. Alza lo sguardo verso pareti e volte: migliaia di stemmi ricordano studenti, rettori e docenti provenienti da molte regioni d'Europa. Non sono una semplice decorazione. Costituiscono una grande mappa della comunità internazionale che studiava a Bologna, organizzata nelle scuole dei legisti e degli artisti. Salendo al piano superiore si incontra il Teatro Anatomico, realizzato nel Seicento. La sala, interamente rivestita di legno, dispone gli spettatori attorno al tavolo centrale usato per le dimostrazioni anatomiche. Le statue di medici celebri e le figure degli spellati trasformano la lezione scientifica in una rappresentazione solenne del sapere. Un altro ambiente importante è la sala dello Stabat Mater, legata alla prima esecuzione bolognese dell'opera di Rossini. Durante la seconda guerra mondiale una parte del complesso fu gravemente danneggiata e poi ricostruita. Quando torni nel cortile, pensa agli stemmi come a migliaia di firme: l'Archiginnasio racconta un'università fatta non soltanto di libri, ma di persone, viaggi e incontri attraverso i secoli.`,
    curiosity: "Gli stemmi raccontano la provenienza internazionale degli studenti che raggiungevano Bologna già molti secoli fa.",
    wikiTitle: "Archiginnasio_di_Bologna",
    photos: [
      { src: commonsFile("Archiginnasio Bologna.jpg"), alt: "Il cortile dell'Archiginnasio di Bologna", credit: "Dascky81 · Wikimedia Commons", source: commonsPage("Archiginnasio Bologna.jpg"), kind: "photo" },
      { src: "/images/ai/piazza-maggiore-rinascimento.jpg", alt: "Interpretazione artistica della Bologna universitaria e civica del Rinascimento", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Piazza Galvani 1, Bologna", lat: 44.49219, lng: 11.34369, minutes: 15, free: false,
  },
  {
    id: "quadrilatero", name: "Quadrilatero", category: "Mercato",
    short: "Antico mercato di botteghe, profumi e specialità bolognesi.",
    story: "Tra via Rizzoli, Piazza Maggiore, Piazza Minghetti e Piazza Galvani si estende l'antico quartiere mercantile. I nomi delle strade ricordano le corporazioni medievali, mentre le botteghe espongono ancora pasta fresca, salumi, formaggi, frutta e prodotti della tradizione.",
    narration: `Lascia Piazza Maggiore e imbocca le strade strette del Quadrilatero. Il cambiamento è immediato: lo spazio monumentale si trasforma in una rete compatta di botteghe, portici, banchi e insegne. Questo quartiere conserva l'impronta dell'antico mercato cittadino. I nomi delle vie sono indizi preziosi. Via delle Pescherie Vecchie ricorda i venditori di pesce; via Drapperie richiama i commercianti di stoffe; via Calzolerie e via Clavature rimandano ad altri mestieri e corporazioni. Nel Medioevo le attività si concentravano per settori, creando una geografia economica riconoscibile. Camminando, osserva la larghezza ridotta delle strade e il rapporto diretto tra vetrine e passaggio pedonale. Qui l'architettura non serve a essere guardata da lontano: accompagna il movimento, protegge sotto i portici e mette le merci quasi a portata di mano. Oggi salumi, formaggi, pasta fresca, frutta e specialità locali mantengono viva la vocazione alimentare della zona, anche se il quartiere è cambiato molte volte. Guarda in alto oltre le insegne: sopra le botteghe continuano le facciate delle case, segno che commercio e vita quotidiana hanno sempre condiviso lo stesso spazio. Il Quadrilatero si comprende soprattutto con i sensi: ascolta le voci, nota gli odori, osserva i colori dei banchi. È una parte di Bologna dove la storia non è chiusa in un museo, ma continua a essere usata, venduta, cucinata e raccontata ogni giorno.`,
    curiosity: "Via delle Pescherie Vecchie conserva nel nome e nelle insegne la memoria delle attività che occupavano questa zona.",
    wikiTitle: "Quadrilatero_(Bologna)",
    photos: [
      { src: commonsFile("Bologna Via Pescherie Vecchie.jpg"), alt: "Le botteghe di via Pescherie Vecchie nel Quadrilatero", credit: "Andrzej Otrębski · Wikimedia Commons · CC BY-SA", source: commonsPage("Bologna Via Pescherie Vecchie.jpg"), kind: "photo" },
      { src: "/images/ai/canale-moline-seta.jpg", alt: "Interpretazione artistica della Bologna mercantile e manifatturiera", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
    address: "Via delle Pescherie Vecchie, Bologna", lat: 44.49331, lng: 11.3443, minutes: 12, free: true,
  },
  {
    id: "santo-stefano", name: "Santo Stefano", category: "Chiesa",
    short: "La piazza triangolare e il complesso delle Sette Chiese.",
    story: "Il complesso di Santo Stefano è formato da edifici religiosi costruiti e trasformati nel corso dei secoli. Attraversando cortili, chiese e chiostri si compie un viaggio attraverso diversi stili e periodi della storia bolognese.",
    narration: `Fermati qualche istante nella piazza e osserva la sua forma: si allarga gradualmente verso il complesso religioso, quasi invitando a entrare. Santo Stefano non è una sola chiesa, ma un insieme di edifici costruiti, trasformati e collegati nel corso di molti secoli. Per questo i bolognesi lo chiamano spesso le Sette Chiese, anche se il numero degli ambienti è cambiato nel tempo. Varcando l'ingresso passi dalla città a un percorso simbolico ispirato ai luoghi della Gerusalemme cristiana. La chiesa del Crocifisso introduce il complesso; la basilica del Santo Sepolcro ne costituisce il cuore evocativo; la chiesa dei Santi Vitale e Agricola conserva la memoria dei primi martiri bolognesi. Proseguendo incontri il Cortile di Pilato e spazi monastici raccolti, dove pietra, mattoni e colonne di provenienze diverse raccontano continue ricostruzioni. Non cercare un'unica simmetria: il fascino nasce proprio dalle irregolarità, dai passaggi stretti e dai cambiamenti di luce. La presenza benedettina contribuì per secoli a custodire e riorganizzare questi luoghi. Uscendo, guarda di nuovo la piazza e i lunghi portici delle case nobiliari. L'esterno elegante e aperto prepara un interno complesso e silenzioso. Santo Stefano è uno dei luoghi migliori per capire come Bologna abbia sovrapposto epoche, devozioni e materiali senza cancellare del tutto ciò che esisteva prima.`,
    curiosity: "Il nome popolare “Sette Chiese” richiama un progetto simbolico ispirato ai luoghi della Gerusalemme cristiana.",
    wikiTitle: "Basilica_di_Santo_Stefano_(Bologna)",
    photos: [
      { src: commonsFile("Piazza Santo Stefano - Bologna.jpg"), alt: "Piazza Santo Stefano e il complesso delle Sette Chiese", credit: "Wikimedia Commons", source: commonsPage("Piazza Santo Stefano - Bologna.jpg"), kind: "photo" },
      { src: "/images/ai/santo-stefano-medievale.jpg", alt: "Interpretazione artistica del complesso di Santo Stefano nel Medioevo", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
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
    photos: [
      { src: commonsFile("Il Santuario di San Luca a Bologna.jpg"), alt: "Il Santuario della Madonna di San Luca sul colle", credit: "Wikimedia Commons", source: commonsPage("Il Santuario di San Luca a Bologna.jpg"), kind: "photo" },
      { src: "/images/ai/san-luca-portico-storico.jpg", alt: "Interpretazione artistica del pellegrinaggio sotto il portico di San Luca nel Settecento", credit: "Ricostruzione illustrativa generata con AI", kind: "ai" },
    ],
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

function geoErrorMessage(error?: GeolocationPositionError) {
  if (error?.code === 1) return "Posizione non autorizzata. Su iPhone apri Impostazioni → Privacy e sicurezza → Localizzazione → Varga Tour/Safari e scegli ‘Mentre usi l’app’.";
  if (error?.code === 3) return "Il GPS impiega troppo tempo. Vai all’aperto, controlla che la localizzazione sia attiva e riprova.";
  return "Posizione non disponibile. Controlla GPS e connessione, poi riprova.";
}

async function compressLandmarkPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Scegli una fotografia valida.");
  if (file.size > 20 * 1024 * 1024) throw new Error("La foto è troppo grande. Scegline una inferiore a 20 MB.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Non riesco a preparare questa fotografia.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("Non riesco a preparare questa fotografia.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Non riesco a leggere questa fotografia."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function smartInterestScore(place: { title: string; category?: string; extract?: string }, interests: string[]) {
  if (!interests.length || interests.includes("tutto")) return 1;
  const text = `${place.title} ${place.category || ""} ${place.extract || ""}`.toLowerCase();
  const patterns: Record<string, RegExp> = {
    storia: /storic|monument|castell|palazz|piazza|archeolog|torre/,
    arte: /arte|muse|galleri|basilica|chiesa|cattedral|opera/,
    natura: /parco|giardin|natura|panoram|lago|monte|collina/,
    cibo: /mercato|cibo|gastronom|osteria|ristor|food|vino/,
    famiglia: /parco|muse|zoo|acquario|bambin|science|scienza/,
    misteri: /leggenda|mister|segreto|sotterrane|fantasm|curiosità/,
  };
  return interests.reduce((score, interest) => score + (patterns[interest]?.test(text) ? 3 : 0), 0);
}

function youtubeVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function curatedAiFor(title: string) {
  const normalized = title.toLowerCase();
  const match = places.find((place) =>
    normalized.includes(place.name.toLowerCase().replace("le ", "")) ||
    normalized.includes(place.wikiTitle.replaceAll("_", " ").replace(/\s*\(.+\)$/, "").toLowerCase()),
  );
  return match?.photos.find((photo) => photo.kind === "ai") ?? null;
}

function scoreItalianVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  let score = voice.lang.toLowerCase() === "it-it" ? 80 : voice.lang.toLowerCase().startsWith("it") ? 60 : 0;
  if (/neural|natural|premium|enhanced|siri|google|microsoft/.test(name)) score += 35;
  if (/alice|elsa|federica|isabella|diego|cosimo/.test(name)) score += 18;
  if (voice.default) score += 6;
  if (voice.localService) score += 4;
  if (/espeak|compact/.test(name)) score -= 25;
  return score;
}

async function preferredItalianVoice() {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 450);
      const loaded = () => { window.clearTimeout(timer); synth.removeEventListener("voiceschanged", loaded); resolve(); };
      synth.addEventListener("voiceschanged", loaded, { once: true });
    });
    voices = synth.getVoices();
  }
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith("it"))
    .sort((a, b) => scoreItalianVoice(b) - scoreItalianVoice(a))[0] ?? null;
}

function narrationChunks(title: string, text: string) {
  const cleaned = text.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const chunks = [`Sei davanti a ${title}. Prenditi un momento, guarda ciò che hai intorno e lasciati guidare.`];
  for (const sentence of sentences) {
    const parts = sentence.length > 280
      ? sentence.split(/(?<=[,;:])\s+/).reduce<string[]>((items, part) => {
          const previous = items.at(-1);
          if (previous && `${previous} ${part}`.length <= 250) items[items.length - 1] = `${previous} ${part}`;
          else items.push(part);
          return items;
        }, [])
      : [sentence];
    for (const part of parts) {
      const previous = chunks.at(-1);
      if (previous && previous.length < 110 && `${previous} ${part}`.length <= 245) chunks[chunks.length - 1] = `${previous} ${part}`;
      else chunks.push(part.trim());
    }
  }
  return chunks.filter(Boolean);
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
  const [locationStatus, setLocationStatus] = useState("Trova i luoghi vicini");
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedNearby, setSelectedNearby] = useState<NearbyPlace | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [autoGuideActive, setAutoGuideActive] = useState(false);
  const [nearbyVideo, setNearbyVideo] = useState<NearbyVideo | null>(null);
  const [nearbyVideoLoading, setNearbyVideoLoading] = useState(false);
  const [mapAreaPlaces, setMapAreaPlaces] = useState<NearbyPlace[]>([]);
  const [mapViewport, setMapViewport] = useState<PoiMapViewport | null>(null);
  const [mapAreaLoading, setMapAreaLoading] = useState(false);
  const [mapAreaStatus, setMapAreaStatus] = useState("Ingrandisci una zona per caricare i luoghi di tutta Italia");
  const [mapLayer, setMapLayer] = useState<"tourism" | "services">("tourism");
  const [smartDuration, setSmartDuration] = useState(120);
  const [smartInterests, setSmartInterests] = useState<string[]>(["tutto"]);
  const [smartRoute, setSmartRoute] = useState<SmartStop[]>([]);
  const [smartPlannerLoading, setSmartPlannerLoading] = useState(false);
  const [cameraRecognitionLoading, setCameraRecognitionLoading] = useState(false);
  const [cameraRecognitionMessage, setCameraRecognitionMessage] = useState("");
  const [travelConditions, setTravelConditions] = useState<TravelConditions | null>(null);
  const [batteryLow, setBatteryLow] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [offlinePackReady, setOfflinePackReady] = useState(false);
  const [visitHistory, setVisitHistory] = useState<VisitRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try { const saved = JSON.parse(localStorage.getItem("varga-tour-passport") || "[]"); return Array.isArray(saved) ? saved.slice(0, 500) : []; } catch { return []; }
  });
  const [surpriseIndex, setSurpriseIndex] = useState(0);
  const [narrationMode, setNarrationMode] = useState<"breve" | "completa" | "curiosita">("completa");
  const [timePortalReveal, setTimePortalReveal] = useState(52);
  const watchIdRef = useRef<number | null>(null);
  const lastSearchRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMapAreaKeyRef = useRef("");
  const mapAreaRequestRef = useRef<AbortController | null>(null);
  const announcedRef = useRef<Set<number | string>>(new Set());
  const speechRunRef = useRef(0);

  useEffect(() => () => {
    speechRunRef.current += 1;
    window.speechSynthesis?.cancel();
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    mapAreaRequestRef.current?.abort();
  }, []);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    type BatteryManager = { level: number; addEventListener: (name: string, listener: () => void) => void; removeEventListener: (name: string, listener: () => void) => void };
    let battery: BatteryManager | null = null;
    const updateBattery = () => setBatteryLow(Boolean(battery && battery.level <= .2));
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    nav.getBattery?.().then((value) => { battery = value; updateBattery(); battery.addEventListener("levelchange", updateBattery); }).catch(() => undefined);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      battery?.removeEventListener("levelchange", updateBattery);
    };
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPhotoIndex(0);
      setNarrationMode("completa");
      setTimePortalReveal(52);
    });
    return () => window.cancelAnimationFrame(frame);
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

  async function playSpeech(id: string, title: string, text: string, rate: number) {
    if (!("speechSynthesis" in window)) return;
    if (speakingId === id) {
      speechRunRef.current += 1;
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    speechRunRef.current += 1;
    const run = speechRunRef.current;
    window.speechSynthesis.cancel();
    setSpeakingId(id);
    const [voice, chunks] = await Promise.all([
      preferredItalianVoice(),
      Promise.resolve(narrationChunks(title, text.slice(0, 6500))),
    ]);
    if (run !== speechRunRef.current) return;
    const speakChunk = (index: number) => {
      if (run !== speechRunRef.current) return;
      if (index >= chunks.length) { setSpeakingId(null); return; }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = "it-IT";
      if (voice) utterance.voice = voice;
      utterance.rate = index === 0 ? Math.max(0.82, rate - 0.04) : rate;
      utterance.pitch = 0.98;
      utterance.volume = 1;
      utterance.onend = () => window.setTimeout(() => speakChunk(index + 1), /[!?]$/.test(chunks[index]) ? 220 : 125);
      utterance.onerror = () => { if (run === speechRunRef.current) setSpeakingId(null); };
      window.speechSynthesis.speak(utterance);
    };
    speakChunk(0);
  }

  function speak(place: Place) {
    setSelected(place);
    setPhotoIndex(0);
    void playSpeech(place.id, place.name, place.narration, 0.9);
  }

  function speakPlaceMode(place: Place, mode: "breve" | "completa" | "curiosita") {
    setNarrationMode(mode);
    const text = mode === "breve"
      ? `${place.short} ${place.story.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")}`
      : mode === "curiosita"
        ? `${place.curiosity} ${place.story}`
        : place.narration;
    void playSpeech(`${place.id}-${mode}`, place.name, text, mode === "breve" ? .94 : .9);
  }

  async function loadTravelConditions(lat: number, lng: number) {
    try {
      const response = await fetch(`/.netlify/functions/travel-conditions?lat=${lat}&lng=${lng}`);
      if (response.ok) setTravelConditions(await response.json());
    } catch { setTravelConditions(null); }
  }

  async function searchNearby(lat: number, lng: number) {
    setNearbyLoading(true);
    setNearbyError("");
    try {
      const iziRequest = fetch(`/.netlify/functions/izi-guide?action=nearby&lat=${lat}&lon=${lng}&radius=10000`)
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
      const geoUrl = new URL("https://it.wikipedia.org/w/api.php");
      geoUrl.search = new URLSearchParams({
        action: "query", list: "geosearch", gscoord: `${lat}|${lng}`,
        gsradius: "10000", gslimit: "16", gsnamespace: "0", format: "json", origin: "*",
      }).toString();
      const response = await fetch(geoUrl);
      if (!response.ok) throw new Error("Ricerca non disponibile");
      const data = await response.json();
      const nearby = (data.query?.geosearch ?? []) as GeoSearchItem[];
      const detailed: NearbyPlace[] = await Promise.all(nearby.slice(0, 12).map(async (item) => {
        try {
          const summaryResponse = await fetch(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`);
          const summary = summaryResponse.ok ? await summaryResponse.json() : {};
          return {
            pageid: item.pageid,
            source: "wikipedia" as const,
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
            pageid: item.pageid, source: "wikipedia" as const, title: item.title, lat: item.lat, lng: item.lon,
            distance: item.dist, extract: "Apri la scheda per conoscere questo luogo.",
            pageUrl: `https://it.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`,
          };
        }
      }));
      const iziData = await iziRequest as { items?: IziNearbyItem[] } | null;
      const iziPlaces: NearbyPlace[] = Array.isArray(iziData?.items) ? iziData.items.map((item) => ({
        pageid: item.id,
        source: "izi" as const,
        iziId: item.iziId,
        title: item.name,
        lat: item.lat,
        lng: item.lon,
        distance: Number.isFinite(item.distance) ? item.distance : distanceKm(lat, lng, item.lat, item.lon) * 1000,
        category: item.category,
        extract: "Audioguida originale e contenuti multimediali disponibili per questo luogo.",
        pageUrl: "https://izi.travel/it",
      })) : [];
      const combined = [...iziPlaces, ...detailed]
        .filter((place, index, all) => all.findIndex((candidate) =>
          candidate.title.localeCompare(place.title, "it", { sensitivity: "base" }) === 0 &&
          distanceKm(candidate.lat, candidate.lng, place.lat, place.lng) < 0.08,
        ) === index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);
      setNearbyPlaces(combined);
      const closest = combined[0];
      if (closest && closest.distance <= 90 && !announcedRef.current.has(closest.pageid)) {
        announcedRef.current.add(closest.pageid);
        void openNearby(closest);
      }
      return combined;
    } catch {
      setNearbyError("Non riesco a caricare i luoghi vicini. Controlla la connessione e riprova.");
      return [];
    } finally {
      setNearbyLoading(false);
    }
  }

  async function loadNearbyVideo(title: string, preferred: NearbyVideo[] = []) {
    setNearbyVideo(null);
    setNearbyVideoLoading(true);
    try {
      if (preferred.length > 0) {
        setNearbyVideo(preferred[0]);
        return;
      }
      const mediaUrl = new URL("https://it.wikipedia.org/w/api.php");
      mediaUrl.search = new URLSearchParams({ action: "query", prop: "images", titles: title, imlimit: "50", format: "json", origin: "*" }).toString();
      const mediaResponse = await fetch(mediaUrl);
      const mediaData = await mediaResponse.json();
      const page = Object.values(mediaData.query?.pages ?? {})[0] as WikiImagesPage | undefined;
      const videoTitle = page?.images?.map((image) => image.title).find((name) => /\.(webm|ogv|ogg)$/i.test(name));
      if (videoTitle) {
        const videoUrl = new URL("https://commons.wikimedia.org/w/api.php");
        videoUrl.search = new URLSearchParams({ action: "query", prop: "videoinfo", titles: videoTitle, viprop: "url|mime", format: "json", origin: "*" }).toString();
        const videoResponse = await fetch(videoUrl);
        const videoData = await videoResponse.json();
        const videoPage = Object.values(videoData.query?.pages ?? {})[0] as WikiVideoPage | undefined;
        const commonsUrl = videoPage?.videoinfo?.[0]?.url;
        if (commonsUrl) {
          setNearbyVideo({ type: "video", url: commonsUrl, title });
          return;
        }
      }
      const youtubeResponse = await fetch(`/.netlify/functions/youtube-search?q=${encodeURIComponent(title)}`);
      if (youtubeResponse.ok) {
        const youtubeData = await youtubeResponse.json();
        if (youtubeData.configured && youtubeData.items?.[0]) setNearbyVideo(youtubeData.items[0]);
      }
    } catch {
      setNearbyVideo(null);
    } finally {
      setNearbyVideoLoading(false);
    }
  }

  async function openNearby(place: NearbyPlace) {
    setSelectedNearby(place);
    if (place.source === "izi" && place.iziId) {
      setNearbyVideoLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/izi-guide?action=detail&id=${encodeURIComponent(place.iziId)}`);
        if (!response.ok) throw new Error("Audioguida non disponibile");
        const data = await response.json();
        if (!data.item) throw new Error("Audioguida non disponibile");
        const enriched: NearbyPlace = {
          ...place,
          extract: data.item.description || place.extract,
          thumbnail: data.item.images?.[0]?.url || place.thumbnail,
          images: data.item.images,
          audioUrl: data.item.audioUrl,
          videos: data.item.videos,
          pageUrl: data.item.sourceUrl || place.pageUrl,
          attribution: data.item.attribution,
        };
        setSelectedNearby(enriched);
        await loadNearbyVideo(enriched.title, enriched.videos);
        return;
      } catch {
        await loadNearbyVideo(place.title);
        return;
      }
    }

    try {
      const detailUrl = new URL("https://it.wikipedia.org/w/api.php");
      detailUrl.search = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", redirects: "1", titles: place.title, format: "json", origin: "*" }).toString();
      const detailResponse = await fetch(detailUrl);
      const detailData = detailResponse.ok ? await detailResponse.json() : null;
      const page = Object.values(detailData?.query?.pages ?? {})[0] as WikiExtractPage | undefined;
      if (page?.extract) {
        const enriched = { ...place, extract: String(page.extract).slice(0, 16000) };
        setSelectedNearby(enriched);
      }
    } catch {
      // La sintesi breve già caricata resta disponibile.
    }
    await loadNearbyVideo(place.title);
  }

  function speakNearby(place: NearbyPlace) {
    const id = `nearby-${place.pageid}`;
    void playSpeech(id, place.title, place.extract, 0.89);
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
        void loadTravelConditions(current.lat, current.lng);
        const previous = lastSearchRef.current;
        if (!previous || distanceKm(previous.lat, previous.lng, current.lat, current.lng) >= 0.25) {
          lastSearchRef.current = current;
          void searchNearby(current.lat, current.lng);
        }
      },
      (error) => { setNearbyError(geoErrorMessage(error)); setLocationStatus("Posizione non autorizzata"); setAutoGuideActive(false); },
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
        void loadTravelConditions(current.lat, current.lng);
      },
      (error) => { setNearbyError(geoErrorMessage(error)); setLocationStatus("Posizione non autorizzata"); }, { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function getCurrentPosition() {
    if (userPosition) return userPosition;
    if (!navigator.geolocation) throw new Error("GPS non disponibile");
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    ));
  }

  async function createSmartRoute() {
    setSmartPlannerLoading(true);
    setNearbyError("");
    try {
      const position = await getCurrentPosition();
      setUserPosition(position);
      const found = nearbyPlaces.length ? nearbyPlaces : await searchNearby(position.lat, position.lng);
      void loadTravelConditions(position.lat, position.lng);
      const maxStops = batteryLow ? Math.min(4, Math.max(2, Math.floor(smartDuration / 24))) : Math.min(14, Math.max(2, Math.floor(smartDuration / 22)));
      const rainMode = travelConditions?.condition === "rain" || travelConditions?.condition === "severe";
      const indoor = /muse|galleri|chiesa|basilica|palazz|bibliotec|teatro|mercato/i;
      const route = found.filter((place) => !visitHistory.some((visit) => visit.id === `nearby-${place.pageid}`)).map<SmartStop>((place) => ({
        id: `nearby-${place.pageid}`, title: place.title, category: place.category || "Luogo turistico", lat: place.lat, lng: place.lng,
        distance: place.distance, nearby: place,
      })).map((stop) => ({ stop, score: smartInterestScore({ title: stop.title, category: stop.category, extract: stop.nearby?.extract }, smartInterests) + (rainMode && indoor.test(`${stop.category} ${stop.title}`) ? 4 : 0) - stop.distance / 4000 }))
        .sort((a, b) => b.score - a.score || a.stop.distance - b.stop.distance)
        .slice(0, maxStops)
        .map((item) => item.stop)
        .sort((a, b) => a.distance - b.distance);
      setSmartRoute(route);
      if (!route.length) setNearbyError("Non ho trovato abbastanza tappe in questa zona. Prova ad aumentare la durata o selezionare ‘Tutto’. ");
    } catch (error) {
      const geoError = error && typeof error === "object" && "code" in error ? error as GeolocationPositionError : undefined;
      setNearbyError(geoError ? geoErrorMessage(geoError) : "Per creare il percorso devi autorizzare la posizione.");
    } finally { setSmartPlannerLoading(false); }
  }

  function toggleSmartInterest(value: string) {
    setSmartInterests((current) => value === "tutto"
      ? ["tutto"]
      : current.includes(value)
        ? (current.filter((item) => item !== value).length ? current.filter((item) => item !== value) : ["tutto"])
        : [...current.filter((item) => item !== "tutto"), value]);
  }

  function openSmartStop(stop: SmartStop) {
    if (stop.nearby) void openNearby(stop.nearby);
    else if (stop.curated) setSelected(stop.curated);
  }

  function saveVisit(record: Omit<VisitRecord, "visitedAt">) {
    setVisitHistory((current) => {
      const next = [{ ...record, visitedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== record.id)].slice(0, 500);
      localStorage.setItem("varga-tour-passport", JSON.stringify(next));
      return next;
    });
  }

  function surpriseMe() {
    const candidates = nearbyPlaces.filter((place) => !visitHistory.some((visit) => visit.id === `nearby-${place.pageid}`));
    const place = candidates[surpriseIndex % Math.max(1, candidates.length)] || nearbyPlaces[0];
    setSurpriseIndex((current) => current + 1);
    if (place) void openNearby(place);
    else { setNearbyError("Attiva la posizione per ricevere una sorpresa vicino a te."); locateUser(); }
  }

  async function shareText(title: string, text: string) {
    try {
      if (navigator.share) await navigator.share({ title, text, url: location.href });
      else { await navigator.clipboard.writeText(`${title}\n${text}\n${location.href}`); setLocationStatus("Testo copiato"); }
    } catch {}
  }

  async function shareActiveTour() {
    const route = activeTourPlaces.map((place, index) => `${index + 1}. ${place.name}`).join("\n");
    await shareText(`Varga Tour · ${activeTour.title}`, `${activeTour.description}\n\n${route}`);
  }

  async function downloadOfflinePack() {
    try {
      const registration = await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({ type: "CACHE_OFFLINE_PACK" });
      setOfflinePackReady(true);
    } catch { setOfflinePackReady(false); }
  }

  async function resolveRecognizedLandmark(landmark: LandmarkRecognition) {
    const search = new URLSearchParams({
      action: "query", generator: "search", gsrsearch: landmark.title, gsrnamespace: "0", gsrlimit: "5",
      prop: "coordinates|extracts|pageimages|info", exintro: "1", explaintext: "1", inprop: "url",
      pithumbsize: "1200", redirects: "1", format: "json", origin: "*",
    });
    try {
      const response = await fetch(`https://it.wikipedia.org/w/api.php?${search}`);
      if (!response.ok) throw new Error("Scheda non disponibile");
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {}) as Array<{
        pageid?: number; title?: string; extract?: string; fullurl?: string; thumbnail?: { source?: string };
        coordinates?: Array<{ lat?: number; lon?: number }>;
      }>;
      const recognizedLat = Number.isFinite(landmark.lat) ? Number(landmark.lat) : undefined;
      const recognizedLng = Number.isFinite(landmark.lng) ? Number(landmark.lng) : undefined;
      const best = pages.sort((a, b) => {
        if (recognizedLat === undefined || recognizedLng === undefined) return 0;
        const aCoordinate = a.coordinates?.[0];
        const bCoordinate = b.coordinates?.[0];
        const aDistance = Number.isFinite(aCoordinate?.lat) && Number.isFinite(aCoordinate?.lon) ? distanceKm(recognizedLat, recognizedLng, Number(aCoordinate!.lat), Number(aCoordinate!.lon)) : Number.MAX_SAFE_INTEGER;
        const bDistance = Number.isFinite(bCoordinate?.lat) && Number.isFinite(bCoordinate?.lon) ? distanceKm(recognizedLat, recognizedLng, Number(bCoordinate!.lat), Number(bCoordinate!.lon)) : Number.MAX_SAFE_INTEGER;
        return aDistance - bDistance;
      })[0];
      const coordinate = best?.coordinates?.[0];
      const lat = Number.isFinite(coordinate?.lat) ? Number(coordinate!.lat) : recognizedLat;
      const lng = Number.isFinite(coordinate?.lon) ? Number(coordinate!.lon) : recognizedLng;
      if (!best?.title || lat === undefined || lng === undefined) throw new Error("Coordinate non disponibili");
      return {
        pageid: best.pageid ?? `camera-${best.title}`,
        source: "wikipedia" as const,
        title: best.title,
        lat,
        lng,
        distance: userPosition ? distanceKm(userPosition.lat, userPosition.lng, lat, lng) * 1000 : 0,
        extract: best.extract || `Monumento riconosciuto dalla fotografia con confidenza ${Math.round(landmark.confidence * 100)}%.`,
        pageUrl: best.fullurl || `https://it.wikipedia.org/wiki/${encodeURIComponent(best.title.replaceAll(" ", "_"))}`,
        thumbnail: best.thumbnail?.source,
      } satisfies NearbyPlace;
    } catch {
      if (!Number.isFinite(landmark.lat) || !Number.isFinite(landmark.lng)) throw new Error("Ho riconosciuto il soggetto, ma non riesco a trovare la sua scheda.");
      const lat = Number(landmark.lat);
      const lng = Number(landmark.lng);
      return {
        pageid: `camera-${landmark.title}`,
        source: "wikipedia" as const,
        title: landmark.title,
        lat,
        lng,
        distance: userPosition ? distanceKm(userPosition.lat, userPosition.lng, lat, lng) * 1000 : 0,
        extract: `Monumento riconosciuto dalla fotografia con confidenza ${Math.round(landmark.confidence * 100)}%.`,
        pageUrl: `https://it.wikipedia.org/w/index.php?search=${encodeURIComponent(landmark.title)}`,
      } satisfies NearbyPlace;
    }
  }

  async function recognizeFromCamera(file: File) {
    if (!isOnline) {
      const message = "Per analizzare una fotografia serve una connessione Internet.";
      setCameraRecognitionMessage(message);
      setNearbyError(message);
      return;
    }
    setCameraRecognitionLoading(true);
    setCameraRecognitionMessage("");
    setNearbyError("");
    setLocationStatus("Analizzo la fotografia…");
    try {
      const image = await compressLandmarkPhoto(file);
      const response = await fetch("/.netlify/functions/recognize-landmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Non riesco ad analizzare la fotografia in questo momento.");
      const landmark = data.landmark as LandmarkRecognition | undefined;
      if (!landmark?.title) throw new Error("Non riconosco un monumento in questa fotografia. Prova a inquadrarlo per intero e con buona luce.");
      const place = await resolveRecognizedLandmark(landmark);
      setLocationStatus(`Riconosciuto: ${place.title}`);
      await openNearby(place);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Non riesco ad analizzare la fotografia in questo momento.";
      setCameraRecognitionMessage(message);
      setNearbyError(message);
      setLocationStatus("Riconoscimento non riuscito");
    } finally {
      setCameraRecognitionLoading(false);
    }
  }

  async function loadMapArea(viewport: PoiMapViewport, requestedLayer = mapLayer) {
    setMapViewport(viewport);
    const intersectsItaly = viewport.north >= 35.2 && viewport.south <= 47.2 && viewport.east >= 6.3 && viewport.west <= 18.9;
    if (!intersectsItaly) {
      mapAreaRequestRef.current?.abort();
      setMapAreaPlaces([]);
      setMapAreaLoading(false);
      setMapAreaStatus("Sposta la mappa sull’Italia");
      return;
    }
    if (viewport.zoom < 10) {
      mapAreaRequestRef.current?.abort();
      setMapAreaPlaces([]);
      setMapAreaLoading(false);
      setMapAreaStatus("Ingrandisci la mappa per visualizzare tutti i pin della zona");
      return;
    }

    const key = [viewport.south, viewport.west, viewport.north, viewport.east]
      .map((value) => value.toFixed(3)).join(":");
    const layerKey = `${requestedLayer}:${key}`;
    if (layerKey === lastMapAreaKeyRef.current) return;
    lastMapAreaKeyRef.current = layerKey;
    mapAreaRequestRef.current?.abort();
    const controller = new AbortController();
    mapAreaRequestRef.current = controller;
    setMapAreaLoading(true);
    setMapAreaStatus("Carico monumenti e punti di interesse…");

    try {
      const query = new URLSearchParams({
        south: String(viewport.south), west: String(viewport.west), north: String(viewport.north), east: String(viewport.east), zoom: String(viewport.zoom), layer: requestedLayer,
      });
      const response = await fetch(`/.netlify/functions/osm-pois?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Ricerca non disponibile");
      const data = await response.json() as { items?: OsmPoiItem[]; truncated?: boolean };
      const items = Array.isArray(data.items) ? data.items : [];
      setMapAreaPlaces(items.map((item) => ({
        pageid: item.id,
        source: "openstreetmap" as const,
        title: item.name,
        lat: item.lat,
        lng: item.lng,
        distance: -1,
        category: item.category,
        extract: requestedLayer === "services" ? "Servizio utile presente nella banca dati OpenStreetMap. Verifica dettagli, orari e indicazioni nella scheda." : "Punto di interesse presente nella banca dati OpenStreetMap. Apri la scheda per cercare descrizione, audio, fotografie e video disponibili.",
        pageUrl: item.sourceUrl,
      })));
      setMapAreaStatus(`${items.length} ${requestedLayer === "services" ? "servizi utili" : "luoghi"} visibili${data.truncated ? " · aumenta lo zoom per vederli tutti" : ""}`);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setMapAreaPlaces([]);
      setMapAreaStatus("Impossibile caricare i pin: riprova spostando la mappa");
    } finally {
      if (mapAreaRequestRef.current === controller) setMapAreaLoading(false);
    }
  }

  function startTour(tourId = "essential") {
    setActiveTourId(tourId);
    setVisited([]);
    setCurrentStop(0);
    setActiveTab("tour");
  }
  function markVisited(id: string) {
    setVisited((current) => current.includes(id) ? current : [...current, id]);
    const place = activeTourPlaces.find((item) => item.id === id);
    if (place) saveVisit({ id: place.id, title: place.name, category: place.category, lat: place.lat, lng: place.lng });
    if (currentStop < activeTourPlaces.length - 1) setCurrentStop((value) => value + 1);
  }

  const mapDisplayPoints = useMemo(() => {
    const isVisible = (lat: number, lng: number) => !mapViewport || (
      lat >= mapViewport.south && lat <= mapViewport.north && lng >= mapViewport.west && lng <= mapViewport.east
    );
    const curated = places
      .filter((place) => isVisible(place.lat, place.lng))
      .map<PoiMapPoint>((place) => ({ id: place.id, name: place.name, category: place.category, lat: place.lat, lng: place.lng, source: "curated" }));
    const dynamic = [...nearbyPlaces, ...mapAreaPlaces].filter((place) => isVisible(place.lat, place.lng)).map<PoiMapPoint>((place) => ({
      id: `nearby-${place.pageid}`,
      name: place.title,
      category: place.category || "Punto di interesse",
      lat: place.lat,
      lng: place.lng,
      source: place.source,
    }));
    const ordered = [...dynamic.filter((point) => point.source === "izi"), ...curated, ...dynamic.filter((point) => point.source !== "izi")];
    return ordered.filter((point, index, all) => all.findIndex((candidate) =>
      candidate.name.localeCompare(point.name, "it", { sensitivity: "base" }) === 0 &&
      distanceKm(candidate.lat, candidate.lng, point.lat, point.lng) < 0.08,
    ) === index).slice(0, 320);
  }, [mapAreaPlaces, mapViewport, nearbyPlaces]);
  const mapPlace = mapDisplayPoints.find((place) => place.id === mapPlaceId) ?? mapDisplayPoints[0];
  const nearbyAiPhoto = selectedNearby ? curatedAiFor(selectedNearby.title) : null;
  const nearbyYoutubeId = nearbyVideo?.type === "youtube" ? youtubeVideoId(nearbyVideo.url) : null;

  function selectMapPoint(id: string) {
    setMapPlaceId(id);
    const curated = places.find((place) => place.id === id);
    if (curated) {
      setSelected(curated);
      return;
    }
    const nearby = [...nearbyPlaces, ...mapAreaPlaces].find((place) => `nearby-${place.pageid}` === id);
    if (nearby) void openNearby(nearby);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActiveTab("scopri")} aria-label="Varga Tour, torna alla scoperta">
          <span className="brand-mark">V</span><span><strong>Varga</strong><small>Tour</small></span>
        </button>
        <div className={`verified-pill ${autoGuideActive ? "live" : ""}`}><LocateFixed size={14} /> {autoGuideActive ? "GPS attivo · rilevamento vicino" : "GPS spento · attivalo quando vuoi"}</div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="app-tabs">
        <TabsList className="desktop-tabs" aria-label="Sezioni principali">
          <TabsTrigger value="scopri"><Compass /> Scopri</TabsTrigger>
          <TabsTrigger value="tour"><Footprints /> Tour</TabsTrigger>
          <TabsTrigger value="mappa"><Map /> Mappa</TabsTrigger>
          <TabsTrigger value="passaporto"><Stamp /> Passaporto</TabsTrigger>
        </TabsList>

        <TabsContent value="scopri" className="content-area">
          <section className="hero-panel">
            <div className="hero-photo" role="img" aria-label="Piazza Maggiore, uno dei luoghi raccontati dalla guida italiana"><div className="photo-credit">Foto: Zairon · Wikimedia Commons · CC0</div></div>
            <div className="hero-copy">
              <p className="eyebrow"><MapPin size={15} /> Tutta Italia, passo dopo passo</p>
              <h1>L&apos;Italia ti parla quando le passi accanto.</h1>
              <p>Dimmi quanto tempo hai: Varga Tour trova i luoghi vicini, crea il percorso e ti accompagna con audio, foto, video, orari e prenotazioni.</p>
              <div className="hero-actions">
                <Button size="lg" onClick={() => document.getElementById("smart-planner")?.scrollIntoView({ behavior: "smooth" })} className="primary-action"><WandSparkles /> Guidami da qui</Button>
                <Button size="lg" variant="outline" onClick={toggleAutoGuide}>{autoGuideActive ? <><Square /> Ferma guida automatica</> : <><BellRing /> Guida automatica</>}</Button>
                <Button size="lg" variant="outline" onClick={surpriseMe}><Shuffle /> Sorprendimi</Button>
                <label className={`camera-recognition ${cameraRecognitionLoading ? "loading" : ""}`} aria-busy={cameraRecognitionLoading}>
                  {cameraRecognitionLoading ? <LoaderCircle className="spin" size={17} /> : <Camera size={17} />}
                  {cameraRecognitionLoading ? "Analizzo la foto…" : "Cosa sto guardando?"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={cameraRecognitionLoading}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void recognizeFromCamera(file);
                    }}
                  />
                </label>
              </div>
              {cameraRecognitionMessage && <div className="camera-recognition-feedback" role="alert">{cameraRecognitionMessage}</div>}
              <div className="tour-facts"><span><LocateFixed /> avvio entro 90 m</span><span><MapPin /> tutta Italia</span><span><Headphones /> 3 racconti</span></div>
            </div>
          </section>

          <section className="section-block smart-planner" id="smart-planner">
            <div className="smart-planner-copy"><p className="eyebrow"><WandSparkles /> Percorso intelligente</p><h2>Quanto tempo hai?</h2><p>Il percorso parte dalla tua posizione, evita le tappe già viste e si adatta a interessi, pioggia, batteria e connessione.</p></div>
            <div className="smart-options">
              <div><small>Durata</small><div className="choice-row">{[{ value: 30, label: "30 min" }, { value: 60, label: "1 ora" }, { value: 120, label: "2 ore" }, { value: 240, label: "Mezza giornata" }, { value: 480, label: "Giornata" }].map((item) => <button key={item.value} className={smartDuration === item.value ? "selected" : ""} onClick={() => setSmartDuration(item.value)}>{item.label}</button>)}</div></div>
              <div><small>Interessi</small><div className="choice-row">{[{ value: "tutto", label: "Tutto" }, { value: "storia", label: "Storia" }, { value: "arte", label: "Arte" }, { value: "misteri", label: "Misteri" }, { value: "natura", label: "Natura" }, { value: "cibo", label: "Cibo" }, { value: "famiglia", label: "Famiglia" }].map((item) => <button key={item.value} className={smartInterests.includes(item.value) ? "selected" : ""} onClick={() => toggleSmartInterest(item.value)}>{item.label}</button>)}</div></div>
              <Button size="lg" className="primary-action smart-create" onClick={() => void createSmartRoute()} disabled={smartPlannerLoading}>{smartPlannerLoading ? "Creo il percorso…" : <><Navigation /> Crea il mio percorso</>}</Button>
            </div>
            <div className="adaptive-status">
              {travelConditions && <span className={travelConditions.condition}><CloudRain /> {travelConditions.message}{Number.isFinite(travelConditions.temperature) ? ` · ${Math.round(travelConditions.temperature!)}°` : ""}</span>}
              {batteryLow && <span className="warning"><BatteryLow /> Batteria bassa: percorso compatto</span>}
              {!isOnline && <span className="warning"><Download /> Offline: uso i contenuti salvati</span>}
            </div>
            {smartRoute.length > 0 && <div className="smart-route-result"><div className="smart-route-title"><div><BadgeCheck /><span><strong>Il tuo Varga Tour è pronto</strong><small>{smartRoute.length} tappe · circa {smartDuration} minuti</small></span></div><button onClick={() => void shareText("Il mio Varga Tour", smartRoute.map((stop, index) => `${index + 1}. ${stop.title}`).join("\n"))}><Share2 /> Condividi</button></div><div className="smart-stop-list">{smartRoute.map((stop, index) => <button key={stop.id} onClick={() => openSmartStop(stop)}><span>{index + 1}</span><div><small>{stop.category}{stop.distance >= 0 ? ` · ${stop.distance < 1000 ? `${Math.round(stop.distance)} m` : `${(stop.distance / 1000).toFixed(1)} km`}` : ""}</small><strong>{stop.title}</strong></div><ChevronRight /></button>)}</div></div>}
          </section>

          <section className="section-block nearby-section">
            <div className="section-heading compact">
              <div><p className="eyebrow">Rilevamento nazionale</p><h2>Luoghi intorno a te</h2></div>
              <div className="nearby-status">{nearbyLoading ? "Ricerca in corso…" : locationStatus}</div>
            </div>
            {nearbyError && <div className="nearby-error">{nearbyError}</div>}
            {!nearbyLoading && nearbyPlaces.length === 0 && !nearbyError && (
              <div className="nearby-empty"><LocateFixed /><div><strong>Attiva la posizione</strong><span>Quando ti avvicini a un punto culturale, la sua guida comparirà automaticamente. Il rilevamento funziona mentre l&apos;app è aperta.</span></div></div>
            )}
            {nearbyPlaces.length > 0 && (
              <div className="nearby-grid">
                {nearbyPlaces.map((place) => (
                  <button key={place.pageid} className={`nearby-card ${place.distance <= 300 ? "very-close" : ""}`} onClick={() => void openNearby(place)}>
                    {place.thumbnail ? <img src={place.thumbnail} alt="" referrerPolicy="no-referrer" /> : <span className="nearby-placeholder"><MapPin /></span>}
                    <span className="nearby-copy"><small>{place.source === "izi" ? "🎧 izi.TRAVEL · " : ""}{place.distance < 1000 ? `${Math.round(place.distance)} m` : `${(place.distance / 1000).toFixed(1)} km`}{place.distance <= 300 ? " · Sei vicino" : ""}</small><strong>{place.title}</strong><span>{place.category || place.extract}</span></span>
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
              <p>{activeTour.description}</p><button className="tour-share" onClick={() => void shareActiveTour()}><Share2 /> Modalità gruppo · condividi percorso</button>
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
          <section className="map-header"><div><p className="eyebrow"><Map /> Monumenti e punti di interesse</p><h1>Mappa turistica d’Italia</h1><p>Sposta e ingrandisci la mappa: scegli tra luoghi da visitare e servizi utili.</p></div><div className="map-header-actions"><div className="map-layer-switch"><button className={mapLayer === "tourism" ? "active" : ""} onClick={() => { setMapLayer("tourism"); lastMapAreaKeyRef.current = ""; if (mapViewport) void loadMapArea(mapViewport, "tourism"); }}>Da visitare</button><button className={mapLayer === "services" ? "active" : ""} onClick={() => { setMapLayer("services"); lastMapAreaKeyRef.current = ""; if (mapViewport) void loadMapArea(mapViewport, "services"); }}>Servizi utili</button></div><Button variant="outline" onClick={locateUser}><LocateFixed /> {locationStatus}</Button></div></section>
          <section className="map-layout">
            <div className="map-frame">
              <PoiMap points={mapDisplayPoints} selectedId={mapPlace?.id} userPosition={userPosition} onSelect={selectMapPoint} onViewportChange={(viewport) => void loadMapArea(viewport)} />
              <div className={`map-load-status ${mapAreaLoading ? "loading" : ""}`}>{mapAreaStatus}</div>
              {mapPlace && <div className="map-caption"><MapPin /><span><small>Luogo selezionato</small><strong>{mapPlace.name}</strong></span><Button size="sm" asChild><a href={`https://www.google.com/maps/dir/?api=1&destination=${mapPlace.lat},${mapPlace.lng}`} target="_blank" rel="noreferrer">Naviga <ExternalLink /></a></Button></div>}
            </div>
            <div className="map-places">{mapDisplayPoints.map((place, index) => <button key={place.id} className={mapPlace?.id === place.id ? "selected" : ""} onClick={() => selectMapPoint(place.id)}><span>{index + 1}</span><div><small>{place.source === "izi" ? `🎧 ${place.category}` : place.source === "openstreetmap" ? `${place.category} · OSM` : place.category}</small><strong>{place.name}</strong></div><ChevronRight /></button>)}</div>
          </section>
        </TabsContent>

        <TabsContent value="passaporto" className="content-area">
          <section className="passport-hero"><div><p className="eyebrow"><Stamp /> Il tuo viaggio</p><h1>Passaporto Varga Tour</h1><p>Ogni luogo visitato diventa un timbro e alimenta automaticamente il tuo diario di viaggio.</p></div><div className="passport-total"><strong>{visitHistory.length}</strong><span>{visitHistory.length === 1 ? "luogo visitato" : "luoghi visitati"}</span></div></section>
          <section className="passport-actions"><button onClick={() => void downloadOfflinePack()}><Download /><span><strong>{offlinePackReady ? "Pacchetto offline pronto" : "Scarica guida offline"}</strong><small>Mappa base, itinerari, racconti e immagini essenziali</small></span></button><button onClick={() => window.print()}><BookOpen /><span><strong>Salva il diario in PDF</strong><small>Usa la stampa del telefono e scegli “Salva come PDF”</small></span></button><button onClick={() => void shareText("Il mio Passaporto Varga Tour", visitHistory.map((item) => `${item.title} · ${new Date(item.visitedAt).toLocaleDateString("it-IT")}`).join("\n"))}><Share2 /><span><strong>Condividi il viaggio</strong><small>Invia tappe e ricordi ad amici e famiglia</small></span></button></section>
          <section className="passport-content"><div className="passport-heading"><div><p className="eyebrow">Diario automatico</p><h2>I tuoi timbri</h2></div>{visitHistory.length >= 3 && <span className="earned-badge"><BadgeCheck /> Esploratore Varga</span>}</div>{visitHistory.length === 0 ? <div className="passport-empty"><Stamp /><strong>Il primo timbro ti aspetta</strong><span>Inizia un tour o apri una scheda quando sei vicino al luogo e premi “Segna visitato”.</span><Button onClick={() => setActiveTab("scopri")} className="primary-action">Scopri vicino a te</Button></div> : <div className="stamp-grid">{visitHistory.map((visit, index) => <article key={`${visit.id}-${visit.visitedAt}`}><span className="stamp-number">{String(index + 1).padStart(2, "0")}</span><Stamp /><small>{visit.category}</small><strong>{visit.title}</strong><time dateTime={visit.visitedAt}>{new Date(visit.visitedAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</time><a href={`https://www.google.com/maps/search/?api=1&query=${visit.lat},${visit.lng}`} target="_blank" rel="noreferrer">Rivedi sulla mappa <ExternalLink /></a></article>)}</div>}</section>
        </TabsContent>

        <TabsList className="mobile-tabs" aria-label="Navigazione mobile">
          <TabsTrigger value="scopri"><Compass /><span>Scopri</span></TabsTrigger>
          <TabsTrigger value="tour"><Footprints /><span>Tour</span></TabsTrigger>
          <TabsTrigger value="mappa"><Map /><span>Mappa</span></TabsTrigger>
          <TabsTrigger value="passaporto"><Stamp /><span>Viaggio</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <Sheet open={Boolean(selectedNearby)} onOpenChange={(open) => { if (!open) { speechRunRef.current += 1; window.speechSynthesis?.cancel(); setSpeakingId(null); setSelectedNearby(null); setNearbyVideo(null); } }}>
        <SheetContent side="right" className="place-sheet nearby-sheet" data-poi-title={selectedNearby?.title} data-poi-lat={selectedNearby?.lat} data-poi-lng={selectedNearby?.lng}>
          {selectedNearby && <>
            <SheetHeader><p className="eyebrow">{selectedNearby.source === "openstreetmap" ? "Punto di interesse sulla mappa" : "Guida rilevata vicino a te"}</p><SheetTitle>{selectedNearby.title}</SheetTitle><SheetDescription>{selectedNearby.source === "openstreetmap" ? `${selectedNearby.category || "Luogo turistico"} · Italia` : selectedNearby.distance < 1000 ? `${Math.round(selectedNearby.distance)} metri da te` : `${(selectedNearby.distance / 1000).toFixed(1)} km da te`}</SheetDescription></SheetHeader>
            <div className="sheet-scroll">
              {(selectedNearby.images?.[0]?.url || selectedNearby.thumbnail) ? (
                <div className="guide-gallery"><img src={selectedNearby.images?.[0]?.url || selectedNearby.thumbnail} alt={`Fotografia di ${selectedNearby.title}`} referrerPolicy="no-referrer" /><span className="photo-open-hint main-photo-open-hint" data-open-photo><ZoomIn size={14} /> Apri foto</span><div className="image-kind">Fotografia reale</div><div className="image-caption"><span>{selectedNearby.title}</span><small>{selectedNearby.source === "izi" ? "Fonte: izi.TRAVEL" : selectedNearby.source === "openstreetmap" ? "Fonte: OpenStreetMap / Wikimedia" : "Fonte: Wikipedia / Wikimedia Commons"}</small></div></div>
              ) : (
                <div className="nearby-image-empty"><MapPin /><span>Fotografia non disponibile per questo luogo</span></div>
              )}
              <div data-poi-multimedia-host />
              {selectedNearby.audioUrl ? (
                <div className="original-audio"><div className="media-heading"><Headphones /><div><strong>Audioguida originale</strong><span>Contenuto fornito da izi.TRAVEL</span></div></div><audio src={selectedNearby.audioUrl} controls preload="none" /></div>
              ) : (
                <div className="audio-box"><Headphones /><div><strong>Voce narrativa naturale</strong><span>La migliore voce italiana disponibile sul dispositivo</span></div><Button size="icon-lg" onClick={() => speakNearby(selectedNearby)} aria-label={speakingId === `nearby-${selectedNearby.pageid}` ? "Ferma audioguida" : "Avvia audioguida"}>{speakingId === `nearby-${selectedNearby.pageid}` ? <Square /> : <Play />}</Button></div>
              )}
              <article><h3>Scopri il luogo</h3><p>{selectedNearby.extract}</p></article>
              {nearbyAiPhoto && <div className="guide-gallery ai-nearby"><img src={nearbyAiPhoto.src} alt={nearbyAiPhoto.alt} /><div className="image-kind ai">Ricostruzione AI</div><div className="image-caption"><span>{nearbyAiPhoto.alt}</span><small>{nearbyAiPhoto.credit}</small></div></div>}
              <section className="video-card" aria-label="Video del luogo">
                <div className="media-heading"><Video /><div><strong>Video del luogo</strong><span>Wikimedia Commons o ricerca esterna</span></div></div>
                {nearbyVideoLoading && <p>Ricerca di un video libero…</p>}
                {nearbyVideo?.type === "video" && <div className="video-frame"><video src={nearbyVideo.url} controls playsInline preload="metadata" /></div>}
                {nearbyVideo?.type === "youtube" && nearbyYoutubeId && <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${nearbyYoutubeId}`} title={nearbyVideo.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}
                {!nearbyVideoLoading && !nearbyVideo && <Button variant="outline" asChild><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${selectedNearby.title} guida turistica`)}`} target="_blank" rel="noreferrer">Cerca video su YouTube <ExternalLink /></a></Button>}
              </section>
              <div className="source-actions"><a href={selectedNearby.pageUrl} target="_blank" rel="noreferrer">Leggi la fonte completa <ExternalLink /></a><span>{selectedNearby.attribution || "Testo: Wikipedia · media: Wikimedia Commons. Le ricostruzioni generate con AI sono sempre indicate."}</span></div>
            </div>
            <SheetFooter><Button size="lg" asChild className="primary-action"><a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedNearby.lat},${selectedNearby.lng}`} target="_blank" rel="noreferrer"><Navigation /> Naviga verso il luogo</a></Button><Button size="lg" variant="outline" onClick={() => saveVisit({ id: `nearby-${selectedNearby.pageid}`, title: selectedNearby.title, category: selectedNearby.category || "Luogo turistico", lat: selectedNearby.lat, lng: selectedNearby.lng })}><Stamp /> Segna visitato</Button></SheetFooter>
          </>}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="place-sheet" data-poi-title={selected?.name} data-poi-lat={selected?.lat} data-poi-lng={selected?.lng}>
          {selected && <>
            <SheetHeader><p className="eyebrow">{selected.category}</p><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.address}</SheetDescription></SheetHeader>
            <div className="sheet-scroll">
              <div className="guide-gallery">
                <img
                  src={selected.photos[photoIndex].src}
                  alt={selected.photos[photoIndex].alt}
                  referrerPolicy="no-referrer"
                />
                <span className="photo-open-hint main-photo-open-hint" data-open-photo><ZoomIn size={14} /> Apri foto</span>
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
              {selected.photos.some((photo) => photo.kind === "photo") && selected.photos.some((photo) => photo.kind === "ai") && <section className="time-portal"><div className="media-heading"><WandSparkles /><div><strong>Portale nel tempo</strong><span>Scorri per confrontare il luogo reale con la ricostruzione storica AI</span></div></div><div className="time-portal-stage"><img src={selected.photos.find((photo) => photo.kind === "photo")!.src} alt={`${selected.name} oggi`} /><div className="time-portal-past" style={{ clipPath: `inset(0 ${100 - timePortalReveal}% 0 0)` }}><img src={selected.photos.find((photo) => photo.kind === "ai")!.src} alt={`Ricostruzione storica illustrativa di ${selected.name}`} /><span>Ricostruzione AI</span></div><i style={{ left: `${timePortalReveal}%` }} /></div><input type="range" min="0" max="100" value={timePortalReveal} onChange={(event) => setTimePortalReveal(Number(event.target.value))} aria-label="Confronta fotografia attuale e ricostruzione storica" /><small>La ricostruzione è illustrativa e non rappresenta una fotografia storica.</small></section>}
              <div data-poi-multimedia-host />
              <section className="narration-modes"><div className="media-heading"><Headphones /><div><strong>Scegli come ascoltare</strong><span>Tre racconti diversi dello stesso luogo</span></div></div><div className="narration-choice">{([{ id: "breve", label: "In 60 secondi", note: "Essenziale" }, { id: "completa", label: "Storia completa", note: `Circa ${Math.max(2, Math.ceil(selected.narration.split(/\s+/).length / 125))} min` }, { id: "curiosita", label: "Curiosità e misteri", note: "Il lato insolito" }] as const).map((mode) => <button key={mode.id} className={narrationMode === mode.id ? "selected" : ""} onClick={() => speakPlaceMode(selected, mode.id)}><span><strong>{mode.label}</strong><small>{mode.note}</small></span>{speakingId === `${selected.id}-${mode.id}` ? <Square /> : <Play />}</button>)}</div></section>
              <article><h3>La storia</h3><p>{selected.story}</p></article>
              <article className="curiosity"><Sparkles /><div><h3>Lo sapevi?</h3><p>{selected.curiosity}</p></div></article>
              {selected.video && (
                <section className="video-card" aria-label="Video della tappa">
                  <div className="media-heading"><Video /><div><strong>Guarda Bologna</strong><span>Video ufficiale · avvio manuale</span></div></div>
                  <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${selected.video.id}`} title={selected.video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
                  <p>{selected.video.title}</p>
                </section>
              )}
              <div className="info-row"><span>Accesso esterno</span><strong>{selected.free ? "Gratuito" : "Ingresso interno a pagamento"}</strong></div>
            </div>
            <SheetFooter><Button size="lg" asChild className="primary-action"><a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer"><Navigation /> Naviga verso il luogo</a></Button><Button size="lg" variant="outline" onClick={() => saveVisit({ id: selected.id, title: selected.name, category: selected.category, lat: selected.lat, lng: selected.lng })}><Stamp /> Segna visitato</Button><Button size="lg" variant="outline" onClick={() => { setMapPlaceId(selected.id); setActiveTab("mappa"); setSelected(null); }}><Map /> Mappa</Button></SheetFooter>
          </>}
        </SheetContent>
      </Sheet>

      <form name="manager-content" method="POST" data-netlify="true" data-netlify-honeypot="website-check" hidden><input type="hidden" name="form-name" value="manager-content" /><input name="luogo" /><input name="coordinate" /><input name="website-check" /><input name="email" /><input name="sito-ufficiale" /><input name="prenotazione" /><input name="orari" /><textarea name="media-ufficiali" /></form>
      <footer className="site-footer"><div><strong>Varga Tour</strong><span>Guida nazionale automatica con contenuti multimediali e AI sempre dichiarata.</span></div><p>I luoghi vicini e le schede sono caricati da fonti aperte e ufficiali. Il GPS resta sul dispositivo e viene usato soltanto per ordinare e rilevare i punti vicini.</p><a href="https://it.wikipedia.org" target="_blank" rel="noreferrer">Fonte nazionale: Wikipedia <ExternalLink /></a></footer>
    </main>
  );
}
