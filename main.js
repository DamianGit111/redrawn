// California congressional maps: 2021 commission map vs. 2025 Prop 50 map

const YEARS = [2021, 2025];

const DATA_FILES = {
  2021: "data/districts_2021.json",
  2025: "data/districts_2025.json",
};
const RESULTS_FILE = "data/results_2024.json";

// [[west, south], [east, north]]
const CALIFORNIA_BOUNDS = [
  [-124.48, 32.53],
  [-114.13, 42.01],
];

// 2024 margin (Harris − Trump, in points) → color. Diverging purple/orange,
// symmetric around 0 so equal leads get equal intensity; anything past ±40 is clamped.
const MARGIN_COLOR = [
  "interpolate", ["linear"], ["get", "margin"],
  -40, "#e66101", // Trump +40
  -20, "#fdb863",
    0, "#f7f7f7", // even
   20, "#b2abd2",
   40, "#5e3c99", // Harris +40
];

// No basemap: an inline style with just a white background layer.
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
    ],
  },
  bounds: CALIFORNIA_BOUNDS,
  fitBoundsOptions: { padding: 40 },
});

// Maps either file's field names onto one shared set of properties, and joins in
// the 2024 margin for this plan. `results` is keyed by district number.
function normalize(feature, year, results) {
  const p = feature.properties;

  let clean;
  if (year === 2021) {
    clean = {
      population: p.POPULATION,
      cvap: p.CVAP_19,
      hispanic: p.F_HSP_CVAP,
      black: p.F_DOJ_NH_B,
      asian: p.F_DOJ_NH_A,
      white: p.F_NH_WHT_C,
    };
  } else {
    clean = {
      population: p.A_POP,
      cvap: p.CVAP,
      hispanic: p.HSP_CVAP_P,
      black: p.BLK_CVAP_P,
      asian: p.ASN_CVAP_P,
      white: p.WHT_CVAP_P,
    };
  }

  clean.district = Number(p.DISTRICT); // "01" and "1" both → 1
  clean.year = year;
  clean.margin = results[clean.district][year].margin;

  return { type: "Feature", geometry: feature.geometry, properties: clean };
}

// Shows one plan's layers and hides the other's (layers are never removed).
function setPlan(year) {
  for (const y of YEARS) {
    const visibility = y === year ? "visible" : "none";
    map.setLayoutProperty(`fill-${y}`, "visibility", visibility);
    map.setLayoutProperty(`outline-${y}`, "visibility", visibility);
    map.setLayoutProperty(`highlight-${y}`, "visibility", visibility);
  }

  for (const button of document.querySelectorAll("#plan-buttons button")) {
    button.classList.toggle("active", Number(button.dataset.year) === year);
  }

  hideTooltip();
}

// highlight([22, 40]) outlines those districts on both plans; highlight([]) clears.
function highlight(districtNumbers) {
  const filter = ["in", ["get", "district"], ["literal", districtNumbers]];
  for (const y of YEARS) {
    map.setFilter(`highlight-${y}`, filter);
  }
}

// ---- Tooltip ----

const tooltip = document.getElementById("tooltip");

function percent(share) {
  return Math.round(share * 100) + "%";
}

// 12.22 → "Harris +12.2", -5.8 → "Trump +5.8"
function marginText(margin) {
  const leader = margin >= 0 ? "Harris" : "Trump";
  return `${leader} +${Math.abs(margin).toFixed(1)}`;
}

function tooltipText(props) {
  return (
    `District ${props.district} · ${marginText(props.margin)} · ` +
    `${props.population.toLocaleString()} people · ` +
    `Hispanic ${percent(props.hispanic)} / Asian ${percent(props.asian)} / ` +
    `Black ${percent(props.black)} / White ${percent(props.white)} of eligible voters`
  );
}

function showTooltip(event) {
  tooltip.textContent = tooltipText(event.features[0].properties);
  tooltip.style.left = event.point.x + 12 + "px";
  tooltip.style.top = event.point.y + 12 + "px";
  tooltip.hidden = false;
}

function hideTooltip() {
  tooltip.hidden = true;
}

// ---- Load data and build layers ----

map.on("load", async () => {
  const fetchJson = (url) => fetch(url).then((response) => response.json());
  const [data2021, data2025, resultsFile] = await Promise.all([
    fetchJson(DATA_FILES[2021]),
    fetchJson(DATA_FILES[2025]),
    fetchJson(RESULTS_FILE),
  ]);
  const rawData = { 2021: data2021, 2025: data2025 };

  // Index results by district number: { 1: { 2021: {...}, 2025: {...} }, 2: ... }
  const results = {};
  for (const row of resultsFile.districts) {
    results[row.district] = row;
  }

  for (const year of YEARS) {
    map.addSource(`plan-${year}`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: rawData[year].features.map((f) => normalize(f, year, results)),
      },
      promoteId: "district",
    });

    map.addLayer({
      id: `fill-${year}`,
      type: "fill",
      source: `plan-${year}`,
      paint: { "fill-color": MARGIN_COLOR },
    });

    map.addLayer({
      id: `outline-${year}`,
      type: "line",
      source: `plan-${year}`,
      paint: { "line-color": "#000000", "line-width": 0.5 },
    });

    // Starts with an empty filter, so nothing is highlighted until highlight() is called.
    map.addLayer({
      id: `highlight-${year}`,
      type: "line",
      source: `plan-${year}`,
      paint: { "line-color": "#111111", "line-width": 3 },
      filter: ["in", ["get", "district"], ["literal", []]],
    });

    // Hidden layers don't receive mouse events, so only the visible plan responds.
    map.on("mousemove", `fill-${year}`, showTooltip);
    map.on("mouseleave", `fill-${year}`, hideTooltip);
  }

  for (const button of document.querySelectorAll("#plan-buttons button")) {
    button.addEventListener("click", () => setPlan(Number(button.dataset.year)));
  }

  setPlan(2021);
});
