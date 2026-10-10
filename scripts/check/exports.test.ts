import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Path, Record as Rec } from "effect";
import {
  declarationDirectories,
  inspectExports,
  publishedDirectories,
} from "#scripts/check/exports";
import { parseSources } from "#scripts/check/source";

const MODULE = "packages/shop/cart.ts";
const READER = "packages/shop/checkout.ts";

/** Names the report of one unused export. */
function report(line: number, name: string, file = MODULE) {
  return `${file}:${line}: no other module names ${name}: remove its \`export\`, or delete the declaration when this module does not use it either (unused-export)`;
}

/**
 * Inspects fixture modules with the export policy alone. `others` holds the
 * text of modules that no rule judges, and `unjudged` the directories whose
 * exports the check cannot judge.
 */
function inspect(
  files: Readonly<Record<string, string>>,
  others: readonly string[] = [],
  unjudged: readonly string[] = []
) {
  const sources = Arr.map(Rec.toEntries(files), ([file, sourceText]) => ({
    file,
    sourceText,
  }));
  return Effect.scoped(
    Effect.map(parseSources(sources), ({ modules }) =>
      inspectExports(modules, others, unjudged)
    )
  );
}

/** Writes manifests below one temporary repository root. */
const repository = Effect.fn("ExportTest.repository")(function* (
  manifests: Readonly<Record<string, string>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "export-policy-",
  });
  const files = yield* Effect.forEach(
    Rec.toEntries(manifests),
    ([file, content]) =>
      Effect.as(
        Effect.andThen(
          fileSystem.makeDirectory(path.dirname(path.join(root, file)), {
            recursive: true,
          }),
          fileSystem.writeFileString(path.join(root, file), content)
        ),
        path.join(root, file)
      )
  );
  return { files, root };
});

describe("Unused export policy", () => {
  it.effect("reports each kind of declaration that nothing else names", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: `export const total = 1, tax = 2;
export function add() {}
export class Basket {}
export interface Line {}
export type Price = number;
export enum Step { First }
const local = 3;
export { local as shared };
`,
        }),
        [
          report(1, "total"),
          report(1, "tax"),
          report(2, "add"),
          report(3, "Basket"),
          report(4, "Line"),
          report(5, "Price"),
          report(6, "Step"),
          report(8, "shared"),
        ]
      );
    })
  );

  it.effect("accepts a name that a second module mentions", () =>
    Effect.gen(function* () {
      const files = {
        [MODULE]: "export const total = 1;\nexport type Price = number;\n",
      };
      assert.deepStrictEqual(
        yield* inspect({
          ...files,
          [READER]:
            'import { type Price, total } from "./cart";\nconst price: Price = total;\n',
        }),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(files, [
          'import { total } from "../cart";\nexport type { Price } from "../cart";\n',
        ]),
        []
      );
    })
  );

  it.effect("reports a copy of a name that each module keeps for itself", () =>
    Effect.gen(function* () {
      const copy = "export function decodeBatch() {}\ndecodeBatch();\n";
      assert.deepStrictEqual(
        yield* inspect({
          "packages/shop/batch.ts": copy,
          "packages/shop/cart.ts": copy,
          "packages/shop/checkout.ts": copy,
        }),
        [
          report(1, "decodeBatch", "packages/shop/batch.ts"),
          report(1, "decodeBatch", "packages/shop/cart.ts"),
          report(1, "decodeBatch", "packages/shop/checkout.ts"),
        ]
      );
    })
  );

  it.effect("reports a name that a module imports from another module", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: "export const total = 1;\n",
          [READER]:
            'import { total } from "./price";\nexport const price = total;\n',
        }),
        [report(1, "total"), report(2, "price", READER)]
      );
    })
  );

  it.effect("does not count a word that a module holds only in a comment", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: "export const total = 1;\nexport const tax = 2;\n",
          [READER]:
            '// total is set below\n/** Adds {@link total}. */\nimport { tax } from "./cart";\nexport const rate = tax;\n',
        }),
        [report(1, "total"), report(4, "rate", READER)]
      );
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: "export const total = 1;\n",
          [READER]: '// import { total } from "./cart";\n',
        }),
        [report(1, "total")]
      );
    })
  );

  it.effect("judges by word an export that a dynamic import loads", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: "export const total = 1;\n",
          "packages/shop/view.ts": 'export default () => import("./cart");\n',
          [READER]:
            'import view from "./view";\nconst total = view;\nexport default total;\n',
        }),
        []
      );
    })
  );

  it.effect("judges only names that a module can import", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({
          [MODULE]: `const total = 1;
const source = { tax: 2 };
export default function add() {}
export { total as default };
export { Price } from "./price";
export * from "./price";
export const { tax } = source;
`,
        }),
        []
      );
    })
  );

  it.effect("leaves modules whose exports are read by name elsewhere", () =>
    Effect.gen(function* () {
      const text = "export const maxDuration = 60;\n";
      assert.deepStrictEqual(
        yield* inspect(
          {
            "apps/www/app/[locale]/(app)/lesson/page.tsx": text,
            "apps/api/app/route.ts": text,
            "apps/www/proxy.ts": text,
            "apps/www/vercel.ts": text,
            "packages/design-system/components/ui/table.tsx": text,
            "packages/design-system/components/evilcharts/charts/area.tsx":
              text,
            "packages/cli/src/client.ts": text,
            "packages/shop/tables.ts": `// @generated by a tool\n${text}`,
          },
          [],
          ["packages/cli/"]
        ),
        []
      );
      assert.deepStrictEqual(
        yield* inspect({
          "apps/www/components/app/page.tsx": text,
          "packages/shop/proxy.ts": "export const proxied = 1;\n",
        }),
        [
          report(1, "maxDuration", "apps/www/components/app/page.tsx"),
          report(1, "proxied", "packages/shop/proxy.ts"),
        ]
      );
    })
  );

  it.effect("judges nothing when every module emits declarations", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect({ [MODULE]: "export class Failure {}\n" }, [], [""]),
        []
      );
    })
  );

  it("names the directories that emit declarations", () => {
    const on = '{"compilerOptions":{"declaration":true,"noEmit":true}}';
    assert.deepStrictEqual(
      declarationDirectories([
        { file: "packages/cli/tsconfig.build.json", sourceText: on },
        { file: "packages/shop/tsconfig.json", sourceText: "// not JSON" },
        {
          file: "apps/www/tsconfig.json",
          sourceText: '{"compilerOptions":{"declaration":false}}',
        },
        { file: "scripts/tsconfig.json", sourceText: '{"extends":"../base"}' },
      ]),
      ["packages/cli/"]
    );
    assert.deepStrictEqual(
      declarationDirectories([
        { file: "packages/typescript-config/base.json", sourceText: on },
        { file: "tsconfig.json", sourceText: on },
      ]),
      ["", ""]
    );
  });

  it.effect("names each workspace whose manifest is not private", () =>
    Effect.gen(function* () {
      const { files, root } = yield* repository({
        "apps/www/package.json": '{"name":"www","private":true}\n',
        "packages/cli/package.json": '{"name":"@shop/cli"}\n',
        "packages/kit/package.json": '{"name":"@shop/kit","private":false}\n',
        "packages/kit/fixture/package.json": '{"name":"nested"}\n',
        "packages/kit/client.ts": "export const client = 1;\n",
      });
      assert.deepStrictEqual(yield* publishedDirectories(root, files), [
        "packages/cli/",
        "packages/kit/",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails when a workspace manifest is not a manifest", () =>
    Effect.gen(function* () {
      const { files, root } = yield* repository({
        "packages/kit/package.json": '{"private":"yes"}\n',
      });
      const error = yield* Effect.flip(publishedDirectories(root, files));
      assert.strictEqual(error._tag, "RepositoryReadError");
      assert.strictEqual(
        error.message,
        "Unable to read packages/kit/package.json as a package manifest."
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
