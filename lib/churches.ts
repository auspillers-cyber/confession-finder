import churchesRaw from "@/data/churches_with_confessions_only.json";

export type ConfessionEntry = {
  start_time?: string;
  end_time?: string;
  notes?: string;
};

export type RawChurch = {
  church_name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  confession_schedule?: Record<string, ConfessionEntry[]>;
  source?: string;
};

export type Church = {
  id: string;
  churchName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  confessionSchedule: Record<string, ConfessionEntry[]>;
  source: string;
  stateSlug: string;
  citySlug: string;
  churchSlug: string;
};

const churches = churchesRaw as RawChurch[];

export function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function makeChurchId(church: RawChurch): string {
  return [
    clean(church.church_name).toLowerCase(),
    clean(church.address).toLowerCase(),
    clean(church.city).toLowerCase(),
    clean(church.state).toLowerCase(),
    clean(church.zip).toLowerCase(),
  ].join("|");
}

function normalizeChurch(church: RawChurch): Church {
  const churchName = clean(church.church_name);
  const city = clean(church.city);
  const state = clean(church.state);

  return {
    id: makeChurchId(church),
    churchName,
    address: clean(church.address),
    city,
    state,
    zip: clean(church.zip),
    website: clean(church.website),
    latitude:
      typeof church.latitude === "number" ? church.latitude : null,
    longitude:
      typeof church.longitude === "number" ? church.longitude : null,
    confessionSchedule: church.confession_schedule ?? {},
    source: clean(church.source),
    stateSlug: slugify(state),
    citySlug: slugify(city),
    churchSlug: slugify(churchName),
  };
}

export function getAllChurches(): Church[] {
  return churches.map(normalizeChurch);
}

export function getChurchesByState(stateSlug: string): Church[] {
  return getAllChurches().filter((church) => church.stateSlug === stateSlug);
}

export function getChurchesByCity(stateSlug: string, citySlug: string): Church[] {
  return getAllChurches().filter(
    (church) =>
      church.stateSlug === stateSlug && church.citySlug === citySlug
  );
}

export function getChurchBySlugs(
  stateSlug: string,
  citySlug: string,
  churchSlug: string
): Church | undefined {
  return getAllChurches().find(
    (church) =>
      church.stateSlug === stateSlug &&
      church.citySlug === citySlug &&
      church.churchSlug === churchSlug
  );
}

export function getAllStateSlugs(): string[] {
  return [...new Set(getAllChurches().map((church) => church.stateSlug))].sort();
}

export function getAllCitiesByState(stateSlug: string): {
  city: string;
  citySlug: string;
  state: string;
  stateSlug: string;
  count: number;
}[] {
  const filtered = getChurchesByState(stateSlug);

  const map = new Map<
    string,
    {
      city: string;
      citySlug: string;
      state: string;
      stateSlug: string;
      count: number;
    }
  >();

  for (const church of filtered) {
    const key = `${church.stateSlug}|${church.citySlug}`;

    if (!map.has(key)) {
      map.set(key, {
        city: church.city,
        citySlug: church.citySlug,
        state: church.state,
        stateSlug: church.stateSlug,
        count: 0,
      });
    }

    map.get(key)!.count += 1;
  }

  return [...map.values()].sort((a, b) => a.city.localeCompare(b.city));
}

export function getAllStatePages(): {
  state: string;
  stateSlug: string;
  count: number;
}[] {
  const all = getAllChurches();

  const map = new Map<
    string,
    {
      state: string;
      stateSlug: string;
      count: number;
    }
  >();

  for (const church of all) {
    if (!map.has(church.stateSlug)) {
      map.set(church.stateSlug, {
        state: church.state,
        stateSlug: church.stateSlug,
        count: 0,
      });
    }

    map.get(church.stateSlug)!.count += 1;
  }

  return [...map.values()].sort((a, b) => a.state.localeCompare(b.state));
}

export function getAllCityPages(): {
  state: string;
  stateSlug: string;
  city: string;
  citySlug: string;
  count: number;
}[] {
  const all = getAllChurches();

  const map = new Map<
    string,
    {
      state: string;
      stateSlug: string;
      city: string;
      citySlug: string;
      count: number;
    }
  >();

  for (const church of all) {
    const key = `${church.stateSlug}|${church.citySlug}`;

    if (!map.has(key)) {
      map.set(key, {
        state: church.state,
        stateSlug: church.stateSlug,
        city: church.city,
        citySlug: church.citySlug,
        count: 0,
      });
    }

    map.get(key)!.count += 1;
  }

  return [...map.values()].sort((a, b) => {
    if (a.state === b.state) return a.city.localeCompare(b.city);
    return a.state.localeCompare(b.state);
  });
}

export function getAllChurchPageParams(): {
  state: string;
  city: string;
  church: string;
}[] {
  return getAllChurches().map((church) => ({
    state: church.stateSlug,
    city: church.citySlug,
    church: church.churchSlug,
  }));
}