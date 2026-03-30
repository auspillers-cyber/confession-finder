import Link from "next/link";
import { notFound } from "next/navigation";
import { getChurchBySlugs } from "@/lib/churches";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    state: string;
    city: string;
    church: string;
  }>;
};

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
    title: `${church.churchName} Confession Times in ${church.city}, ${church.state} | Catholic Churches offering Confession`,
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
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "40px 20px 60px",
        background:
          "linear-gradient(to bottom, #f4fbff 0%, #fcfdfd 30%, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/${church.stateSlug}/${church.citySlug}`}
          style={{
            color: "#4b6b88",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Back to {church.city}
        </Link>
      </div>

      <h1
        style={{
          fontSize: "2.4rem",
          marginBottom: 10,
          color: "#12324a",
          lineHeight: 1.15,
        }}
      >
        {church.churchName}
      </h1>

      <div
        style={{
          color: "#5a7182",
          marginBottom: 30,
          lineHeight: 1.6,
          fontSize: "1.02rem",
        }}
      >
        {church.address}, {church.city}, {church.state} {church.zip}
      </div>

      <section
        style={{
          padding: 24,
          border: "1px solid #d9ebf5",
          borderRadius: 18,
          marginBottom: 32,
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
          Looking for more confession times near you?
        </h2>

        <p
          style={{
            margin: "0 0 18px 0",
            color: "#476173",
            lineHeight: 1.6,
            maxWidth: 620,
          }}
        >
          Use the live finder to see nearby confession times, or browse more
          churches in {church.city}.
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

          <Link
            href={`/${church.stateSlug}/${church.citySlug}`}
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
            View More in {church.city}
          </Link>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: "1.65rem",
            marginBottom: 16,
            color: "#12324a",
          }}
        >
          Confession Times
        </h2>

        {scheduleEntries.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {scheduleEntries.map(([day, entries]) => (
              <div
                key={day}
                style={{
                  border: "1px solid #dcebf3",
                  borderRadius: 16,
                  padding: 18,
                  background: "#ffffff",
                  color: "#163247",
                  boxShadow: "0 8px 22px rgba(28, 70, 102, 0.06)",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "#14344d",
                    marginBottom: 8,
                    fontSize: "1.02rem",
                  }}
                >
                  {day}
                </strong>

                <div style={{ color: "#425a6b", lineHeight: 1.7 }}>
                  {entries.map((entry, i) => (
                    <div key={i}>
                      {[entry.start_time, entry.end_time]
                        .filter(Boolean)
                        .join(" - ")}
                      {entry.notes ? ` (${entry.notes})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #dcebf3",
              borderRadius: 16,
              padding: 18,
              background: "#ffffff",
              color: "#6b7f8d",
              boxShadow: "0 8px 22px rgba(28, 70, 102, 0.06)",
            }}
          >
            No confession schedule listed.
          </div>
        )}
      </section>

      {church.website && (
        <a
          href={church.website}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            padding: "12px 16px",
            border: "1px solid #cfe4f1",
            borderRadius: 12,
            textDecoration: "none",
            color: "#1d5f8d",
            background: "#ffffff",
            fontWeight: 600,
          }}
        >
          Visit Church Website
        </a>
      )}
    </main>
  );
}