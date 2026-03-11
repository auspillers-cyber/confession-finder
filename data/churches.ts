export type ConfessionTime = {
  day: string;
  start: string;
  end: string;
};

export type Church = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  address: string;
  latitude: number;
  longitude: number;
  confessionTimes: ConfessionTime[];
};

export const churches: Church[] = [
  {
    id: "st-catherine-of-siena-miami",
    name: "St. Catherine of Siena",
    city: "Miami",
    state: "FL",
    zip: "33176",
    address: "9200 SW 107th Ave, Miami, FL 33176",
    latitude: 25.684,
    longitude: -80.3685,
    confessionTimes: [
      { day: "Tuesday", start: "18:30", end: "19:30" },
      { day: "Thursday", start: "18:30", end: "19:30" },
      { day: "Saturday", start: "08:00", end: "09:00" },
      { day: "Saturday", start: "16:00", end: "17:00" },
    ],
  },
  {
    id: "st-timothy-parish-miami",
    name: "St. Timothy Parish",
    city: "Miami",
    state: "FL",
    zip: "33165",
    address: "5400 SW 102nd Ave, Miami, FL 33165",
    latitude: 25.7186,
    longitude: -80.3613,
    confessionTimes: [
      { day: "Saturday", start: "11:00", end: "12:30" },
    ],
  },
  {
    id: "epiphany-catholic-church-miami",
    name: "Epiphany Catholic Church",
    city: "Miami",
    state: "FL",
    zip: "33143",
    address: "8235 SW 57th Ave, Miami, FL 33143",
    latitude: 25.6948,
    longitude: -80.2853,
    confessionTimes: [
      { day: "Saturday", start: "16:00", end: "17:00" },
    ],
  },
  {
    id: "st-louis-catholic-church-pinecrest",
    name: "St. Louis Catholic Church",
    city: "Pinecrest",
    state: "FL",
    zip: "33156",
    address: "7270 SW 120th St, Pinecrest, FL 33156",
    latitude: 25.6588,
    longitude: -80.3123,
    confessionTimes: [
      { day: "Saturday", start: "09:00", end: "10:00" },
    ],
  },
  {
    id: "st-augustine-catholic-church-coral-gables",
    name: "St. Augustine Catholic Church",
    city: "Coral Gables",
    state: "FL",
    zip: "33146",
    address: "1400 Miller Rd, Coral Gables, FL 33146",
    latitude: 25.7155,
    longitude: -80.2783,
    confessionTimes: [
      { day: "Saturday", start: "16:00", end: "17:00" },
    ],
  },
];