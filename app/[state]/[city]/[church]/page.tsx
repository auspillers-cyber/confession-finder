import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllChurchPageParams, getChurchBySlugs } from "@/lib/churches";

type PageProps = {
  params: Promise<{
    state: string;
    city: string;
    church: string;
  }>;
};

export async function generateStaticParams() {
  return getAllChurchPageParams();
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;

  const church = getChurchBySlugs(
    resolvedParams.state,
    resolvedParams.city,
    resolvedParams.church
  );

  if (!church) {
    return {
      title: "Confession Finder",
      description: "Find Catholic confession times near you.",
    };
  }

  return {
    title: `${church.churchName} Confession Times in ${church.city}, ${church.state} | Confession Finder`,
    description: `View confession times for ${church.churchName} in ${church.city}, ${church.state}. See church address, website, and confession schedule.`,
  };
}

export default async function ChurchPage({ params }: PageProps) {
  const resolvedParams = await params;

  const church = getChurchBySlugs(
    resolvedParams.state,
    resolvedParams.city,
    resolvedParams.church
  );

  if (!church) {
    notFound();
  }

  const scheduleEntries = Object.entries(church.confessionSchedule);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/${church.stateSlug}/${church.citySlug}`}
          style={{ color: "#888", textDecoration: "none" }}
        >
          ← Back to {church.city}
        </Link>
      </div>

      <h1 style={{ fontSize: "2.2rem", marginBottom: 10 }}>
        {church.churchName}
      </h1>

      <div style={{ color: "#444", marginBottom: 30 }}>
        {church.address}, {church.city}, {church.state} {church.zip}
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.6rem", marginBottom: 16 }}>
          Confession Times
        </h2>

        {scheduleEntries.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {scheduleEntries.map(([day, entries]) => (
              <div
                key={day}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 14,
                  background: "#fafafa",
                  color: "#111",
                }}
              >
                <strong>{day}</strong>

                <div style={{ marginTop: 6 }}>
                  {entries.map((entry, i) => (
                    <div key={i}>
                      {[entry.start_time, entry.end_time].filter(Boolean).join(" - ")}
                      {entry.notes ? ` (${entry.notes})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No confession schedule listed.</p>
        )}
      </section>

      {church.website && (
        <a
          href={church.website}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            borderRadius: 8,
            textDecoration: "none",
            color: "#111",
          }}
        >
          Visit Church Website
        </a>
      )}
    </main>
  );
}