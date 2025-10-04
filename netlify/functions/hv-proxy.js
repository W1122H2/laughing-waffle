// netlify/functions/hv-proxy.js
export async function handler(event, context) {
  const params = event.queryStringParameters;
  const target = "https://api.helioviewer.org/v2/getClosestImage/?" + new URLSearchParams(params);

  try {
    const res = await fetch(target);
    const text = await res.text();
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: text
    };
  } catch (err) {
    return { statusCode: 500, body: "Proxy error: " + err.message };
  }
}
