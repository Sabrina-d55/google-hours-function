export async function handler(event) {
  const placeId = event.queryStringParameters?.placeId;

  if (!placeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing placeId" }),
    };
  }

  const API_KEY = process.env.GOOGLE_API_KEY_2;

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=current_opening_hours,opening_hours&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return {
        statusCode: 500,
        body: JSON.stringify(data),
      };
    }

    const hours =
      data.result.current_opening_hours?.weekday_text ||
      data.result.opening_hours?.weekday_text ||
      [];

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=900",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hours }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
