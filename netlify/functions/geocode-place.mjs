const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 240);
  if (query.length < 3) return json({ error: "Inserisci il nome dell’albergo e la località" }, 400);

  const search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "it",
    addressdetails: "1",
  });

  try {
    const response = await fetch(`${NOMINATIM_URL}?${search}`, {
      headers: { "User-Agent": "Varga-Tour/1.0 (travel planner)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const [result] = await response.json();
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!result || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: "Albergo o località non trovati. Aggiungi città e indirizzo." }, 404);
    }
    return json({ name: result.display_name, lat, lng }, 200, 86400);
  } catch (error) {
    console.error("Geocodifica alloggio:", error);
    return json({ error: "Ricerca dell’alloggio temporaneamente non disponibile" }, 502);
  }
};

export default handler;

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
