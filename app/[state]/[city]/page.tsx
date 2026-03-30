import Link from "next/link";
import { notFound } from "next/navigation";
import { getChurchesByCity } from "@/lib/churches";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    state: string;
    city: string;
  }>;
};

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
    title: `Confession Near Me in ${cityName}, ${stateName}`,
    description: `Find Catholic confession near you in ${cityName}, ${stateName}. View confession times today at local churches.`,
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
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: "40px 20px 60px",
        background:
          "linear-gradient(to bottom, #f4fbff 0%, #fcfdfd 30%, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/${stateSlug}`}
          style={{
            color: "#4b6b88",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Back to {stateName}
        </Link>
      </div>

      <h1
        style={{
          fontSize: "2.7rem",
          marginBottom: 12,
          color: "#12324a",
          lineHeight: 1.15,
        }}
      >
        Confession Times in {cityName}, {stateName}
      </h1>

      <p
        style={{
          fontSize: "1.1rem",
          color: "#4f6475",
          marginBottom: 28,
          maxWidth: 760,
          lineHeight: 1.6,
        }}
      >
        Browse Catholic churches in {cityName} with confession schedules, church
        details, and direct links.
      </p>

      <section
        style={{
          padding: 24,
          border: "1px solid #d9ebf5",
          borderRadius: 18,
          marginBottom: 28,
          background: "linear-gradient(135deg, #eaf7ff 0%, #f5fbff 100%)",
          boxShadow: "0 10px 30px rgba(28, 70, 102, 0.08)",
        }}
      >
        <h2
          style={{
            fontSize: "1.45rem",
            marginBottom: 10,
            color: "#12324a",
          }}
        >
          Looking for confession near you today?
        </h2>

        <p
          style={{
            margin: "0 0 18px 0",
            color: "#476173",
            lineHeight: 1.6,
            maxWidth: 700,
          }}
        >
          Use the live finder to see confession times near your location, or
          browse churches in {cityName} below.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "#1d8fe1",
              color: "#fff",
              padding: "14px 22px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 700,
              boxShadow: "0 8px 20px rgba(29, 143, 225, 0.22)",
            }}
          >
            Find Confession Near You
          </Link>

          <a
            href="#churches-list"
            style={{
              display: "inline-block",
              background: "#ffffff",
              color: "#1d5f8d",
              padding: "14px 22px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
              border: "1px solid #cfe4f1",
            }}
          >
            Browse Churches in {cityName}
          </a>
        </div>
      </section>

      <div
        style={{
          padding: 20,
          border: "1px solid #dcecf5",
          borderRadius: 16,
          marginBottom: 32,
          background: "#ffffff",
          color: "#234055",
          boxShadow: "0 6px 18px rgba(31, 61, 90, 0.05)",
        }}
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          <strong>{churches.length}</strong> churches with confession data found
          in <strong>{cityName}</strong>.
        </p>
      </div>

      <section id="churches-list">
        <h2
          style={{
            fontSize: "1.75rem",
            marginBottom: 18,
            color: "#12324a",
          }}
        >
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
                  border: "1px solid #dcebf3",
                  borderRadius: 16,
                  padding: 20,
                  textDecoration: "none",
                  color: "#163247",
                  background: "#ffffff",
                  boxShadow: "0 8px 22px rgba(28, 70, 102, 0.06)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.08rem",
                    marginBottom: 8,
                    color: "#14344d",
                  }}
                >
                  {church.churchName}
                </div>

                <div
                  style={{
                    color: "#5a7182",
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {church.address}, {church.city}, {church.state} {church.zip}
                </div>

                {scheduleEntries.length > 0 ? (
                  <div style={{ color: "#425a6b", lineHeight: 1.6 }}>
                    {scheduleEntries.slice(0, 2).map(([day, entries]) => (
                      <div key={day} style={{ marginBottom: 4 }}>
                        <strong style={{ color: "#173a55" }}>{day}:</strong>{" "}
                        {entries
                          .map((entry) =>
                            [entry.start_time, entry.end_time]
                              .filter(Boolean)
                              .join(" - ")
                          )
                          .join(", ")}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#6b7f8d" }}>
                    No confession schedule listed.
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}