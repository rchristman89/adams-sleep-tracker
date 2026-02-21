import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import { json } from "./jobsShared";

import { addDays, isoDateInTimeZone } from "../shared/dates";
import { getSleepEntriesClient, getTableStorageConfigFromEnv, listSleepEntriesSince } from "../storage";
import { toIsoDate, type IsoDate } from "../storage/types";

type NightStatus = "OK" | "DEGRADED" | "MAJOR" | "SEV1" | "UNKNOWN";


function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (p <= 0) return sortedAsc[0];
  if (p >= 1) return sortedAsc[sortedAsc.length - 1];

  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function statusForMinutes(minutes: number, sloMinutes: number): Exclude<NightStatus, "UNKNOWN"> {
  // Thresholds from docs/architecture.md
  if (minutes >= sloMinutes) return "OK";
  if (minutes >= 360) return "DEGRADED";
  if (minutes >= 240) return "MAJOR";
  return "SEV1";
}

function dateRangeInclusive(start: IsoDate, end: IsoDate): IsoDate[] {
  if (start > end) return [];

  const out: IsoDate[] = [];
  let cur: IsoDate = start;
  // NOTE: IsoDate is expected to be in ISO `YYYY-MM-DD` format, so lexicographic
  // string comparison (`cur <= end`) is equivalent to chronological comparison.
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export async function stats(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const env = process.env;
  const tz = env.TIMEZONE ?? "America/New_York";

  const rawSloMinutes = env.SLO_MINUTES;
  let sloMinutes: number;
  if (rawSloMinutes === undefined) {
    sloMinutes = 420;
  } else {
    sloMinutes = Number(rawSloMinutes);
    if (!Number.isFinite(sloMinutes) || sloMinutes <= 0) {
      ctx.error("Invalid SLO_MINUTES environment variable; expected positive number", { value: rawSloMinutes });
      return json(500, { error: "Internal Server Error" });
    }
  }

  let sleepClient;
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    sleepClient = getSleepEntriesClient(cfg);
  } catch (err) {
    ctx.error("Failed to initialize Table Storage client", { err });
    return json(500, { error: "Internal Server Error" });
  }

  const now = new Date();
  const nowUtc = now.toISOString();
  const localDate = isoDateInTimeZone(now, tz);
  // Sleep replies on day D map to sleep_date D-1, so stats should end at yesterday.
  const endSleepDate = addDays(localDate, -1);

  const burnSeriesStartRaw = env.BURN_SERIES_START_DATE ?? "2026-02-20";
  let startForBurn: IsoDate;
  try {
    startForBurn = toIsoDate(burnSeriesStartRaw);
  } catch (err) {
    ctx.error("Invalid BURN_SERIES_START_DATE; expected YYYY-MM-DD", { value: burnSeriesStartRaw, err });
    return json(500, { error: "Internal Server Error" });
  }

  let entries;
  try {
    entries = await listSleepEntriesSince(sleepClient, startForBurn);
  } catch (err) {
    ctx.error("Failed to list SleepEntries", { err, since: startForBurn });
    return json(500, { error: "Internal Server Error" });
  }

  const byDate = new Map<IsoDate, { minutes: number }>();
  for (const e of entries) byDate.set(e.sleepDate, { minutes: e.minutesSlept });

  // Windows
  const start30 = addDays(endSleepDate, -29);
  const start7 = addDays(endSleepDate, -6);

  const window30 = dateRangeInclusive(start30, endSleepDate);

  const minutes30: number[] = [];
  const minutes7: number[] = [];

  const statusHistory30 = window30.map((d) => {
    const rec = byDate.get(d);
    if (!rec) return { sleepDate: d, status: "UNKNOWN" as const, minutesSlept: null };
    const st = statusForMinutes(rec.minutes, sloMinutes);
    minutes30.push(rec.minutes);
    if (d >= start7) minutes7.push(rec.minutes);
    return { sleepDate: d, status: st, minutesSlept: rec.minutes };
  });

  minutes30.sort((a, b) => a - b);
  minutes7.sort((a, b) => a - b);

  const avg7 = avg(minutes7);
  const avg30 = avg(minutes30);

  const p50_30 = percentile(minutes30, 0.5);
  const p90_30 = percentile(minutes30, 0.9);

  const incidents30 = statusHistory30.filter((x) => x.status !== "OK" && x.status !== "UNKNOWN").length;
  const sev1Count30 = statusHistory30.filter((x) => x.status === "SEV1").length;

  // Availability/error budget over last 7 nights.
  const known7 = statusHistory30.filter((x) => x.sleepDate >= start7 && x.status !== "UNKNOWN");
  const ok7 = known7.filter((x) => x.status === "OK").length;
  const availability7 = known7.length === 0 ? null : ok7 / known7.length;
  const errorBudget7 = availability7 === null ? null : 1 - availability7;

  // Cumulative burn series since 2026-02-20.
  const burnEnd = endSleepDate;
  const burnDates = dateRangeInclusive(startForBurn, burnEnd);
  let cumulativeBurn = 0;
  const cumulativeBurnSeries = burnDates.map((d) => {
    const rec = byDate.get(d);
    const burn = rec ? (rec.minutes >= sloMinutes ? 0 : 1) : 0;
    cumulativeBurn += burn;
    return {
      sleepDate: d,
      burn,
      cumulativeBurn
    };
  });

  return json(200, {
    generatedAtUtc: nowUtc,
    timezone: tz,
    sloMinutes,
    endSleepDate,

    averages: {
      avgMinutes7: avg7,
      avgMinutes30: avg30
    },

    percentiles30: {
      p50Minutes: p50_30,
      p90Minutes: p90_30
    },

    incidents30: {
      incidents: incidents30,
      sev1: sev1Count30
    },

    reliability7: {
      availability: availability7,
      errorBudget: errorBudget7,
      knownNights: known7.length
    },

    statusHistory30,
    cumulativeBurnSeries
  });
}

app.http("stats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "stats",
  handler: stats
});
