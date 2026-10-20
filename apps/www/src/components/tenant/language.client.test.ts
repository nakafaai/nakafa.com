// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import {
  changeSchoolLanguage,
  LanguageSaveFailed,
} from "@/components/tenant/language.client";

const doubles = vi.hoisted(() => ({
  report: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/components/tenant/language", () => ({
  saveSchoolLanguage: doubles.save,
}));
vi.mock("@/lib/analytics/client", () => ({
  reportClientException: doubles.report,
}));

/** The browser's cookie jar in these tests: a document whose cookie property records each write. */
function stubDocument(cookie: string) {
  let writes: readonly string[] = [];
  const document = {
    get cookie() {
      return cookie;
    },
    set cookie(line: string) {
      writes = Arr.append(writes, line);
    },
  };
  vi.stubGlobal("document", document);
  return () => writes;
}

describe("changeSchoolLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doubles.report.mockReturnValue(Effect.void);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("fails for an unknown locale without showing or saving it", () =>
    Effect.gen(function* () {
      const writes = stubDocument("NAKAFA_LOCALE=en");
      const refresh = vi.fn();

      const failure = yield* changeSchoolLanguage("fr", refresh).pipe(
        Effect.flip
      );

      expect(failure).toBeInstanceOf(LanguageSaveFailed);
      expect(doubles.save).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(writes()).toStrictEqual([]);
    })
  );

  it.effect(
    "shows the chosen language before the save answers, then keeps it once saved",
    () =>
      Effect.gen(function* () {
        const writes = stubDocument("NAKAFA_LOCALE=en");
        const refresh = vi.fn();
        doubles.save.mockImplementation(() => {
          expect(refresh).toHaveBeenCalledTimes(1);
          expect(writes()).toHaveLength(1);
          return Promise.resolve(undefined);
        });

        const outcome = yield* changeSchoolLanguage("id", refresh);

        expect(outcome).toBe("saved");
        expect(writes()).toStrictEqual([
          "NAKAFA_LOCALE=id; Max-Age=31536000; Path=/; SameSite=lax",
        ]);
        expect(doubles.save).toHaveBeenCalledExactlyOnceWith({ data: "id" });
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(doubles.report).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rolls a failed save back to the language the page had, and reports it",
    () =>
      Effect.gen(function* () {
        const writes = stubDocument("NAKAFA_LOCALE=en");
        const refresh = vi.fn();
        const failure = new Error("network");
        doubles.save.mockRejectedValue(failure);

        const outcome = yield* changeSchoolLanguage("de", refresh);

        expect(outcome).toBe("rolledBack");
        expect(writes()).toStrictEqual([
          "NAKAFA_LOCALE=de; Max-Age=31536000; Path=/; SameSite=lax",
          "NAKAFA_LOCALE=en; Max-Age=31536000; Path=/; SameSite=lax",
        ]);
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(doubles.report).toHaveBeenCalledExactlyOnceWith(failure, {
          source: "school-language",
        });
      })
  );

  it.effect(
    "removes the language cookie on a failed save when the page had none",
    () =>
      Effect.gen(function* () {
        const writes = stubDocument("");
        doubles.save.mockRejectedValue(new Error("network"));

        const outcome = yield* changeSchoolLanguage("id", vi.fn());

        expect(outcome).toBe("rolledBack");
        expect(Option.getOrUndefined(Arr.last(writes()))).toBe(
          "NAKAFA_LOCALE=; Max-Age=0; Path=/; SameSite=lax"
        );
      })
  );
});
