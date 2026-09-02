"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, LocateFixed, MapPin, Navigation, Plane, Search, TrainFront, Accessibility, Building2, ShoppingCart } from "lucide-react";
import { IndoorMap } from "@/components/indoor-map";

type Hub = { id: string; name: string; subtitle?: string; type: "airport" | "station" | "mall" | "supermarket" | "hospital" | "university" | "building"; lat: number; lng: number };
type IndoorPoint = { id: string; name: string; category: string; level?: string; wheelchair?: string; lat: number; lng: number };
type Position = { lat: number; lng: number; accuracy?: number; altitude?: number | null; altitudeAccuracy?: number | null };
type FloorSource = "unknown" | "confirmed" | "estimated";

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const typeName = (type: Hub["type"]) => ({
  airport: "Aeroporto", station: "Stazione", mall: "Centro commerciale", supermarket: "Supermercato",
  hospital: "Ospedale", university: "Università", building: "Struttura",
}[type]);

function toPosition(p: GeolocationPosition): Position {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude, altitudeAccuracy: p.coords.altitudeAccuracy };
}

function numericLevel(value?: string) {
  if (!value) return null;
  const number = Number(value.split(";")[0].trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export default function IndoorGuidePage() {
  const [query, setQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [results, setResults] = useState<Hub[]>([]);
  const [nearby, setNearby] = useState<Hub[]>([]);
  const [hub, setHub] = useState<Hub | null>(null);
  const [points, setPoints] = useState<IndoorPoint[]>([]);
  const [destination, setDestination] = useState<IndoorPoint | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Scegli una struttura oppure usa la tua posizione.");
  const [detailed, setDetailed] = useState(false);
  const [category, setCategory] = useState("Tutti");
  const [level, setLevel] = useState("Tutti");
  const [currentFloor, setCurrentFloor] = useState<string | null>(null);
  const [floorSource, setFloorSource] = useState<FloorSource>("unknown");
  const [floorReference, setFloorReference] = useState<{ level: number; altitude: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  const levels = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.level).filter(Boolean) as string[])).sort((a, b) => {
    const na = numericLevel(a); const nb = numericLevel(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, "it");
  })], [points]);

  useEffect(() => {
    if (!floorReference || position?.altitude == null) return;
    const numericLevels = levels.filter((item) => item !== "Tutti").map((item) => ({ label: item, n: numericLevel(item) })).filter((item): item is { label: string; n: number } => item.n !== null);
    if (!numericLevels.length) return;
    const estimatedNumber = floorReference.level + Math.round((position.altitude - floorReference.altitude) / 3.3);
    const closest = numericLevels.reduce((best, item) => Math.abs(item.n - estimatedNumber) < Math.abs(best.n - estimatedNumber) ? item : best);
    if (currentFloor !== closest.label || floorSource !== "estimated") { setCurrentFloor(closest.label); setFloorSource("estimated"); }
  }, [position?.altitude, floorReference, levels, currentFloor, floorSource]);

  async function searchHub() {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true); setMessage("Cerco la struttura…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=search&q=${encodeURIComponent(q)}`);
      const data = await response.json();
      setResults(Array.isArray(data.items) ? data.items : []);
      setMessage(data.items?.length ? "Scegli la struttura." : "Nessuna struttura trovata.");
    } catch { setMessage("Ricerca non disponibile."); }
    finally { setLoading(false); }
  }

  function locate() {
    if (!navigator.geolocation) { setMessage("GPS non disponibile."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const current = toPosition(p); setPosition(current);
      try {
        const response = await fetch(`/.netlify/functions/indoor-guide?action=nearby&lat=${current.lat}&lng=${current.lng}&radius=30000`);
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        items.sort((a: Hub, b: Hub) => distanceMeters(current, a) - distanceMeters(current, b));
        setNearby(items);
        setMessage(items.length ? "Ho trovato le strutture più vicine." : "Nessuna struttura trovata nelle vicinanze.");
      } catch { setMessage("Ricerca vicina non disponibile."); }
      finally { setLoading(false); }
    }, () => { setLoading(false); setMessage("Posizione non autorizzata."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  }

  async function openHub(item: Hub) {
    setHub(item); setDestination(null); setPoints([]); setDestinationQuery(""); setLoading(true); setLevel("Tutti"); setCurrentFloor(null); setFloorSource("unknown"); setFloorReference(null);
    setMessage("Carico la mappa e i punti interni…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=indoor&lat=${item.lat}&lng=${item.lng}&radius=1200`);
      const data = await response.json();
      const loaded = Array.isArray(data.points) ? data.points : [];
      setPoints(loaded); setDetailed(Boolean(data.detailed));
      setMessage(loaded.length ? `${loaded.length} punti disponibili. Cerca dove vuoi andare oppure scegli dalla lista.` : "Mappa disponibile, ma i dettagli interni pubblici sono limitati.");
    } catch { setMessage("Non riesco a caricare i dettagli interni."); }
    finally { setLoading(false); }
  }

  function confirmFloor(value: string) {
    setCurrentFloor(value); setLevel(value); setFloorSource("confirmed");
    const n = numericLevel(value);
    if (n !== null && position?.altitude != null) setFloorReference({ level: n, altitude: position.altitude });
    setMessage(`Piano ${value} confermato.`);
  }

  const startGuide = useCallback((point: IndoorPoint) => {
    setDestination(point); setDestinationQuery(point.name);
    if (point.level) setLevel(point.level);
    setMessage(`Navigazione verso ${point.name}.`);
    if (!navigator.geolocation) return;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition((p) => setPosition(toPosition(p)), () => setMessage("Segnale GPS debole dentro la struttura."), { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
  }, []);

  const categories = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.category))).sort()], [points]);
  const visible = useMemo(() => points.filter((p) => (category === "Tutti" || p.category === category) && (level === "Tutti" || p.level === level)), [points, category, level]);
  const destinationMatches = useMemo(() => {
    const q = destinationQuery.trim().toLocaleLowerCase("it");
    const source = q ? points.filter((p) => `${p.name} ${p.category} ${p.level || ""}`.toLocaleLowerCase("it").includes(q)) : points;
    return [...source].sort((a, b) => {
      if (position) return distanceMeters(position, a) - distanceMeters(position, b);
      return a.name.localeCompare(b.name, "it");
    }).slice(0, 60);
  }, [points, destinationQuery, position]);
  const verticalConnectors = useMemo(() => points.filter((p) => ["Ascensore", "Scale", "Scala mobile"].includes(p.category)), [points]);

  const routeInfo = useMemo(() => {
    if (!position || !destination) return { route: [] as Array<{ lat: number; lng: number }>, text: "" };
    const destinationFloor = destination.level || null;
    if (!currentFloor || !destinationFloor || currentFloor === destinationFloor) return { route: [position, destination], text: currentFloor && destinationFloor ? `Percorso sul piano ${destinationFloor}` : "Percorso indicativo sulla mappa" };
    const currentCandidates = verticalConnectors.filter((p) => p.level === currentFloor);
    const destinationCandidates = verticalConnectors.filter((p) => p.level === destinationFloor);
    if (!currentCandidates.length || !destinationCandidates.length) return { route: [position, destination], text: `Devi passare dal piano ${currentFloor} al piano ${destinationFloor}; collegamento verticale non completamente mappato.` };
    const startConnector = currentCandidates.reduce((best, item) => distanceMeters(position, item) < distanceMeters(position, best) ? item : best);
    const endConnector = destinationCandidates.reduce((best, item) => distanceMeters(destination, item) < distanceMeters(destination, best) ? item : best);
    return { route: [position, startConnector, endConnector, destination], text: `Vai verso ${startConnector.name}; passa al piano ${destinationFloor} e prosegui verso ${destination.name}.` };
  }, [position, destination, currentFloor, verticalConnectors]);

  const navDistance = position && destination ? distanceMeters(position, destination) : null;
  const icon = (item: Hub) => item.type === "airport" ? <Plane /> : item.type === "station" ? <TrainFront /> : item.type === "supermarket" ? <ShoppingCart /> : <Building2 />;
  const floorLabel = currentFloor ? `Piano ${currentFloor} · ${floorSource === "confirmed" ? "confermato" : "stimato"}` : "Piano non determinato";

  return <main className="indoor-page">
    <header className="indoor-topbar"><Link href="/" className="indoor-back"><ArrowLeft size={18} /> Varga Tour</Link><div><strong>Guida interna</strong><small>Mappe delle strutture</small></div></header>
    <section className="indoor-hero"><div><p className="eyebrow"><Navigation size={16} /> Navigazione interna</p><h1>Una mappa per arrivare proprio lì.</h1><p>Cerca qualunque punto interno disponibile: negozi, gate, binari, reparti, bagni, uscite, ristoranti, servizi, parcheggi e molto altro.</p></div><button className="indoor-locate" onClick={locate} disabled={loading}><LocateFixed /> Usa la mia posizione</button></section>
    <section className="indoor-search-panel"><div className="indoor-search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchHub()} placeholder="Cerca la struttura…" /><button onClick={() => void searchHub()} disabled={loading}>Cerca</button></div><p className="indoor-status">{loading ? "Caricamento…" : message}</p></section>
    {!hub && (results.length > 0 || nearby.length > 0) && <section className="indoor-hub-grid">{(results.length ? results : nearby).map((item) => <button key={item.id} className="indoor-hub-card" onClick={() => void openHub(item)}><span className="indoor-hub-icon">{icon(item)}</span><span><small>{typeName(item.type)}</small><strong>{item.name}</strong>{item.subtitle && <em>{item.subtitle}</em>}</span><Navigation size={19} /></button>)}</section>}
    {hub && <section className="indoor-workspace">
      <div className="indoor-workspace-head"><div><small>{typeName(hub.type)}</small><h2>{hub.name}</h2><p>{detailed ? "Dettagli interni e livelli disponibili sulla mappa." : "Mostro tutti i punti pubblici disponibili."}</p></div><button onClick={() => { setHub(null); setDestination(null); setPoints([]); }}>Cambia struttura</button></div>
      <div className="indoor-destination-panel"><div className="indoor-destination-search"><Search size={20} /><input value={destinationQuery} onChange={(e) => setDestinationQuery(e.target.value)} placeholder="Dove vuoi andare? Es. Zara, Gate 12, Binario 7, Bagni, Cardiologia…" /></div><div className="indoor-destination-results">{destinationMatches.map((point) => <button key={point.id} onClick={() => startGuide(point)}><span><small>{point.category}{point.level ? ` · Piano ${point.level}` : ""}</small><strong>{point.name}</strong></span><Navigation size={18} /></button>)}</div></div>
      <div className="indoor-floor-status"><div><strong>{floorLabel}</strong><small>{position?.accuracy ? `Precisione orizzontale circa ${Math.round(position.accuracy)} m` : "Attiva la posizione per vedere dove sei"}{position?.altitudeAccuracy ? ` · quota ±${Math.round(position.altitudeAccuracy)} m` : ""}</small></div>{levels.length > 1 && <div className="indoor-floor-confirm"><span>Io sono al piano:</span>{levels.filter((x) => x !== "Tutti").map((x) => <button key={x} className={currentFloor === x ? "active" : ""} onClick={() => confirmFloor(x)}>{x}</button>)}</div>}</div>
      <div className="indoor-map-wrap"><IndoorMap center={hub} points={visible} position={position} destination={destination} routePoints={routeInfo.route} onSelect={startGuide} /><div className="indoor-map-legend"><span><b className="dot-user" /> Tu</span><span><b className="dot-dest" /> Destinazione</span><span>{points.length} punti</span></div></div>
      {destination && <div className="indoor-navigation-card"><div><Navigation size={54} /></div><div><small>Destinazione</small><h3>{destination.name}</h3><p>{destination.category}{destination.level ? ` · Piano ${destination.level}` : ""}</p>{navDistance !== null && <strong className="indoor-distance">{navDistance < 1000 ? `${Math.round(navDistance)} m` : `${(navDistance / 1000).toFixed(1)} km`}</strong>}<span className="indoor-route-text">{routeInfo.text}</span></div><button onClick={() => { setDestination(null); setDestinationQuery(""); }}>Termina</button></div>}
      {levels.length > 1 && <div className="indoor-level-row"><strong>Visualizza piano</strong>{levels.map((x) => <button key={x} className={level === x ? "active" : ""} onClick={() => setLevel(x)}>{x}</button>)}</div>}
      <div className="indoor-filter-row">{categories.slice(0, 14).map((x) => <button key={x} className={category === x ? "active" : ""} onClick={() => setCategory(x)}>{x}</button>)}</div>
      <div className="indoor-point-list">{visible.map((point) => <button key={point.id} onClick={() => startGuide(point)}><span className="indoor-point-icon"><MapPin size={18} /></span><span><small>{point.category}{point.level ? ` · Piano ${point.level}` : ""}</small><strong>{point.name}</strong>{point.wheelchair === "yes" && <em><Accessibility size={13} /> Accessibile</em>}</span><Navigation size={18} /></button>)}</div>
      {points.length === 0 && !loading && <div className="indoor-empty"><Compass /><strong>Dettagli interni non disponibili</strong><p>La mappa della zona resta utilizzabile. I punti interni compaiono quando presenti nei dati OpenStreetMap.</p></div>}
    </section>}
    <footer className="indoor-source">Mappa e dati: © OpenStreetMap contributors. Il piano automatico è una stima basata sulla variazione di quota dopo una conferma iniziale.</footer>
  </main>;
}
