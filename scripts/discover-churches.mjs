import fs from "fs/promises";

const scanPoints = JSON.parse(
  await fs.readFile("./data/us_scan_points.json", "utf8")
);

const MAX_PAGES = 30;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(lat, lng, page, pointName) {
  const url = `https://masstimes.org/Churchs/?lat=${lat}&long=${lng}&pg=${page}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": `https://masstimes.org/map?lat=${lat}&lng=${lng}&SearchQueryTerm=${encodeURIComponent(pointName)}`
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!text.trim().startsWith("[")) {
    throw new Error(`Not JSON. First 200 chars: ${text.slice(0, 200)}`);
  }

  return JSON.parse(text);
}

function mapChurch(church) {
  return {
    church_name: church.church_name || "",
    address: church.church_address_street_address || "",
    city: church.church_address_city_name || "",
    state: church.church_address_province_name || "",
    zip: church.church_address_postal_code || "",
    website: church.church_website || "",
    latitude: church.latitude ?? null,
    longitude: church.longitude ?? null,
    confession_schedule: {},
    source: "masstimes"
  };
}

function makeKey(church) {
  return [
    church.church_name.trim().toLowerCase(),
    church.address.trim().toLowerCase(),
    church.city.trim().toLowerCase(),
    church.state.trim().toLowerCase()
  ].join("|");
}

async function main() {
  const rawPages = [];
  const discovered = [];
  const seenKeys = new Set();

  for (const point of scanPoints) {
    console.log(`\n=== ${point.state} - ${point.name} ===`);

    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Fetching page ${page}...`);

      let rows;
      try {
        rows = await fetchPage(point.lat, point.lng, page, point.name);
      } catch (err) {
        console.error(`Page ${page} failed: ${err.message}`);
        break;
      }

      console.log(`Page ${page}: ${rows.length} rows`);

      if (!rows.length) {
        console.log("Empty page reached. Moving to next point.");
        break;
      }

      rawPages.push({
        state: point.state,
        name: point.name,
        lat: point.lat,
        lng: point.lng,
        page,
        count: rows.length,
        rows
      });

      let newCount = 0;

      for (const row of rows) {
        const church = mapChurch(row);
        const key = makeKey(church);

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          discovered.push(church);
          newCount++;
        }
      }

      console.log(`Page ${page}: ${newCount} new unique churches`);

      if (newCount === 0) {
        console.log("No new churches on this page. Moving to next point.");
        break;
      }

      await fs.writeFile(
        "./data/discovered_churches.json",
        JSON.stringify(discovered, null, 2)
      );

      await sleep(REQUEST_DELAY_MS);
    }
  }

  await fs.writeFile(
    "./data/us_pages_raw.json",
    JSON.stringify(rawPages, null, 2)
  );

  await fs.writeFile(
    "./data/discovered_churches.json",
    JSON.stringify(discovered, null, 2)
  );

  console.log(`\nSaved ${discovered.length} unique churches total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});