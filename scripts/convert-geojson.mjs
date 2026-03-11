import fs from "fs";

const geojson = JSON.parse(
  fs.readFileSync("./data/florida_churches.geojson", "utf8")
);

function clean(value) {
  return (value || "").toString().trim();
}

function buildAddress(props) {
  const house = clean(props["addr:housenumber"]);
  const street = clean(props["addr:street"]);
  const full = clean(props["addr:full"]);

  if (full) return full;
  return [house, street].filter(Boolean).join(" ");
}

function normalizeState(value) {
  const v = clean(value);
  if (!v) return "FL";
  if (v.toLowerCase() === "florida") return "FL";
  return v;
}

const churches = geojson.features.map((feature) => {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];

  return {
    church_name: clean(props.name) || "Unknown Church",
    address: buildAddress(props),
    city: clean(props["addr:city"]),
    state: normalizeState(props["addr:state"]),
    zip: clean(props["addr:postcode"]),
    website: clean(props.website || props["contact:website"] || props["url"]),
    latitude: coords[1] ?? null,
    longitude: coords[0] ?? null,
    confession_schedule: {}
  };
});

fs.writeFileSync(
  "./data/churches.json",
  JSON.stringify(churches, null, 2)
);

console.log(`Converted ${churches.length} churches`);