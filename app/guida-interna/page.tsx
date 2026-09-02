"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Compass, LocateFixed, MapPin, Navigation, Plane, Search, TrainFront, Accessibility, Building2, ShoppingCart, RotateCcw, Crosshair, Flag } from "lucide-react";
import { IndoorMap } from "@/components/indoor-map";
import { routeLengthMeters, shortestIndoorPath, type IndoorRouteSegment } from "@/lib/indoor-routing";

type Hub = { id: string; name: string; subtitle?: string; type: "airport" | "station" | "mall" | "supermarket" | "hospital" | "university" | "building"; lat: number; lng: number };
type IndoorPoint = { id: string; name: string; category: string; level?: string; wheelchair?: string; lat: number; lng: number };
type Position = { lat: number; lng: number; accuracy?: number; altitude?: number | null; altitudeAccuracy?: number | null };
type FloorSource = "unknown" | "confirmed" | "estimated";
type Checkpoint = { id: string; lat: number; lng: number; name: string; instruction: string; level?: string; distanceFromPrevious: number; final?: boolean };

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

function buildCheckpoints(route: Array<{ lat: number; lng: number }>, points: IndoorPoint[], destination: IndoorPoint): Checkpoint[] {
  if (route.length < 2) return [];
  const checkpoints: Checkpoint[] = [];
  let anchor = route[0];
  let accumulated = 0;
  let lastAddedIndex = 0;

  for (let i = 1; i < route.length; i += 1) {
    accumulated += distanceMeters(route[i - 1], route[i]);
    const isLast = i === route.length - 1;
    if (!isLast && accumulated < 28) continue;

    const coordinate = route[i];
    const nearest = points
      .map((point) => ({ point, distance: distanceMeters(coordinate, point) }))
      .filter((item) => item.distance <= 18 && item.point.id !== destination.id)
      .sort((a, b) => a.distance - b.distance)[0]?.point;

    const final = isLast;
    const name = final ? destination.name : nearest?.name || `Checkpoint ${checkpoints.length + 1}`;
    const level = final ? destination.level : nearest?.level;
    const legDistance = Math.max(1, Math.round(distanceMeters(anchor, coordinate)));
    const categoryHint = nearest && ["Ascensore", "Scale", "Scala mobile"].includes(nearest.category)
      ? `Raggiungi ${nearest.name}${nearest.level ? ` al piano ${nearest.level}` : ""}.`
      : final
        ? `Vai fino a ${destination.name}.`
        : `Vai fino a ${name}.`;

    checkpoints.push({
      id: final ? `destination-${destination.id}` : `checkpoint-${i}-${name}`,
      lat: coordinate.lat,
      lng: coordinate.lng,
      name,
      instruction: categoryHint,
      level,
      distanceFromPrevious: legDistance,
      final,
    });
    anchor = coordinate;
    accumulated = 0;
    lastAddedIndex = i;
  }

  if (lastAddedIndex !== route.length - 1) {
    checkpoints.push({
      id: `destination-${destination.id}`,
      lat: destination.lat,
      lng: destination.lng,
      name: destination.name,
      instruction: `Vai fino a ${destination.name}.`,
      level: destination.level,
      distanceFromPrevious: Math.max(1, Math.round(distanceMeters(anchor, destination))),
      final: true,
    });
  }

  return checkpoints;
}

export default function IndoorGuidePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hub[]>([]);
  const [nearby, setNearby] = useState<Hub[]>([]);
  const [hub, setHub] = useState<Hub | null>(null);
  const [points, setPoints] = useState<IndoorPoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<IndoorRouteSegment[]>([]);
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
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [checkpointRoute, setCheckpointRoute] = useState<Array<{ lat: number; lng: number }>>([]);
  const [checkpointStart, setCheckpointStart] = useState<Position | null>(null);
  const [checkpointDestinationId, setCheckpointDestinationId] = useState<string | null>(null);
  const [navigationComplete, setNavigationComplete] = useState(false);
  const watchRef = useRef<number | null>(null);

  const stopGpsWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
  }, []);

  const resetCheckpointNavigation = useCallback(() => {
    setCheckpoints([]);
    setCheckpointIndex(0);
    setCheckpointRoute([]);
    setCheckpointStart(null);
    setCheckpointDestinationId(null);
    setNavigationComplete(false);
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
    stopGpsWatch(); resetCheckpointNavigation();
    setHub(item); setDestination(null); setPoints([]); setRouteSegments([]); setLoading(true); setLevel("Tutti"); setCurrentFloor(null); setFloorSource("unknown"); setFloorReference(null); setPosition(null); setSimulationStart(null); setPickingSimulationStart(false);
    setMessage("Carico la mappa e i percorsi interni…");
    try {
      const response = await fetch(`/.netlify/functions/indoor-guide?action=indoor&lat=${item.lat}&lng=${item.lng}&radius=1200`);
      const data = await response.json();
      const loaded = Array.isArray(data.points) ? data.points : [];
      const loadedSegments = Array.isArray(data.routeSegments) ? data.routeSegments : [];
      setPoints(loaded); setRouteSegments(loadedSegments); setDetailed(Boolean(data.detailed));
      setMessage(loaded.length || loadedSegments.length ? `${loaded.length} punti e ${loadedSegments.length} segmenti pedonali caricati. Scegli una destinazione.` : "Mappa disponibile, ma i dettagli interni pubblici sono limitati.");
    } catch { setMessage("Non riesco a caricare i dettagli interni."); }
    finally { setLoading(false); }
  }

  function confirmFloor(value: string) {
    setCurrentFloor(value); setLevel(value); setFloorSource("confirmed");
    const n = numericLevel(value);
    if (!simulationMode && n !== null && position?.altitude != null) setFloorReference({ level: n, altitude: position.altitude });
    setMessage(simulationMode ? `Piano ${value} impostato per la simulazione.` : `Piano ${value} confermato.`);
  }

  function toggleSimulation() {
    stopGpsWatch(); resetCheckpointNavigation();
    const next = !simulationMode;
    setSimulationMode(next);
    setPickingSimulationStart(false);
    setDestination(null);
    setPosition(null);
    setSimulationStart(null);
    setCurrentFloor(null);
    setFloorSource("unknown");
    setFloorReference(null);
    setMessage(next ? "Modalità simulazione attiva. Scegli il punto di partenza e poi la destinazione." : "Simulazione disattivata. Puoi usare la posizione reale.");
  }

  function chooseSimulationStart() {
    if (!simulationMode) return;
    resetCheckpointNavigation();
    setDestination(null);
    setPickingSimulationStart(true);
    setMessage("Tocca sulla mappa il punto esatto da cui vuoi partire.");
  }

  const handleSimulationStartPick = useCallback((picked: { lat: number; lng: number }) => {
    const start: Position = { lat: picked.lat, lng: picked.lng, accuracy: 1 };
    setPosition(start);
    setSimulationStart(start);
    setPickingSimulationStart(false);
    setMessage("Punto di partenza impostato. Adesso scegli la destinazione.");
  }, []);

  const startGuide = useCallback((point: IndoorPoint) => {
    resetCheckpointNavigation();
    setDestination(point);
    if (point.level) setLevel(point.level);
    if (simulationMode) {
      if (!simulationStart) {
        setMessage("Prima scegli il punto di partenza della simulazione.");
        return;
      }
      setPosition(simulationStart);
      setMessage(`Destinazione ${point.name} selezionata. Preparo i checkpoint.`);
      return;
    }
    setMessage(`Navigazione a checkpoint verso ${point.name}. Conferma ogni tappa con “Sono arrivato”.`);
    if (!navigator.geolocation) return;
    stopGpsWatch();
    watchRef.current = navigator.geolocation.watchPosition((p) => setPosition(toPosition(p)), () => setMessage("Segnale GPS debole: puoi comunque avanzare confermando i checkpoint."), { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
  }, [resetCheckpointNavigation, simulationMode, simulationStart, stopGpsWatch]);

  const categories = useMemo(() => ["Tutti", ...Array.from(new Set(points.map((p) => p.category))).sort()], [points]);
  const visible = useMemo(() => points.filter((p) => (category === "Tutti" || p.category === category) && (level === "Tutti" || p.level === level)), [points, category, level]);
  const verticalConnectors = useMemo(() => points.filter((p) => ["Ascensore", "Scale", "Scala mobile"].includes(p.category)), [points]);

  const routeInfo = useMemo(() => {
    if (!position || !destination) return { route: [] as Array<{ lat: number; lng: number }>, text: "", routed: false };
    const destinationFloor = destination.level || null;
    if (!currentFloor || !destinationFloor || currentFloor === destinationFloor) {
      const path = shortestIndoorPath(routeSegments, position, destination, currentFloor || destinationFloor);
      if (path) return { route: path, text: "Percorso interno sui corridoi mappati.", routed: true };
      return { route: [position, destination], text: "Percorso indicativo: i corridoi interni non sono completamente mappati.", routed: false };
    }
    const currentCandidates = verticalConnectors.filter((p) => p.level === currentFloor);
    const destinationCandidates = verticalConnectors.filter((p) => p.level === destinationFloor);
    if (!currentCandidates.length || !destinationCandidates.length) return { route: [position, destination], text: `Passa dal piano ${currentFloor} al piano ${destinationFloor}.`, routed: false };
    const startConnector = currentCandidates.reduce((best, item) => distanceMeters(position, item) < distanceMeters(position, best) ? item : best);
    const endConnector = destinationCandidates.reduce((best, item) => distanceMeters(destination, item) < distanceMeters(destination, best) ? item : best);
    const firstLeg = shortestIndoorPath(routeSegments, position, startConnector, currentFloor) || [position, startConnector];
    const lastLeg = shortestIndoorPath(routeSegments, endConnector, destination, destinationFloor) || [endConnector, destination];
    return { route: [...firstLeg, endConnector, ...lastLeg.slice(1)], text: `Raggiungi ${startConnector.name}, passa al piano ${destinationFloor} e continua verso ${destination.name}.`, routed: firstLeg.length > 2 || lastLeg.length > 2 };
  }, [position, destination, currentFloor, verticalConnectors, routeSegments]);

  useEffect(() => {
    if (!destination || !position || routeInfo.route.length < 2 || checkpointDestinationId === destination.id) return;
    const generated = buildCheckpoints(routeInfo.route, points, destination);
    if (!generated.length) return;
    setCheckpoints(generated);
    setCheckpointIndex(0);
    setCheckpointRoute(routeInfo.route);
    setCheckpointStart(position);
    setCheckpointDestinationId(destination.id);
    setNavigationComplete(false);
    setMessage(`Percorso pronto: ${generated.length} checkpoint. Vai al primo e premi “Sono arrivato”.`);
  }, [destination, position, routeInfo.route, points, checkpointDestinationId]);

  const activeCheckpoint = checkpoints[checkpointIndex] || null;
  const remainingRoute = useMemo(() => {
    if (!checkpointRoute.length || !activeCheckpoint) return routeInfo.route;
    const start = checkpointIndex === 0 ? checkpointStart : checkpoints[checkpointIndex - 1];
    if (!start) return checkpointRoute;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    checkpointRoute.forEach((point, index) => {
      const d = distanceMeters(start, point);
      if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
    });
    return checkpointRoute.slice(nearestIndex);
  }, [checkpointRoute, activeCheckpoint, checkpointIndex, checkpointStart, checkpoints, routeInfo.route]);

  function confirmCheckpoint() {
    if (!activeCheckpoint) return;
    if (simulationMode) setPosition({ lat: activeCheckpoint.lat, lng: activeCheckpoint.lng, accuracy: 1 });
    if (activeCheckpoint.final || checkpointIndex >= checkpoints.length - 1) {
      setNavigationComplete(true);
      setMessage(`Destinazione raggiunta: ${destination?.name || activeCheckpoint.name}.`);
      return;
    }
    const nextIndex = checkpointIndex + 1;
    setCheckpointIndex(nextIndex);
    const next = checkpoints[nextIndex];
    if (next.level) { setCurrentFloor(next.level); setLevel(next.level); }
    setMessage(`Checkpoint confermato. Prossima tappa: ${next.name}.`);
  }

  function previousCheckpoint() {
    if (!checkpoints.length || checkpointIndex <= 0) return;
    const previousIndex = checkpointIndex - 1;
    setNavigationComplete(false);
    setCheckpointIndex(previousIndex);
    const previousPosition = previousIndex === 0 ? checkpointStart : checkpoints[previousIndex - 1];
    if (simulationMode && previousPosition) setPosition({ lat: previousPosition.lat, lng: previousPosition.lng, accuracy: 1 });
    setMessage(`Tornato al checkpoint ${previousIndex + 1}.`);
  }

  function resetSimulation() {
    resetCheckpointNavigation();
    setDestination(null);
    if (simulationStart) setPosition(simulationStart);
    setMessage(simulationStart ? "Simulazione riportata al punto di partenza. Scegli di nuovo la destinazione." : "Scegli un punto di partenza sulla mappa.");
  }

  const navDistance = activeCheckpoint && position ? distanceMeters(position, activeCheckpoint) : checkpointRoute.length >= 2 ? routeLengthMeters(checkpointRoute) : null;
  const icon = (item: Hub) => item.type === "airport" ? <Plane /> : item.type === "station" ? <TrainFront /> : item.type === "supermarket" ? <ShoppingCart /> : <Building2 />;
  const floorLabel = currentFloor ? `Piano ${currentFloor} · ${simulationMode ? "simulazione" : floorSource === "confirmed" ? "confermato" : "stimato"}` : simulationMode ? "Piano simulato non impostato" : "Piano non determinato";

  return <main className="indoor-page">
    <header className="indoor-topbar"><Link href="/" className="indoor-back"><ArrowLeft size={18} /> Varga Tour</Link><div><strong>Guida interna</strong><small>Navigazione a checkpoint</small></div></header>
    <section className="indoor-hero"><div><p className="eyebrow"><Navigation size={16} /> Navigazione interna</p><h1>Un checkpoint alla volta.</h1><p>Varga Tour ti indica una tappa semplice. Quando arrivi, confermi e ricevi immediatamente la prossima indicazione.</p></div><button className="indoor-locate" onClick={locate} disabled={loading || simulationMode}><LocateFixed /> Usa la mia posizione</button></section>
    <section className="indoor-search-panel"><div className="indoor-search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchHub()} placeholder="Cerca aeroporto, stazione, centro commerciale, supermercato…" /><button onClick={() => void searchHub()} disabled={loading}>Cerca</button></div><p className="indoor-status">{loading ? "Caricamento…" : message}</p></section>
    {!hub && (results.length > 0 || nearby.length > 0) && <section className="indoor-hub-grid">{(results.length ? results : nearby).map((item) => <button key={item.id} className="indoor-hub-card" onClick={() => void openHub(item)}><span className="indoor-hub-icon">{icon(item)}</span><span><small>{typeName(item.type)}</small><strong>{item.name}</strong>{item.subtitle && <em>{item.subtitle}</em>}</span><Navigation size={19} /></button>)}</section>}
    {hub && <section className="indoor-workspace">
      <div className="indoor-workspace-head"><div><small>{typeName(hub.type)}</small><h2>{hub.name}</h2><p>{detailed ? "Dettagli interni, corridoi e livelli disponibili sulla mappa." : "Mostro tutti i punti pubblici disponibili."}</p></div><button onClick={() => { stopGpsWatch(); resetCheckpointNavigation(); setHub(null); setDestination(null); setPoints([]); setRouteSegments([]); setPosition(null); setSimulationStart(null); }}>Cambia struttura</button></div>

      <div className="indoor-filter-row">
        <button className={simulationMode ? "active" : ""} onClick={toggleSimulation}><Compass size={16} /> {simulationMode ? "Simulazione attiva" : "Modalità simulazione"}</button>
        {simulationMode && <button className={pickingSimulationStart ? "active" : ""} onClick={chooseSimulationStart}><Crosshair size={16} /> Scegli punto di partenza</button>}
        {simulationMode && simulationStart && <button onClick={resetSimulation}><RotateCcw size={16} /> Reset</button>}
      </div>

      <div className="indoor-floor-status"><div><strong>{floorLabel}</strong><small>{simulationMode ? (simulationStart ? "Posizione simulata scelta manualmente sulla mappa" : "Scegli tu il punto di partenza") : position?.accuracy ? `Precisione orizzontale circa ${Math.round(position.accuracy)} m` : "Attiva la posizione per vedere dove sei"}{!simulationMode && position?.altitudeAccuracy ? ` · quota ±${Math.round(position.altitudeAccuracy)} m` : ""}</small></div>{levels.length > 1 && <div className="indoor-floor-confirm"><span>{simulationMode ? "Piano simulato:" : "Io sono al piano:"}</span>{levels.filter((x) => x !== "Tutti").map((x) => <button key={x} className={currentFloor === x ? "active" : ""} onClick={() => confirmFloor(x)}>{x}</button>)}</div>}</div>
      <div className="indoor-map-wrap"><IndoorMap center={hub} points={visible} position={position} destination={destination} routePoints={remainingRoute} onSelect={startGuide} pickingSimulationStart={pickingSimulationStart} onPickSimulationStart={handleSimulationStartPick} /><div className="indoor-map-legend"><span><b className="dot-user" /> {simulationMode ? "Posizione simulata" : "Tu"}</span><span><b className="dot-dest" /> Destinazione</span><span>{checkpoints.length ? `${checkpointIndex + 1}/${checkpoints.length} checkpoint` : routeSegments.length ? `${routeSegments.length} percorsi interni` : `${points.length} punti`}</span></div></div>

      {destination && <div className={`indoor-navigation-card ${navigationComplete ? "complete" : ""}`}>
        <div>{navigationComplete ? <Flag size={54} /> : <Navigation size={54} />}</div>
        <div>
          <small>{navigationComplete ? "Destinazione raggiunta" : activeCheckpoint ? `Checkpoint ${checkpointIndex + 1} di ${checkpoints.length}` : "Preparazione percorso"}</small>
          <h3>{navigationComplete ? destination.name : activeCheckpoint?.name || destination.name}</h3>
          {!navigationComplete && activeCheckpoint && <p>{activeCheckpoint.instruction}{activeCheckpoint.level ? ` · Piano ${activeCheckpoint.level}` : ""}</p>}
          {!navigationComplete && navDistance !== null && <strong className="indoor-distance">{navDistance < 1000 ? `${Math.round(navDistance)} m` : `${(navDistance / 1000).toFixed(1)} km`}</strong>}
          {!navigationComplete && <span className="indoor-route-text">{activeCheckpoint ? "Quando raggiungi questo punto, conferma manualmente per ricevere la prossima tappa." : routeInfo.text}</span>}
        </div>
        <div className="checkpoint-actions">
          {!navigationComplete && checkpointIndex > 0 && <button className="checkpoint-back" onClick={previousCheckpoint}><ChevronLeft size={18} /> Indietro</button>}
          {!navigationComplete && activeCheckpoint && <button className="checkpoint-arrived" onClick={confirmCheckpoint}><Check size={20} /> SONO ARRIVATO <ArrowRight size={18} /></button>}
          {navigationComplete && <button className="checkpoint-arrived" onClick={() => { stopGpsWatch(); resetCheckpointNavigation(); setDestination(null); }}><Check size={20} /> Fine navigazione</button>}
          <button className="checkpoint-end" onClick={() => { stopGpsWatch(); resetCheckpointNavigation(); setDestination(null); }}>Termina</button>
        </div>
      </div>}

      {levels.length > 1 && <div className="indoor-level-row"><strong>Visualizza piano</strong>{levels.map((x) => <button key={x} className={level === x ? "active" : ""} onClick={() => setLevel(x)}>{x}</button>)}</div>}
      <div className="indoor-filter-row">{categories.slice(0, 14).map((x) => <button key={x} className={category === x ? "active" : ""} onClick={() => setCategory(x)}>{x}</button>)}</div>
      <div className="indoor-point-list">{visible.map((point) => <button key={point.id} onClick={() => startGuide(point)}><span className="indoor-point-icon"><MapPin size={18} /></span><span><small>{point.category}{point.level ? ` · Piano ${point.level}` : ""}</small><strong>{point.name}</strong>{point.wheelchair === "yes" && <em><Accessibility size={13} /> Accessibile</em>}</span><Navigation size={18} /></button>)}</div>
      {points.length === 0 && !loading && <div className="indoor-empty"><Compass /><strong>Dettagli interni non disponibili</strong><p>La mappa della zona resta utilizzabile. Se la rete interna non è abbastanza dettagliata, Varga Tour usa checkpoint indicativi e la conferma manuale dell’utente.</p></div>}
    </section>}
    <footer className="indoor-source">Mappa e dati: © OpenStreetMap contributors. La navigazione indoor procede a checkpoint: Varga Tour mostra una tappa alla volta e passa alla successiva solo dopo la conferma “Sono arrivato”. Il GPS resta un supporto e non decide automaticamente l’avanzamento.</footer>
  </main>;
}
