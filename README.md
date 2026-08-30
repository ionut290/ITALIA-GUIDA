# Italia Guida

Guida turistica automatica per scoprire i luoghi culturali vicini in tutta Italia.

## Funzioni

- rilevamento GPS mentre l'app è aperta;
- ricerca dei punti culturali entro 10 km;
- apertura automatica della scheda entro 300 metri;
- mappa Leaflet con tutti i monumenti, i POI vicini e la posizione GPS;
- audioguida italiana, fotografie, video e navigazione;
- audioguide originali izi.TRAVEL quando disponibili;
- video Wikimedia e YouTube incorporati quando disponibili;
- itinerari editoriali completi per Bologna;
- ricostruzioni generate con AI sempre dichiarate.

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

Le chiavi restano nelle funzioni Netlify e non vengono mai incluse nel codice inviato al browser. Se non sono configurate, l’app continua a funzionare con Wikipedia, Wikimedia Commons e sintesi vocale del dispositivo.
