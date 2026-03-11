import fs from "fs/promises";

const rawPages = JSON.parse(
  await fs.readFile("./data/us_pages_raw.json", "utf8")
);

function clean(value) {
  return (value ?? "").toString().trim();
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function makeKey(church) {
  return [
    clean(church.church_name).toLowerCase(),
    clean(church.address).toLowerCase(),
    clean(church.city).toLowerCase(),
    clean(church.state).toLowerCase(),
    clean(church.zip).toLowerCase()
  ].join("|");
}

function mapRow(row) {
  return {
    church_name: clean(
      row.church_name ||
      row.name ||
      row.church_display_name ||
      row.parish_name ||
      row.church_parish_name ||
      row.church_type_name
    ),
    address: clean(
      row.church_address_street_address ||
      row.church_address ||
      row.address
    ),
    city: clean(
      row.church_address_city_name ||
      row.city
    ),
    state: clean(
      row.church_address_providence_name ||
      row.church_address_province_name ||
      row.church_address_state_name ||
      row.state
    ),
    zip: clean(
      row.church_address_postal_code ||
      row.zip
    ),
    website: clean(
      row.church_website ||
      row.website ||
      row.url
    ),
    latitude: toNumberOrNull(row.latitude ?? row.lat),
    longitude: toNumberOrNull(row.longitude ?? row.lng ?? row.long),
    confession_schedule: {},
    source: "masstimes"
  };
}

const allChurches = [];
const seen = new Set();

for (const page of rawPages) {
  const rows = Array.isArray(page.rows) ? page.rows : [];

  for (const row of rows) {
    const church = mapRow(row);
    const key = makeKey(church);

    if (!seen.has(key)) {
      seen.add(key);
      allChurches.push(church);
    }
  }
}

await fs.writeFile(
  "./data/churches.json",
  JSON.stringify(allChurches, null, 2)
);

console.log(`Converted ${allChurches.length} churches from us_pages_raw.json`);