import { MetadataRoute } from "next";
import {
  getAllStatePages,
  getAllCityPages,
  getAllChurchPageParams,
} from "@/lib/churches";

const baseUrl = "https://confessionnearyou.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = [];

  // Homepage
  urls.push({
    url: `${baseUrl}`,
    lastModified: new Date(),
  });

  // State pages
  const states = getAllStatePages();

  states.forEach((state) => {
    urls.push({
      url: `${baseUrl}/${state.stateSlug}`,
      lastModified: new Date(),
    });
  });

  // City pages
  const cities = getAllCityPages();

  cities.forEach((city) => {
    urls.push({
      url: `${baseUrl}/${city.stateSlug}/${city.citySlug}`,
      lastModified: new Date(),
    });
  });

  // Church pages
  const churches = getAllChurchPageParams();

  churches.forEach((church) => {
    urls.push({
      url: `${baseUrl}/${church.state}/${church.city}/${church.church}`,
      lastModified: new Date(),
    });
  });

  return urls;
}