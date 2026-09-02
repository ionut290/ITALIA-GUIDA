import { indoorProviderInfo } from "../../lib/indoor-providers.mjs";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" };

export async function handler(event) {
  const name = String(event.queryStringParameters?.name || "");
  return { statusCode: 200, headers, body: JSON.stringify(indoorProviderInfo(name)) };
}
