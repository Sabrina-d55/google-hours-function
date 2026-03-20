import { getStore } from "@netlify/blobs";

export async function handler(event) {
  const placeId = event.queryStringParameters?.placeId;

  if (!placeId) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Missing placeId" }),
    };
  }

  const API_KEY = process.env.GOOGLE_API_KEY_2;
  const store = getStore("google-hours-cache");
  const cacheKey = `hours-${placeId}`;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // 1. Check cached data first
    const cached = await store.get(cacheKey, { type: "json" });

    if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=900",
          "Content-Type": "application/json",
          "X-Cache": "HIT",
        },
        body: JSON.stringify({ hours: cached.hours }),
      };
    }

    // 2. Fetch fresh data from Google
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=current_opening_hours,opening_hours&key=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      };
    }

    const hours =
      data.result.current_opening_hours?.weekday_text ||
      data.result.opening_hours?.weekday_text ||
      [];

    // 3. Save to cache
    await store.setJSON(cacheKey, {
      hours,
      timestamp: Date.now(),
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=900",
        "Content-Type": "application/json",
        "X-Cache": "MISS",
      },
      body: JSON.stringify({ hours }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
}
