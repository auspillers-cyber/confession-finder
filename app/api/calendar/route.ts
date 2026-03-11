import { NextRequest } from "next/server";

const dayOrder = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function nextDateForDay(dayName: string): Date {
  const now = new Date();
  const targetIndex = dayOrder.indexOf(dayName);
  const currentIndex = now.getDay();

  if (targetIndex === -1) return now;

  let daysAway = targetIndex - currentIndex;
  if (daysAway < 0) daysAway += 7;

  const result = new Date(now);
  result.setDate(now.getDate() + daysAway);
  return result;
}

function parseTimeString(time: string): { hour: number; minute: number } {
  const value = time.trim();

  // Supports "16:00"
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number);
    return { hour, minute };
  }

  // Supports "4:00 PM"
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    return { hour, minute };
  }

  // Fallback
  return { hour: 16, minute: 0 };
}

function buildDateTime(dayName: string, time: string): Date {
  const baseDate = nextDateForDay(dayName);
  const { hour, minute } = parseTimeString(time);

  const result = new Date(baseDate);
  result.setHours(hour, minute, 0, 0);

  // If it's today but already passed, move to next week
  if (result.getTime() < Date.now()) {
    result.setDate(result.getDate() + 7);
  }

  return result;
}

function toICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function toGoogleDate(date: Date): string {
  return toICSDate(date);
}

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function isIOS(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userAgent = req.headers.get("user-agent") || "";

  const church = searchParams.get("church") || "Catholic Church";
  const day = searchParams.get("day") || "Saturday";
  const start = searchParams.get("start") || "16:00";
  const end = searchParams.get("end") || "17:00";
  const address = searchParams.get("address") || "";
  const city = searchParams.get("city") || "";
  const state = searchParams.get("state") || "";
  const zip = searchParams.get("zip") || "";
  const details =
    searchParams.get("details") || `Catholic Confession at ${church}`;

  const location = [address, city, state, zip].filter(Boolean).join(", ");

  const startDate = buildDateTime(day, start);
  const endDate = buildDateTime(day, end);

  // Android: open directly in Google Calendar
  if (isAndroid(userAgent)) {
    const googleUrl = new URL("https://calendar.google.com/calendar/render");
    googleUrl.searchParams.set("action", "TEMPLATE");
    googleUrl.searchParams.set("text", `Confession - ${church}`);
    googleUrl.searchParams.set(
      "dates",
      `${toGoogleDate(startDate)}/${toGoogleDate(endDate)}`
    );
    googleUrl.searchParams.set("details", details);
    if (location) {
      googleUrl.searchParams.set("location", location);
    }

    return Response.redirect(googleUrl.toString(), 302);
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Confession Finder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@confessionfinder`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `SUMMARY:${escapeICS(`Confession - ${church}`)}`,
    `DTSTART:${toICSDate(startDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    location ? `LOCATION:${escapeICS(location)}` : "",
    `DESCRIPTION:${escapeICS(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  // iPhone/iPad: serve inline, not forced attachment
  if (isIOS(userAgent)) {
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="confession.ics"',
        "Cache-Control": "no-store",
      },
    });
  }

  // Desktop / everything else: download ICS
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="confession.ics"',
      "Cache-Control": "no-store",
    },
  });
}