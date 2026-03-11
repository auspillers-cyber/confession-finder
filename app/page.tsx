"use client";

import { useEffect, useMemo, useState } from "react";
import churchesData from "../data/churches_with_confessions_only.json";

type ConfessionSlot = {
  start_time?: string;
  end_time?: string;
  notes?: string;
};

type RawChurch = {
  church_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  confession_schedule: Record<string, ConfessionSlot[]>;
};

type ConfessionTime = {
  day: string;
  start: string;
  end: string;
  notes?: string;
};

type Church = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  address: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  confessionTimes: ConfessionTime[];
};

type FilterOption =
  | "next"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "saturday"
  | "sunday";

type UserLocation = {
  lat: number;
  lng: number;
};

type ChurchResult = Church & {
  distanceMiles: number | null;
  bestSlot: ConfessionTime | null;
  bestScore: number;
};

const rawChurches = churchesData as RawChurch[];

const dayOrder = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function clean(value: unknown): string {
  return (value ?? "").toString().trim();
}

function slugify(text: string): string {
  return clean(text)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeChurchKey(input: {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website?: string;
}) {
  return [
    clean(input.name).toLowerCase(),
    clean(input.address).toLowerCase(),
    clean(input.city).toLowerCase(),
    clean(input.state).toLowerCase(),
    clean(input.zip).toLowerCase(),
    clean(input.website).toLowerCase(),
  ].join("|");
}

function normalizeDay(day: string): string {
  const cleaned = clean(day);

  const map: Record<string, string> = {
    Sunday: "Sunday",
    Sundays: "Sunday",
    Monday: "Monday",
    Mondays: "Monday",
    Tuesday: "Tuesday",
    Tuesdays: "Tuesday",
    Wednesday: "Wednesday",
    Wednesdays: "Wednesday",
    Thursday: "Thursday",
    Thursdays: "Thursday",
    Friday: "Friday",
    Fridays: "Friday",
    Saturday: "Saturday",
    Saturdays: "Saturday",
    Weekday: "Weekdays",
    Weekdays: "Weekdays",
    Daily: "Daily",
  };

  return map[cleaned] || cleaned;
}

function parseTimeToMinutes(time: string): number | null {
  const trimmed = clean(time);
  if (!trimmed) return null;

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const suffix = ampmMatch[3].toUpperCase();

    if (suffix === "PM" && hour !== 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;

    return hour * 60 + minute;
  }

  const hhmmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hour = Number(hhmmMatch[1]);
    const minute = Number(hhmmMatch[2]);
    return hour * 60 + minute;
  }

  return null;
}

function formatTime(time: string): string {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return clean(time);

  let hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function transformChurches(raw: RawChurch[]): Church[] {
  const map = new Map<string, Church>();

  for (const church of raw) {
    const confessionTimes: ConfessionTime[] = [];

    for (const [day, slots] of Object.entries(church.confession_schedule || {})) {
      const normalizedDay = normalizeDay(day);

      for (const slot of slots) {
        const start = clean(slot.start_time);
        if (!start) continue;

        confessionTimes.push({
          day: normalizedDay,
          start,
          end: clean(slot.end_time),
          notes: clean(slot.notes),
        });
      }
    }

    const baseChurch: Church = {
      id: "",
      name: clean(church.church_name),
      city: clean(church.city),
      state: clean(church.state),
      zip: clean(church.zip),
      address: clean(church.address),
      website: clean(church.website),
      latitude: toNumber(church.latitude),
      longitude: toNumber(church.longitude),
      confessionTimes,
    };

    const dedupeKey = makeChurchKey({
      name: baseChurch.name,
      address: baseChurch.address,
      city: baseChurch.city,
      state: baseChurch.state,
      zip: baseChurch.zip,
      website: baseChurch.website,
    });

    const existing = map.get(dedupeKey);

    if (!existing) {
      baseChurch.id = slugify(
        `${baseChurch.name}-${baseChurch.address}-${baseChurch.city}-${baseChurch.state}-${baseChurch.zip}-${baseChurch.website}`
      );
      map.set(dedupeKey, baseChurch);
      continue;
    }

    const mergedSlots = [...existing.confessionTimes];

    for (const slot of confessionTimes) {
      const alreadyExists = mergedSlots.some(
        (existingSlot) =>
          existingSlot.day === slot.day &&
          existingSlot.start === slot.start &&
          existingSlot.end === slot.end &&
          existingSlot.notes === slot.notes
      );

      if (!alreadyExists) {
        mergedSlots.push(slot);
      }
    }

    map.set(dedupeKey, {
      ...existing,
      website: existing.website || baseChurch.website,
      latitude: existing.latitude ?? baseChurch.latitude,
      longitude: existing.longitude ?? baseChurch.longitude,
      confessionTimes: mergedSlots,
    });
  }

  return Array.from(map.values());
}

const churches: Church[] = transformChurches(rawChurches);

function getTodayIndex(): number {
  return new Date().getDay();
}

function getTodayName(): string {
  return dayOrder[getTodayIndex()];
}

function getTomorrowName(): string {
  return dayOrder[(getTodayIndex() + 1) % 7];
}

function getNextWeekdayOffset(): number | null {
  const todayIndex = getTodayIndex();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7;
    if (dayIndex >= 1 && dayIndex <= 5) return offset;
  }

  return null;
}

function getTomorrowWeekday(): boolean {
  const tomorrowIndex = (getTodayIndex() + 1) % 7;
  return tomorrowIndex >= 1 && tomorrowIndex <= 5;
}

function getSlotScore(slot: ConfessionTime): number {
  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = parseTimeToMinutes(slot.start);

  if (slotMinutes === null) return Number.POSITIVE_INFINITY;

  if (slot.day === "Daily") {
    return slotMinutes >= currentMinutes
      ? slotMinutes
      : 7 * 1440 + slotMinutes;
  }

  if (slot.day === "Weekdays") {
    for (let offset = 0; offset < 7; offset++) {
      const dayIndex = (currentDayIndex + offset) % 7;
      const isWeekday = dayIndex >= 1 && dayIndex <= 5;
      if (!isWeekday) continue;
      if (offset === 0 && slotMinutes < currentMinutes) continue;
      return offset * 1440 + slotMinutes;
    }

    return Number.POSITIVE_INFINITY;
  }

  const slotDayIndex = dayOrder.indexOf(slot.day);
  if (slotDayIndex === -1) return Number.POSITIVE_INFINITY;

  let daysAway = slotDayIndex - currentDayIndex;
  if (daysAway < 0) daysAway += 7;

  if (daysAway === 0 && slotMinutes < currentMinutes) {
    daysAway = 7;
  }

  return daysAway * 1440 + slotMinutes;
}

function getSlotsForFilter(church: Church, filter: FilterOption): ConfessionTime[] {
  const today = getTodayName();
  const tomorrow = getTomorrowName();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  return church.confessionTimes.filter((slot) => {
    const slotMinutes = parseTimeToMinutes(slot.start);
    if (slotMinutes === null) return false;

    switch (filter) {
      case "next":
        return true;

      case "today":
        if (slot.day === today) return slotMinutes >= nowMinutes;
        if (slot.day === "Daily") return slotMinutes >= nowMinutes;
        if (slot.day === "Weekdays") {
          const todayIndex = getTodayIndex();
          return todayIndex >= 1 && todayIndex <= 5 && slotMinutes >= nowMinutes;
        }
        return false;

      case "tomorrow":
        if (slot.day === tomorrow) return true;
        if (slot.day === "Daily") return true;
        if (slot.day === "Weekdays") return getTomorrowWeekday();
        return false;

      case "thisWeek":
        return getSlotScore(slot) < Number.POSITIVE_INFINITY;

      case "saturday":
        return slot.day === "Saturday";

      case "sunday":
        return slot.day === "Sunday";

      default:
        return false;
    }
  });
}

function getBestSlotForFilter(
  church: Church,
  filter: FilterOption
): ConfessionTime | null {
  const slots = getSlotsForFilter(church, filter);
  if (!slots.length) return null;

  let bestSlot: ConfessionTime | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const slot of slots) {
    const score = getSlotScore(slot);
    if (score < bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }

  return bestSlot;
}

function getBestScoreForFilter(church: Church, filter: FilterOption): number {
  const bestSlot = getBestSlotForFilter(church, filter);
  if (!bestSlot) return Number.POSITIVE_INFINITY;
  return getSlotScore(bestSlot);
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function getDistanceMiles(
  church: Church,
  userLocation: UserLocation | null
): number | null {
  if (!userLocation) return null;
  if (church.latitude === null || church.longitude === null) return null;

  return haversineMiles(
    userLocation.lat,
    userLocation.lng,
    church.latitude,
    church.longitude
  );
}

function formatDistance(distance: number | null): string {
  if (distance === null) return "";
  if (distance < 10) return `${distance.toFixed(1)} miles away`;
  return `${Math.round(distance)} miles away`;
}

function getDisplayLabel(bestSlot: ConfessionTime | null): string {
  if (!bestSlot) return "No confession times available";

  const score = getSlotScore(bestSlot);
  const daysAway = Math.floor(score / 1440);

  let prefix = bestSlot.day;
  if (daysAway === 0) prefix = "Today";
  if (daysAway === 1) prefix = "Tomorrow";

  if (!bestSlot.end) {
    return `${prefix} • ${formatTime(bestSlot.start)}`;
  }

  return `${prefix} • ${formatTime(bestSlot.start)} - ${formatTime(bestSlot.end)}`;
}
function sortSlotsForDisplay(slots: ConfessionTime[]): ConfessionTime[] {
  return [...slots].sort((a, b) => {
    const dayA = dayOrder.indexOf(a.day);
    const dayB = dayOrder.indexOf(b.day);

    if (dayA !== dayB) return dayA - dayB;

    const aMinutes = parseTimeToMinutes(a.start) ?? 99999;
    const bMinutes = parseTimeToMinutes(b.start) ?? 99999;

    return aMinutes - bMinutes;
  });
}
export default function Home() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterOption>("next");
  const [visibleCount, setVisibleCount] = useState(30); 
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "granted" | "denied"
  >("idle");

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("granted");
      },
      () => {
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);
  useEffect(() => {
  setVisibleCount(30);
    }, [search, filter]);

  const filteredChurches = useMemo(() => {
    const searchValue = clean(search).toLowerCase();

    const baseResults: ChurchResult[] = churches
      .filter((church) => {
        const matchesSearch =
          searchValue === "" ||
          church.name.toLowerCase().includes(searchValue) ||
          church.city.toLowerCase().includes(searchValue) ||
          church.state.toLowerCase().includes(searchValue) ||
          church.zip.toLowerCase().includes(searchValue) ||
          church.address.toLowerCase().includes(searchValue);

        if (!matchesSearch) return false;

        return getBestSlotForFilter(church, filter) !== null;
      })
      .map((church) => {
        const distanceMiles = getDistanceMiles(church, userLocation);
        const bestSlot = getBestSlotForFilter(church, filter);
        const bestScore = getBestScoreForFilter(church, filter);
        

        return {
          ...church,
          distanceMiles,
          bestSlot,
          bestScore,
        };
      });

    const deduped = new Map<string, ChurchResult>();

    for (const church of baseResults) {
      const key = makeChurchKey({
        name: church.name,
        address: church.address,
        city: church.city,
        state: church.state,
        zip: church.zip,
        website: church.website,
      });

      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, church);
        continue;
      }

      const existingHasDistance = existing.distanceMiles !== null;
      const currentHasDistance = church.distanceMiles !== null;

      if (!existingHasDistance && currentHasDistance) {
        deduped.set(key, church);
        continue;
      }

      if (
        existing.distanceMiles !== null &&
        church.distanceMiles !== null &&
        church.distanceMiles < existing.distanceMiles
      ) {
        deduped.set(key, church);
        continue;
      }

      if (church.bestScore < existing.bestScore) {
        deduped.set(key, church);
      }
    }

    const dedupedResults = Array.from(deduped.values());

    const withDistance = dedupedResults
      .filter(
        (church) =>
          church.distanceMiles !== null && Number.isFinite(church.distanceMiles)
      )
      .sort((a, b) => {
        if (a.distanceMiles! !== b.distanceMiles!) {
          return a.distanceMiles! - b.distanceMiles!;
        }

        if (a.bestScore !== b.bestScore) {
          return a.bestScore - b.bestScore;
        }

        return a.name.localeCompare(b.name);
      });

    const withoutDistance = dedupedResults
      .filter(
        (church) =>
          church.distanceMiles === null || !Number.isFinite(church.distanceMiles)
      )
      .sort((a, b) => {
        if (a.bestScore !== b.bestScore) {
          return a.bestScore - b.bestScore;
        }

        return a.name.localeCompare(b.name);
      });

    return [...withDistance, ...withoutDistance];
  }, [search, filter, userLocation]);

  const visibleChurches = filteredChurches.slice(0, visibleCount);

  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "40px",
        maxWidth: "950px",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        color: "#111111",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: "40px", marginBottom: "10px" }}>
        Find Confession Near You
      </h1>

      <p style={{ fontSize: "18px", color: "#555555", marginBottom: "20px" }}>
        Search Catholic churches and see upcoming confession times.
      </p>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#ffffff",
          paddingBottom: "16px",
          marginBottom: "24px",
          borderBottom: "1px solid #eeeeee",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px",
            paddingTop: "8px",
          }}
        >
          <input
            type="text"
            placeholder="Search church, city, ZIP, or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "12px",
              fontSize: "16px",
              minWidth: "280px",
              border: "1px solid #cccccc",
              borderRadius: "8px",
            }}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            style={{
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #cccccc",
              borderRadius: "8px",
            }}
          >
            <option value="next">Closest</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="thisWeek">This week</option>
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>

        <div style={{ color: "#555555", fontSize: "14px" }}>
          {locationStatus === "loading" && "Getting your location..."}
          {locationStatus === "granted" &&
            "Sorted by closest churches first, then next upcoming confession."}
          {locationStatus === "denied" &&
            "Location unavailable. Sorted by next upcoming confession."}
        </div>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {visibleChurches.map((church) => {
          const renderKey = `${church.id}-${church.zip}-${church.bestScore}-${church.website || "nowebsite"}`;

          return (
            <div
              key={renderKey}
              style={{
                border: "1px solid #dddddd",
                borderRadius: "12px",
                padding: "20px",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ margin: "0 0 8px 0" }}>{church.name}</h2>

              <p style={{ margin: "0 0 6px 0", color: "#555555" }}>
                {church.address}, {church.city}, {church.state} {church.zip}
              </p>

              {church.distanceMiles !== null && (
                <p
                  style={{
                    margin: "0 0 8px 0",
                    color: "#0f5a2b",
                    fontWeight: 600,
                  }}
                >
                  {formatDistance(church.distanceMiles)}
                </p>
              )}

              <div style={{ margin: "0 0 18px 0" }}>
  <p
    style={{
      margin: "0 0 10px 0",
      fontWeight: 600,
      fontSize: "18px",
    }}
  >
    Confession time:
  </p>

  <div style={{ display: "grid", gap: "10px" }}>
    {sortSlotsForDisplay(getSlotsForFilter(church, filter)).map((slot, index) => (
      <div
        key={`${church.id}-${slot.day}-${slot.start}-${index}`}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          fontSize: "17px",
          lineHeight: 1.4,
        }}
      >
        <span>
  <strong>
    {slot.day === "Weekdays" ? "Weekdays (Mon–Fri)" : slot.day}
  </strong>{" "}
  • {formatTime(slot.start)}
  {slot.end ? ` - ${formatTime(slot.end)}` : ""}
</span>

        <a
  href={`/api/calendar?church=${encodeURIComponent(
    church.name
  )}&day=${encodeURIComponent(slot.day)}&start=${encodeURIComponent(
    slot.start
  )}&end=${encodeURIComponent(
    slot.end || slot.start
  )}&address=${encodeURIComponent(
    church.address
  )}&city=${encodeURIComponent(church.city)}&state=${encodeURIComponent(
    church.state
  )}&zip=${encodeURIComponent(church.zip)}`}
  style={{
    textDecoration: "none",
    fontSize: "16px",
    whiteSpace: "nowrap",
  }}
>
  <span
    style={{
      color: "#1a73e8",
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    }}
  >
    📅 Add to Calendar
  </span>
</a>
      </div>
    ))}
  </div>
</div>

<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
  <a
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${church.address}, ${church.city}, ${church.state} ${church.zip}`
    )}`}
    target="_blank"
    rel="noreferrer"
    style={{
      padding: "10px 14px",
      border: "1px solid #111111",
      borderRadius: "8px",
      textDecoration: "none",
      color: "#111111",
    }}
  >
    Directions
  </a>

   {church.website && (
    <a
      href={church.website}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: "10px 14px",
        border: "1px solid #cccccc",
        borderRadius: "8px",
        textDecoration: "none",
        color: "#111111",
      }}
    >
      Website
    </a>
  )}
</div>
            </div>
          );
        })}
      </div>

      {visibleCount < filteredChurches.length && (
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setVisibleCount((prev) => prev + 30)}
            style={{
              padding: "12px 18px",
              border: "1px solid #111111",
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              color: "#111111",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Load More
          </button>
        </div>
      )}

    </main>
  );
}