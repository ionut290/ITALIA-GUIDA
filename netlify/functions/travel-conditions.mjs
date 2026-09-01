const handler = async (request) => {
  if (request.method !== "GET") return json({ error: "Metodo non consentito" }, 405);
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "Coordinate non valide" }, 400);
  }
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    hourly: "precipitation_probability,precipitation,weather_code",
    forecast_hours: "4", timezone: "auto",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Meteo non disponibile");
    const data = await response.json();
    const current = data.current || {};
    const rainSoon = Math.max(...(data.hourly?.precipitation_probability || [0]).slice(0, 3));
    const weatherCode = Number(current.weather_code || 0);
    const precipitation = Number(current.precipitation || 0);
    const severe = weatherCode >= 95 || Number(current.wind_speed_10m || 0) >= 50;
    const rainy = precipitation > 0 || rainSoon >= 55 || (weatherCode >= 51 && weatherCode <= 82);
    return json({
      temperature: Number(current.temperature_2m),
      apparentTemperature: Number(current.apparent_temperature),
      precipitation,
      rainProbabilityNextHours: Number.isFinite(rainSoon) ? rainSoon : 0,
      windSpeed: Number(current.wind_speed_10m),
      weatherCode,
      condition: severe ? "severe" : rainy ? "rain" : "good",
      message: severe
        ? "Condizioni difficili: preferisci luoghi al coperto e verifica gli avvisi locali."
        : rainy
          ? "Pioggia possibile: il percorso privilegerà musei, chiese e luoghi coperti."
          : "Condizioni favorevoli per un itinerario a piedi.",
      source: "Open-Meteo",
    }, 200, 600);
  } catch {
    return json({ error: "Condizioni meteo temporaneamente non disponibili" }, 502);
  }
};

export default handler;

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=1800` : "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
