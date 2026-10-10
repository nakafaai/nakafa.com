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

/** The same lists as the Tailwind extension of VS Code reads them, when its settings declare them. */
const VsCodeSettings = Schema.fromJsonString(
  Schema.Struct({
    "tailwindCSS.classAttributes": Schema.optionalKey(
      Schema.Array(Schema.String)
    ),
    "tailwindCSS.classFunctions": Schema.optionalKey(
      Schema.Array(Schema.String)
    ),
  })
);

/** Orders names so that two lists compare equal when they hold the same names. */
function sorted(names: readonly string[]) {
  return Arr.sort(names, Order.String);
}

describe("editor class positions", () => {
  it.effect("match the Tailwind settings of the editors", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const zed = yield* fileSystem
        .readFileString(`${REPOSITORY_ROOT}.zed/settings.json`)
        .pipe(Effect.flatMap(Schema.decodeEffect(ZedSettings)));
      const vscode = yield* fileSystem
        .readFileString(`${REPOSITORY_ROOT}.vscode/settings.json`)
        .pipe(Effect.flatMap(Schema.decodeEffect(VsCodeSettings)));
      const { settings } = zed.lsp["tailwindcss-language-server"];

      assert.deepStrictEqual(
        sorted(settings.classAttributes),
        sorted(CLASS_ATTRIBUTES)
      );
      assert.deepStrictEqual(
        sorted(settings.classFunctions),
        sorted(CLASS_FUNCTIONS)
      );
      // VS Code reads these lists only when its settings declare them.
      assert.deepStrictEqual(
        sorted(vscode["tailwindCSS.classAttributes"] ?? CLASS_ATTRIBUTES),
        sorted(CLASS_ATTRIBUTES)
      );
      assert.deepStrictEqual(
        sorted(vscode["tailwindCSS.classFunctions"] ?? CLASS_FUNCTIONS),
        sorted(CLASS_FUNCTIONS)
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
