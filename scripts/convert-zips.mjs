import fs from "fs";

const raw = JSON.parse(fs.readFileSync("./data/zipcodes.json", "utf8"));

const optimized = {};

for (const row of raw) {
  const zip = String(row.zip_code).padStart(5, "0");

  optimized[zip] = {
    lat: Number(row.latitude),
    lng: Number(row.longitude)
  };
}

fs.writeFileSync(
  "./data/us_zipcodes.json",
  JSON.stringify(optimized)
);

console.log("Converted ZIP dataset");