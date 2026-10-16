import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { parseSources } from "#scripts/check/source";
import { inspectToastSource } from "#scripts/check/toasts";

const COMPONENT = "apps/www/components/example/toast.tsx";
const HELPER = "packages/design-system/lib/toast/notify.ts";
const TOASTER = "packages/design-system/components/ui/sonner.tsx";
const TEST_MODULE = "apps/www/components/example/toast.test.ts";
const SONNER_RULE =
  "import toast from @repo/design-system/lib/toast/notify instead of sonner, which only the Toaster and that helper import";

/** Inspects one module with the toast policy alone. */
function inspect(sourceText: string, file = COMPONENT) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectToastSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Toast source policy", () => {
  it.effect(
    "rejects the toast library outside the Toaster and the helper",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { toast } from "sonner";`),
          [`${COMPONENT}: ${SONNER_RULE}.`]
        );
      })
  );

  it.effect(
    "rejects a re-export and a dynamic import of the toast library too",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export { toast } from "sonner";
const sonner = import("sonner");`),
          [`${COMPONENT}: ${SONNER_RULE}.`, `${COMPONENT}: ${SONNER_RULE}.`]
        );
      })
  );

  it.effect("accepts the toast library in the Toaster and in the helper", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { toast } from "sonner";`, TOASTER),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(`import { toast } from "sonner";`, HELPER),
        []
      );
    })
  );

  it.effect("accepts a component that shows toasts through the helper", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
toast.error({ title: "action-error.title", description: "action-error.description" });`),
        []
      );
    })
  );

  it.effect("does not judge a test module, which may test the library", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { toast } from "sonner";`, TEST_MODULE),
        []
      );
    })
  );
});
