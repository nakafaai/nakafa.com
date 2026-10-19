import { describe, expect, it } from "@effect/vitest";
import {
  CountryDefaults,
  countryDefaults,
  StartRequest,
  startZone,
} from "@repo/backend/confect/tenancy/start";
import { Record, Schema } from "effect";

describe("tenancy/start", () => {
  it("holds a real currency and real time zones for every country", () => {
    expect(
      Record.map(countryDefaults, (defaults) =>
        Schema.is(CountryDefaults)(defaults)
      )
    ).toEqual({ DE: true, GB: true, ID: true, SG: true, US: true });
  });

  it("keeps the browser's zone when the country uses it, else the country's first", () => {
    expect(startZone("ID", "Asia/Makassar")).toBe("Asia/Makassar");
    expect(startZone("ID", "Europe/Berlin")).toBe("Asia/Jakarta");
  });

  it("opens one unit for each level", () => {
    const request = {
      country: "ID",
      name: "Harapan Bangsa",
      role: "teacher",
      size: "s",
      slug: "harapan",
      timeZone: "Asia/Jakarta",
    };
    const isRequest = Schema.is(StartRequest);
    expect(
      isRequest({
        ...request,
        units: [
          { level: "sd", name: "SD Harapan" },
          { level: "smp", name: "SMP Harapan" },
        ],
      })
    ).toBe(true);
    expect(
      isRequest({
        ...request,
        units: [
          { level: "sd", name: "SD Harapan" },
          { level: "sd", name: "SD Harapan Dua" },
        ],
      })
    ).toBe(false);
  });
});
