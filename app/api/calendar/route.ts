import { NextRequest, NextResponse } from "next/server";

const DEFAULT_TZ = "America/New_York";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function parse12HourTime(timeStr: string): { hour: number; minute: number } | null {
  const normalized = (timeStr || "").trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return { hour, minute };
}

function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = (dateStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function buildLocalParts(dateStr: string, timeStr: string) {
  const date = parseDate(dateStr);
  const time = parse12HourTime(timeStr);

  if (!date || !time) return null;

  return {
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time.hour,
    minute: time.minute,
  };
}

function formatIcsLocal(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}00`;
}

function formatUtcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds()
  )}Z`;
}

function addMinutes(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}, minutesToAdd: number) {
  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0
  );

  date.setMinutes(date.getMinutes() + minutesToAdd);

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const church = (searchParams.get("church") || "").trim() || "Catholic Church";
  const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
  const start = (searchParams.get("start") || "").trim(); // e.g. 7:00 PM
  const end = (searchParams.get("end") || "").trim(); // e.g. 8:00 PM
  const address = (searchParams.get("address") || "").trim();
  const tz = (searchParams.get("tz") || DEFAULT_TZ).trim() || DEFAULT_TZ;

  const startLocal = buildLocalParts(date, start);

  if (!startLocal) {
    return new NextResponse("Invalid calendar parameters", { status: 400 });
  }

  let endLocal = end ? buildLocalParts(date, end) : null;

  if (!endLocal) {
    endLocal = addMinutes(startLocal, 30);
  }

  const location = address;
  const title = `Confession – ${church}`;
  const description = `Catholic confession at ${church}`;
  const uidSafeChurch = church.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const uidSafeStart = `${date}-${start}`.replace(/[^a-z0-9]+/gi, "-");
  const uid = `${uidSafeChurch}-${uidSafeStart}@confessionnearyou.com`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Confession Near You//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DTSTART;TZID=${tz}:${formatIcsLocal(startLocal)}`,
    `DTEND;TZID=${tz}:${formatIcsLocal(endLocal)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="confession-${date}.ics"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}