import { lookup } from "node:dns/promises";

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
      loadCommonsImages(title, lat, lng),
      loadYoutube(title),
      Number.isFinite(lat) && Number.isFinite(lng) ? loadOpenStreetMap(title, lat, lng) : Promise.resolve(null),
    ]);
    const likelyOfficialWebsite = openstreetmap?.officialWebsite
      || article?.externalLinks?.find((link) => sourceScore(link) >= 20)
      || "";
    const [wikidata, likelyOfficialPage] = await Promise.all([
      article?.wikibaseItem ? loadWikidata(article.wikibaseItem) : Promise.resolve(null),
      likelyOfficialWebsite ? loadOfficialPage(likelyOfficialWebsite).catch(() => null) : Promise.resolve(null),
    ]);
    const officialWebsite = wikidata?.officialWebsite || likelyOfficialWebsite;
    const officialPage = likelyOfficialPage && sameHost(likelyOfficialWebsite, officialWebsite) ? likelyOfficialPage : null;
    const socialMedia = dedupeSocial([
      ...(wikidata?.socialMedia || []),
      ...(openstreetmap?.socialMedia || []),
      ...(officialPage?.socialMedia || []),
      ...(article?.socialMedia || []),
      ...socialSearchItems(article?.title || title),
    ]);

    const sources = dedupeLinks([
      article?.pageUrl ? { title: "Wikipedia", url: article.pageUrl, kind: "enciclopedia" } : null,
      article?.wikibaseItem ? { title: "Wikidata", url: `https://www.wikidata.org/wiki/${article.wikibaseItem}`, kind: "dati" } : null,
      { title: "Wikimedia Commons", url: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(article?.title || title)}&title=Special:MediaSearch&type=image`, kind: "foto" },
      openstreetmap?.sourceUrl ? { title: "OpenStreetMap", url: openstreetmap.sourceUrl, kind: "mappa e dati" } : null,
      officialWebsite ? { title: "Sito ufficiale", url: officialWebsite, kind: "fonte ufficiale" } : null,
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
      officialWebsite,
      operational: buildOperational(openstreetmap, officialPage, officialWebsite),
      officialMedia: buildOfficialMedia(openstreetmap, officialPage, socialMedia, officialWebsite),
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

async function loadCommonsImages(title, lat, lng) {
  const common = {
    action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1400", format: "json", origin: "*",
  };
  const searches = [new URLSearchParams({
    ...common, generator: "search", gsrsearch: `${title} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "50",
  })];
  if (Number.isFinite(lat) && Number.isFinite(lng)) searches.push(new URLSearchParams({
    ...common, generator: "geosearch", ggsprimary: "all", ggsnamespace: "6", ggsradius: "500",
    ggscoord: `${lat}|${lng}`, ggslimit: "35",
  }));

  try {
    const results = await Promise.allSettled(searches.map(async (params) => {
      const response = await fetch(`${COMMONS_API}?${params}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return [];
      return Object.values((await response.json()).query?.pages || {});
    }));
    const seen = new Set();
    return results.flatMap((result) => result.status === "fulfilled" ? result.value : []).map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) return null;
      const meta = info.extmetadata || {};
      const imageTitle = String(page.title || "").replace(/^File:/, "");
      const searchable = [imageTitle, meta.ObjectName?.value, meta.ImageDescription?.value, meta.Categories?.value].map(stripHtml).join(" ");
      return {
        url: info.thumburl || info.url,
        originalUrl: info.url,
        title: imageTitle,
        author: stripHtml(meta.Artist?.value || "Wikimedia Commons"),
        license: meta.LicenseShortName?.value || "",
        sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        taggedVargaTour: isVargaTourText(searchable),
        relevance: similarity(imageTitle, title),
      };
    }).filter((item) => item?.originalUrl && !seen.has(item.originalUrl) && seen.add(item.originalUrl))
      .sort((a, b) => Number(b.taggedVargaTour) - Number(a.taggedVargaTour) || b.relevance - a.relevance)
      .slice(0, 60);
  } catch { return []; }
}

async function loadYoutube(title) {
  const apiKey = Netlify.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return { configured: false, items: [] };
  const params = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "25",
    q: `${title} Italia visita guidata|${title} Varga Tour|#VargaTour ${title}`,
    relevanceLanguage: "it", regionCode: "IT", safeSearch: "strict", videoEmbeddable: "true", key: apiKey,
    videoSyndicated: "true",
  });
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return { configured: true, items: [] };
    const data = await response.json();
    return { configured: true, items: (data.items || []).map((item) => {
      const videoTitle = item.snippet?.title || title;
      const channel = item.snippet?.channelTitle || "YouTube";
      return {
        id: item.id?.videoId,
        title: videoTitle,
        channel,
        taggedVargaTour: isVargaTourText(`${videoTitle} ${channel} ${item.snippet?.description || ""}`),
      };
    }).filter((item) => item.id)
      .sort((a, b) => Number(b.taggedVargaTour) - Number(a.taggedVargaTour)) };
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
      operator: tags.operator || tags.brand || tags.owner || "",
      openingHours: tags.opening_hours || "",
      bookingUrl: firstHttpUrl(tags["website:booking"], tags["reservation:website"], tags["booking:website"], tags["tickets:website"], tags["contact:booking"], tags["contact:website"]),
      reservation: tags.reservation || tags.booking || "",
      phone: tags["contact:phone"] || tags.phone || "",
      email: tags["contact:email"] || tags.email || "",
      fee: tags.fee || "",
      charge: tags.charge || "",
      wheelchair: tags.wheelchair || "",
      officialImages: splitMediaUrls(tags.image || tags["image:0"] || ""),
      officialVideos: splitMediaUrls(tags.video || tags["contact:video"] || ""),
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

async function loadOfficialPage(rawUrl) {
  const url = safePublicUrl(rawUrl);
  if (!url) return null;
  const { response, finalUrl } = await fetchPublicHtml(url);
  if (!response.ok || !String(response.headers.get("content-type") || "").includes("text/html")) return null;
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 1500000) return null;
  const html = (await response.text()).slice(0, 900000);
  const baseUrl = new URL(finalUrl);
  const links = extractHtmlLinks(html, baseUrl);
  const bookingLink = links
    .filter((item) => /prenot|booking|ticket|bigliett|acquist|visita|reservation/i.test(`${item.text} ${item.url}`))
    .sort((a, b) => bookingLinkScore(b) - bookingLinkScore(a))[0]?.url || "";
  const socialMedia = links.map((item) => socialFromUrl(item.url, "official")).filter(Boolean);
  const image = absoluteHtmlUrl(metaContent(html, "og:image") || metaContent(html, "twitter:image"), baseUrl);
  const videoCandidates = [
    metaContent(html, "og:video"),
    metaContent(html, "og:video:url"),
    ...links.filter((item) => /youtube\.com\/(watch|shorts)|youtu\.be\/|vimeo\.com\//i.test(item.url)).map((item) => item.url),
  ].map((item) => absoluteHtmlUrl(item, baseUrl)).filter(Boolean);
  return {
    pageUrl: finalUrl,
    bookingLink,
    image,
    videos: [...new Set(videoCandidates)].slice(0, 8),
    socialMedia: dedupeSocial(socialMedia).slice(0, 12),
    title: stripHtml(metaContent(html, "og:site_name") || matchHtml(html, /<title[^>]*>([\s\S]*?)<\/title>/i)) || domainLabel(finalUrl),
  };
}

async function fetchPublicHtml(initialUrl) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicHost(current);
    const response = await fetch(current, {
      headers: { "User-Agent": "Varga-Tour/1.0 (+https://github.com/ionut290/ITALIA-GUIDA)", Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(6500),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current };
    const location = response.headers.get("location");
    const next = location ? absoluteHtmlUrl(location, new URL(current)) : "";
    if (!next) throw new Error("Reindirizzamento ufficiale non valido");
    current = next;
  }
  throw new Error("Troppi reindirizzamenti dal sito ufficiale");
}

async function assertPublicHost(rawUrl) {
  const host = new URL(rawUrl).hostname;
  const addresses = await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), 1800)),
  ]);
  if (!Array.isArray(addresses) || !addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("Host ufficiale non pubblico");
}

function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (/^\d+\.\d+\.\d+\.\d+$/.test(value) ? value : "");
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function buildOperational(osm, officialPage, officialWebsite) {
  const openingHours = osm?.openingHours || "";
  const reservation = String(osm?.reservation || "").toLowerCase();
  const directBookingUrl = osm?.bookingUrl || officialPage?.bookingLink || "";
  const bookingUrl = directBookingUrl || officialWebsite || "";
  const bookingMode = directBookingUrl
    ? "Prenotazione online"
    : officialWebsite
      ? "Verifica disponibilità e prenota sul sito ufficiale"
    : osm?.phone
      ? "Prenotazione telefonica"
      : reservation === "yes" || reservation === "required"
        ? "Prenotazione richiesta: verifica con il gestore"
        : "Verifica sul sito ufficiale";
  return {
    openingHours,
    openingHoursSource: openingHours ? osm?.sourceUrl || "" : "",
    bookingUrl,
    bookingMode,
    reservationRequired: reservation === "yes" || reservation === "required" || reservation === "mandatory",
    phone: osm?.phone || "",
    email: osm?.email || "",
    priceInfo: osm?.charge || (osm?.fee === "no" ? "Ingresso gratuito" : osm?.fee === "yes" ? "Ingresso a pagamento" : ""),
    wheelchair: osm?.wheelchair || "",
    operator: osm?.operator || officialPage?.title || "",
    sourceUrl: osm?.sourceUrl || officialWebsite || "",
  };
}

function buildOfficialMedia(osm, officialPage, socialMedia, officialWebsite) {
  const images = [
    ...(osm?.officialImages || []).map((url) => ({ url, sourceUrl: osm.sourceUrl, title: "Immagine dichiarata nella scheda ufficiale" })),
    ...(officialPage?.image ? [{ url: officialPage.image, sourceUrl: officialPage.pageUrl, title: "Immagine pubblicata sul sito ufficiale" }] : []),
  ].filter((item) => safePublicUrl(item.url));
  const videos = [
    ...(osm?.officialVideos || []),
    ...(officialPage?.videos || []),
  ].map((url) => officialVideo(url)).filter(Boolean);
  return {
    managerName: osm?.operator || officialPage?.title || "Gestore del luogo",
    sourceUrl: officialPage?.pageUrl || officialWebsite || osm?.sourceUrl || "",
    images: dedupeLinks(images).slice(0, 10),
    videos: dedupeLinks(videos).slice(0, 10),
    socialMedia: socialMedia.filter((item) => item.kind === "official").slice(0, 12),
  };
}

function officialVideo(url) {
  const social = socialFromUrl(url, "official");
  if (social?.embedType) return { url, title: "Video pubblicato dal gestore", embedType: social.embedType, embedId: social.embedId };
  return safePublicUrl(url) ? { url, title: "Video pubblicato dal gestore" } : null;
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return matchHtml(html, new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"))
    || matchHtml(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"));
}

function matchHtml(html, expression) {
  return String(html || "").match(expression)?.[1]?.trim() || "";
}

function extractHtmlLinks(html, baseUrl) {
  const items = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const url = absoluteHtmlUrl(match[1], baseUrl);
    if (url) items.push({ url, text: stripHtml(match[2]).slice(0, 120) });
    if (items.length >= 500) break;
  }
  return dedupeLinks(items);
}

function bookingLinkScore(item) {
  const value = `${item.text} ${item.url}`.toLowerCase();
  return (/prenota|book now|acquista|biglietti/.test(value) ? 30 : 0) + (/ticket|booking|reservation/.test(value) ? 20 : 0) - (/privacy|cookie/.test(value) ? 50 : 0);
}

function safePublicUrl(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || isPrivateAddress(host)) return "";
    return url.href;
  } catch { return ""; }
}

function absoluteHtmlUrl(raw, baseUrl) {
  try { return safePublicUrl(new URL(String(raw || "").replaceAll("&amp;", "&"), baseUrl).href); } catch { return ""; }
}

function firstHttpUrl(...values) {
  return values.map((value) => safePublicUrl(value)).find(Boolean) || "";
}

function splitMediaUrls(value) {
  return String(value || "").split(/[;|]/).map((item) => safePublicUrl(item.trim())).filter(Boolean).slice(0, 10);
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
function sameHost(a, b) {
  try { return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, ""); } catch { return false; }
}
function socialProfile(platform, rawValue, buildUrl) {
  const value = String(rawValue || "").trim().replace(/^@/, "");
  if (!value) return null;
  return enrichSocialEmbed({ platform, title: `Profilo ufficiale ${platform}`, url: buildUrl(value), handle: platform === "YouTube" ? "" : `@${value}`, kind: "official" });
}
function socialFromTag(platform, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    const parsed = socialFromUrl(value, "official");
    return parsed || enrichSocialEmbed({ platform, title: `Profilo ufficiale ${platform}`, url: value, kind: "official" });
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
  return buildUrl ? enrichSocialEmbed({ platform, title: `Profilo ufficiale ${platform}`, url: buildUrl(clean), handle: platform === "YouTube" ? "" : `@${clean}`, kind: "official" }) : null;
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
    return enrichSocialEmbed({ platform, title: isPost ? `Contenuto su ${platform}` : `Profilo su ${platform}`, url: url.href, kind });
  } catch { return null; }
}
function enrichSocialEmbed(item) {
  try {
    const url = new URL(item.url);
    const base = item.kind !== "search" && isVargaTourText(`${item.title || ""} ${item.handle || ""} ${decodeURIComponent(url.href)}`)
      ? { ...item, taggedVargaTour: true }
      : item;
    if (item.platform === "YouTube") {
      const id = url.hostname === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1];
      return id ? { ...base, embedType: "youtube", embedId: id } : base;
    }
    if (item.platform === "TikTok") {
      const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1];
      if (videoId) return { ...base, embedType: "tiktok-video", embedId: videoId };
      const handle = url.pathname.match(/^\/@([^/?#]+)/)?.[1];
      if (handle) return { ...base, embedType: "tiktok-profile", embedId: handle };
    }
    if (item.platform === "Instagram" && /^\/(?:p|reel|reels|tv)\//.test(url.pathname)) {
      return { ...base, embedType: "instagram-post", embedId: url.href };
    }
    return base;
  } catch {}
  return item;
}
function socialSearchItems(title) {
  const touristQuery = `${title} Italia guida turistica`;
  const vargaQuery = `#VargaTour ${title}`;
  return [
    { platform: "YouTube", title: "Cerca video #VargaTour", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(vargaQuery)}`, kind: "search" },
    { platform: "TikTok", title: "Cerca video #VargaTour", url: `https://www.tiktok.com/search?q=${encodeURIComponent(vargaQuery)}`, kind: "search" },
    { platform: "Instagram", title: "Cerca foto e Reel #VargaTour", url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(vargaQuery)}`, kind: "search" },
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
  }).sort((a, b) => Number(b.taggedVargaTour) - Number(a.taggedVargaTour) || socialKindScore(b.kind) - socialKindScore(a.kind)).slice(0, 30);
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
function isVargaTourText(value) {
  return /(?:#|\b)varga[\s_-]*tour\b/i.test(String(value || ""));
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
