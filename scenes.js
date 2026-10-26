// Story scenes, in scroll order. Each one fully describes the map, so applyScene()
// can jump to any scene from any other (including when scrolling back up).
//
//   id           matches data-scene on the card's <section> in index.html
//   plan         "2021" | "2025"
//   showResults  true = color by 2024 margin, false = light gray
//   highlight    district numbers to outline ([] = none)
//   ghost        true = faint dashed outline of the OTHER plan's districts
//   camera       "state" (all of California) or { fit: [district numbers] }
//   alt          one-sentence description for screen readers

const SCENES = [
  {
    id: "districts",
    plan: "2021",
    showResults: false,
    highlight: [],
    ghost: false,
    camera: "state",
    alt: "A map of California divided into its 52 congressional districts under the 2021 commission map.",
  },
  {
    id: "what-is-gerrymandering",
    plan: "2021",
    showResults: false,
    highlight: [],
    ghost: false,
    camera: "state",
    alt: "A map of California divided into its 52 congressional districts under the 2021 commission map.",
  },
  {
    id: "why-redraw",
    plan: "2021",
    showResults: false,
    highlight: [],
    ghost: false,
    camera: "state",
    alt: "The same 2021 map of California's 52 districts, shown in plain gray.",
  },
  {
    id: "prop-50",
    plan: "2021",
    showResults: false,
    highlight: [],
    ghost: false,
    camera: "state",
    alt: "The 2021 map of California's 52 districts in plain gray, while the card explains Proposition 50.",
  },
  {
    id: "map-2021",
    plan: "2021",
    showResults: true,
    highlight: [1, 3, 9, 13, 41, 48],
    ghost: false,
    camera: "state",
    alt: "The 2021 map colored by 2024 presidential margin, purple for Harris and orange for Trump, with districts 1, 3, 9, 13, 41 and 48 outlined.",
  },
  {
    id: "map-2025",
    plan: "2025",
    showResults: true,
    highlight: [1, 3, 9, 13, 41, 48],
    ghost: true,
    camera: "state",
    alt: "The 2025 map colored by 2024 presidential margin, with districts 1, 3, 9, 13, 41 and 48 outlined and the old 2021 lines shown faintly.",
  },
  {
    id: "district-1",
    plan: "2025",
    showResults: true,
    highlight: [1],
    ghost: true,
    camera: { fit: [1] },
    alt: "A close-up of District 1 in Northern California under the 2025 map, with the old 2021 lines shown faintly.",
  },
  {
    id: "district-41",
    plan: "2025",
    showResults: true,
    highlight: [41],
    ghost: true,
    camera: { fit: [41] },
    alt: "A close-up of District 41 under the 2025 map, with the old 2021 lines shown faintly.",
  },
  {
    id: "district-15",
    plan: "2025",
    showResults: true,
    highlight: [15],
    ghost: true,
    camera: { fit: [15] },
    alt: "A close-up of District 15 under the 2025 map, with the old 2021 lines shown faintly.",
  },
  {
    id: "explore",
    plan: "2025",
    showResults: true,
    highlight: [],
    ghost: false,
    camera: "state",
    alt: "The full 2025 map of California colored by 2024 presidential margin.",
  },
];
