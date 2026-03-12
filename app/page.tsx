"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import churchesData from "../data/churches_with_confessions_only.json";
import zipData from "../data/us_zipcodes.json";

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
};

type Suggestion = {
  label: string;
  lat: number;
  lng: number;
};

type LocationStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unsupported"
  | "suggesting"
  | "manual-granted"
  | "manual-error";

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

function getBestSlot(church: Church): ConfessionTime | null {
  if (!church.confessionTimes.length) return null;

  let bestSlot: ConfessionTime | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const slot of church.confessionTimes) {
    const score = getSlotScore(slot);
    if (score < bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }

  return bestSlot;
}

function getBestScore(church: Church): number {
  const bestSlot = getBestSlot(church);
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
  const [visibleCount, setVisibleCount] = useState(30);

  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState(
    ""
  );

  const [manualAddress, setManualAddress] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [lastSuggestionQuery, setLastSuggestionQuery] = useState("");

  const debounceRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationMessage(
        "Location is not supported on this device. Enter city, state below."
      );
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
        setShowSuggestions(false);
        setLocationMessage("Showing churches closest to your location.");
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus("denied");
        setShowEditor(true);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(
            "Location is turned off for Safari. Enable it in Safari site settings, or enter city, state below."
          );
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("Location request timed out. Enter city, state below.");
        } else {
          setLocationMessage("Could not get your location. Enter city, state below.");
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

  const zip = manualAddress.trim();

  if (zip.length !== 5) return;

  const data = (zipData as any)[zip];

  if (!data) {
    setLocationMessage("ZIP code not found.");
    return;
  }

  setActiveLocation({
    lat: data.lat,
    lng: data.lng,
    label: zip,
    source: "manual",
  });

  setLocationMessage(`Showing churches near ZIP ${zip}`);

}, [manualAddress]);

  const chooseSuggestion = useCallback((suggestion: Suggestion) => {
    setManualAddress(suggestion.label);
    setLastSuggestionQuery(suggestion.label);
    setActiveLocation({
      lat: suggestion.lat,
      lng: suggestion.lng,
      label: suggestion.label,
      source: "manual",
    });
    setLocationStatus("manual-granted");
    setLocationMessage(`Showing churches closest to ${suggestion.label}.`);
    setSuggestions([]);
    setShowSuggestions(false);
    setShowEditor(false);
  }, []);

  const clearLocation = useCallback(() => {
    setActiveLocation(null);
    setLocationStatus("idle");
    setLocationMessage("Use your current location or enter city, state.");
    setManualAddress("");
    setSuggestions([]);
    setShowSuggestions(false);
    setShowEditor(false);
    setLastSuggestionQuery("");
  }, []);

  const openEditor = useCallback(() => {
    setShowEditor(true);
    setLocationMessage("Use your current location again, or enter a different city, state.");
  }, []);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeLocation]);

  const filteredChurches = useMemo(() => {
    const baseResults: ChurchResult[] = churches
      .filter((church) => getBestSlot(church) !== null)
      .map((church) => {
        const distanceMiles = getDistanceMiles(church, activeLocation);
        const bestSlot = getBestSlot(church);
        const bestScore = getBestScore(church);

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
      .filter((church) => church.distanceMiles !== null && Number.isFinite(church.distanceMiles))
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
      .filter((church) => church.distanceMiles === null || !Number.isFinite(church.distanceMiles))
      .sort((a, b) => {
        if (a.bestScore !== b.bestScore) {
          return a.bestScore - b.bestScore;
        }

        return a.name.localeCompare(b.name);
      });

    return [...withDistance, ...withoutDistance];
  }, [activeLocation]);

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

            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="ZIP code"
                value={manualAddress}
                onChange={(e) => {
                  setManualAddress(e.target.value);
                  setShowEditor(true);
                }}
                onFocus={() => {
                  if (suggestions.length) setShowSuggestions(true);
                }}
                onBlur={() => {
                  if (blurTimeoutRef.current) {
                    window.clearTimeout(blurTimeoutRef.current);
                  }
                  blurTimeoutRef.current = window.setTimeout(() => {
                    setShowSuggestions(false);
                  }, 150);
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

              {showSuggestions && suggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #ececec",
                    borderRadius: "18px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 50,
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.label}-${index}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseSuggestion(suggestion)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "16px 18px",
                        backgroundColor: "#ffffff",
                        border: "none",
                        borderBottom:
                          index === suggestions.length - 1 ? "none" : "1px solid #f3f3f3",
                        cursor: "pointer",
                        fontSize: "15px",
                        lineHeight: 1.45,
                        color: "#222222",
                      }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  fontWeight: 1000,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }}>⌖</span>
                <span>{isLoadingLocation ? "Getting location..." : "Use precise location"}</span>
              </button>
            </div>

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

            {showEditor && locationStatus === "denied" && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "16px",
                  border: "1px solid #ecd7ae",
                  borderRadius: "16px",
                  backgroundColor: "#fffaf2",
                  fontSize: "14px",
                  color: "#555555",
                  lineHeight: 1.5,
                }}
              >
                Location is turned off for Safari. Enable it in Safari site settings, or keep typing city, state above and choose one of the suggestions.
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
              position: "relative",
            }}
          >
            <input
              type="text"
              placeholder="City, state"
              value={manualAddress}
              onChange={(e) => {
                setManualAddress(e.target.value);
              }}
              onFocus={() => {
                if (suggestions.length) setShowSuggestions(true);
              }}
              onBlur={() => {
                if (blurTimeoutRef.current) {
                  window.clearTimeout(blurTimeoutRef.current);
                }
                blurTimeoutRef.current = window.setTimeout(() => {
                  setShowSuggestions(false);
                }, 150);
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

            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  left: 0,
                  right: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid #ececec",
                  borderRadius: "18px",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
                  overflow: "hidden",
                  zIndex: 50,
                }}
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.label}-${index}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseSuggestion(suggestion)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "16px 18px",
                      backgroundColor: "#ffffff",
                      border: "none",
                      borderBottom:
                        index === suggestions.length - 1 ? "none" : "1px solid #f3f3f3",
                      cursor: "pointer",
                      fontSize: "15px",
                      lineHeight: 1.45,
                      color: "#222222",
                    }}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

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
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {visibleChurches.map((church) => {
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
                  {sortSlotsForDisplay(church.confessionTimes).map((slot, index) => (
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