import { NextRequest } from "next/server";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  if (
    !year || !month || !day ||
    Number.isNaN(hour) || Number.isNaN(minute)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function toICSLocal(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    "00",
  ].join("");
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const church = searchParams.get("church") || "Catholic Church";
  const date = searchParams.get("date") || "";
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  const address = searchParams.get("address") || "";
  const city = searchParams.get("city") || "";
  const state = searchParams.get("state") || "";
  const zip = searchParams.get("zip") || "";

  const startDate = parseLocalDateTime(date, start);
  const endDate = parseLocalDateTime(date, end || start);

  if (!startDate || !endDate) {
    return new Response("Invalid calendar parameters", { status: 400 });
  }

  const location = [address, city, state, zip].filter(Boolean).join(", ");

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Confession Near You//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${Date.now()}-${Math.random().toString(36).slice(2)}
DTSTAMP:${toICSLocal(new Date())}
DTSTART:${toICSLocal(startDate)}
DTEND:${toICSLocal(endDate)}
SUMMARY:Confession - ${church}
LOCATION:${location}
DESCRIPTION:Catholic Confession at ${church}
END:VEVENT
END:VCALENDAR`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="confession.ics"`,
    },
  });
}