// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readCard } from "#catalog/card";

const module = `
const items = [{ name: "goal", height: 9 }];

export const card = {
  name: "Questionnaire",
  group: "Forms",
  height: 300,
  source: "components/ui/questionnaire",
};
`;

describe("readCard", () => {
  it.effect(
    "reads the card literal a card module exports, past other objects",
    () =>
      Effect.gen(function* () {
        expect(yield* readCard(module, "questionnaire.tsx")).toEqual({
          name: "Questionnaire",
          group: "Forms",
          height: 300,
          source: "components/ui/questionnaire",
          declaration: "Questionnaire",
        });
      })
  );

  it.effect(
    "refuses a card outside the page's sections, naming its module",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          readCard(module.replace('"Forms"', '"Brand"'), "questionnaire.tsx")
        );
        expect(error._tag).toBe("CardError");
        expect(error.message).toContain("catalog/cards/questionnaire.tsx");
      })
  );

  it.effect("reads the declaration a card names for its guideline", () =>
    Effect.gen(function* () {
      const themes = yield* readCard(
        'export const card = { name: "Themes", group: "Identity", height: 900, source: "lib/theme/registry", declaration: "themes" };',
        "themes.tsx"
      );
      expect(themes.declaration).toBe("themes");
    })
  );

  it.effect("refuses a module that exports no card", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readCard("export function Preview() {}", "empty.tsx")
      );
      expect(error._tag).toBe("CardError");
    })
  );
});
