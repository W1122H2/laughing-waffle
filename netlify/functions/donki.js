export async function handler(event, context) {
  const { startDate, endDate } = event.queryStringParameters;
  const nasaKey = process.env.NASA_API_KEY;

  const url = new URL("https://api.nasa.gov/DONKI/FLR");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("api_key", nasaKey);

  try {
    const res = await fetch(url.toString());
    const data = await res.text();
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: data
    };
  } catch (err) {
    return { statusCode: 500, body: "DONKI proxy error: " + err.message };
  }
}
