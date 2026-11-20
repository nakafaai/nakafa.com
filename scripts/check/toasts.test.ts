import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { parseSources } from "#scripts/check/source";
import { inspectToastSource } from "#scripts/check/toasts";

const COMPONENT = "apps/www/src/components/example/toast.tsx";
const HELPER = "packages/design-system/lib/toast/notify.ts";
const TOASTER = "packages/design-system/components/ui/toast.tsx";
const TEST_MODULE = "apps/www/src/components/example/toast.test.ts";
const TEST_HELPER = "packages/design-system/components/pool/test.fixture.ts";
const TOAST_RULE =
  "import { toast } from @repo/design-system/lib/toast/notify instead of @ui-sdk/react/toast, which only the Toaster imports";

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
          yield* inspect(`import { toast } from "@ui-sdk/react/toast";`),
          [`${COMPONENT}: ${TOAST_RULE}.`]
        );
      })
  );

  it.effect(
    "rejects a re-export and a dynamic import of the toast library too",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export { toast } from "@ui-sdk/react/toast";
const parts = import("@ui-sdk/react/toast");`),
          [`${COMPONENT}: ${TOAST_RULE}.`, `${COMPONENT}: ${TOAST_RULE}.`]
        );
      })
  );

  it.effect(
    "accepts the toast parts in the Toaster, and rejects them in the helper, which shows toasts through the Toaster",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(
            `import { toast } from "@ui-sdk/react/toast";`,
            TOASTER
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `import { toast } from "@ui-sdk/react/toast";`,
            HELPER
          ),
          [`${HELPER}: ${TOAST_RULE}.`]
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
        yield* inspect(
          `import { toast } from "@ui-sdk/react/toast";`,
          TEST_MODULE
        ),
        []
      );
    })
  );

  it.effect(
    "does not judge a test.*.ts helper, which sets up the tests like a test module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(
            `import { toast } from "@ui-sdk/react/toast";`,
            TEST_HELPER
          ),
          []
        );
      })
  );
});
