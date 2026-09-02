const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=120, s-maxage=300",
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

async function overpass(query) {
  let lastError;
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "VargaTour/1.0" },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      return await response.json();
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Overpass non disponibile");
}

function centerOf(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) return { lat: element.lat, lng: element.lon };
  if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) return { lat: element.center.lat, lng: element.center.lon };
  return null;
}

function hubType(tags = {}) {
  if (tags.aeroway === "aerodrome" || tags.aeroway === "terminal") return "airport";
  return "station";
}

function hubLabel(tags = {}) {
  return tags.name || tags["name:it"] || tags.ref || (hubType(tags) === "airport" ? "Aeroporto" : "Stazione");
}

function pointCategory(tags = {}) {
  if (tags.aeroway === "gate") return "Gate";
  if (tags.railway === "platform" || tags.public_transport === "platform") return "Binario / piattaforma";
  if (tags.amenity === "toilets") return "Bagni";
  if (tags.amenity === "information" || tags.information) return "Informazioni";
  if (tags.amenity === "ticket_office" || tags.shop === "ticket") return "Biglietteria";
  if (tags.amenity === "luggage_locker" || tags.amenity === "luggage_storage") return "Deposito bagagli";
  if (tags.amenity === "car_rental") return "Autonoleggio";
  if (tags.amenity === "cafe" || tags.amenity === "restaurant" || tags.amenity === "fast_food") return "Cibo e bevande";
  if (tags.shop) return "Negozio";
  if (tags.highway === "elevator") return "Ascensore";
  if (tags.highway === "steps") return tags.conveying ? "Scala mobile" : "Scale";
  if (tags.entrance || tags.railway === "train_station_entrance") return "Ingresso / uscita";
  if (tags.checkin) return "Check-in";
  if (tags.security) return "Controlli sicurezza";
  if (tags.customs) return "Dogana";
  if (tags.room) return "Locale";
  if (tags.indoor === "corridor") return "Corridoio";
  return "Punto interno";
}

function isUseful(tags = {}) {
  return Boolean(
    tags.name || tags.ref || tags.aeroway === "gate" || tags.railway === "platform" ||
    tags.public_transport === "platform" || tags.amenity || tags.shop || tags.entrance ||
    tags.railway === "train_station_entrance" || tags.highway === "elevator" || tags.highway === "steps" ||
    tags.checkin || tags.security || tags.customs
  );
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}|${item.category}|${item.level || ""}|${item.lat.toFixed(5)}|${item.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function handler(event) {
  try {
    const p = event.queryStringParameters || {};
    const action = p.action || "nearby";

    if (action === "search") {
      const q = String(p.q || "").trim();
      if (q.length < 2) return json(200, { items: [] });
      const url = new URL(NOMINATIM);
      url.search = new URLSearchParams({ q: `${q}, Italia`, format: "jsonv2", countrycodes: "it", limit: "12", addressdetails: "1", extratags: "1" }).toString();
      const response = await fetch(url, { headers: { "user-agent": "VargaTour/1.0 (indoor navigation)" } });
      if (!response.ok) throw new Error("Ricerca struttura non disponibile");
      const data = await response.json();
      const items = data.filter((x) => {
        const text = `${x.type || ""} ${x.category || ""} ${x.display_name || ""}`.toLowerCase();
        return /airport|aerodrome|aeroporto|station|stazione|railway|terminal/.test(text);
      }).map((x) => ({
        id: `nominatim-${x.osm_type}-${x.osm_id}`,
        name: String(x.display_name || "").split(",")[0],
        subtitle: x.display_name,
        type: /airport|aerodrome|aeroporto/.test(`${x.type} ${x.category} ${x.display_name}`.toLowerCase()) ? "airport" : "station",
        lat: Number(x.lat), lng: Number(x.lon), osmType: x.osm_type, osmId: x.osm_id,
      }));
      return json(200, { items });
    }

    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json(400, { error: "Coordinate non valide" });

    if (action === "nearby") {
      const radius = Math.min(50000, Math.max(1000, Number(p.radius) || 25000));
      const query = `[out:json][timeout:20];(nwr(around:${radius},${lat},${lng})[aeroway=aerodrome];nwr(around:${radius},${lat},${lng})[railway=station][station!=subway];);out center tags;`;
      const data = await overpass(query);
      const items = (data.elements || []).map((element) => {
        const c = centerOf(element); if (!c) return null;
        return { id: `osm-${element.type}-${element.id}`, name: hubLabel(element.tags), subtitle: element.tags?.operator || element.tags?.iata || "", type: hubType(element.tags), ...c, osmType: element.type, osmId: element.id };
      }).filter(Boolean).slice(0, 40);
      return json(200, { items });
    }

    if (action === "indoor") {
      const radius = Math.min(2500, Math.max(300, Number(p.radius) || 1200));
      const query = `[out:json][timeout:25];(
        nwr(around:${radius},${lat},${lng})[indoor];
        nwr(around:${radius},${lat},${lng})[aeroway=gate];
        nwr(around:${radius},${lat},${lng})[railway=platform];
        nwr(around:${radius},${lat},${lng})[public_transport=platform];
        nwr(around:${radius},${lat},${lng})[railway=train_station_entrance];
        nwr(around:${radius},${lat},${lng})[entrance];
        nwr(around:${radius},${lat},${lng})[highway=elevator];
        nwr(around:${radius},${lat},${lng})[highway=steps];
        nwr(around:${radius},${lat},${lng})[amenity];
        nwr(around:${radius},${lat},${lng})[shop];
      );out center tags;`;
      const data = await overpass(query);
      const points = unique((data.elements || []).map((element) => {
        const c = centerOf(element); const tags = element.tags || {};
        if (!c || !isUseful(tags)) return null;
        const category = pointCategory(tags);
        const name = tags.name || tags.ref || (category === "Gate" ? `Gate ${tags.ref || ""}`.trim() : category);
        return {
          id: `osm-${element.type}-${element.id}`, name, category, level: tags.level || tags["level:ref"] || "",
          wheelchair: tags.wheelchair || "", ...c, tags: { ref: tags.ref || "", operator: tags.operator || "" },
        };
      }).filter(Boolean)).slice(0, 350);
      const detailed = points.some((x) => x.level || ["Gate", "Binario / piattaforma", "Ascensore", "Scale", "Scala mobile", "Corridoio"].includes(x.category));
      return json(200, { points, detailed, source: "OpenStreetMap contributors" });
    }

    return json(400, { error: "Azione non supportata" });
  } catch (error) {
    return json(502, { error: error instanceof Error ? error.message : "Servizio temporaneamente non disponibile" });
  }
}
