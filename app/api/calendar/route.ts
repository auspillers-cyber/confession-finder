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

function buildDateTime(dayName: string, time: string): Date {
  const baseDate = nextDateForDay(dayName);
  const [hour, minute] = time.split(":").map(Number);

  const result = new Date(baseDate);
  result.setHours(hour, minute, 0, 0);

  // if it's today but already passed, move to next week
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

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const church = searchParams.get("church") || "Catholic Church";
  const day = searchParams.get("day") || "Saturday";
  const start = searchParams.get("start") || "16:00";
  const end = searchParams.get("end") || "17:00";
  const address = searchParams.get("address") || "";
  const city = searchParams.get("city") || "";
  const state = searchParams.get("state") || "";
  const zip = searchParams.get("zip") || "";

  const location = [address, city, state, zip].filter(Boolean).join(", ");

  const startDate = buildDateTime(day, start);
  const endDate = buildDateTime(day, end);

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Confession Near You//EN
BEGIN:VEVENT
UID:${Date.now()}-${Math.random().toString(36).slice(2)}
DTSTAMP:${toICSDate(new Date())}
SUMMARY:Confession - ${church}
DTSTART:${toICSDate(startDate)}
DTEND:${toICSDate(endDate)}
LOCATION:${location}
DESCRIPTION:Catholic Confession at ${church}
END:VEVENT
END:VCALENDAR`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="confession.ics"`,
    },
  });
}