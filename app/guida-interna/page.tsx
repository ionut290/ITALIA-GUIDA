"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, LocateFixed, MapPin, Navigation, Plane, Search, TrainFront, Accessibility, Building2, ShoppingCart, Play, Pause, RotateCcw, Crosshair } from "lucide-react";
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
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude,
    altitudeAccuracy: p.coords.altitudeAccuracy,
  };
}

function numericLevel(value?: string) {
  if (!value) return null;
  const first = value.split(";")[0].trim().replace(",", ".");
  const number = Number(first);
  return Number.isFinite(number) ? number : null;
}

export default function IndoorGuidePage() {
  const [query, setQuery] = useState("");
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
  const [simulationMode, setSimulationMode] = useState(false);
  const [pickingSimulationStart, setPickingSimulationStart] = useState(false);
  const [simulationStart, setSimulationStart] = useState<Position | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const watchRef = useRef<number | null>(null);
  const simulationRef = useRef<number | null>(null);

  const stopGpsWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current !== null) {
      window.clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
    setSimulationRunning(false);
  }, []);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    if (simulationRef.current !== null) window.clearInterval(simulationRef.current);
  }, []);

  const levels = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.level).filter(Boolean) as string[])).sort((a, b) => {
    const na = numericLevel(a); const nb = numericLevel(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, "it");
  })], [points]);

  useEffect(() => {
    if (simulationMode || !floorReference || position?.altitude == null) return;
    const numericLevels = levels.filter((item) => item !== "Tutti").map((item) => ({ label: item, n: numericLevel(item) })).filter((item): item is { label: string; n: number } => item.n !== null);
    if (!numericLevels.length) return;
    const estimatedNumber = floorReference.level + Math.round((position.altitude - floorReference.altitude) / 3.3);
    const closest = numericLevels.reduce((best, item) => Math.abs(item.n - estimatedNumber) < Math.abs(best.n - estimatedNumber) ? item : best);
    if (currentFloor !== closest.label || floorSource !== "estimated") {
      setCurrentFloor(closest.label);
      setFloorSource("estimated");
    }
  }, [position?.altitude, floorReference, levels, currentFloor, floorSource, simulationMode]);

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
    if (simulationMode) { setMessage("Disattiva la simulazione per usare la posizione reale."); return; }
    if (!navigator.geolocation) { setMessage("GPS non disponibile."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const current = toPosition(p);
      setPosition(current);
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
    stopGpsWatch(); stopSimulation();
    setHub(item); setDestination(null); setPoints([]); setLoading(true); setLevel("Tutti"); setCurrentFloor(null); setFloorSource("unknown"); setFloorReference(null); setPosition(null); setSimulationStart(null); setPickingSimulationStart(false);
    setMessage("Carico la mappa e i punti interni…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=indoor&lat=${item.lat}&lng=${item.lng}&radius=1200`);
      const data = await response.json();
      const loaded = Array.isArray(data.points) ? data.points : [];
      setPoints(loaded); setDetailed(Boolean(data.detailed));
      setMessage(loaded.length ? `${loaded.length} punti sulla mappa. Se conosci il piano in cui sei, confermalo per migliorare la navigazione.` : "Mappa disponibile, ma i dettagli interni pubblici sono limitati.");
    } catch { setMessage("Non riesco a caricare i dettagli interni."); }
    finally { setLoading(false); }
  }

  function confirmFloor(value: string) {
    setCurrentFloor(value); setLevel(value); setFloorSource("confirmed");
    const n = numericLevel(value);
    if (!simulationMode && n !== null && position?.altitude != null) setFloorReference({ level: n, altitude: position.altitude });
    setMessage(simulationMode ? `Piano ${value} impostato per la simulazione.` : `Piano ${value} confermato. Userò questo dato per la navigazione${position?.altitude != null ? " e per stimare eventuali cambi di piano" : ""}.`);
  }

  function toggleSimulation() {
    stopGpsWatch(); stopSimulation();
    const next = !simulationMode;
    setSimulationMode(next);
    setPickingSimulationStart(false);
    setDestination(null);
    setPosition(null);
    setSimulationStart(null);
    setCurrentFloor(null);
    setFloorSource("unknown");
    setFloorReference(null);
    setMessage(next ? "Modalità simulazione attiva. Premi “Scegli punto di partenza” e tocca la mappa." : "Simulazione disattivata. Puoi usare la posizione reale.");
  }

  function chooseSimulationStart() {
    if (!simulationMode) return;
    stopSimulation();
    setDestination(null);
    setPickingSimulationStart(true);
    setMessage("Tocca sulla mappa il punto esatto da cui vuoi partire.");
  }

  const handleSimulationStartPick = useCallback((picked: { lat: number; lng: number }) => {
    const start: Position = { lat: picked.lat, lng: picked.lng, accuracy: 1 };
    setPosition(start);
    setSimulationStart(start);
    setPickingSimulationStart(false);
    setMessage("Punto di partenza impostato. Adesso scegli la destinazione sulla mappa o dall’elenco.");
  }, []);

  const startGuide = useCallback((point: IndoorPoint) => {
    setDestination(point);
    if (point.level) setLevel(point.level);
    if (simulationMode) {
      stopSimulation();
      if (!simulationStart) {
        setMessage("Prima scegli il punto di partenza della simulazione.");
        return;
      }
      setPosition(simulationStart);
      setMessage(`Destinazione ${point.name} selezionata. Premi Avvia simulazione.`);
      return;
    }
    setMessage(`Navigazione verso ${point.name}.`);
    if (!navigator.geolocation) return;
    stopGpsWatch();
    watchRef.current = navigator.geolocation.watchPosition((p) => setPosition(toPosition(p)), () => setMessage("Segnale GPS debole dentro la struttura."), { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
  }, [simulationMode, simulationStart, stopGpsWatch, stopSimulation]);

  function runSimulation() {
    if (!simulationMode || !simulationStart || !destination) {
      setMessage(!simulationStart ? "Scegli prima il punto di partenza." : "Scegli prima la destinazione.");
      return;
    }
    stopSimulation();
    if (!position) setPosition(simulationStart);
    setSimulationRunning(true);
    setMessage(`Simulazione in corso verso ${destination.name}.`);
    simulationRef.current = window.setInterval(() => {
      setPosition((previous) => {
        const from = previous ?? simulationStart;
        const remaining = distanceMeters(from, destination);
        if (remaining <= 2) {
          if (simulationRef.current !== null) window.clearInterval(simulationRef.current);
          simulationRef.current = null;
          setSimulationRunning(false);
          setMessage(`Destinazione raggiunta: ${destination.name}.`);
          return { lat: destination.lat, lng: destination.lng, accuracy: 1 };
        }
        const step = Math.min(0.18, Math.max(0.04, 4 / remaining));
        return {
          lat: from.lat + (destination.lat - from.lat) * step,
          lng: from.lng + (destination.lng - from.lng) * step,
          accuracy: 1,
        };
      });
    }, 500);
  }

  function resetSimulation() {
    stopSimulation();
    if (simulationStart) setPosition(simulationStart);
    setMessage(simulationStart ? "Simulazione riportata al punto di partenza." : "Scegli un punto di partenza sulla mappa.");
  }

  const categories = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.category))).sort()], [points]);
  const visible = useMemo(() => points.filter((p) => (category === "Tutti" || p.category === category) && (level === "Tutti" || p.level === level)), [points, category, level]);
  const verticalConnectors = useMemo(() => points.filter((p) => ["Ascensore", "Scale", "Scala mobile"].includes(p.category)), [points]);

  const routeInfo = useMemo(() => {
    if (!position || !destination) return { route: [] as Array<{ lat: number; lng: number }>, text: "" };
    const destinationFloor = destination.level || null;
    if (!currentFloor || !destinationFloor || currentFloor === destinationFloor) {
      return { route: [position, destination], text: currentFloor && destinationFloor ? `Percorso sul piano ${destinationFloor}` : simulationMode ? "Percorso della simulazione" : "Percorso indicativo sulla mappa" };
    }
    const currentCandidates = verticalConnectors.filter((p) => p.level === currentFloor);
    const destinationCandidates = verticalConnectors.filter((p) => p.level === destinationFloor);
    if (!currentCandidates.length || !destinationCandidates.length) {
      return { route: [position, destination], text: `Devi passare dal piano ${currentFloor} al piano ${destinationFloor}; collegamento verticale non completamente mappato.` };
    }
    const startConnector = currentCandidates.reduce((best, item) => distanceMeters(position, item) < distanceMeters(position, best) ? item : best);
    const endConnector = destinationCandidates.reduce((best, item) => distanceMeters(destination, item) < distanceMeters(destination, best) ? item : best);
    return {
      route: [position, startConnector, endConnector, destination],
      text: `Vai verso ${startConnector.name}; passa al piano ${destinationFloor} e prosegui verso ${destination.name}.`,
    };
  }, [position, destination, currentFloor, verticalConnectors, simulationMode]);

  const navDistance = position && destination ? distanceMeters(position, destination) : null;
  const icon = (item: Hub) => item.type === "airport" ? <Plane /> : item.type === "station" ? <TrainFront /> : item.type === "supermarket" ? <ShoppingCart /> : <Building2 />;
  const floorLabel = currentFloor ? `Piano ${currentFloor} · ${simulationMode ? "simulazione" : floorSource === "confirmed" ? "confermato" : "stimato"}` : simulationMode ? "Piano simulato non impostato" : "Piano non determinato";

  return <main className="indoor-page">
    <header className="indoor-topbar"><Link href="/" className="indoor-back"><ArrowLeft size={18} /> Varga Tour</Link><div><strong>Guida interna</strong><small>Mappe delle strutture</small></div></header>
    <section className="indoor-hero"><div><p className="eyebrow"><Navigation size={16} /> Navigazione interna</p><h1>Una mappa per arrivare proprio lì.</h1><p>Aeroporti, stazioni, centri commerciali, supermercati, ospedali, università e altre grandi strutture mappate.</p></div><button className="indoor-locate" onClick={locate} disabled={loading || simulationMode}><LocateFixed /> Usa la mia posizione</button></section>
    <section className="indoor-search-panel"><div className="indoor-search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchHub()} placeholder="Cerca aeroporto, stazione, centro commerciale, supermercato…" /><button onClick={() => void searchHub()} disabled={loading}>Cerca</button></div><p className="indoor-status">{loading ? "Caricamento…" : message}</p></section>
    {!hub && (results.length > 0 || nearby.length > 0) && <section className="indoor-hub-grid">{(results.length ? results : nearby).map((item) => <button key={item.id} className="indoor-hub-card" onClick={() => void openHub(item)}><span className="indoor-hub-icon">{icon(item)}</span><span><small>{typeName(item.type)}</small><strong>{item.name}</strong>{item.subtitle && <em>{item.subtitle}</em>}</span><Navigation size={19} /></button>)}</section>}
    {hub && <section className="indoor-workspace">
      <div className="indoor-workspace-head"><div><small>{typeName(hub.type)}</small><h2>{hub.name}</h2><p>{detailed ? "Dettagli interni e livelli disponibili sulla mappa." : "Mostro tutti i punti pubblici disponibili."}</p></div><button onClick={() => { stopGpsWatch(); stopSimulation(); setHub(null); setDestination(null); setPoints([]); setPosition(null); setSimulationStart(null); }}>Cambia struttura</button></div>

      <div className="indoor-filter-row">
        <button className={simulationMode ? "active" : ""} onClick={toggleSimulation}><Compass size={16} /> {simulationMode ? "Simulazione attiva" : "Modalità simulazione"}</button>
        {simulationMode && <button className={pickingSimulationStart ? "active" : ""} onClick={chooseSimulationStart}><Crosshair size={16} /> Scegli punto di partenza</button>}
        {simulationMode && destination && simulationStart && <button onClick={simulationRunning ? stopSimulation : runSimulation}>{simulationRunning ? <><Pause size={16} /> Pausa</> : <><Play size={16} /> Avvia simulazione</>}</button>}
        {simulationMode && simulationStart && <button onClick={resetSimulation}><RotateCcw size={16} /> Reset</button>}
      </div>

      <div className="indoor-floor-status"><div><strong>{floorLabel}</strong><small>{simulationMode ? (simulationStart ? "Posizione simulata scelta manualmente sulla mappa" : "Scegli tu il punto di partenza") : position?.accuracy ? `Precisione orizzontale circa ${Math.round(position.accuracy)} m` : "Attiva la posizione per vedere dove sei"}{!simulationMode && position?.altitudeAccuracy ? ` · quota ±${Math.round(position.altitudeAccuracy)} m` : ""}</small></div>{levels.length > 1 && <div className="indoor-floor-confirm"><span>{simulationMode ? "Piano simulato:" : "Io sono al piano:"}</span>{levels.filter((x) => x !== "Tutti").map((x) => <button key={x} className={currentFloor === x ? "active" : ""} onClick={() => confirmFloor(x)}>{x}</button>)}</div>}</div>
      <div className="indoor-map-wrap"><IndoorMap center={hub} points={visible} position={position} destination={destination} routePoints={routeInfo.route} onSelect={startGuide} pickingSimulationStart={pickingSimulationStart} onPickSimulationStart={handleSimulationStartPick} /><div className="indoor-map-legend"><span><b className="dot-user" /> {simulationMode ? "Posizione simulata" : "Tu"}</span><span><b className="dot-dest" /> Destinazione</span><span>{points.length} punti</span></div></div>
      {destination && <div className="indoor-navigation-card"><div><Navigation size={54} /></div><div><small>{simulationMode ? "Destinazione simulazione" : "Destinazione"}</small><h3>{destination.name}</h3><p>{destination.category}{destination.level ? ` · Piano ${destination.level}` : ""}</p>{navDistance !== null && <strong className="indoor-distance">{navDistance < 1000 ? `${Math.round(navDistance)} m` : `${(navDistance / 1000).toFixed(1)} km`}</strong>}<span className="indoor-route-text">{routeInfo.text}</span></div><button onClick={() => { stopSimulation(); setDestination(null); }}>Termina</button></div>}
      {levels.length > 1 && <div className="indoor-level-row"><strong>Visualizza piano</strong>{levels.map((x) => <button key={x} className={level === x ? "active" : ""} onClick={() => setLevel(x)}>{x}</button>)}</div>}
      <div className="indoor-filter-row">{categories.slice(0, 14).map((x) => <button key={x} className={category === x ? "active" : ""} onClick={() => setCategory(x)}>{x}</button>)}</div>
      <div className="indoor-point-list">{visible.map((point) => <button key={point.id} onClick={() => startGuide(point)}><span className="indoor-point-icon"><MapPin size={18} /></span><span><small>{point.category}{point.level ? ` · Piano ${point.level}` : ""}</small><strong>{point.name}</strong>{point.wheelchair === "yes" && <em><Accessibility size={13} /> Accessibile</em>}</span><Navigation size={18} /></button>)}</div>
      {points.length === 0 && !loading && <div className="indoor-empty"><Compass /><strong>Dettagli interni non disponibili</strong><p>La mappa della zona resta utilizzabile. I negozi, ingressi, corridoi, piani e servizi compaiono quando presenti nei dati OpenStreetMap.</p></div>}
    </section>}
    <footer className="indoor-source">Mappa e dati: © OpenStreetMap contributors. In modalità simulazione la posizione è scelta manualmente sulla mappa e non usa il GPS reale. Il piano automatico reale resta una stima basata sulla variazione di quota dopo una conferma iniziale.</footer>
  </main>;
}
