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

function formatTime(value) {
  const v = clean(value);
  if (!v) return "";

  // Handles "08:30:00" -> "8:30 AM"
  const match = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return v;

  let hour = Number(match[1]);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${ampm}`;
}

function normalizeDay(value) {
  const v = clean(value).replace(/\s+/g, " ");
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function isConfessionEntry(entry) {
  const type = clean(entry.service_typename).toLowerCase();
  const comment = clean(entry.comment).toLowerCase();

  return (
    type.includes("confession") ||
    comment.includes("confession")
  );
}

function buildConfessionSlot(entry) {
  const start = formatTime(entry.time_start);
  const end = formatTime(entry.time_end);
  const notes = clean(entry.comment);

  return {
    start_time: start,
    end_time: end,
    notes
  };
}

function mapChurch(row) {
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

function makeKey(church) {
  return [
    clean(church.church_name).toLowerCase(),
    clean(church.address).toLowerCase(),
    clean(church.city).toLowerCase(),
    clean(church.state).toLowerCase(),
    clean(church.zip).toLowerCase()
  ].join("|");
}

const seen = new Map();

for (const page of rawPages) {
  const rows = Array.isArray(page.rows) ? page.rows : [];

  for (const row of rows) {
    const church = mapChurch(row);
    const key = makeKey(church);

    if (!seen.has(key)) {
      seen.set(key, church);
    }

    const target = seen.get(key);

    const worshipTimes = Array.isArray(row.church_worship_times)
      ? row.church_worship_times
      : [];

    for (const entry of worshipTimes) {
      if (!isConfessionEntry(entry)) continue;

      const day = normalizeDay(entry.day_of_week);
      if (!day) continue;

      if (!target.confession_schedule[day]) {
        target.confession_schedule[day] = [];
      }

      const slot = buildConfessionSlot(entry);

      const alreadyExists = target.confession_schedule[day].some(
        (existing) =>
          existing.start_time === slot.start_time &&
          existing.end_time === slot.end_time &&
          existing.notes === slot.notes
      );

      if (!alreadyExists) {
        target.confession_schedule[day].push(slot);
      }
    }
  }
}

const churches = Array.from(seen.values());

await fs.writeFile(
  "./data/churches_scraped.json",
  JSON.stringify(churches, null, 2)
);

const withConfessions = churches.filter(
  (church) => Object.keys(church.confession_schedule).length > 0
);

await fs.writeFile(
  "./data/churches_with_confessions_only.json",
  JSON.stringify(withConfessions, null, 2)
);

console.log(`Saved ${churches.length} total churches`);
console.log(`Saved ${withConfessions.length} churches with confession times`);