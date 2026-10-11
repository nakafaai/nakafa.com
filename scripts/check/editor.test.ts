import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Order, Schema } from "effect";
import { CLASS_ATTRIBUTES, CLASS_FUNCTIONS } from "#scripts/check/editor";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** The Tailwind lists that the Zed settings give the language server. */
const ZedSettings = Schema.fromJsonString(
  Schema.Struct({
    lsp: Schema.Struct({
      "tailwindcss-language-server": Schema.Struct({
        settings: Schema.Struct({
          classAttributes: Schema.Array(Schema.String),
          classFunctions: Schema.Array(Schema.String),
        }),
      }),
    }),
  })
);

/** Orders names so that two lists compare equal when they hold the same names. */
function sorted(names: readonly string[]) {
  return Arr.sort(names, Order.String);
}

describe("editor class positions", () => {
  it.effect("match the Tailwind settings of Zed", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const zed = yield* fileSystem
        .readFileString(`${REPOSITORY_ROOT}.zed/settings.json`)
        .pipe(Effect.flatMap(Schema.decodeEffect(ZedSettings)));
      const { settings } = zed.lsp["tailwindcss-language-server"];

      assert.deepStrictEqual(
        sorted(settings.classAttributes),
        sorted(CLASS_ATTRIBUTES)
      );
      assert.deepStrictEqual(
        sorted(settings.classFunctions),
        sorted(CLASS_FUNCTIONS)
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
