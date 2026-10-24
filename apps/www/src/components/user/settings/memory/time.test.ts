import { afterEach, describe, expect, it } from "@effect/vitest";
import { formatEnds } from "@/components/user/settings/memory/time";

const DAY = 86_400_000;
/** The last millisecond of 20 October 2026 in UTC. */
const END_OF_DAY = 1_792_540_799_999;
/** The first millisecond of 20 October 2026 in UTC. */
const START_OF_DAY = END_OF_DAY - DAY + 1;

afterEach(() => vi.unstubAllEnvs());

describe("formatEnds", () => {
  it("names the day in each language", () => {
    expect(formatEnds(END_OF_DAY, "en")).toBe("October 20, 2026");
    expect(formatEnds(END_OF_DAY, "id")).toBe("20 Oktober 2026");
    expect(formatEnds(END_OF_DAY, "de")).toBe("20. Oktober 2026");
  });

  // The test pins the zone of the browser itself: a host that already runs in
  // UTC, such as the CI runner, would name the right day without the guard.
  for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    it(`keeps the day the learner named in a browser at ${zone}`, () => {
      vi.stubEnv("TZ", zone);

      expect(formatEnds(START_OF_DAY, "en")).toBe("October 20, 2026");
      expect(formatEnds(END_OF_DAY, "en")).toBe("October 20, 2026");
      expect(formatEnds(END_OF_DAY + 1, "en")).toBe("October 21, 2026");
    });
  }
});
