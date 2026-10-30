// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import {
  changeSchoolLanguage,
  SchoolLanguageUnknown,
} from "@/components/tenant/locale";

/** The browser's cookie jar in these tests: a document whose cookie property records each write. */
function stubDocument() {
  let writes: readonly string[] = [];
  const document = {
    set cookie(line: string) {
      writes = Arr.append(writes, line);
    },
  };
  vi.stubGlobal("document", document);
  return () => writes;
}

describe("changeSchoolLanguage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("fails for an unknown locale without writing or showing it", () =>
    Effect.gen(function* () {
      const writes = stubDocument();
      const refresh = vi.fn();

      const failure = yield* changeSchoolLanguage("fr", refresh).pipe(
        Effect.flip
      );

      expect(failure).toBeInstanceOf(SchoolLanguageUnknown);
      expect(refresh).not.toHaveBeenCalled();
      expect(writes()).toStrictEqual([]);
    })
  );

  it.effect(
    "writes the language cookie for a year, then renders the page in it",
    () =>
      Effect.gen(function* () {
        const writes = stubDocument();
        const refresh = vi.fn(() => {
          expect(writes()).toHaveLength(1);
        });

        yield* changeSchoolLanguage("id", refresh);

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(writes()).toStrictEqual([
          "NAKAFA_LOCALE=id; Max-Age=31536000; Path=/; SameSite=lax",
        ]);
      })
  );
});
