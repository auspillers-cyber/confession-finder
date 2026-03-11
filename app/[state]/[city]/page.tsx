import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllCityPages, getChurchesByCity } from "@/lib/churches";

type PageProps = {
  params: Promise<{
    state: string;
    city: string;
  }>;
};

export async function generateStaticParams() {
  return getAllCityPages().map((city) => ({
    state: city.stateSlug,
    city: city.citySlug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const stateSlug = resolvedParams.state;
  const citySlug = resolvedParams.city;

  const churches = getChurchesByCity(stateSlug, citySlug);

  if (!churches.length) {
    return {
      title: "Confession Finder",
      description: "Find Catholic confession times near you.",
    };
  }

  const cityName = churches[0].city;
  const stateName = churches[0].state;

  return {
    title: `Confession Times in ${cityName}, ${stateName} | Confession Finder`,
    description: `Find Catholic confession times in ${cityName}, ${stateName}. Browse local churches and view confession schedules.`,
  };
}

export default async function CityPage({ params }: PageProps) {
  const resolvedParams = await params;
  const stateSlug = resolvedParams.state;
  const citySlug = resolvedParams.city;

  const churches = getChurchesByCity(stateSlug, citySlug);

  if (!churches.length) {
    notFound();
  }

  const cityName = churches[0].city;
  const stateName = churches[0].state;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/${stateSlug}`}
          style={{ color: "#888", textDecoration: "none" }}
        >
          ← Back to {stateName}
        </Link>
      </div>

      <h1 style={{ fontSize: "2.5rem", marginBottom: 12 }}>
        Confession Times in {cityName}, {stateName}
      </h1>

      <p style={{ fontSize: "1.1rem", color: "#444", marginBottom: 32 }}>
        Browse Catholic churches in {cityName} with confession schedules, church
        details, and direct links.
      </p>

      <div
        style={{
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginBottom: 32,
          background: "#fafafa",
          color: "#111",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>{churches.length}</strong> churches with confession data found in{" "}
          <strong>{cityName}</strong>.
        </p>
      </div>

      <section>
        <h2 style={{ fontSize: "1.6rem", marginBottom: 16 }}>
          Churches in {cityName}
        </h2>

        <div style={{ display: "grid", gap: 16 }}>
          {churches.map((church) => {
            const scheduleEntries = Object.entries(church.confessionSchedule);

            return (
              <Link
                key={church.id}
                href={`/${church.stateSlug}/${church.citySlug}/${church.churchSlug}`}
                style={{
                  display: "block",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 18,
                  textDecoration: "none",
                  color: "#111",
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 6 }}>
                  {church.churchName}
                </div>

                <div style={{ color: "#444", marginBottom: 10 }}>
                  {church.address}, {church.city}, {church.state} {church.zip}
                </div>

                {scheduleEntries.length > 0 ? (
                  <div style={{ color: "#555" }}>
                    {scheduleEntries.slice(0, 2).map(([day, entries]) => (
                      <div key={day} style={{ marginBottom: 4 }}>
                        <strong>{day}:</strong>{" "}
                        {entries
                          .map((entry) =>
                            [entry.start_time, entry.end_time].filter(Boolean).join(" - ")
                          )
                          .join(", ")}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#666" }}>No confession schedule listed.</div>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}