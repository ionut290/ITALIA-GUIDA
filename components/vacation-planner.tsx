"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, Check, ChevronDown, ChevronUp, CircleEuro, ExternalLink, FileUp, Hotel, LoaderCircle, MapPinned, Navigation, Pencil, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VacationMap, type VacationMapPoint } from "@/components/vacation-map";

type HotelStay = {
  id: string;
  hotel: string;
  location: string;
  checkIn: string;
  checkOut: string;
  cost: number;
  lat?: number;
  lng?: number;
  resolvedAddress?: string;
};

type PlanStop = { id: string; name: string; category: string; lat: number; lng: number; sourceUrl?: string; moment: string };
type VacationDay = { date: string; hotelId: string; title: string; note: string; stops: PlanStop[]; departure?: boolean };
type StoredVacation = { hotels: HotelStay[]; plan: VacationDay[]; updatedAt: string };
type OsmItem = { id: string; name: string; category: string; lat: number; lng: number; sourceUrl?: string };

const STORAGE_KEY = "varga-tour-my-vacation-v1";
const EMPTY_FORM = { hotel: "", location: "", checkIn: "", checkOut: "", cost: "" };
const MOMENTS = ["Mattina", "Pranzo", "Pomeriggio", "Sera"];

const MONTHS: Record<string, number> = {
  gennaio: 1, january: 1, febbraio: 2, february: 2, marzo: 3, march: 3, aprile: 4, april: 4,
  maggio: 5, may: 5, giugno: 6, june: 6, luglio: 7, july: 7, agosto: 8, august: 8,
  settembre: 9, september: 9, ottobre: 10, october: 10, novembre: 11, november: 11, dicembre: 12, december: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseConfirmationDate(value: string) {
  const source = value.toLowerCase().replace(/\s+/g, " ");
  const iso = source.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = source.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
  if (numeric) return isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const dayFirst = source.match(/\b(\d{1,2})\s+(gennaio|january|febbraio|february|marzo|march|aprile|april|maggio|may|giugno|june|luglio|july|agosto|august|settembre|september|ottobre|october|novembre|november|dicembre|december)\s+(20\d{2})\b/);
  if (dayFirst) return isoDate(Number(dayFirst[3]), MONTHS[dayFirst[2]], Number(dayFirst[1]));
  const monthFirst = source.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/);
  if (monthFirst) return isoDate(Number(monthFirst[3]), MONTHS[monthFirst[1]], Number(monthFirst[2]));
  return "";
}

function valueAfterLabel(text: string, labels: string) {
  const match = text.match(new RegExp(`(?:${labels})\\s*[:\\-]?\\s*([^\\n]{2,140})`, "i"));
  return match?.[1]?.trim() || "";
}

function bookingFields(rawText: string) {
  const text = rawText.replace(/\r/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const hotel = valueAfterLabel(text, "prenotazione (?:confermata )?(?:presso|a)|booking (?:confirmed )?at|nome (?:della )?struttura|property name|accommodation")
    .replace(/\s+(?:è confermata|is confirmed).*$/i, "");
  const location = valueAfterLabel(text, "indirizzo(?: della struttura)?|address")
    .replace(/\s+(?:telefono|phone|check[ -]?in).*$/i, "");
  const checkInBlock = valueAfterLabel(text, "check[ -]?in|arrivo|arrival");
  const checkOutBlock = valueAfterLabel(text, "check[ -]?out|partenza|departure");
  const amountMatch = text.match(/(?:prezzo totale|totale|importo totale|total price|total amount)\s*[:\-]?\s*(?:€|EUR)?\s*([0-9][0-9., ]*)/i)
    || text.match(/(?:€|EUR)\s*([0-9][0-9., ]*)/i);
  let cost = amountMatch?.[1]?.trim().replace(/\s/g, "") || "";
  if (cost.includes(",") && cost.includes(".")) cost = cost.lastIndexOf(",") > cost.lastIndexOf(".") ? cost.replace(/\./g, "") : cost.replace(/,/g, "");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(cost)) cost = cost.replace(/\./g, "");
  return { hotel, location, checkIn: parseConfirmationDate(checkInBlock), checkOut: parseConfirmationDate(checkOutBlock), cost };
}

function readableEmailText(raw: string) {
  let text = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, value: string) => String.fromCharCode(parseInt(value, 16)));
  if (/<(?:html|body|div|p|br|table)\b/i.test(text)) {
    const withLines = text.replace(/<(?:br\s*\/?|\/p|\/div|\/tr|\/li)>/gi, "\n");
    text = new DOMParser().parseFromString(withLines, "text/html").body.textContent || text;
  }
  return text;
}

async function readBookingFile(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return pages.join("\n");
  }
  return readableEmailText(await file.text());
}

function storedVacation(): StoredVacation {
  if (typeof window === "undefined") return { hotels: [], plan: [], updatedAt: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as StoredVacation | null;
    if (saved && Array.isArray(saved.hotels) && Array.isArray(saved.plan)) return saved;
  } catch { /* Il modulo riparte vuoto se il dato locale è danneggiato. */ }
  return { hotels: [], plan: [], updatedAt: "" };
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return parseLocalDate(value).toLocaleDateString("it-IT", options ?? { weekday: "long", day: "numeric", month: "long" });
}

function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (cursor < last) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function nights(stay: HotelStay) {
  if (!stay.checkIn || !stay.checkOut) return 0;
  return Math.max(0, Math.round((parseLocalDate(stay.checkOut).getTime() - parseLocalDate(stay.checkIn).getTime()) / 86400000));
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function uniqueItems(items: OsmItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}-${item.lat.toFixed(4)}-${item.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickDayStops(items: OsmItem[], used: Set<string>, dayIndex: number) {
  const available = items.filter((item) => !used.has(item.id));
  const food = available.filter((item) => /ristor|caffè|gelateria|fast food|area ristorazione/i.test(item.category));
  const highlights = available.filter((item) => /museo|galleria|monumento|storico|castello|archeologico|panoramico|parco|riserva|giardino|spiaggia|cascata|grotta|faro|zoo|acquario|teatro|attrazione/i.test(item.category));
  const visits = highlights.length >= 2 ? highlights : available.filter((item) => !food.includes(item));
  const selected: OsmItem[] = [];
  const take = (pool: OsmItem[], offset = 0) => {
    const item = pool[(dayIndex + offset) % Math.max(pool.length, 1)];
    if (item && !selected.some((value) => value.id === item.id)) selected.push(item);
  };
  take(visits);
  take(food);
  take(visits, Math.ceil(visits.length / 2));
  if (selected.length < 3) available.forEach((item) => { if (selected.length < 3 && !selected.some((value) => value.id === item.id)) selected.push(item); });
  selected.forEach((item) => used.add(item.id));
  return selected.map((item, index) => ({ ...item, moment: MOMENTS[index] ?? "Sera" }));
}

export function VacationPlanner() {
  const [initialVacation] = useState(storedVacation);
  const [hotels, setHotels] = useState<HotelStay[]>(initialVacation.hotels);
  const [plan, setPlan] = useState<VacationDay[]>(initialVacation.plan);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [bookingImportOpen, setBookingImportOpen] = useState(false);
  const [bookingText, setBookingText] = useState("");
  const [bookingFileName, setBookingFileName] = useState("");
  const [bookingImportLoading, setBookingImportLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hotels, plan, updatedAt: new Date().toISOString() } satisfies StoredVacation));
  }, [hotels, plan]);

  const orderedHotels = useMemo(() => [...hotels].sort((a, b) => a.checkIn.localeCompare(b.checkIn)), [hotels]);
  const totalCost = useMemo(() => hotels.reduce((sum, stay) => sum + stay.cost, 0), [hotels]);
  const totalNights = useMemo(() => hotels.reduce((sum, stay) => sum + nights(stay), 0), [hotels]);
  const mapPoints = useMemo<VacationMapPoint[]>(() => {
    const result: VacationMapPoint[] = hotels.filter((stay) => Number.isFinite(stay.lat) && Number.isFinite(stay.lng)).map((stay) => ({
      id: stay.id, name: stay.hotel, category: "Alloggio", lat: stay.lat!, lng: stay.lng!, kind: "hotel",
    }));
    const seen = new Set<string>();
    plan.forEach((day, index) => day.stops.forEach((stop) => {
      if (seen.has(stop.id)) return;
      seen.add(stop.id);
      result.push({ id: `${day.date}-${stop.id}`, name: stop.name, category: stop.category, lat: stop.lat, lng: stop.lng, kind: "stop", day: index + 1 });
    }));
    return result;
  }, [hotels, plan]);

  function submitHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const cost = Number(form.cost.replace(",", "."));
    if (!form.hotel.trim() || !form.location.trim() || !form.checkIn || !form.checkOut || parseLocalDate(form.checkOut) <= parseLocalDate(form.checkIn) || !Number.isFinite(cost) || cost < 0) {
      setMessage("Controlla albergo, località, date e costo. Il check-out deve essere successivo al check-in.");
      return;
    }
    const stay: HotelStay = { id: editingId ?? crypto.randomUUID(), hotel: form.hotel.trim(), location: form.location.trim(), checkIn: form.checkIn, checkOut: form.checkOut, cost };
    setHotels((current) => editingId ? current.map((item) => item.id === editingId ? stay : item) : [...current, stay]);
    setPlan([]);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage(editingId ? "Alloggio aggiornato. Rigenera il programma." : "Alloggio aggiunto. Puoi inserirne un altro oppure creare la vacanza.");
  }

  function importBookingText(text = bookingText) {
    const imported = bookingFields(text);
    const found = Object.entries(imported).filter(([, value]) => Boolean(value)).map(([key]) => key);
    if (!found.length) {
      setMessage("Non riconosco i dati della prenotazione. Incolla il testo completo della conferma Booking oppure compila i campi manualmente.");
      return;
    }
    setForm((current) => ({
      hotel: imported.hotel || current.hotel,
      location: imported.location || current.location,
      checkIn: imported.checkIn || current.checkIn,
      checkOut: imported.checkOut || current.checkOut,
      cost: imported.cost || current.cost,
    }));
    setBookingImportOpen(false);
    const missing = [!imported.hotel && "nome albergo", !imported.location && "indirizzo", !imported.checkIn && "check-in", !imported.checkOut && "check-out", !imported.cost && "costo"].filter(Boolean);
    setMessage(missing.length ? `Prenotazione importata. Controlla e completa: ${missing.join(", ")}.` : "Prenotazione Booking importata. Controlla i dati e premi “Aggiungi albergo”.");
  }

  async function importBookingFile(file: File) {
    setBookingImportLoading(true);
    setBookingFileName(file.name);
    setMessage("Leggo la conferma Booking…");
    try {
      const text = await readBookingFile(file);
      setBookingText(text);
      importBookingText(text);
    } catch {
      setMessage("Non riesco a leggere questo file. Prova a incollare il testo della conferma Booking nel riquadro.");
    } finally { setBookingImportLoading(false); }
  }

  function editHotel(stay: HotelStay) {
    setEditingId(stay.id);
    setForm({ hotel: stay.hotel, location: stay.location, checkIn: stay.checkIn, checkOut: stay.checkOut, cost: String(stay.cost).replace(".", ",") });
    document.getElementById("vacation-hotel-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function resolveHotel(stay: HotelStay) {
    if (Number.isFinite(stay.lat) && Number.isFinite(stay.lng)) return stay;
    const query = new URLSearchParams({ q: `${stay.hotel}, ${stay.location}` });
    const response = await fetch(`/.netlify/functions/geocode-place?${query}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${stay.hotel}: ${data.error || "località non trovata"}`);
    return { ...stay, lat: Number(data.lat), lng: Number(data.lng), resolvedAddress: String(data.name || stay.location) };
  }

  async function loadPois(stay: HotelStay) {
    const lat = stay.lat!;
    const lng = stay.lng!;
    const radius = 0.075;
    const query = new URLSearchParams({
      south: String(lat - radius), west: String(lng - radius), north: String(lat + radius), east: String(lng + radius), zoom: "13", layer: "tourism",
      categories: "cultura,natura,cibo,shopping,divertimento,famiglia,tour",
    });
    const response = await fetch(`/.netlify/functions/osm-pois?${query}`);
    const data = await response.json().catch(() => ({})) as { items?: OsmItem[]; error?: string };
    if (!response.ok) throw new Error(data.error || `Non trovo attività vicino a ${stay.hotel}`);
    return uniqueItems(Array.isArray(data.items) ? data.items : []).sort((a, b) => distanceKm(stay as HotelStay & { lat: number; lng: number }, a) - distanceKm(stay as HotelStay & { lat: number; lng: number }, b));
  }

  async function generateVacation() {
    if (!hotels.length) { setMessage("Inserisci almeno un albergo prima di creare la vacanza."); return; }
    const chronological = [...orderedHotels];
    const overlap = chronological.some((stay, index) => index > 0 && stay.checkIn < chronological[index - 1].checkOut);
    if (overlap) { setMessage("Le date di due alloggi si sovrappongono. Correggile prima di creare il programma."); return; }
    setLoading(true);
    setMessage("Localizzo gli alberghi e cerco le esperienze migliori nei dintorni…");
    try {
      const resolved: HotelStay[] = [];
      for (const stay of orderedHotels) resolved.push(await resolveHotel(stay));
      const generated: VacationDay[] = [];
      for (const stay of resolved) {
        const poi = await loadPois(stay);
        const used = new Set<string>();
        const stayDates = dateRange(stay.checkIn, stay.checkOut);
        stayDates.forEach((date, dayIndex) => {
          const stops = pickDayStops(poi, used, dayIndex);
          generated.push({
            date,
            hotelId: stay.id,
            title: dayIndex === 0 ? `Arrivo a ${stay.location}` : `Alla scoperta di ${stay.location}`,
            note: dayIndex === 0 ? `Check-in presso ${stay.hotel}. Programma leggero per iniziare la vacanza senza fretta.` : `Giornata organizzata partendo da ${stay.hotel}, con tappe vicine per ridurre gli spostamenti.`,
            stops,
          });
        });
      }
      const lastStay = resolved.at(-1)!;
      generated.push({ date: lastStay.checkOut, hotelId: lastStay.id, title: "Ultimo giorno e rientro", note: `Check-out da ${lastStay.hotel}. Controlla bagagli e orario di partenza.`, stops: [], departure: true });
      setHotels(resolved);
      setPlan(generated.sort((a, b) => a.date.localeCompare(b.date)));
      setOpenDays(new Set(generated.slice(0, 2).map((day) => day.date)));
      setMessage(`Vacanza pronta: ${generated.length} giorni organizzati e ${generated.reduce((sum, day) => sum + day.stops.length, 0)} tappe sulla mappa.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Non sono riuscito a creare il programma. Riprova tra poco.");
    } finally { setLoading(false); }
  }

  function sharePlan() {
    const text = plan.map((day, index) => `Giorno ${index + 1} · ${formatDate(day.date)}\n${day.title}\n${day.stops.map((stop) => `- ${stop.moment}: ${stop.name}`).join("\n")}`).join("\n\n");
    if (navigator.share) void navigator.share({ title: "La mia vacanza · Varga Tour", text });
    else void navigator.clipboard?.writeText(text).then(() => setMessage("Programma copiato negli appunti."));
  }

  return <section className="vacation-planner">
    <div className="vacation-hero">
      <div><p className="eyebrow"><Sparkles /> Organizzatore automatico</p><h1>La mia vacanza</h1><p>Tu inserisci gli alberghi, le date e quanto hai speso. Varga Tour prepara il viaggio giorno per giorno e mette tutto sulla mappa.</p></div>
      <div className="vacation-summary"><span><BedDouble /><strong>{totalNights}</strong><small>notti</small></span><span><CircleEuro /><strong>{euro(totalCost)}</strong><small>alloggi</small></span><span><CalendarDays /><strong>{plan.length || "—"}</strong><small>giorni</small></span></div>
    </div>

    <div className="vacation-workspace">
      <form id="vacation-hotel-form" className="hotel-form" onSubmit={submitHotel}>
        <div className="vacation-section-heading"><div><p className="eyebrow"><Hotel /> I tuoi alloggi</p><h2>{editingId ? "Modifica albergo" : "Aggiungi un albergo"}</h2></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Annulla</button>}</div>
        <div className="booking-import">
          <button type="button" className="booking-import-toggle" onClick={() => setBookingImportOpen((open) => !open)} aria-expanded={bookingImportOpen}>
            <span><FileUp /><span><strong>Importa prenotazione Booking</strong><small>Da PDF, e-mail o testo della conferma</small></span></span>{bookingImportOpen ? <X /> : <ChevronDown />}
          </button>
          {bookingImportOpen && <div className="booking-import-panel">
            <div className="booking-safety"><ShieldCheck /><span><strong>Connessione sicura</strong><small>Non inserire la password Booking. Il file viene letto soltanto sul tuo dispositivo.</small></span></div>
            <label className="booking-file-picker">
              {bookingImportLoading ? <LoaderCircle className="spin" /> : <FileUp />}
              <span><strong>{bookingFileName || "Scegli conferma Booking"}</strong><small>PDF, EML, HTML oppure TXT</small></span>
              <input type="file" accept=".pdf,.eml,.html,.htm,.txt,application/pdf,message/rfc822,text/plain,text/html" disabled={bookingImportLoading} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importBookingFile(file); }} />
            </label>
            <div className="booking-import-separator"><span>oppure</span></div>
            <label className="booking-paste"><span>Incolla il testo della conferma</span><textarea value={bookingText} onChange={(event) => setBookingText(event.target.value)} placeholder="Copia qui il contenuto dell’e-mail ricevuta da Booking.com…" /></label>
            <Button type="button" className="primary-action" disabled={!bookingText.trim() || bookingImportLoading} onClick={() => importBookingText()}><Check /> Compila automaticamente</Button>
          </div>}
        </div>
        <label><span>Nome dell’albergo</span><input required value={form.hotel} onChange={(event) => setForm({ ...form, hotel: event.target.value })} placeholder="Es. Hotel Roma" /></label>
        <label className="wide"><span>Città e indirizzo</span><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Es. Via Nazionale 10, Roma" /></label>
        <label><span>Check-in</span><input required type="date" value={form.checkIn} onChange={(event) => setForm({ ...form, checkIn: event.target.value })} /></label>
        <label><span>Check-out</span><input required type="date" min={form.checkIn} value={form.checkOut} onChange={(event) => setForm({ ...form, checkOut: event.target.value })} /></label>
        <label><span>Spesa alloggio (€)</span><input required inputMode="decimal" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} placeholder="0,00" /></label>
        <Button type="submit" className="primary-action hotel-submit">{editingId ? <><Check /> Salva modifica</> : <><Plus /> Aggiungi albergo</>}</Button>
      </form>

      <div className="hotel-list-panel">
        <div className="vacation-section-heading"><div><p className="eyebrow">Riepilogo prenotazioni</p><h2>{hotels.length ? `${hotels.length} ${hotels.length === 1 ? "alloggio" : "alloggi"}` : "Nessun alloggio"}</h2></div>{hotels.length > 0 && <strong>{totalNights ? `${euro(totalCost / totalNights)} / notte` : euro(totalCost)}</strong>}</div>
        {!hotels.length ? <div className="hotel-empty"><Hotel /><strong>Inizia dal primo albergo</strong><span>Puoi aggiungere tutte le tappe del viaggio, anche in città diverse.</span></div> : <div className="hotel-list">{orderedHotels.map((stay, index) => <article key={stay.id}>
          <span className="hotel-number">{index + 1}</span><div><small>{formatDate(stay.checkIn, { day: "numeric", month: "short" })} → {formatDate(stay.checkOut, { day: "numeric", month: "short" })} · {nights(stay)} notti</small><strong>{stay.hotel}</strong><span>{stay.location}</span><b>{euro(stay.cost)}</b></div>
          <div className="hotel-row-actions"><button onClick={() => editHotel(stay)} aria-label={`Modifica ${stay.hotel}`}><Pencil /></button><button onClick={() => { setHotels((current) => current.filter((item) => item.id !== stay.id)); setPlan([]); }} aria-label={`Elimina ${stay.hotel}`}><Trash2 /></button></div>
        </article>)}</div>}
        <Button size="lg" className="primary-action generate-vacation" onClick={() => void generateVacation()} disabled={loading || !hotels.length}>{loading ? <><LoaderCircle className="spin" /> Organizzo la vacanza…</> : plan.length ? <><RotateCcw /> Rigenera programma</> : <><Sparkles /> Organizza la mia vacanza</>}</Button>
        {message && <p className="vacation-message" role="status">{message}</p>}
      </div>
    </div>

    {plan.length > 0 && <>
      <div className="vacation-plan-heading"><div><p className="eyebrow"><CalendarDays /> Programma completo</p><h2>Giorno per giorno</h2></div><button onClick={sharePlan}>Condividi programma <ExternalLink /></button></div>
      <div className="vacation-result">
        <div className="vacation-days">{plan.map((day, index) => {
          const stay = hotels.find((item) => item.id === day.hotelId);
          const open = openDays.has(day.date);
          return <article key={`${day.date}-${day.hotelId}`} className={open ? "open" : ""}>
            <button className="vacation-day-header" onClick={() => setOpenDays((current) => { const next = new Set(current); if (next.has(day.date)) next.delete(day.date); else next.add(day.date); return next; })}>
              <span>{index + 1}</span><div><small>{formatDate(day.date)}</small><strong>{day.title}</strong></div>{open ? <ChevronUp /> : <ChevronDown />}
            </button>
            {open && <div className="vacation-day-body"><p>{day.note}</p>{stay && <div className="day-hotel"><Hotel /><span><small>{day.departure ? "Check-out" : "Il tuo alloggio"}</small><strong>{stay.hotel}</strong></span></div>}{day.stops.map((stop) => <div className="day-stop" key={stop.id}><span>{stop.moment}</span><div><small>{stop.category}</small><strong>{stop.name}</strong></div><a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer" aria-label={`Naviga verso ${stop.name}`}><Navigation /></a></div>)}</div>}
          </article>;
        })}</div>
        <div className="vacation-map-panel"><div><MapPinned /><span><strong>Mappa della vacanza</strong><small>Alberghi e tappe del programma</small></span></div><VacationMap points={mapPoints} /></div>
      </div>
    </>}
  </section>;
}
