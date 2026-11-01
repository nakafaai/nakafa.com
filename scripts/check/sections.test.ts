import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectSectionSource } from "#scripts/check/sections";
import { parseSources } from "#scripts/check/source";

const COMPONENT = "apps/www/src/components/exams/sitting/student.tsx";
const SECTION_RULE =
  "@/components/shared/card/section is the settings card, which only Settings draws: use a plain heading, body and footer here";

/** Inspects one module with the settings card policy alone. */
function inspect(sourceText: string, file = COMPONENT) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectSectionSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Settings card source policy", () => {
  it.effect("rejects the settings card outside Settings", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `import { CardSection } from "@/components/shared/card/section";`
        ),
        [`${COMPONENT}: ${SECTION_RULE}.`]
      );
    })
  );

  it.effect("rejects a re-export and a dynamic import of the card too", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export { CardSection } from "@/components/shared/card/section";
const section = import("@/components/shared/card/section");`),
        [`${COMPONENT}: ${SECTION_RULE}.`, `${COMPONENT}: ${SECTION_RULE}.`]
      );
    })
  );

  it.effect("accepts the settings card in both Settings areas", () =>
    Effect.gen(function* () {
      const source = `import { CardSection } from "@/components/shared/card/section";`;
      assert.deepStrictEqual(
        yield* inspect(
          source,
          "apps/www/src/components/tenant/settings/name.tsx"
        ),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/user/settings/name.tsx"),
        []
      );
    })
  );

  it.effect("accepts a module that only names the path in a string", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`const path = "@/components/shared/card/section";`),
        []
      );
    })
  );
});
