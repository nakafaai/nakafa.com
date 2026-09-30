import { afterEach, assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { SourceFile } from "typescript/unstable/ast";
import { API, Program, Snapshot } from "typescript/unstable/sync";
import { type SourceInspector, sourceViolations } from "#scripts/check/source";

const FILE = "packages/example/src/program.ts";
const VIEW = "apps/www/components/example.tsx";

/** Reports each inspected module by name, so tests see which files ran. */
const named: SourceInspector = (file: string, sourceFile: SourceFile) => [
  `${file}: ${sourceFile.text.length}`,
];

afterEach(() => vi.restoreAllMocks());

describe("repository source policy", () => {
  it.effect(
    "applies every inspector to each authored module in one batch",
    () =>
      Effect.gen(function* () {
        const close = vi.spyOn(API.prototype, "close");
        const violations = yield* sourceViolations(
          [
            { file: FILE, sourceText: "export {};" },
            { file: VIEW, sourceText: "export const View = () => <div />;" },
            { file: "apps/www/content/example.md", sourceText: "# Note" },
          ],
          [named, (file) => [`${file}: second`]]
        );
        assert.deepStrictEqual(violations, [
          `${FILE}: 10`,
          `${FILE}: second`,
          `${VIEW}: 34`,
          `${VIEW}: second`,
        ]);
        assert.strictEqual(close.mock.calls.length, 1);
      })
  );

  it.effect("skips the compiler when no module is authored TypeScript", () =>
    Effect.gen(function* () {
      const open = vi.spyOn(API.prototype, "updateSnapshot");
      const violations = yield* sourceViolations(
        [{ file: "apps/www/content/example.md", sourceText: "# Note" }],
        [named]
      );
      assert.deepStrictEqual(violations, []);
      assert.strictEqual(open.mock.calls.length, 0);
    })
  );

  it.effect("fails with a typed error when the compiler cannot start", () =>
    Effect.gen(function* () {
      const cause = new Error("native compiler unavailable");
      vi.resetModules();
      vi.doMock("typescript/unstable/sync", () => ({
        API: class {
          constructor() {
            throw cause;
          }
        },
      }));
      const policy = yield* Effect.promise(
        () => import("#scripts/check/source")
      );
      const failure = yield* policy
        .sourceViolations([{ file: FILE, sourceText: "" }], [named])
        .pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        [
          "TestCompilerError",
          cause,
          "Unable to start the native source compiler.",
        ]
      );
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          vi.doUnmock("typescript/unstable/sync");
          vi.resetModules();
        })
      )
    )
  );

  it.effect("fails when the compiler cannot open the sources", () =>
    Effect.gen(function* () {
      const cause = new Error("native snapshot unavailable");
      vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
        throw cause;
      });
      const snapshotFailure = yield* sourceViolations(
        [{ file: FILE, sourceText: "export {};" }],
        [named]
      ).pipe(Effect.flip);
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const projectFailure = yield* sourceViolations(
        [{ file: FILE, sourceText: "export {};" }],
        [named]
      ).pipe(Effect.flip);

      assert.deepStrictEqual(
        [snapshotFailure, projectFailure].map((failure) => [
          failure._tag,
          failure.cause,
          failure.message,
        ]),
        [
          ["TestCompilerError", cause, "Unable to inspect repository sources."],
          [
            "TestCompilerError",
            "The native source project is missing.",
            "Unable to inspect repository sources.",
          ],
        ]
      );
    })
  );

  it.effect("reports a source the compiler does not expose", () =>
    Effect.gen(function* () {
      vi.spyOn(Program.prototype, "getSourceFile").mockReturnValueOnce(
        undefined
      );
      const violations = yield* sourceViolations(
        [{ file: FILE, sourceText: "export {};" }],
        [named]
      );
      assert.deepStrictEqual(violations, [
        `${FILE}: the native compiler did not expose this source file.`,
      ]);
    })
  );
});
