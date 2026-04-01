"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import churchesData from "../data/churches_with_confessions_only.json";
import zipDataRaw from "../data/us_zipcodes.json";

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

type ActiveLocation = {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "manual";
};

type ChurchResult = Church & {
  distanceMiles: number | null;
  bestSlot: ConfessionTime | null;
  bestScore: number;
  exactZipMatch: boolean;
};

type FilterOption =
  | "next"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "saturday"
  | "sunday";

type LocationStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unsupported"
  | "manual-granted"
  | "manual-error";

type ZipData = Record<string, { lat: number; lng: number }>;

const zipData = zipDataRaw as ZipData;
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
          end: clean(slot.end_time) || start,
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
    return slotMinutes >= currentMinutes ? slotMinutes : 7 * 1440 + slotMinutes;
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

function getBestSlotForFilter(church: Church, filter: FilterOption): ConfessionTime | null {
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
function getNextDateForSlotDay(day: string): string {
  const now = new Date();
  const todayIndex = now.getDay();

  if (day === "Weekdays") {
    for (let offset = 0; offset < 14; offset++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      const candidateDay = candidate.getDay();
      if (candidateDay >= 1 && candidateDay <= 5) {
        return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
      }
    }
  }

  if (day === "Daily") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  const targetIndex = dayOrder.indexOf(day);
  let daysAway = targetIndex - todayIndex;
  if (daysAway < 0) daysAway += 7;

  const result = new Date(now);
  result.setDate(now.getDate() + daysAway);

  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
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

function getDistanceMiles(church: Church, activeLocation: ActiveLocation | null): number | null {
  if (!activeLocation) return null;
  if (church.latitude === null || church.longitude === null) return null;

  return haversineMiles(
    activeLocation.lat,
    activeLocation.lng,
    church.latitude,
    church.longitude
  );
}

function formatDistance(distance: number | null): string {
  if (distance === null) return "";
  if (distance < 10) return `${distance.toFixed(1)} miles away`;
  return `${Math.round(distance)} miles away`;
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
  const [zipInput, setZipInput] = useState("");
  const [filter, setFilter] = useState<FilterOption>("next");
  const [visibleCount, setVisibleCount] = useState(30);

  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationMessage("Location is not supported on this device.");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setActiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Current location",
          source: "gps",
        });
        setLocationStatus("granted");
        setShowEditor(false);
        setLocationMessage("Showing closest churches to your current location.");
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus("denied");

        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("Location is turned off for Safari. Enter a ZIP code instead.");
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("Location request timed out. Enter a ZIP code instead.");
        } else {
          setLocationMessage("Could not get your location. Enter a ZIP code instead.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    const zip = zipInput.trim();

    if (zip.length === 0) {
      if (!activeLocation || activeLocation.source === "manual") {
        setLocationStatus("idle");
        setLocationMessage("");
      }
      return;
    }

    if (zip.length < 5) {
      setLocationMessage("Enter a 5-digit ZIP code.");
      return;
    }

    if (zip.length > 5) {
      setLocationMessage("ZIP code must be 5 digits.");
      return;
    }

    const data = zipData[zip];

    if (!data) {
      setLocationStatus("manual-error");
      setLocationMessage("ZIP code not found.");
      return;
    }

    setActiveLocation({
      lat: data.lat,
      lng: data.lng,
      label: zip,
      source: "manual",
    });
    setLocationStatus("manual-granted");
    setLocationMessage(`Showing churches near ZIP ${zip}.`);
    setShowEditor(false);
  }, [zipInput, activeLocation]);

  const clearLocation = useCallback(() => {
    setActiveLocation(null);
    setLocationStatus("idle");
    setLocationMessage("");
    setZipInput("");
    setShowEditor(false);
    setFilter("next");
  }, []);

  const openEditor = useCallback(() => {
    setShowEditor(true);
  }, []);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeLocation, filter]);

  const filteredChurches = useMemo(() => {
    const baseResults: ChurchResult[] = churches
      .filter((church) => getBestSlotForFilter(church, filter) !== null)
      .map((church) => {
        const distanceMiles = getDistanceMiles(church, activeLocation);
        const bestSlot = getBestSlotForFilter(church, filter);
        const bestScore = getBestScoreForFilter(church, filter);

      return {
  ...church,
  distanceMiles,
  bestSlot,
  bestScore,
  exactZipMatch:
    activeLocation?.source === "manual" &&
    clean(church.zip) === clean(activeLocation.label),
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

      const existingDistance = existing.distanceMiles ?? Number.POSITIVE_INFINITY;
      const currentDistance = church.distanceMiles ?? Number.POSITIVE_INFINITY;

      if (currentDistance < existingDistance) {
        deduped.set(key, church);
        continue;
      }

      if (church.bestScore < existing.bestScore) {
        deduped.set(key, church);
      }
    }

    const dedupedResults = Array.from(deduped.values());

    const hasLocation = activeLocation !== null;

    if (hasLocation) {
  return dedupedResults.sort((a, b) => {
    if (activeLocation?.source === "manual") {
      if (a.exactZipMatch !== b.exactZipMatch) {
        return a.exactZipMatch ? -1 : 1;
      }
    }

    const aDistance = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const bDistance = b.distanceMiles ?? Number.POSITIVE_INFINITY;

    if (aDistance !== bDistance) {
      return aDistance - bDistance;
    }

    if (a.bestScore !== b.bestScore) {
      return a.bestScore - b.bestScore;
    }

    return a.name.localeCompare(b.name);
  });
}

    return dedupedResults.sort((a, b) => {
      if (a.bestScore !== b.bestScore) {
        return a.bestScore - b.bestScore;
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeLocation, filter]);

  const visibleChurches = filteredChurches.slice(0, visibleCount);
  const isLoadingLocation = locationStatus === "loading";

  if (!activeLocation) {
    return (
      <main
        style={{
          fontFamily: "Arial, sans-serif",
          padding: "36px 20px",
          maxWidth: "860px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          color: "#111111",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            border: "1px solid #ececec",
            borderRadius: "28px",
            padding: "30px 24px",
            backgroundColor: "#ffffff",
            boxShadow: "0 14px 48px rgba(0,0,0,0.06)",
          }}
        >
          <h1
            style={{
              fontSize: "44px",
              lineHeight: 1.05,
              marginBottom: "14px",
              letterSpacing: "-0.03em",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Confession Near You
          </h1>

          <div
            style={{
              maxWidth: "660px",
              margin: "0 auto 8px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "18px",
                color: "#555555",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              “The priest is not there to judge you, but to forgive and absolve you.”
            </p>
            <p
              style={{
                fontSize: "16px",
                color: "#666666",
                marginTop: "8px",
                marginBottom: 0,
                fontStyle: "italic",
              }}
            >
              — St. John Vianney
            </p>
          </div>

          <div
            style={{
              maxWidth: "680px",
              margin: "34px auto 0",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                marginBottom: "14px",
                textAlign: "center",
              }}
            >
              Find the closest church to confess
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="ZIP code"
              value={zipInput}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 5);
                setZipInput(next);
              }}
              style={{
                width: "100%",
                padding: "18px 22px",
                fontSize: "20px",
                border: "1px solid #dcdcdc",
                borderRadius: "999px",
                outline: "none",
                backgroundColor: "#ffffff",
                color: "#111111",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <button
                onClick={requestLocation}
                aria-label="Use precise location"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "14px 20px",
                  border: "1px solid #d9d9d9",
                  borderRadius: "999px",
                  backgroundColor: "#ffffff",
                  color: "#3b82f6",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }}>⌖</span>
                <span>{isLoadingLocation ? "Getting location..." : "Use precise location"}</span>
              </button>
            </div>

            {!!locationMessage && (
              <div
                style={{
                  marginTop: "12px",
                  color: "#666666",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {locationMessage}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "0 16px 28px",
        maxWidth: "950px",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        color: "#111111",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #eeeeee",
          padding: "8px 0 10px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={clearLocation}
            aria-label="Back"
            style={{
              border: "none",
              background: "none",
              padding: "4px 2px",
              margin: 0,
              fontSize: "28px",
              lineHeight: 1,
              cursor: "pointer",
              color: "#111111",
            }}
          >
            ←
          </button>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #cccccc",
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              color: "#111111",
            }}
          >
            <option value="next">Next Available</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="thisWeek">This Week</option>
            <option value="saturday">Saturday</option>
            <option value="sunday">Sunday</option>
          </select>

          <button
            onClick={openEditor}
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #cccccc",
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              color: "#111111",
              cursor: "pointer",
            }}
          >
            Edit Location
          </button>
        </div>

        {showEditor && (
          <div
            style={{
              marginTop: "10px",
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="ZIP code"
              value={zipInput}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 5);
                setZipInput(next);
              }}
              style={{
                width: "100%",
                padding: "16px 18px",
                fontSize: "17px",
                border: "1px solid #dddddd",
                borderRadius: "18px",
                outline: "none",
                backgroundColor: "#fcfcfc",
                color: "#111111",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                marginTop: "10px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={requestLocation}
                aria-label="Use precise location"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px 18px",
                  border: "1px solid #d9d9d9",
                  borderRadius: "999px",
                  backgroundColor: "#ffffff",
                  color: "#3b82f6",
                  fontSize: "15px",
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }}>⌖</span>
                <span>{isLoadingLocation ? "Getting location..." : "Use precise location"}</span>
              </button>
            </div>

            {!!locationMessage && (
              <div
                style={{
                  marginTop: "8px",
                  color: "#666666",
                  fontSize: "13px",
                  lineHeight: 1.4,
                }}
              >
                {locationMessage}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {visibleChurches.map((church) => {
          const slots = sortSlotsForDisplay(getSlotsForFilter(church, filter));
          const renderKey = `${church.id}-${church.zip}-${church.bestScore}-${church.website || "nowebsite"}`;

          return (
            <div
              key={renderKey}
              style={{
                border: "1px solid #ececec",
                borderRadius: "20px",
                padding: "22px",
                backgroundColor: "#ffffff",
                boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "30px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {church.name}
              </h2>

              <p
                style={{
                  margin: "0 0 10px 0",
                  color: "#666666",
                  fontSize: "16px",
                  lineHeight: 1.5,
                }}
              >
                {church.address}, {church.city}, {church.state} {church.zip}
              </p>

              {activeLocation?.source === "gps" && church.distanceMiles !== null && (
                <p
                  style={{
                    margin: "0 0 12px 0",
                    color: "#0f5a2b",
                    fontWeight: 700,
                    fontSize: "16px",
                  }}
                >
                  {formatDistance(church.distanceMiles)}
                </p>
              )}

              <div style={{ margin: "0 0 18px 0" }}>
                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontWeight: 700,
                    fontSize: "18px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Confession time:
                </p>

                <div style={{ display: "grid", gap: "10px" }}>
                  {slots.map((slot, index) => (
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
                        )}&city=${encodeURIComponent(
                          church.city
                        )}&state=${encodeURIComponent(
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
                          Add to Calendar
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
                    padding: "11px 16px",
                    border: "1px solid #111111",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "#111111",
                    fontWeight: 600,
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
                      padding: "11px 16px",
                      border: "1px solid #d8d8d8",
                      borderRadius: "10px",
                      textDecoration: "none",
                      color: "#111111",
                      fontWeight: 500,
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
            marginTop: "22px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setVisibleCount((prev) => prev + 30)}
            style={{
              padding: "12px 18px",
              border: "1px solid #111111",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              color: "#111111",
              fontSize: "16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Load More
          </button>
        </div>
      )}
    </main>
  );
}