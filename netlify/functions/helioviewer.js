export async function handler(event) {
  const { endpoint, ...params } = event.queryStringParameters;
  if (!endpoint) {
    return { statusCode: 400, body: "Missing endpoint parameter" };
  }

  const target = `https://api.helioviewer.org/v2/${endpoint}/?` + new URLSearchParams(params);

  try {
    const res = await fetch(target);

    // Special case: binary image
    if (endpoint === "downloadScreenshot") {
      const buffer = await res.arrayBuffer();
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "image/jpeg"
        },
        body: Buffer.from(buffer).toString("base64"),
        isBase64Encoded: true   // <-- absolutely required
      };
    }

    // Default: JSON/text endpoints
    const text = await res.text();
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: text
    };
  } catch (err) {
    return { statusCode: 500, body: "Helioviewer proxy error: " + err.message };
  }
}
