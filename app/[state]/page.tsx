import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllCitiesByState,
  getAllStatePages,
  getChurchesByState,
} from "@/lib/churches";

type PageProps = {
  params: Promise<{
    state: string;
  }>;
};

export async function generateStaticParams() {
  return getAllStatePages().map((state) => ({
    state: state.stateSlug,
  }));
}

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
    title: `Confession Times in ${stateName} | Confession Finder`,
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
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: 12 }}>
        Confession Times in {stateName}
      </h1>

      <p style={{ fontSize: "1.1rem", color: "#444", marginBottom: 32 }}>
        Find Catholic churches in {stateName} with confession schedules, church
        details, and city pages.
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
          <strong>{stateName}</strong>.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.6rem", marginBottom: 16 }}>
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
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: "#111",
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{city.city}</div>
              <div style={{ color: "#555" }}>{city.count} churches</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}