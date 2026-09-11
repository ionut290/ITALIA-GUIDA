const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ITALY = { south: 35.2, west: 6.3, north: 47.2, east: 18.9 };

const CATEGORY_QUERIES = {
  cultura: [
    'nwr["name"]["tourism"~"^(attraction|museum|gallery|viewpoint|artwork)$"]',
    'nwr["name"]["historic"]',
    'nwr["name"]["amenity"="place_of_worship"]',
    'nwr["name"]["man_made"="lighthouse"]',
  ],
  natura: [
    'nwr["name"]["natural"~"^(peak|beach|cave_entrance|waterfall|spring)$"]',
    'nwr["name"]["leisure"~"^(park|nature_reserve|garden)$"]',
    'nwr["name"]["tourism"="viewpoint"]',
  ],
  cibo: [
    'nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|pub|bar)$"]',
    'nwr["name"]["shop"~"^(bakery|deli|cheese|wine|confectionery)$"]',
  ],
  shopping: [
    'nwr["name"]["shop"]',
    'nwr["name"]["amenity"="marketplace"]',
    'nwr["name"]["shop"="mall"]',
  ],
  divertimento: [
    'nwr["name"]["tourism"~"^(zoo|aquarium|theme_park)$"]',
    'nwr["name"]["amenity"~"^(theatre|cinema)$"]',
    'nwr["name"]["leisure"~"^(water_park|sports_centre|escape_game|amusement_arcade|bowling_alley)$"]',
  ],
  notte: [
    'nwr["name"]["amenity"~"^(nightclub|bar|pub|music_venue)$"]',
    'nwr["name"]["leisure"="dance"]',
  ],
  famiglia: [
    'nwr["name"]["tourism"~"^(zoo|aquarium|theme_park)$"]',
    'nwr["name"]["leisure"~"^(playground|water_park|park|amusement_arcade)$"]',
  ],
  tour: [
    'nwr["name"]["tourism"~"^(information|attraction|viewpoint)$"]',
    'nwr["name"]["office"="tourism"]',
  ],
  adulti: [
    'nwr["name"]["amenity"~"^(nightclub|casino|bar|pub)$"]',
    'nwr["name"]["shop"~"^(erotic|adult)$"]',
  ],
};

const SERVICE_QUERIES = [
  'nwr["amenity"~"^(toilets|drinking_water|pharmacy|hospital|clinic|police|parking|charging_station|bus_station)$"]',
  'nwr["tourism"="information"]',
];

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const url = new URL(request.url);
  const south = clamp(finiteNumber(url.searchParams.get("south")), ITALY.south, ITALY.north);
  const west = clamp(finiteNumber(url.searchParams.get("west")), ITALY.west, ITALY.east);
  const north = clamp(finiteNumber(url.searchParams.get("north")), ITALY.south, ITALY.north);
  const east = clamp(finiteNumber(url.searchParams.get("east")), ITALY.west, ITALY.east);
  const zoom = finiteNumber(url.searchParams.get("zoom"));
  const layer = url.searchParams.get("layer") === "services" ? "services" : "tourism";
  const requested = (url.searchParams.get("categories") || "tutto").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if ([south, west, north, east, zoom].some((value) => value === null) || south >= north || west >= east) return json({ error: "Area non valida" }, 400);
  if (zoom < 10) return json({ items: [], zoomRequired: true }, 200, 300);
  if (north - south > 1.6 || east - west > 2.2) return json({ error: "Area troppo estesa: aumenta lo zoom" }, 400);

  const bbox = `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;
  const selectedKeys = requested.includes("tutto") ? Object.keys(CATEGORY_QUERIES) : requested.filter((key) => CATEGORY_QUERIES[key]);
  const templates = layer === "services" ? SERVICE_QUERIES : [...new Set(selectedKeys.flatMap((key) => CATEGORY_QUERIES[key]))];
  const query = `[out:json][timeout:25];\n(\n${templates.map((template) => `  ${template}(${bbox});`).join("\n")}\n);\nout center tags qt 500;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "Italia-Guida/1.1" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    const data = await response.json();
    const items = (Array.isArray(data.elements) ? data.elements : []).map(normalize).filter(Boolean);
    return json({ items, truncated: items.length >= 500, layer, categories: layer === "services" ? ["servizi"] : selectedKeys }, 200, 900);
  } catch (error) {
    console.error("OpenStreetMap POI:", error);
    return json({ error: "Punti di interesse temporaneamente non disponibili" }, 502);
  }
};

export default handler;

function normalize(element) {
  const tags = element.tags || {};
  const lat = finiteNumber(element.lat ?? element.center?.lat);
  const lng = finiteNumber(element.lon ?? element.center?.lon);
  const category = categoryFor(tags);
  const isUsefulService = /^(Bagni pubblici|Fontanella|Farmacia|Ospedale|Clinica|Polizia|Parcheggio|Ricarica elettrica|Stazione autobus|Informazioni turistiche)$/.test(category);
  const name = tags["name:it"] || tags.name || (isUsefulService ? category : "");
  if (!name || lat === null || lng === null) return null;
  const wikipediaTitle = typeof tags.wikipedia === "string" && tags.wikipedia.startsWith("it:") ? tags.wikipedia.slice(3) : "";
  return {
    id: `osm-${element.type}-${element.id}`,
    name, category, lat, lng, wikipediaTitle,
    sourceUrl: wikipediaTitle ? `https://it.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle.replaceAll(" ", "_"))}` : `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

function categoryFor(tags) {
  if (tags.amenity === "toilets") return "Bagni pubblici";
  if (tags.amenity === "drinking_water") return "Fontanella";
  if (tags.amenity === "pharmacy") return "Farmacia";
  if (tags.amenity === "hospital") return "Ospedale";
  if (tags.amenity === "clinic") return "Clinica";
  if (tags.amenity === "police") return "Polizia";
  if (tags.amenity === "parking") return "Parcheggio";
  if (tags.amenity === "charging_station") return "Ricarica elettrica";
  if (tags.amenity === "bus_station") return "Stazione autobus";
  if (tags.tourism === "information") return "Informazioni turistiche";
  if (tags.amenity === "restaurant") return "Ristorante";
  if (tags.amenity === "cafe") return "Caffè";
  if (tags.amenity === "fast_food") return "Fast food";
  if (tags.amenity === "food_court") return "Area ristorazione";
  if (tags.amenity === "ice_cream") return "Gelateria";
  if (tags.amenity === "nightclub") return "Discoteca";
  if (tags.amenity === "music_venue") return "Locale musica";
  if (tags.amenity === "casino") return "Casinò · 18+";
  if (tags.amenity === "bar") return "Bar";
  if (tags.amenity === "pub") return "Pub";
  if (tags.amenity === "marketplace") return "Mercato";
  if (tags.shop === "mall") return "Centro commerciale";
  if (tags.shop === "erotic" || tags.shop === "adult") return "Negozio adulti · 18+";
  if (tags.shop) return "Shopping";
  if (tags.office === "tourism") return "Tour ed esperienze";
  if (tags.tourism === "museum") return "Museo";
  if (tags.tourism === "gallery") return "Galleria";
  if (tags.tourism === "viewpoint") return "Punto panoramico";
  if (tags.tourism === "artwork") return "Opera d’arte";
  if (tags.tourism === "zoo") return "Zoo";
  if (tags.tourism === "aquarium") return "Acquario";
  if (tags.tourism === "theme_park") return "Parco divertimenti";
  if (tags.amenity === "theatre") return "Teatro";
  if (tags.amenity === "cinema") return "Cinema";
  if (tags.leisure === "water_park") return "Parco acquatico";
  if (tags.leisure === "park") return "Parco";
  if (tags.leisure === "nature_reserve") return "Riserva naturale";
  if (tags.leisure === "garden") return "Giardino";
  if (tags.leisure === "playground") return "Area giochi";
  if (tags.leisure === "sports_centre") return "Centro sportivo";
  if (tags.leisure === "escape_game") return "Escape room";
  if (tags.leisure === "amusement_arcade") return "Sala giochi";
  if (tags.leisure === "bowling_alley") return "Bowling";
  if (tags.amenity === "place_of_worship") return "Luogo di culto";
  if (tags.man_made === "lighthouse") return "Faro";
  if (tags.natural === "peak") return "Cima panoramica";
  if (tags.natural === "beach") return "Spiaggia";
  if (tags.natural === "cave_entrance") return "Grotta";
  if (tags.natural === "waterfall") return "Cascata";
  if (tags.natural === "spring") return "Sorgente";
  if (tags.historic === "archaeological_site") return "Sito archeologico";
  if (tags.historic === "memorial") return "Memoriale";
  if (tags.historic === "castle") return "Castello";
  if (tags.historic) return "Monumento storico";
  return "Attrazione turistica";
}

function finiteNumber(value) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function clamp(value, minimum, maximum) { return value === null ? null : Math.min(maximum, Math.max(minimum, value)); }
function json(body, status = 200, maxAge = 0) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600` : "no-store", "X-Content-Type-Options": "nosniff" } }); }
