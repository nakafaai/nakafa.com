import { describe, expect, it } from "@effect/vitest";
import { highlightLessonCode } from "@repo/design-system/lib/code/lesson";
import { Effect } from "effect";

describe("highlightLessonCode", () => {
  it.effect.each([
    ["bash", "echo $HOME"],
    ["c", "int main(void) { return 0; }"],
    ["http", "GET / HTTP/1.1"],
    ["json", '{"a": 1}'],
    ["markdown", "# Title"],
    ["python", "print(1)"],
  ])(
    "draws %s, a language lessons write in, with the default themes",
    ([language, code]) =>
      Effect.gen(function* () {
        const html = yield* highlightLessonCode({ code, language });

        expect(html).toContain(
          "shiki-themes github-light-high-contrast github-dark-default"
        );
      })
  );

  it.effect("leaves a language no lesson writes in to the browser", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        highlightLessonCode({ code: "fn main() {}", language: "rust" })
      );

      expect(error._tag).toBe("UnsupportedCodeLanguageError");
    })
  );
});
