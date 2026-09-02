export const indoorOfficialSources = [
  { match: /bologna|marconi|blq/i, name: "Aeroporto di Bologna", url: "https://www.bologna-airport.it/en/at-the-airport/services/terminal-maps/?idC=62211" },
  { match: /fiumicino|leonardo da vinci|fco/i, name: "Aeroporti di Roma - Fiumicino", url: "https://www.adr.it/web/aeroporti-di-roma-en/fiumicino-shop-eat-maps" },
  { match: /malpensa|mxp/i, name: "Milano Malpensa", url: "https://www.milanomalpensa-airport.com/en/airport-guide/airport-map" },
  { match: /linate/i, name: "Milano Linate", url: "https://www.milanolinate-airport.com/en/airport-guide/airport-map" },
  { match: /venezia|marco polo|vce/i, name: "Aeroporto di Venezia", url: "https://www.veneziaairport.it/en/map.html" }
];

export function findOfficialIndoorSources(name = "") {
  return indoorOfficialSources.filter((source) => source.match.test(name)).map(({ match, ...source }) => source);
}

export function indoorProviderInfo(name = "") {
  const official = findOfficialIndoorSources(name);
  return {
    preferred: official.length ? "official" : "osm",
    official,
    here: { supported: true, requiresAccess: true },
    osm: { supported: true, name: "OpenStreetMap Indoor" }
  };
}
