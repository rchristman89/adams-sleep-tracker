import { describe, expect, it } from "vitest";
import { formatMinutes, parseSleep } from "./parseSleep";

describe("formatMinutes", () => {
  it("pads minutes", () => {
    expect(formatMinutes(420)).toBe("7h 00m");
    expect(formatMinutes(435)).toBe("7h 15m");
  });
});

describe("parseSleep", () => {
  it("parses clock format", () => {
    const r = parseSleep("7:30");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.minutes).toBe(450);
      expect(r.method).toBe("clock");
    }
  });

  it("rejects invalid clock minutes", () => {
    expect(parseSleep("7:99").ok).toBe(false);
  });

  it("parses token format", () => {
    const r = parseSleep("7h 30m");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.minutes).toBe(450);
      expect(r.method).toBe("tokens");
    }
  });

  it("parses hours-only tokens", () => {
    const r = parseSleep("7h");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(420);
  });

  it("parses decimal hours", () => {
    const r = parseSleep("7.5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.minutes).toBe(450);
      expect(r.method).toBe("decimal");
    }
  });

  it("parses comma decimal hours", () => {
    const r = parseSleep("7,5");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(450);
  });

  it("parses integer hours", () => {
    const r = parseSleep("7");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(420);
  });

  it("rejects empty", () => {
    expect(parseSleep(" ").ok).toBe(false);
  });

  it("rejects unrecognized", () => {
    expect(parseSleep("banana").ok).toBe(false);
  });

  it("enforces maxMinutes", () => {
    expect(parseSleep("25", { maxMinutes: 16 * 60 }).ok).toBe(false);
  });
});
