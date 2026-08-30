const WIKI_API = "https://it.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);

  const url = new URL(request.url);
  const title = (url.searchParams.get("title") || "").trim().slice(0, 180);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (title.length < 2) return json({ error: "Titolo non valido" }, 400);

  try {
    const article = await resolveWikipediaArticle(title, lat, lng);
    const [commons, youtube, wikidata] = await Promise.all([
      loadCommonsImages(article?.title || title),
      loadYoutube(title),
      article?.wikibaseItem ? loadWikidata(article.wikibaseItem) : Promise.resolve(null),
    ]);

    const sources = dedupeLinks([
      article?.pageUrl ? { title: "Wikipedia", url: article.pageUrl, kind: "enciclopedia" } : null,
      article?.wikibaseItem ? { title: "Wikidata", url: `https://www.wikidata.org/wiki/${article.wikibaseItem}`, kind: "dati" } : null,
      { title: "Wikimedia Commons", url: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(article?.title || title)}&title=Special:MediaSearch&type=image`, kind: "foto" },
      ...((article?.externalLinks || []).slice(0, 8).map((link) => ({ title: domainLabel(link), url: link, kind: "articolo" }))),
    ].filter(Boolean));

    return json({
      title: article?.title || title,
      summary: article?.extract || "",
      description: article?.description || "",
      wikipediaUrl: article?.pageUrl || "",
      wikidataId: article?.wikibaseItem || "",
      images: commons,
      videos: youtube.items,
      youtubeConfigured: youtube.configured,
      facts: wikidata?.facts || [],
      officialWebsite: wikidata?.officialWebsite || "",
      sources,
    }, 200, 86400);
  } catch (error) {
    console.error("POI details:", error);
    return json({ error: "Approfondimenti temporaneamente non disponibili" }, 502);
  }
};

export default handler;

async function resolveWikipediaArticle(title, lat, lng) {
  const candidates = [];

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const geo = new URLSearchParams({
      action: "query", list: "geosearch", gscoord: `${lat}|${lng}`, gsradius: "1200",
      gslimit: "12", gsnamespace: "0", format: "json", origin: "*",
    });
    try {
      const response = await fetch(`${WIKI_API}?${geo}`, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const data = await response.json();
        for (const item of data.query?.geosearch || []) candidates.push(item.title);
      }
    } catch {}
  }

  candidates.unshift(title);
  let resolved = candidates.find((candidate) => similarity(candidate, title) >= 0.62) || title;

  const search = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: title, gsrnamespace: "0", gsrlimit: "5",
    prop: "extracts|pageprops|info|extlinks", exintro: "1", explaintext: "1", inprop: "url",
    ellimit: "20", redirects: "1", format: "json", origin: "*",
  });
  const searchResponse = await fetch(`${WIKI_API}?${search}`, { signal: AbortSignal.timeout(8000) });
  if (searchResponse.ok) {
    const data = await searchResponse.json();
    const pages = Object.values(data.query?.pages || {});
    const best = pages.sort((a, b) => similarity(b.title || "", title) - similarity(a.title || "", title))[0];
    if (best && similarity(best.title || "", title) > similarity(resolved, title)) resolved = best.title;
  }

  const params = new URLSearchParams({
    action: "query", prop: "extracts|pageprops|info|extlinks", titles: resolved,
    exintro: "1", explaintext: "1", inprop: "url", ellimit: "20", redirects: "1",
    format: "json", origin: "*",
  });
  const response = await fetch(`${WIKI_API}?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined) return null;

  let description = "";
  try {
    const summaryResponse = await fetch(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(page.title).replaceAll(" ", "_"))}`, { signal: AbortSignal.timeout(6000) });
    if (summaryResponse.ok) description = (await summaryResponse.json()).description || "";
  } catch {}

  return {
    title: page.title,
    extract: page.extract || "",
    description,
    pageUrl: page.fullurl || `https://it.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replaceAll(" ", "_"))}`,
    wikibaseItem: page.pageprops?.wikibase_item || "",
    externalLinks: (page.extlinks || []).map((item) => item["*"]).filter(isUsefulExternalLink),
  };
}

async function loadCommonsImages(title) {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `${title} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "10",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1100", format: "json", origin: "*",
  });
  try {
    const response = await fetch(`${COMMONS_API}?${params}`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data.query?.pages || {}).map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) return null;
      const meta = info.extmetadata || {};
      return {
        url: info.thumburl || info.url,
        originalUrl: info.url,
        title: String(page.title || "").replace(/^File:/, ""),
        author: stripHtml(meta.Artist?.value || "Wikimedia Commons"),
        license: meta.LicenseShortName?.value || "",
        sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      };
    }).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

async function loadYoutube(title) {
  const apiKey = Netlify.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return { configured: false, items: [] };
  const params = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "3", q: `${title} Italia storia visita guidata`,
    relevanceLanguage: "it", regionCode: "IT", safeSearch: "strict", videoEmbeddable: "true", key: apiKey,
  });
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return { configured: true, items: [] };
    const data = await response.json();
    return { configured: true, items: (data.items || []).map((item) => ({
      id: item.id?.videoId,
      title: item.snippet?.title || title,
      channel: item.snippet?.channelTitle || "YouTube",
    })).filter((item) => item.id) };
  } catch {
    return { configured: true, items: [] };
  }
}

async function loadWikidata(id) {
  try {
    const params = new URLSearchParams({ action: "wbgetentities", ids: id, props: "claims|labels", languages: "it|en", format: "json", origin: "*" });
    const response = await fetch(`${WIKIDATA_API}?${params}`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return null;
    const entity = (await response.json()).entities?.[id];
    if (!entity) return null;
    const website = claimValue(entity.claims?.P856?.[0]);
    const inception = timeValue(entity.claims?.P571?.[0]);
    const coordinate = coordinateValue(entity.claims?.P625?.[0]);
    const facts = [];
    if (inception) facts.push({ label: "Data / periodo", value: inception });
    if (coordinate) facts.push({ label: "Coordinate", value: coordinate });
    return { officialWebsite: typeof website === "string" ? website : "", facts };
  } catch {
    return null;
  }
}

function claimValue(claim) {
  return claim?.mainsnak?.datavalue?.value ?? null;
}
function timeValue(claim) {
  const value = claimValue(claim)?.time;
  if (!value) return "";
  const match = String(value).match(/[+-](\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return month === "00" ? year : day === "00" ? `${month}/${year}` : `${day}/${month}/${year}`;
}
function coordinateValue(claim) {
  const value = claimValue(claim);
  if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return "";
  return `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`;
}
function isUsefulExternalLink(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return !/(wikipedia|wikimedia|wikidata|facebook|instagram|twitter|x\.com|youtube|youtu\.be)$/i.test(host);
  } catch { return false; }
}
function domainLabel(link) {
  try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return "Approfondimento"; }
}
function dedupeLinks(items) {
  const seen = new Set();
  return items.filter((item) => item?.url && !seen.has(item.url) && seen.add(item.url)).slice(0, 12);
}
function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function similarity(a, b) {
  const aa = new Set(normalize(a).split(" ").filter((word) => word.length > 2));
  const bb = new Set(normalize(b).split(" ").filter((word) => word.length > 2));
  if (!aa.size || !bb.size) return 0;
  const overlap = [...aa].filter((word) => bb.has(word)).length;
  return overlap / Math.max(aa.size, bb.size);
}
function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}
function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=604800` : "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
