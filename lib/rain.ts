// Heavy-rain check for Today, from a MET Norway locationforecast (compact) response.
// Pure and import-free so tests/today.test.mjs can run it directly.

// Mumbai. Only a city's coordinates leave the app: no personal data goes to the weather service.
export const MUMBAI = { lat: 19.07, lon: 72.88 };

// Rain left in the day (mm) that counts as heavy. IMD calls 64.5 mm in 24 hours "heavy";
// this is the rest of today only, so the bar is lower.
export const HEAVY_MM = 45;

/** Monsoon season, when the check runs at all: June to mid-October. */
export const isMonsoon = (day: string) => day.slice(5) >= "06-01" && day.slice(5) <= "10-15";

type Step = { time: string; data?: { next_1_hours?: { details?: { precipitation_amount?: number } } } };
export type Forecast = { properties?: { timeseries?: Step[] } };

/** Millimetres of rain forecast from `nowMs` to midnight India time on `day`. */
export function rainLeftToday(f: Forecast, day: string, nowMs: number): number {
  const end = Date.parse(`${day}T00:00:00+05:30`) + 86_400_000;
  let mm = 0;
  for (const s of f.properties?.timeseries ?? []) {
    const t = Date.parse(s.time);
    if (t + 3_600_000 <= nowMs || t >= end) continue;
    mm += s.data?.next_1_hours?.details?.precipitation_amount ?? 0;
  }
  return Math.round(mm * 10) / 10;
}

export const isHeavy = (mm: number) => mm >= HEAVY_MM;

/** Mandates whose interviews a Mumbai downpour gets in the way of. No city recorded counts too. */
export const inMumbai = (city: string | null | undefined) => !city || /mumbai|bombay|thane|bkc|lower parel/i.test(city);
