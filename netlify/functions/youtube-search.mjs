const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const apiKey = Netlify.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return json({ configured: false, items: [] });
  const queryText = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 120);
  if (queryText.length < 2) return json({ error: "Ricerca non valida" }, 400);

  const query = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "3", q: `${queryText} storia visita guidata`,
    relevanceLanguage: "it", regionCode: "IT", safeSearch: "strict", videoEmbeddable: "true", key: apiKey,
    videoSyndicated: "true",
  });
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${query}`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`YouTube ${response.status}`);
    const data = await response.json();
    return json({ configured: true, items: (data.items || []).map((item) => ({
      type: "youtube", url: `https://www.youtube.com/watch?v=${item.id.videoId}`, title: item.snippet.title,
    })) }, 200, 21600);
  } catch (error) {
    console.error("YouTube:", error);
    return json({ configured: true, items: [], error: "Ricerca video non disponibile" }, 502);
  }
};

export default handler;

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
