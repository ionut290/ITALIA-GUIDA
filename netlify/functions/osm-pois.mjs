const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ITALY = { south: 35.2, west: 6.3, north: 47.2, east: 18.9 };

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const url = new URL(request.url);
  const south = clamp(finiteNumber(url.searchParams.get("south")), ITALY.south, ITALY.north);
  const west = clamp(finiteNumber(url.searchParams.get("west")), ITALY.west, ITALY.east);
  const north = clamp(finiteNumber(url.searchParams.get("north")), ITALY.south, ITALY.north);
  const east = clamp(finiteNumber(url.searchParams.get("east")), ITALY.west, ITALY.east);
  const zoom = finiteNumber(url.searchParams.get("zoom"));
  const layer = url.searchParams.get("layer") === "services" ? "services" : "tourism";
  if ([south, west, north, east, zoom].some((value) => value === null) || south >= north || west >= east) {
    return json({ error: "Area non valida" }, 400);
  }
  if (zoom < 10) return json({ items: [], zoomRequired: true }, 200, 300);
  if (north - south > 1.6 || east - west > 2.2) return json({ error: "Area troppo estesa: aumenta lo zoom" }, 400);

  const bbox = `${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)}`;
  const query = layer === "services" ? `[out:json][timeout:20];
(
  nwr["amenity"~"^(toilets|drinking_water|pharmacy|hospital|clinic|police|parking|charging_station|bus_station)$"](${bbox});
  nwr["tourism"="information"](${bbox});
);
out center tags qt 300;` : `[out:json][timeout:20];
(
  nwr["name"]["tourism"~"^(attraction|museum|gallery|viewpoint|artwork|zoo|aquarium|theme_park)$"](${bbox});
  nwr["name"]["historic"](${bbox});
  nwr["name"]["amenity"="place_of_worship"](${bbox});
  nwr["name"]["amenity"~"^(theatre|cinema)$"](${bbox});
  nwr["name"]["leisure"~"^(water_park|park|sports_centre|escape_game|amusement_arcade)$"](${bbox});
  nwr["name"]["man_made"="lighthouse"](${bbox});
  nwr["name"]["natural"="peak"](${bbox});
);
out center tags qt 300;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "Italia-Guida/1.0" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    const data = await response.json();
    const items = (Array.isArray(data.elements) ? data.elements : []).map(normalize).filter(Boolean);
    return json({ items, truncated: items.length >= 300, layer }, 200, 900);
  } catch (error) {
    console.error("OpenStreetMap POI:", error);
    return json({ error: "Punti turistici temporaneamente non disponibili" }, 502);
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
    name,
    category,
    lat,
    lng,
    wikipediaTitle,
    sourceUrl: wikipediaTitle
      ? `https://it.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle.replaceAll(" ", "_"))}`
      : `https://www.openstreetmap.org/${element.type}/${element.id}`,
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
  if (tags.leisure === "sports_centre") return "Centro sportivo";
  if (tags.leisure === "escape_game") return "Escape room";
  if (tags.leisure === "amusement_arcade") return "Sala giochi";
  if (tags.amenity === "place_of_worship") return "Luogo di culto";
  if (tags.man_made === "lighthouse") return "Faro";
  if (tags.natural === "peak") return "Cima panoramica";
  if (tags.historic === "archaeological_site") return "Sito archeologico";
  if (tags.historic === "memorial") return "Memoriale";
  if (tags.historic === "castle") return "Castello";
  if (tags.historic) return "Monumento storico";
  return "Attrazione turistica";
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function clamp(value, minimum, maximum) {
  return value === null ? null : Math.min(maximum, Math.max(minimum, value));
}
function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600` : "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
