const MAX_BASE64_LENGTH = 4_500_000;

const handler = async (request) => {
  if (request.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ error: "Origine non consentita" }, 403);
  }

  const apiKey = Netlify.env.get("GOOGLE_CLOUD_VISION_API_KEY");
  if (!apiKey) {
    return json({ error: "Il riconoscimento fotografico non è ancora configurato." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Fotografia non valida" }, 400);
  }

  const image = typeof body?.image === "string" ? body.image.trim() : "";
  if (!image || image.length > MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return json({ error: image.length > MAX_BASE64_LENGTH ? "La fotografia è troppo grande" : "Fotografia non valida" }, image.length > MAX_BASE64_LENGTH ? 413 : 400);
  }

  try {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        requests: [{
          image: { content: image },
          features: [{ type: "LANDMARK_DETECTION", maxResults: 5 }],
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.responses?.[0]?.error) {
      console.error("Google Vision landmark detection:", response.status, data.responses?.[0]?.error?.message || data.error?.message || "unknown error");
      return json({ error: "Il servizio di riconoscimento non è disponibile. Riprova tra poco." }, 502);
    }

    const annotations = Array.isArray(data.responses?.[0]?.landmarkAnnotations)
      ? data.responses[0].landmarkAnnotations
      : [];
    const landmarks = annotations.map((item) => {
      const location = item.locations?.[0]?.latLng;
      return {
        title: String(item.description || "").trim(),
        confidence: Number(item.score) || 0,
        ...(Number.isFinite(location?.latitude) ? { lat: Number(location.latitude) } : {}),
        ...(Number.isFinite(location?.longitude) ? { lng: Number(location.longitude) } : {}),
      };
    }).filter((item) => item.title).sort((a, b) => b.confidence - a.confidence);

    if (!landmarks.length) {
      return json({ error: "Non riconosco un monumento in questa fotografia. Prova a inquadrarlo per intero e con buona luce." }, 422);
    }
    return json({ landmark: landmarks[0], alternatives: landmarks.slice(1, 3) }, 200);
  } catch (error) {
    console.error("Landmark recognition:", error);
    return json({ error: "Il servizio di riconoscimento non risponde. Controlla la connessione e riprova." }, 504);
  }
};

export default handler;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
