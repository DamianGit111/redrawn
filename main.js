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

// 2024 margin (Harris − Trump, in points) → color. Diverging purple/orange from a dark
// "even", symmetric around 0 so equal leads get equal intensity; anything past ±30 is clamped.
// Keep in sync with --harris / --even / --trump in style.css (used by the legend).
const MARGIN_COLOR = [
  "interpolate", ["linear"], ["get", "margin"],
  -30, "#FF9A3C", // Trump +30
    0, "#2A2A2A", // even
   30, "#8E7CFF", // Harris +30
];
const PLAIN_COLOR = "#141414";
const PLAIN_OUTLINE = "#4A4A4A";
const RESULTS_OUTLINE = "#000000"; // dark seams read more cleanly between colored districts

const FLY_DURATION = 1200; // ms
const PHONE_QUERY = window.matchMedia("(max-width: 699px)");
const REDUCED_MOTION_QUERY = window.matchMedia("(prefers-reduced-motion: reduce)");

// Current map state, so setPlan() and setGhost() can be called in either order.
let currentPlan = 2021;
let ghostOn = false;
let currentScene = null;

// Normalized FeatureCollections by year, kept for computing district bounding boxes.
const planData = {};

// No basemap: an inline style with just a black background layer.
// Scroll/drag handlers are off so the mouse wheel and touch scroll the page, not the map.
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#000000" } },
    ],
  },
  bounds: CALIFORNIA_BOUNDS,
  scrollZoom: false,
  dragPan: false,
  dragRotate: false,
  touchZoomRotate: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
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
  currentPlan = year;
  for (const y of YEARS) {
    const visibility = y === year ? "visible" : "none";
    map.setLayoutProperty(`fill-${y}`, "visibility", visibility);
    map.setLayoutProperty(`outline-${y}`, "visibility", visibility);
    map.setLayoutProperty(`highlight-${y}`, "visibility", visibility);
  }

  for (const button of document.querySelectorAll("#plan-buttons button")) {
    button.classList.toggle("active", Number(button.dataset.year) === year);
  }

  setGhost(ghostOn); // the ghost is always the *other* plan, so it follows the plan
  hideTooltip();
}

// Turns the faint dashed outline of the non-showing plan on or off.
function setGhost(on) {
  ghostOn = on;
  for (const y of YEARS) {
    const visible = on && y !== currentPlan;
    map.setLayoutProperty(`ghost-${y}`, "visibility", visible ? "visible" : "none");
  }
}

// Colors districts by 2024 margin (true) or plain dark gray (false), on both plans,
// and shows the legend only while the colors mean something.
function setResults(on) {
  for (const y of YEARS) {
    map.setPaintProperty(`fill-${y}`, "fill-color", on ? MARGIN_COLOR : PLAIN_COLOR);
    map.setPaintProperty(`outline-${y}`, "line-color", on ? RESULTS_OUTLINE : PLAIN_OUTLINE);
  }
  document.getElementById("legend").hidden = !on;
}

// highlight([22, 40]) outlines those districts on both plans; highlight([]) clears.
function highlight(districtNumbers) {
  const filter = ["in", ["get", "district"], ["literal", districtNumbers]];
  for (const y of YEARS) {
    map.setFilter(`highlight-${y}`, filter);
  }
}

// Returns [[west, south], [east, north]] around the given districts in one plan.
function districtBounds(year, districtNumbers) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;

  for (const feature of planData[year].features) {
    if (!districtNumbers.includes(feature.properties.district)) continue;

    // Flatten the nested rings down to a plain list of [lng, lat] points.
    // Polygon = [ring][point], MultiPolygon = [polygon][ring][point].
    const { type, coordinates } = feature.geometry;
    const points = coordinates.flat(type === "Polygon" ? 1 : 2);

    for (const [lng, lat] of points) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }

  return [[west, south], [east, north]];
}

// Map padding that keeps the subject out from under the story cards.
function cameraPadding() {
  if (PHONE_QUERY.matches) {
    return { top: 60, right: 20, bottom: window.innerHeight * 0.45, left: 20 };
  }
  // Cards sit in a left column, so pad past their right edge.
  const cardRight = document.querySelector(".card").getBoundingClientRect().right;
  return { top: 40, right: 40, bottom: 40, left: cardRight + 40 };
}

// Moves the camera to a scene's "state" or { fit: [...] } target.
function moveCamera(camera, animate) {
  const bounds = camera === "state" ? CALIFORNIA_BOUNDS : districtBounds(currentPlan, camera.fit);
  const target = map.cameraForBounds(bounds, { padding: cameraPadding() });
  if (!target) return; // padding is larger than the screen (tiny window)

  if (animate && !REDUCED_MOTION_QUERY.matches) {
    map.flyTo({ ...target, duration: FLY_DURATION });
  } else {
    map.jumpTo(target);
  }
}

// Sets every part of the map from one scene object, so any scene can follow any other.
function applyScene(scene, animate = true) {
  if (scene === currentScene) return;
  currentScene = scene;

  setPlan(Number(scene.plan));
  setResults(scene.showResults);
  highlight(scene.highlight);
  setGhost(scene.ghost);
  moveCamera(scene.camera, animate);

  document.getElementById("scene-alt").textContent = scene.alt;
}

// ---- Tooltip ----

const tooltip = document.getElementById("tooltip");

// 0.2459 → "25%"
function percent(share) {
  return Math.round(share * 100) + "%";
}

// 12.22 → "leaned Harris by 12 points", -0.8 → "leaned Trump by 1 point", 0.3 → "was about even"
function marginText(margin) {
  const points = Math.round(Math.abs(margin));
  if (points === 0) return "was about even";
  const leader = margin > 0 ? "Harris" : "Trump";
  return `leaned ${leader} by ${points} ${points === 1 ? "point" : "points"}`;
}

// Builds the two hover lines from a district's normalized properties.
function tooltipLines(props) {
  return [
    `District ${props.district} · ${marginText(props.margin)} in 2024`,
    `${props.population.toLocaleString()} people. Eligible voters are ` +
      `${percent(props.hispanic)} Hispanic, ${percent(props.asian)} Asian, ` +
      `${percent(props.black)} Black and ${percent(props.white)} White.`,
  ];
}

// Fills in and positions the tooltip next to the mouse.
function showTooltip(event) {
  const [summary, detail] = tooltipLines(event.features[0].properties);
  const detailLine = document.createElement("div");
  detailLine.className = "tooltip-detail";
  detailLine.textContent = detail;
  tooltip.replaceChildren(summary, detailLine);
  tooltip.style.left = event.point.x + 12 + "px";
  tooltip.style.top = event.point.y + 12 + "px";
  tooltip.hidden = false;
}

// Hides the tooltip.
function hideTooltip() {
  tooltip.hidden = true;
}

// ---- Scroll story ----

// Adds a quiet "1 of 8" to the top of each card. Runs right away (not on map load)
// so the numbers are there before the data arrives.
function numberCards() {
  const cards = document.querySelectorAll(".step .card");
  cards.forEach((card, i) => {
    const progress = document.createElement("p");
    progress.className = "card-progress";
    progress.textContent = `${i + 1} of ${cards.length}`;
    card.prepend(progress);
  });
}

// Grows the bar on the left edge with how far the middle of the screen is through the story.
function updateStoryProgress() {
  const story = document.getElementById("story").getBoundingClientRect();
  const through = (window.innerHeight / 2 - story.top) / story.height;
  const clamped = Math.min(1, Math.max(0, through));
  document.getElementById("story-progress").style.transform = `scaleY(${clamped})`;
}

numberCards();
updateStoryProgress();
window.addEventListener("scroll", updateStoryProgress, { passive: true });
window.addEventListener("resize", updateStoryProgress);

// Applies a step's scene when that step crosses the middle 10% band of the screen.
// Only .step sections are observed, so the landing section never triggers a scene.
function setUpStory() {
  const scenesById = {};
  for (const scene of SCENES) {
    scenesById[scene.id] = scene;
  }

  // Set scene 1 instantly, so the map is ready behind the landing before any card arrives.
  applyScene(SCENES[0], false);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        applyScene(scenesById[entry.target.dataset.scene]);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );

  for (const step of document.querySelectorAll(".step")) {
    if (!scenesById[step.dataset.scene]) {
      console.warn(`No scene in scenes.js with id "${step.dataset.scene}"`);
      continue;
    }
    observer.observe(step);
  }
}

// ---- Landing maps ----

// Same stops as MARGIN_COLOR, as [margin, [r, g, b]], for coloring the landing SVGs in JS.
const MARGIN_STOPS = [
  [-30, [255, 154, 60]],
  [0, [42, 42, 42]],
  [30, [142, 124, 255]],
];

// Mirrors MARGIN_COLOR's linear interpolation: 12.2 → "rgb(…)".
function marginColor(margin) {
  const m = Math.min(30, Math.max(-30, margin));
  const [[m0, c0], [m1, c1]] = m < 0 ? [MARGIN_STOPS[0], MARGIN_STOPS[1]] : [MARGIN_STOPS[1], MARGIN_STOPS[2]];
  const t = (m - m0) / (m1 - m0);
  const rgb = c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
  return `rgb(${rgb.join(", ")})`;
}

// Draws both plans as static SVG maps in the landing section, colored by 2024 margin.
// A flat projection with longitude shrunk by cos(latitude) is close enough at this size.
function drawLandingMaps() {
  const [[west, south], [east, north]] = CALIFORNIA_BOUNDS;
  const xScale = Math.cos(((south + north) / 2) * Math.PI / 180);
  const width = 300;
  const k = width / ((east - west) * xScale);
  const height = (north - south) * k;

  // One ring → "M x y L x y … Z", skipping points that land on the same rounded spot.
  const ringPath = (ring) => {
    let d = "";
    let last = "";
    for (const [lng, lat] of ring) {
      const point = `${((lng - west) * xScale * k).toFixed(1)} ${((north - lat) * k).toFixed(1)}`;
      if (point === last) continue;
      d += (d ? " L" : "M") + point;
      last = point;
    }
    return d + "Z";
  };

  for (const svg of document.querySelectorAll(".landing-map svg")) {
    const year = Number(svg.dataset.year);
    svg.setAttribute("viewBox", `0 0 ${width} ${height.toFixed(1)}`);

    for (const feature of planData[year].features) {
      const { type, coordinates } = feature.geometry;
      const rings = type === "Polygon" ? coordinates : coordinates.flat(1);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", rings.map(ringPath).join(" "));
      path.setAttribute("fill", marginColor(feature.properties.margin));
      svg.append(path);
    }
  }
}

// ---- Load data and build layers ----

// Starts loading right away (not on map load), so the landing maps don't wait for WebGL.
// Resolves once planData is filled in for both years.
const dataReady = (async () => {
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
    planData[year] = {
      type: "FeatureCollection",
      features: rawData[year].features.map((f) => normalize(f, year, results)),
    };
  }
})();

dataReady.then(drawLandingMaps);

map.on("load", async () => {
  await dataReady;

  for (const year of YEARS) {
    map.addSource(`plan-${year}`, {
      type: "geojson",
      data: planData[year],
      promoteId: "district",
    });
  }

  // Layers are added by kind (all fills, then all outlines, ...) rather than by plan,
  // so the ghost of one plan draws on top of the other plan's fill.
  for (const year of YEARS) {
    map.addLayer({
      id: `fill-${year}`,
      type: "fill",
      source: `plan-${year}`,
      paint: { "fill-color": PLAIN_COLOR },
    });
  }

  for (const year of YEARS) {
    map.addLayer({
      id: `outline-${year}`,
      type: "line",
      source: `plan-${year}`,
      paint: { "line-color": PLAIN_OUTLINE, "line-width": 0.5 },
    });
  }

  for (const year of YEARS) {
    map.addLayer({
      id: `ghost-${year}`,
      type: "line",
      source: `plan-${year}`,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#A39E94", // --muted
        "line-opacity": 0.4,
        "line-width": 1,
        "line-dasharray": [2, 2],
      },
    });
  }

  for (const year of YEARS) {
    map.addLayer({
      id: `highlight-${year}`,
      type: "line",
      source: `plan-${year}`,
      paint: { "line-color": "#F3EFE7", "line-width": 2.5 }, // --paper
      filter: ["in", ["get", "district"], ["literal", []]],
    });

    // Hidden layers don't receive mouse events, so only the visible plan responds.
    map.on("mousemove", `fill-${year}`, showTooltip);
    map.on("mouseleave", `fill-${year}`, hideTooltip);
  }

  for (const button of document.querySelectorAll("#plan-buttons button")) {
    button.addEventListener("click", () => setPlan(Number(button.dataset.year)));
  }

  setUpStory();
});
