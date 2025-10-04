const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const startEl = document.getElementById("startDate");
const endEl = document.getElementById("endDate");
const wlEl = document.getElementById("wavelength");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");

// Pre-fill with a recent week
(function presetDates() {
  const now = new Date();
  const end = new Date(now.toISOString().slice(0, 10));
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  startEl.value = start.toISOString().slice(0, 10);
  endEl.value = end.toISOString().slice(0, 10);
})();

clearBtn.addEventListener("click", () => {
  resultsEl.innerHTML = "";
  statusEl.textContent = "";
});

searchBtn.addEventListener("click", async () => {
  const startDate = startEl.value;
  const endDate = endEl.value;
  const chosenWavelength = wlEl.value;

  if (!startDate || !endDate) {
    setStatus("Please select both start and end dates.", true);
    return;
  }
  if (new Date(startDate) > new Date(endDate)) {
    setStatus("Start date must be before end date.", true);
    return;
  }

  setStatus("Fetching solar flare data…");
  resultsEl.innerHTML = "";

  try {
    const flares = await fetchDONKIFlares(startDate, endDate);
    if (!Array.isArray(flares) || flares.length === 0) {
      setStatus("No flares found in that window.", false);
      resultsEl.innerHTML = `<div class="empty">Try expanding the date range.</div>`;
      return;
    }

    setStatus(`Found ${flares.length} flare(s). Fetching images…`);
    for (const flare of flares) {
      const card = makeCard(flare);
      resultsEl.appendChild(card);
      try {
        const imgUrl = await fetchHelioviewerScreenshot(flare.peakTime, chosenWavelength);
        const img = card.querySelector("img");
        const fb = card.querySelector(".fallback");
        img.src = imgUrl;
        img.onload = () => fb.style.display = "none";
        img.onerror = () => fb.textContent = "Image unavailable";
      } catch (e) {
        const fb = card.querySelector(".fallback");
        fb.textContent = "Image unavailable";
      }
    }
    setStatus(`Done.`);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, true);
  }
});

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

// --- NASA DONKI via Netlify function ---
async function fetchDONKIFlares(startDate, endDate) {
  const url = `/.netlify/functions/donki?startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DONKI proxy failed (${res.status})`);
  return res.json();
}

// Map wavelengths to Helioviewer sourceIds
const wavelengthMap = {
  "193": 14,
  "171": 13,
  "211": 15
};

// --- Helioviewer via Netlify function ---
async function fetchHelioviewerScreenshot(peakTime, chosenWavelength) {
  const fallbackOrder = [chosenWavelength, "193", "171", "211"];
  const tried = new Set();

  for (const wl of fallbackOrder) {
    if (tried.has(wl)) continue;
    tried.add(wl);

    try {
      const sourceId = wavelengthMap[wl];
      if (!sourceId) continue;

      // Step 1: getClosestImage via proxy
      const closestUrl = `/.netlify/functions/helioviewer?endpoint=getClosestImage&date=${toISOSeconds(peakTime)}&sourceId=${sourceId}`;
      const closestRes = await fetch(closestUrl);
      if (!closestRes.ok) continue;
      const closestData = await closestRes.json();
      if (!closestData.date) continue;

      // Step 2: takeScreenshot via proxy
      const screenshotUrl = `/.netlify/functions/helioviewer?endpoint=takeScreenshot&date=${closestData.date.replace(" ", "T")}Z&imageScale=2.5&layers=[SDO,AIA,${wl},1,100]&x0=0&y0=0&width=1024&height=1024&format=jpg`;
      const screenshotRes = await fetch(screenshotUrl);
      if (!screenshotRes.ok) continue;
      const screenshotData = await screenshotRes.json();
      if (!screenshotData.id) continue;

      // Step 3: downloadScreenshot via proxy
      return `/.netlify/functions/helioviewer?endpoint=downloadScreenshot&id=${screenshotData.id}`;
    } catch (err) {
      console.warn(`Helioviewer failed for ${wl}Å:`, err);
      continue;
    }
  }

  throw new Error("No valid screenshot found for any wavelength");
}

function toISOSeconds(ts) {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

function makeCard(f) {
  const card = document.createElement("article");
  card.className = "card";

  const classType = f.classType || "Unknown";
  const peak = f.peakTime ? new Date(f.peakTime).toUTCString() : "N/A";
  const begin = f.beginTime ? new Date(f.beginTime).toUTCString() : "N/A";
  const end = f.endTime ? new Date(f.endTime).toUTCString() : "N/A";
  const source = f.sourceLocation || "Unknown";
  const link = f.link || null;
  const activeRegion = f.activeRegionNum ? `AR ${f.activeRegionNum}` : null;

  card.innerHTML = `
    <div class="thumb">
      <img alt="SDO/AIA image near flare peak" />
      <div class="fallback"><div class="spinner"></div></div>
    </div>
    <div class="content">
      <div class="row">
        <span class="badge">${classType} flare</span>
        ${activeRegion ? `<span class="badge">${activeRegion}</span>` : ""}
      </div>
      <div class="meta"><b>Peak:</b> <span class="nowrap">${peak}</span></div>
      <div class="meta"><b>Start:</b> <span class="nowrap">${begin}</span></div>
      <div class="meta"><b>End:</b> <span class="nowrap">${end}</span></div>
      <div class="meta"><b>Source:</b> ${source}</div>
      <div class="linkbar">
        ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">Event details</a>` : ""}
        <a href="https://api.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA API</a>
        <a href="https://helioviewer.org/" target="_blank" rel="noopener noreferrer">Helioviewer</a>
      </div>
    </div>
  `;
  return card;
}
