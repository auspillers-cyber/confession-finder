import fs from "fs/promises";
import * as cheerio from "cheerio";

const churches = JSON.parse(await fs.readFile("./data/churches.json", "utf8"));

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ConfessionNearYouBot/0.1",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  return await res.text();
}

function extractConfessionText(html) {
  const $ = cheerio.load(html);
  const matches = [];

  $("body *").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const lower = text.toLowerCase();

    if (
      lower.includes("confession") ||
      lower.includes("reconciliation") ||
      lower.includes("penance")
    ) {
      matches.push(text);
    }
  });

  return matches.join(" ");
}

function extractTimes(text) {
  const regex =
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*[:\-]?\s*([^]*?)(?=(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*[:\-]?|$)/gi;

  const results = {};
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rawDay = match[1];
    const rawTimes = match[2];

    const day =
      rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();

    results[day] = rawTimes.trim();
  }

  return results;
}

function normalizeTime(t) {
  if (!t) return null;

  const clean = t
    .replace(/a\.m\./gi, "am")
    .replace(/p\.m\./gi, "pm")
    .replace(/\s+/g, "")
    .toLowerCase();

  const matched = clean.match(/(\d{1,2}:\d{2})(am|pm)?/);
  if (!matched) return null;

  const time = matched[1];
  const suffix = matched[2];

  let [hour, minute] = time.split(":").map(Number);

  if (suffix === "pm" && hour !== 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function parseTimeRanges(text) {
  const ranges = [];

  const regex =
    /(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)?)\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)?)/gi;

  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = normalizeTime(match[1]);
    const end = normalizeTime(match[2]);

    if (start && end) {
      ranges.push({
        start_time: start,
        end_time: end,
      });
    }
  }

  return ranges;
}

function buildNormalizedSchedule(parsedTimes) {
  const schedule = {};

  for (const [day, rawText] of Object.entries(parsedTimes)) {
    const ranges = parseTimeRanges(rawText);

    if (ranges.length > 0) {
      schedule[day] = ranges;
    }
  }

  return schedule;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeChurch(church) {
  if (!church.website) {
    return {
      ...church,
      scrape_status: "no_website",
    };
  }

  try {
    const html = await fetchHtml(church.website);
    const confessionText = extractConfessionText(html);
    const parsedTimes = extractTimes(confessionText);
    const normalizedSchedule = buildNormalizedSchedule(parsedTimes);

    const hasSchedule = Object.keys(normalizedSchedule).length > 0;

    return {
      ...church,
      confession_schedule: hasSchedule
        ? normalizedSchedule
        : church.confession_schedule || {},
      scrape_status: hasSchedule ? "scraped" : "needs_manual_review",
      scrape_source_text: confessionText.slice(0, 2000),
    };
  } catch (error) {
    return {
      ...church,
      scrape_status: "error",
      scrape_error: String(error.message || error),
    };
  }
}

async function main() {
  const updatedChurches = [];
  const churchesWithWebsites = churches.filter((c) => c.website);

  console.log(`Found ${churches.length} total churches`);
  console.log(`Scraping ${churchesWithWebsites.length} churches with websites...\n`);

  let index = 0;

  for (const church of churches) {
    index += 1;
    console.log(`[${index}/${churches.length}] ${church.church_name || "Unknown Church"}`);

    const updated = await scrapeChurch(church);
    updatedChurches.push(updated);

    console.log(`   status: ${updated.scrape_status}`);

    await sleep(1500);
  }

  await fs.writeFile(
    "./data/churches_scraped.json",
    JSON.stringify(updatedChurches, null, 2)
  );

  const scrapedCount = updatedChurches.filter(
    (c) => c.scrape_status === "scraped"
  ).length;

  const reviewCount = updatedChurches.filter(
    (c) => c.scrape_status === "needs_manual_review"
  ).length;

  const errorCount = updatedChurches.filter(
    (c) => c.scrape_status === "error"
  ).length;

  console.log("\nDone.");
  console.log(`Scraped successfully: ${scrapedCount}`);
  console.log(`Needs manual review: ${reviewCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log("Saved to: ./data/churches_scraped.json");
}

main().catch((err) => {
  console.error(err);
})