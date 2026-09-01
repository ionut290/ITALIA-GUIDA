const WIKI_API = "https://it.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);

  const url = new URL(request.url);
  const title = (url.searchParams.get("title") || "").trim().slice(0, 180);
  const latValue = url.searchParams.get("lat");
  const lngValue = url.searchParams.get("lng");
  const lat = latValue === null ? NaN : Number(latValue);
  const lng = lngValue === null ? NaN : Number(lngValue);
  if (title.length < 2) return json({ error: "Titolo non valido" }, 400);

  try {
    const [article, commons, youtube, openstreetmap] = await Promise.all([
      resolveWikipediaArticle(title, lat, lng).catch(() => null),
      loadCommonsImages(title),
      loadYoutube(title),
      Number.isFinite(lat) && Number.isFinite(lng) ? loadOpenStreetMap(title, lat, lng) : Promise.resolve(null),
    ]);
    const wikidata = article?.wikibaseItem ? await loadWikidata(article.wikibaseItem) : null;
    const socialMedia = dedupeSocial([
      ...(wikidata?.socialMedia || []),
      ...(openstreetmap?.socialMedia || []),
      ...(article?.socialMedia || []),
      ...socialSearchItems(article?.title || title),
    ]);

    const sources = dedupeLinks([
      article?.pageUrl ? { title: "Wikipedia", url: article.pageUrl, kind: "enciclopedia" } : null,
      article?.wikibaseItem ? { title: "Wikidata", url: `https://www.wikidata.org/wiki/${article.wikibaseItem}`, kind: "dati" } : null,
      { title: "Wikimedia Commons", url: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(article?.title || title)}&title=Special:MediaSearch&type=image`, kind: "foto" },
      openstreetmap?.sourceUrl ? { title: "OpenStreetMap", url: openstreetmap.sourceUrl, kind: "mappa e dati" } : null,
      (wikidata?.officialWebsite || openstreetmap?.officialWebsite) ? { title: "Sito ufficiale", url: wikidata?.officialWebsite || openstreetmap?.officialWebsite, kind: "fonte ufficiale" } : null,
      ...((article?.externalLinks || []).slice(0, 6).map((link) => ({ title: domainLabel(link), url: link, kind: sourceScore(link) >= 20 ? "fonte istituzionale" : "approfondimento" }))),
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
      facts: dedupeFacts([...(wikidata?.facts || []), ...(openstreetmap?.facts || [])]),
      officialWebsite: wikidata?.officialWebsite || openstreetmap?.officialWebsite || "",
      sources,
      socialMedia,
    }, 200, 86400);
  } catch (error) {
    console.error("POI details:", error);
    return json({ error: "Approfondimenti temporaneamente non disponibili" }, 502);
  }
};

export default handler;

async function resolveWikipediaArticle(title, lat, lng) {
  void lat;
  void lng;
  let resolved = title;

  const search = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: title, gsrnamespace: "0", gsrlimit: "5",
    prop: "extracts|pageprops|info|extlinks", exintro: "1", explaintext: "1", inprop: "url",
    ellimit: "50", redirects: "1", format: "json", origin: "*",
  });
  try {
    const searchResponse = await fetch(`${WIKI_API}?${search}`, { signal: AbortSignal.timeout(4000) });
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const pages = Object.values(data.query?.pages || {});
      const best = pages.sort((a, b) => similarity(b.title || "", title) - similarity(a.title || "", title))[0];
      if (best && similarity(best.title || "", title) >= 0.35) resolved = best.title;
    }
  } catch {}

  const params = new URLSearchParams({
    action: "query", prop: "extracts|pageprops|info|extlinks", titles: resolved,
    exintro: "1", explaintext: "1", inprop: "url", ellimit: "50", redirects: "1",
    format: "json", origin: "*",
  });
  let data;
  try {
    const response = await fetch(`${WIKI_API}?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    data = await response.json();
  } catch {
    return null;
  }
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing !== undefined) return null;

  const externalLinks = (page.extlinks || []).map((item) => item["*"]).filter(Boolean);
  return {
    title: page.title,
    extract: page.extract || "",
    description: "",
    pageUrl: page.fullurl || `https://it.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replaceAll(" ", "_"))}`,
    wikibaseItem: page.pageprops?.wikibase_item || "",
    externalLinks: externalLinks.filter(isUsefulExternalLink).sort((a, b) => sourceScore(b) - sourceScore(a)),
    socialMedia: externalLinks.map((link) => socialFromUrl(link, "linked")).filter(Boolean),
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
    videoSyndicated: "true",
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
    const related = {
      "Tipologia": entityIds(entity.claims?.P31),
      "Architetto / autore": entityIds(entity.claims?.P84),
      "Stile architettonico": entityIds(entity.claims?.P149),
      "Tutela": entityIds(entity.claims?.P1435),
    };
    const labels = await loadWikidataLabels([...new Set(Object.values(related).flat())]);
    const facts = [];
    if (inception) facts.push({ label: "Data / periodo", value: inception });
    for (const [label, ids] of Object.entries(related)) {
      const values = ids.map((relatedId) => labels[relatedId]).filter(Boolean);
      if (values.length) facts.push({ label, value: [...new Set(values)].slice(0, 3).join(", ") });
    }
    if (coordinate) facts.push({ label: "Coordinate", value: coordinate });
    const socialMedia = [
      socialProfile("Instagram", claimValue(entity.claims?.P2003?.[0]), (value) => `https://www.instagram.com/${encodeURIComponent(value)}/`),
      socialProfile("Facebook", claimValue(entity.claims?.P2013?.[0]), (value) => `https://www.facebook.com/${encodeURIComponent(value)}`),
      socialProfile("YouTube", claimValue(entity.claims?.P2397?.[0]), (value) => `https://www.youtube.com/channel/${encodeURIComponent(value)}`),
      socialProfile("TikTok", claimValue(entity.claims?.P7085?.[0]), (value) => `https://www.tiktok.com/@${encodeURIComponent(value)}`),
      socialProfile("X", claimValue(entity.claims?.P2002?.[0]), (value) => `https://x.com/${encodeURIComponent(value)}`),
      socialProfile("Flickr", claimValue(entity.claims?.P3267?.[0]), (value) => `https://www.flickr.com/people/${encodeURIComponent(value)}`),
    ].filter(Boolean);
    return { officialWebsite: typeof website === "string" ? website : "", facts, socialMedia };
  } catch {
    return null;
  }
}

async function loadWikidataLabels(ids) {
  if (!ids.length) return {};
  try {
    const params = new URLSearchParams({ action: "wbgetentities", ids: ids.slice(0, 30).join("|"), props: "labels", languages: "it|en", format: "json", origin: "*" });
    const response = await fetch(`${WIKIDATA_API}?${params}`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return {};
    const entities = (await response.json()).entities || {};
    return Object.fromEntries(Object.entries(entities).map(([entityId, entity]) => [entityId, entity.labels?.it?.value || entity.labels?.en?.value || ""]));
  } catch {
    return {};
  }
}

async function loadOpenStreetMap(title, lat, lng) {
  const query = `[out:json][timeout:6];nwr(around:120,${lat},${lng})["name"];out center tags 30;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "Italia-Guida/1.1" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(7500),
    });
    if (!response.ok) return null;
    const elements = (await response.json()).elements || [];
    const candidates = elements
      .map((element) => ({ element, score: similarity(element.tags?.["name:it"] || element.tags?.name || "", title) }))
      .filter((candidate) => candidate.score >= 0.48)
      .sort((a, b) => b.score - a.score);
    const element = candidates[0]?.element;
    if (!element) return null;
    const tags = element.tags || {};
    const facts = [];
    if (tags.start_date) facts.push({ label: "Periodo (OpenStreetMap)", value: tags.start_date });
    if (tags.architect) facts.push({ label: "Architetto (OpenStreetMap)", value: tags.architect });
    if (tags.architectural_style) facts.push({ label: "Stile (OpenStreetMap)", value: tags.architectural_style });
    if (tags.opening_hours) facts.push({ label: "Orari indicativi", value: tags.opening_hours });
    if (tags.fee) facts.push({ label: "Ingresso", value: tags.fee === "no" ? "Gratuito" : tags.fee === "yes" ? "A pagamento" : tags.fee });
    return {
      facts,
      officialWebsite: tags.website || tags["contact:website"] || "",
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      socialMedia: [
        socialFromTag("Instagram", tags["contact:instagram"] || tags.instagram),
        socialFromTag("Facebook", tags["contact:facebook"] || tags.facebook),
        socialFromTag("YouTube", tags["contact:youtube"] || tags.youtube),
        socialFromTag("TikTok", tags["contact:tiktok"] || tags.tiktok),
        socialFromTag("X", tags["contact:twitter"] || tags.twitter),
        socialFromTag("Flickr", tags["contact:flickr"] || tags.flickr),
      ].filter(Boolean),
    };
  } catch {
    return null;
  }
}

function claimValue(claim) {
  return claim?.mainsnak?.datavalue?.value ?? null;
}
function entityIds(claims = []) {
  return claims.map((claim) => claimValue(claim)?.id).filter((id) => typeof id === "string");
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
    return !/(wikipedia|wikimedia|wikidata|facebook|instagram|twitter|x\.com|youtube|youtu\.be|web\.archive|viaf\.org|wordpress|blogspot)/i.test(host);
  } catch { return false; }
}
function sourceScore(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    if (/\.gov\.it$|\.comune\.|comune\.|cultura\.gov\.it|unesco\.org|\.edu$|\.unibo\.it$/.test(host)) return 40;
    if (/muse|fondazione|biblioteca|turismo|welcome|official/.test(host)) return 25;
    if (/treccani|enciclopedia|istituto/.test(host)) return 18;
    return 5;
  } catch { return 0; }
}
function domainLabel(link) {
  try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return "Approfondimento"; }
}
function socialProfile(platform, rawValue, buildUrl) {
  const value = String(rawValue || "").trim().replace(/^@/, "");
  if (!value) return null;
  return { platform, title: `Profilo ufficiale ${platform}`, url: buildUrl(value), handle: platform === "YouTube" ? "" : `@${value}`, kind: "official" };
}
function socialFromTag(platform, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    const parsed = socialFromUrl(value, "official");
    return parsed || { platform, title: `Profilo ufficiale ${platform}`, url: value, kind: "official" };
  }
  const clean = value.replace(/^@/, "");
  const builders = {
    Instagram: (item) => `https://www.instagram.com/${encodeURIComponent(item)}/`,
    Facebook: (item) => `https://www.facebook.com/${encodeURIComponent(item)}`,
    YouTube: (item) => item.startsWith("UC") ? `https://www.youtube.com/channel/${encodeURIComponent(item)}` : `https://www.youtube.com/@${encodeURIComponent(item)}`,
    TikTok: (item) => `https://www.tiktok.com/@${encodeURIComponent(item)}`,
    X: (item) => `https://x.com/${encodeURIComponent(item)}`,
    Flickr: (item) => `https://www.flickr.com/people/${encodeURIComponent(item)}`,
  };
  const buildUrl = builders[platform];
  return buildUrl ? { platform, title: `Profilo ufficiale ${platform}`, url: buildUrl(clean), handle: platform === "YouTube" ? "" : `@${clean}`, kind: "official" } : null;
}
function socialFromUrl(link, kind = "linked") {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let platform = "";
    if (host === "youtu.be" || host.endsWith("youtube.com")) platform = "YouTube";
    else if (host.endsWith("instagram.com")) platform = "Instagram";
    else if (host.endsWith("tiktok.com")) platform = "TikTok";
    else if (host.endsWith("facebook.com") || host === "fb.com") platform = "Facebook";
    else if (host === "x.com" || host.endsWith("twitter.com")) platform = "X";
    else if (host.endsWith("flickr.com")) platform = "Flickr";
    if (!platform) return null;
    const isPost = /\/(watch|shorts|reel|reels|p|video|videos)\b/i.test(url.pathname) || host === "youtu.be";
    return { platform, title: isPost ? `Contenuto su ${platform}` : `Profilo su ${platform}`, url: url.href, kind };
  } catch { return null; }
}
function socialSearchItems(title) {
  const touristQuery = `${title} Italia guida turistica`;
  return [
    { platform: "YouTube", title: "Cerca altri video", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(touristQuery)}`, kind: "search" },
    { platform: "TikTok", title: "Cerca video del luogo", url: `https://www.tiktok.com/search?q=${encodeURIComponent(`${title} Italia`)}`, kind: "search" },
    { platform: "Instagram", title: "Cerca foto e Reel", url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(title)}`, kind: "search" },
  ];
}
function dedupeLinks(items) {
  const seen = new Set();
  return items.filter((item) => item?.url && !seen.has(item.url) && seen.add(item.url)).slice(0, 12);
}
function dedupeSocial(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.url || !item?.platform) return false;
    const key = String(item.url).replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => socialKindScore(b.kind) - socialKindScore(a.kind)).slice(0, 12);
}
function socialKindScore(kind) {
  return kind === "official" ? 30 : kind === "linked" ? 20 : 10;
}
function dedupeFacts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${normalize(item?.label)}:${normalize(item?.value)}`;
    if (!item?.label || !item?.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
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
