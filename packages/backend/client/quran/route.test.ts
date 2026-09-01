import { describe, expect, it } from "@effect/vitest";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";

describe("parseQuranSurahNumber", () => {
  it.each(["1", "114"])("accepts canonical surah segment %s", (value) => {
    expect(parseQuranSurahNumber(value)).toBe(Number(value));
  });

  it.each(["", "0", "01", "1.5", "115", "NaN", "Infinity"])(
    "rejects non-canonical surah segment %s",
    (value) => {
      expect(parseQuranSurahNumber(value)).toBeNull();
    }
  );

  it.each([undefined, null])("rejects missing surah segment %s", (value) => {
    expect(parseQuranSurahNumber(value)).toBeNull();
  });
});
