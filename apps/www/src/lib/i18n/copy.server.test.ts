// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readCopy } from "@/lib/i18n/copy.server";

const readServerTranslatorMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/internationalization/src/translator", () => ({
  /** Controls the copy that one namespace answers, or the failure it raises. */
  readServerTranslator: readServerTranslatorMock,
}));

describe("translator copy reader", () => {
  it.effect("answers the translator of the namespace it names", () =>
    Effect.gen(function* () {
      readServerTranslatorMock.mockResolvedValueOnce(
        (key: string) => `copy:${key}`
      );

      const t = yield* readCopy({ locale: "en", namespace: "Metadata" });

      expect(t("description")).toBe("copy:description");
      expect(readServerTranslatorMock).toHaveBeenCalledWith({
        locale: "en",
        namespace: "Metadata",
      });
    })
  );

  it.effect(
    "fails with its cause and namespace when the copy cannot load",
    () =>
      Effect.gen(function* () {
        const cause = new TypeError("Copy is unavailable.");
        readServerTranslatorMock.mockRejectedValueOnce(cause);

        expect(
          yield* readCopy({ locale: "en", namespace: "Tryouts" }).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "CopyUnavailableError",
          cause,
          namespace: "Tryouts",
        });
      })
  );
});
