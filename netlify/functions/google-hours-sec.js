import { getStore } from "@netlify/blobs";

export async function handler(event) {
  const placeId = event.queryStringParameters?.placeId;
  const forceRefresh = event.queryStringParameters?.refresh === "true";

  if (!placeId) {
    return response(400, { error: "Missing placeId" });
  }

  const API_KEY = process.env.GOOGLE_API_KEY_2;

  if (!API_KEY) {
    return response(500, { error: "Missing API key configuration" });
  }

  const store = getStore({
    name: "google-hours-cache-2",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });

  const cacheKey = `hours-${placeId}`;
  const CACHE_TTL = 2 * 60 * 60 * 1000; // ✅ 2h

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=current_opening_hours,opening_hours&key=${API_KEY}`;

  try {
    const cached = await store.get(cacheKey, { type: "json" });

    if (!forceRefresh && cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL) {
      return response(
        200,
        {
          hours: cached.hours,
          source: "blob-cache",
        },
        "HIT"
      );
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return response(500, data);
    }

    const hours =
      data.result.current_opening_hours?.weekday_text ||
      data.result.opening_hours?.weekday_text ||
      [];

    await store.setJSON(cacheKey, {
      hours,
      timestamp: Date.now(),
    });

    return response(
      200,
      {
        hours,
        source: "google-api",
      },
      forceRefresh ? "FORCED" : "MISS"
    );

  } catch (error) {
    return response(500, { error: error.message });
  }
}

// 👉 Helper response function
function response(status, body, cacheStatus = "") {
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",

      // ✅ 2h CDN cache
      "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600",

      "X-Cache": cacheStatus,
    },
    body: JSON.stringify(body),
  };
}
