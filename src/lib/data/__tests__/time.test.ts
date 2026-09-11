import { describe, it, expect } from "vitest";
import { parseDurationToSeconds, formatSeconds, formatMinutes } from "../time";

describe("parseDurationToSeconds", () => {
  it("parses combined minute/second/millisecond strings", () => {
    expect(parseDurationToSeconds("2m 58s 200ms")).toBeCloseTo(178.2, 5);
    expect(parseDurationToSeconds("18s 320ms")).toBeCloseTo(18.32, 5);
    expect(parseDurationToSeconds("45s")).toBe(45);
    expect(parseDurationToSeconds("9s")).toBe(9);
  });

  it("parses an hour+minute string", () => {
    expect(parseDurationToSeconds("1h 2m")).toBe(3720);
  });

  it("parses a minute+millisecond string with no seconds component", () => {
    expect(parseDurationToSeconds("5m 390ms")).toBeCloseTo(300.39, 5);
  });

  it("parses a plain number-as-string as already-seconds", () => {
    expect(parseDurationToSeconds("42")).toBe(42);
  });

  it("returns null for empty/unparseable input, not 0", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds(null)).toBeNull();
    expect(parseDurationToSeconds(undefined)).toBeNull();
    expect(parseDurationToSeconds("n/a")).toBeNull();
  });
});

describe("formatSeconds / formatMinutes", () => {
  it("formats sub-minute durations compactly", () => {
    expect(formatSeconds(18.32)).toBe("18.3s");
    expect(formatSeconds(9)).toBe("9s");
  });
  it("formats multi-minute durations", () => {
    expect(formatMinutes(178)).toBe("2m 58s");
    expect(formatMinutes(3720)).toBe("1h 2m 0s");
  });
});
