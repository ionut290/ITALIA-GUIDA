const API_ROOT = "https://api.izi.travel";
const MEDIA_ROOT = "https://media.izi.travel";

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const apiKey = Netlify.env.get("IZI_TRAVEL_API_KEY");
  if (!apiKey) return json({ configured: false, items: [] });

  const url = new URL(request.url);
  try {
    if (url.searchParams.get("action") === "nearby") return await nearby(url, apiKey);
    if (url.searchParams.get("action") === "detail") return await detail(url, apiKey);
    return json({ error: "Azione non valida" }, 400);
  } catch (error) {
    console.error("izi.TRAVEL:", error);
    return json({ configured: true, error: "Servizio audioguide temporaneamente non disponibile" }, 502);
  }
};

export default handler;

async function nearby(url, apiKey) {
  const lat = finiteNumber(url.searchParams.get("lat"));
  const lon = finiteNumber(url.searchParams.get("lon"));
  const radius = Math.min(10000, Math.max(100, finiteNumber(url.searchParams.get("radius")) || 10000));
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: "Coordinate non valide" }, 400);

  const query = new URLSearchParams({
    languages: "it,en", version: "1.8", type: "museum,tour,tourist_attraction",
    form: "compact", includes: "geo_distance,content_provider", lat_lon: `${lat},${lon}`,
    radius: String(radius), geo_search_type: "location", limit: "35",
  });
  const data = await iziFetch(`${API_ROOT}/mtg/objects/search?${query}`, apiKey);
  return json({ configured: true, items: (Array.isArray(data) ? data : []).map(normalizeNearby).filter(Boolean) }, 200, 600);
}

async function detail(url, apiKey) {
  const id = url.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Identificatore non valido" }, 400);
  const query = new URLSearchParams({ languages: "it,en,any", version: "1.8", form: "full", media_links: "true" });
  const data = await iziFetch(`${API_ROOT}/mtgobjects/${encodeURIComponent(id)}?${query}`, apiKey);
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return json({ configured: true, item: null }, 404);
  return json({ configured: true, item: normalizeDetail(item) }, 200, 1800);
}

async function iziFetch(url, apiKey) {
  const response = await fetch(url, {
    headers: { "X-IZI-API-KEY": apiKey, Accept: "application/izi-api-v1.8+json", "User-Agent": "Italia-Guida/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`izi.TRAVEL ${response.status}`);
  return response.json();
}

function normalizeNearby(item) {
  const content = preferredContent(item.content);
  const lat = finiteNumber(item.location?.latitude);
  const lon = finiteNumber(item.location?.longitude);
  if (!item.uuid || !content?.title || lat === null || lon === null) return null;
  return {
    id: `izi-${item.uuid}`, iziId: item.uuid, name: content.title, lat, lon,
    category: ({ museum: "Museo con audioguida", tour: "Tour guidato", tourist_attraction: "Attrazione con audioguida" })[item.type] || "Audioguida",
    distance: finiteNumber(item.geo_distance),
  };
}

function normalizeDetail(item) {
  const content = preferredContent(item.content) || {};
  const providerId = item.content_provider?.uuid;
  const images = (content.images || []).filter((media) => ["story", "map"].includes(media.type)).map((media) => ({
    url: media.url || mediaUrl(providerId, media.uuid, media.type === "story" ? "_800x600.jpg" : ".jpg"),
    originalUrl: media.url || mediaUrl(providerId, media.uuid, media.type === "story" ? "_1600x1200.jpg" : ".jpg"),
    title: media.title || content.title,
  })).filter((media) => media.url);
  const audio = (content.audio || []).find((media) => media.type === "story") || content.audio?.[0];
  const rawVideos = Array.isArray(content.video) ? content.video : content.video ? [content.video] : [];
  return {
    description: stripHtml([content.summary, content.desc].filter(Boolean).join("\n\n")),
    images,
    audioUrl: audio?.url || mediaUrl(providerId, audio?.uuid, ".m4a"),
    videos: rawVideos.map((media) => media.type === "youtube"
      ? { type: "youtube", url: media.url, title: media.title || content.title }
      : { type: "video", url: media.url || mediaUrl(providerId, media.uuid, ".mp4"), title: media.title || content.title }).filter((media) => media.url),
    sourceUrl: "https://izi.travel/it",
    attribution: `Audioguida e media: izi.TRAVEL${item.content_provider?.name ? ` · ${item.content_provider.name}` : ""}. Diritti indicati dal fornitore del contenuto.`,
  };
}

function preferredContent(content) {
  if (!Array.isArray(content)) return null;
  return content.find((entry) => entry.language === "it") || content.find((entry) => entry.language === "en") || content[0] || null;
}
function mediaUrl(providerId, mediaId, suffix) { return providerId && mediaId ? `${MEDIA_ROOT}/${providerId}/${mediaId}${suffix}` : ""; }
function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function stripHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
}
function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
