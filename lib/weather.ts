import "server-only";
import { cacheLife } from "next/cache";
import { MUMBAI, isHeavy, isMonsoon, rainLeftToday, type Forecast } from "./rain";

// MET Norway's forecast is free for commercial use with credit (CC BY 4.0), shown under the umbrella.
// Their terms ask for an identifying User-Agent.
const URL = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${MUMBAI.lat}&lon=${MUMBAI.lon}`;

// One fetch per hour for the whole app, shared by everyone. Throws on failure so failures aren't cached.
async function mumbaiForecast(hour: string): Promise<Forecast> {
  "use cache";
  cacheLife("hours");
  void hour; // part of the cache key
  const res = await fetch(URL, {
    headers: { "User-Agent": "ParadigmShiftersApp/1.0 (+https://paradigmshifters.vercel.app)" },
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Forecast ${res.status}`);
  return (await res.json()) as Forecast;
}

/** Is heavy rain forecast in Mumbai for the rest of `day`? Only asks in the monsoon; false whenever unsure. */
export async function heavyRainToday(day: string): Promise<boolean> {
  if (!isMonsoon(day)) return false;
  try {
    const now = new Date();
    const f = await mumbaiForecast(now.toISOString().slice(0, 13));
    return isHeavy(rainLeftToday(f, day, now.getTime()));
  } catch {
    return false;
  }
}
