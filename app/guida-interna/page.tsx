"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, Crosshair, LocateFixed, MapPin, Navigation, Plane, Search, TrainFront, Wheelchair } from "lucide-react";

 type Hub = { id: string; name: string; subtitle?: string; type: "airport" | "station"; lat: number; lng: number };
 type IndoorPoint = { id: string; name: string; category: string; level?: string; wheelchair?: string; lat: number; lng: number };
 type Position = { lat: number; lng: number; accuracy?: number };

function distanceMeters(a: Position, b: Position) {
  const r = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearing(a: Position, b: Position) {
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function directionText(deg: number) {
  const dirs = ["Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ovest", "Ovest", "Nord-ovest"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function IndoorGuidePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hub[]>([]);
  const [nearby, setNearby] = useState<Hub[]>([]);
  const [hub, setHub] = useState<Hub | null>(null);
  const [points, setPoints] = useState<IndoorPoint[]>([]);
  const [destination, setDestination] = useState<IndoorPoint | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Scegli un aeroporto o una stazione, oppure usa la tua posizione.");
  const [detailed, setDetailed] = useState(false);
  const [category, setCategory] = useState("Tutti");
  const watchRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  useEffect(() => {
    const handler = (event: DeviceOrientationEvent) => {
      const anyEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const value = Number.isFinite(anyEvent.webkitCompassHeading) ? anyEvent.webkitCompassHeading! : Number(event.alpha || 0);
      setHeading(value);
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  async function searchHub() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true); setMessage("Cerco aeroporti e stazioni italiane…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=search&q=${encodeURIComponent(q)}`);
      const data = await response.json();
      setResults(Array.isArray(data.items) ? data.items : []);
      setMessage(data.items?.length ? "Scegli la struttura." : "Nessuna struttura trovata con questo nome.");
    } catch { setMessage("Ricerca non disponibile. Riprova tra poco."); }
    finally { setLoading(false); }
  }

  function locate() {
    if (!navigator.geolocation) { setMessage("GPS non disponibile su questo dispositivo."); return; }
    setLoading(true); setMessage("Rilevo la tua posizione…");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const current = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
      setPosition(current);
      try {
        const response = await fetch(`/.netlify/functions/indoor-guide?action=nearby&lat=${current.lat}&lng=${current.lng}&radius=30000`);
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        items.sort((a: Hub, b: Hub) => distanceMeters(current, a) - distanceMeters(current, b));
        setNearby(items);
        setMessage(items.length ? "Ho trovato le strutture più vicine." : "Non trovo aeroporti o stazioni entro 30 km.");
      } catch { setMessage("Non riesco a cercare le strutture vicine."); }
      finally { setLoading(false); }
    }, () => { setLoading(false); setMessage("Posizione non autorizzata."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }

  async function openHub(item: Hub) {
    setHub(item); setDestination(null); setPoints([]); setLoading(true);
    setMessage("Carico gate, binari, ingressi, servizi e livelli disponibili…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=indoor&lat=${item.lat}&lng=${item.lng}&radius=1400`);
      const data = await response.json();
      const loaded = Array.isArray(data.points) ? data.points : [];
      setPoints(loaded); setDetailed(Boolean(data.detailed));
      setMessage(loaded.length ? `${loaded.length} punti disponibili. Scegli dove vuoi arrivare.` : "Per questa struttura non ci sono ancora punti interni sufficienti nella mappa pubblica.");
    } catch { setMessage("Non riesco a caricare la mappa interna di questa struttura."); }
    finally { setLoading(false); }
  }

  function startGuide(point: IndoorPoint) {
    setDestination(point);
    setMessage(`Guida avviata verso ${point.name}.`);
    if (!navigator.geolocation) return;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition((p) => {
      setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    }, () => setMessage("GPS debole o non disponibile dentro la struttura."), { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 });
  }

  const categories = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.category))).sort()], [points]);
  const visiblePoints = useMemo(() => points.filter((p) => category === "Tutti" || p.category === category), [points, category]);
  const nav = destination && position ? {
    distance: distanceMeters(position, destination),
    bearing: bearing(position, destination),
  } : null;
  const relative = nav ? nav.bearing - heading : 0;

  return (
    <main className="indoor-page">
      <header className="indoor-topbar">
        <Link href="/" className="indoor-back"><ArrowLeft size={18} /> Varga Tour</Link>
        <div><strong>Guida interna</strong><small>Aeroporti e stazioni italiane</small></div>
      </header>

      <section className="indoor-hero">
        <div><p className="eyebrow"><Plane size={16} /><TrainFront size={16} /> Navigazione dentro le strutture</p><h1>Dove vuoi arrivare?</h1><p>Scegli aeroporto o stazione, poi seleziona gate, binario, uscita, bagni, biglietteria, ascensore o altro punto disponibile.</p></div>
        <button className="indoor-locate" onClick={locate} disabled={loading}><LocateFixed /> Usa la mia posizione</button>
      </section>

      <section className="indoor-search-panel">
        <div className="indoor-search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchHub()} placeholder="Es. Bologna Centrale, Fiumicino, Malpensa…" /><button onClick={() => void searchHub()} disabled={loading}>Cerca</button></div>
        <p className="indoor-status">{loading ? "Caricamento…" : message}</p>
      </section>

      {!hub && (nearby.length > 0 || results.length > 0) && <section className="indoor-hub-grid">
        {(results.length ? results : nearby).map((item) => <button key={item.id} className="indoor-hub-card" onClick={() => void openHub(item)}>
          <span className="indoor-hub-icon">{item.type === "airport" ? <Plane /> : <TrainFront />}</span>
          <span><small>{item.type === "airport" ? "Aeroporto" : "Stazione"}</small><strong>{item.name}</strong>{item.subtitle && <em>{item.subtitle}</em>}</span>
          <Navigation size={19} />
        </button>)}
      </section>}

      {hub && <section className="indoor-workspace">
        <div className="indoor-workspace-head"><div><small>{hub.type === "airport" ? "Aeroporto" : "Stazione"}</small><h2>{hub.name}</h2><p>{detailed ? "Mappatura interna dettagliata disponibile." : "Copertura interna parziale: userò i punti pubblici disponibili."}</p></div><button onClick={() => { setHub(null); setDestination(null); setPoints([]); }}>Cambia struttura</button></div>

        {destination && <div className="indoor-navigation-card">
          <div className="indoor-arrow" style={{ transform: `rotate(${relative}deg)` }}><Navigation size={64} /></div>
          <div><small>Stai andando verso</small><h3>{destination.name}</h3><p>{destination.category}{destination.level ? ` · Livello ${destination.level}` : ""}</p>
            {nav ? <><strong className="indoor-distance">{nav.distance < 1000 ? `${Math.round(nav.distance)} m` : `${(nav.distance / 1000).toFixed(1)} km`}</strong><span>Direzione {directionText(nav.bearing)}</span></> : <span>Attivo la tua posizione per guidarti.</span>}
          </div>
          <button onClick={() => { setDestination(null); if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }}>Termina</button>
        </div>}

        <div className="indoor-filter-row">{categories.slice(0, 12).map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="indoor-point-list">{visiblePoints.map((point) => <button key={point.id} onClick={() => startGuide(point)}>
          <span className="indoor-point-icon">{point.category === "Gate" ? <Plane size={18} /> : point.category.includes("Binario") ? <TrainFront size={18} /> : <MapPin size={18} />}</span>
          <span><small>{point.category}{point.level ? ` · Livello ${point.level}` : ""}</small><strong>{point.name}</strong>{point.wheelchair === "yes" && <em><Wheelchair size={13} /> Accessibile</em>}</span>
          <Navigation size={18} />
        </button>)}</div>
        {points.length === 0 && !loading && <div className="indoor-empty"><Compass /><strong>Mappa interna non ancora disponibile</strong><p>Varga Tour può comunque portarti all’ingresso della struttura; la guida dettagliata comparirà automaticamente quando OpenStreetMap contiene gate, binari, livelli o servizi interni.</p></div>}
      </section>}

      <footer className="indoor-source">Dati cartografici: © OpenStreetMap contributors. La precisione GPS può diminuire all’interno di edifici, gallerie e piani sotterranei.</footer>
    </main>
  );
}
