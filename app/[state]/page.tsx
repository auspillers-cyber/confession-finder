import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllCitiesByState,
  getChurchesByState,
} from "@/lib/churches";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    state: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const stateSlug = resolvedParams.state;
  const churches = getChurchesByState(stateSlug);

  if (!churches.length) {
    return {
      title: "Confession Finder",
      description: "Find Catholic confession times near you.",
    };
  }

  const stateName = churches[0].state;

  return {
   title: `Confession Times in  ${stateName} | Catholic Churches offering Confession`,
    description: `Find Catholic confession times in ${stateName}. Browse churches by city and view confession schedules.`,
  };
}

export default async function StatePage({ params }: PageProps) {
  const resolvedParams = await params;
  const stateSlug = resolvedParams.state;

  const churches = getChurchesByState(stateSlug);

  if (!churches.length) {
    notFound();
  }

  const stateName = churches[0].state;
  const cities = getAllCitiesByState(stateSlug);

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
      <h1
        style={{
          fontSize: "2.7rem",
          marginBottom: 12,
          color: "#12324a",
        }}
      >
        Confession Times in {stateName}
      </h1>

      <p
        style={{
          fontSize: "1.1rem",
          color: "#4f6475",
          marginBottom: 28,
          maxWidth: 700,
          lineHeight: 1.6,
        }}
      >
        Find Catholic churches in {stateName} with confession schedules, or use
        the live finder to locate confession times near you instantly.
      </p>

      {/* 🔥 CTA BLOCK */}
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
          Find confession near you right now
        </h2>

        <p
          style={{
            margin: "0 0 18px 0",
            color: "#476173",
            lineHeight: 1.6,
            maxWidth: 640,
          }}
        >
          Use the live search tool to instantly find confession times based on
          your location.
        </p>

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
      </section>

      {/* INFO BOX */}
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
        <p style={{ margin: 0 }}>
          <strong>{churches.length}</strong> churches with confession data found
          in <strong>{stateName}</strong>.
        </p>
      </div>

      {/* CITY LIST */}
      <section>
        <h2
          style={{
            fontSize: "1.8rem",
            marginBottom: 18,
            color: "#12324a",
          }}
        >
          Browse Cities in {stateName}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {cities.map((city) => (
            <Link
              key={`${city.stateSlug}-${city.citySlug}`}
              href={`/${city.stateSlug}/${city.citySlug}`}
              style={{
                display: "block",
                border: "1px solid #dcebf3",
                borderRadius: 16,
                padding: 18,
                textDecoration: "none",
                color: "#163247",
                background: "#ffffff",
                boxShadow: "0 8px 22px rgba(28, 70, 102, 0.06)",
                transition: "transform 0.15s ease",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 6,
                  fontSize: "1.05rem",
                }}
              >
                {city.city}
              </div>

              <div style={{ color: "#5a7182" }}>
                {city.count} churches
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}