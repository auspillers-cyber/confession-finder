import { getAllStatePages, getAllCityPages } from "@/lib/churches";
import HomeFinder from "./HomeFinder";

export default function Home() {
  const states = getAllStatePages();
  // Pick the top 24 cities by church count for SEO links
  const topCities = getAllCityPages()
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Confession Near You",
    url: "https://confessionnearyou.com",
    description:
      "Find Catholic confession times near you. Search by ZIP code or location and browse churches offering confession today.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://confessionnearyou.com/?zip={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Interactive finder — client component */}
      <HomeFinder />

      {/* Static SEO content — crawlable by Google */}
      <section
        style={{
          maxWidth: 950,
          margin: "0 auto",
          padding: "0 16px 60px",
          fontFamily: "Arial, sans-serif",
          color: "#111111",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 8,
            color: "#12324a",
          }}
        >
          Find Confession Near You
        </h2>
        <p
          style={{
            color: "#555",
            lineHeight: 1.6,
            marginBottom: 32,
            maxWidth: 680,
          }}
        >
          Confession Near You helps Catholics find sacramental confession times
          at local Catholic churches across the United States. Enter your ZIP
          code or share your location to see churches near you, sorted by
          distance and the soonest available confession time.
        </p>

        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 16,
            color: "#12324a",
          }}
        >
          Browse Confession Times by City
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
            marginBottom: 40,
          }}
        >
          {topCities.map((city) => (
            <a
              key={`${city.stateSlug}-${city.citySlug}`}
              href={`/${city.stateSlug}/${city.citySlug}`}
              style={{
                display: "block",
                padding: "10px 14px",
                border: "1px solid #ececec",
                borderRadius: 10,
                textDecoration: "none",
                color: "#163247",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {city.city}, {city.state}
              <span style={{ color: "#888", marginLeft: 6, fontWeight: 400 }}>
                ({city.count})
              </span>
            </a>
          ))}
        </div>

        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 16,
            color: "#12324a",
          }}
        >
          Browse by State
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          {states.map((state) => (
            <a
              key={state.stateSlug}
              href={`/${state.stateSlug}`}
              style={{
                display: "block",
                padding: "10px 14px",
                border: "1px solid #ececec",
                borderRadius: 10,
                textDecoration: "none",
                color: "#163247",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {state.state}
              <span style={{ color: "#888", marginLeft: 6, fontWeight: 400 }}>
                ({state.count})
              </span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
