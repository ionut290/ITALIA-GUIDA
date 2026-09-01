# Italia Guida

Guida turistica automatica per scoprire i luoghi culturali vicini in tutta Italia.

## Funzioni

- rilevamento GPS mentre l'app è aperta;
- ricerca dei punti culturali entro 10 km;
- apertura automatica della scheda entro 300 metri;
- mappa Leaflet nazionale con caricamento automatico dei monumenti e POI OpenStreetMap nell’area visibile, oltre alla posizione GPS;
- audioguida italiana con selezione automatica della voce più naturale, ritmo e pause narrative;
- schede estese con dati incrociati da Wikipedia, Wikidata, Wikimedia Commons e OpenStreetMap;
- gallerie fino a 8 fotografie documentarie, video e navigazione;
- audioguide originali izi.TRAVEL quando disponibili;
- video Wikimedia e YouTube incorporati quando disponibili;
- account ufficiali e contenuti collegati da YouTube, Instagram, TikTok, Facebook, X e Flickr, mantenuti sulla piattaforma originale;
- ricerche social dirette per ogni monumento, anche senza chiavi API;
- itinerari editoriali completi per Bologna;
- ricostruzioni generate con AI sempre dichiarate e separate dalle fotografie reali.

## Avvio locale

```bash
npm install
npm run dev
```

## Netlify

Il repository contiene già `netlify.toml`. Collegando il repository a Netlify, il sito usa Node.js 22 e il supporto Next.js gestito dalla piattaforma.

La versione base funziona senza chiavi API usando Wikipedia, Wikimedia Commons e la voce del telefono. Per ampliare i contenuti aggiungere, nelle variabili protette di Netlify:

- `IZI_TRAVEL_API_KEY`: audioguide e media izi.TRAVEL. La chiave va richiesta a izi.TRAVEL e usata nel rispetto delle condizioni del fornitore.
- `YOUTUBE_API_KEY`: ricerca di video incorporabili. È facoltativa e soggetta alla quota gratuita del progetto Google.

Gli account social ufficiali vengono ricavati, quando presenti, da Wikidata, Wikipedia e OpenStreetMap. Foto e video social non vengono copiati sui server dell’app: si aprono o si riproducono dalla fonte originale, così autore e provenienza rimangono visibili.

Le chiavi restano nelle funzioni Netlify e non vengono mai incluse nel codice inviato al browser. Se non sono configurate, l’app continua a funzionare con Wikipedia, Wikimedia Commons e sintesi vocale del dispositivo.
