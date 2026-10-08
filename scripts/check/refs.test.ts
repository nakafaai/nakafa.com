import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectRefsSource } from "#scripts/check/refs";
import { parseSources } from "#scripts/check/source";

const SWITCHER = "apps/www/components/school/sidebar/switcher.tsx";
const SERVER = "packages/backend/confect/tenancy/viewer.impl.ts";
const RULE =
  "import the per-domain refs of each domain the module uses, such as @repo/backend/confect/_generated/refs/nina for refs.public.nina, instead of the whole @repo/backend/confect/_generated/refs tree";

/** Inspects one module with the refs policy alone. */
function inspect(sourceText: string, file = SWITCHER) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectRefsSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Refs source policy", () => {
  it.effect("accepts the per-domain refs in every import form", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import nina from "@repo/backend/confect/_generated/refs/nina";
import type chats from "@repo/backend/confect/_generated/refs/chats";
export { default as users } from "@repo/backend/confect/_generated/refs/users";
type Schools = import("@repo/backend/confect/_generated/refs/schools").default;
const onboarding = await import("@repo/backend/confect/_generated/refs/onboarding");`),
        []
      );
    })
  );

  it.effect("rejects the whole refs tree in every import form", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import refs from "@repo/backend/confect/_generated/refs";
import type refsType from "@repo/backend/confect/_generated/refs";
export { default } from "@repo/backend/confect/_generated/refs";
type Tree = import("@repo/backend/confect/_generated/refs").default;
const tree = await import("@repo/backend/confect/_generated/refs");`),
        Arr.replicate(`${SWITCHER}: ${RULE}.`, 5)
      );
    })
  );

  it.effect("leaves the server's whole-tree imports alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `import refs from "@repo/backend/confect/_generated/refs";`,
          SERVER
        ),
        []
      );
    })
  );
});
