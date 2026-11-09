import { describe, expect, it } from "@effect/vitest";
import { StartRequest, startZone } from "@repo/backend/confect/tenancy/start";
import { Schema } from "effect";

describe("tenancy/start", () => {
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
