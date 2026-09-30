import { afterEach, assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { API, Checker, Program, Snapshot } from "typescript/unstable/sync";
import {
  effectSourceViolations,
  effectTestViolations,
} from "#scripts/check/effect";

const FILE = "packages/example/src/program.test.ts";
const VIOLATION =
  "packages/example/src/program.test.ts: return the Effect to @effect/vitest instead of running it.";

afterEach(() => vi.restoreAllMocks());

describe("Effect test policy", () => {
  it.effect("closes the compiler after an isolated batch", () =>
    Effect.gen(function* () {
      const close = vi.spyOn(API.prototype, "close");
      const violations = yield* effectTestViolations([
        { file: FILE, sourceText: "const Effect = client;" },
        {
          file: FILE,
          sourceText:
            'import { Effect } from "effect"; Effect.runPromise(program);',
        },
        { file: FILE, sourceText: "Effect.runPromise(program);" },
      ]);
      assert.deepStrictEqual(violations, [VIOLATION]);
      assert.strictEqual(close.mock.calls.length, 1);
    })
  );

  it.effect("ignores sources that are not TypeScript tests", () =>
    Effect.gen(function* () {
      const violations = yield* effectTestViolations([
        {
          file: "packages/example/src/program.ts",
          sourceText:
            'import { Effect } from "effect"; Effect.runSync(program);',
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("closes the compiler and preserves native failures", () =>
    Effect.gen(function* () {
      const cause = new Error("native compiler disconnected");
      const close = vi.spyOn(API.prototype, "close");
      vi.spyOn(Checker.prototype, "getSymbolAtLocation").mockImplementationOnce(
        () => {
          throw cause;
        }
      );
      const failure = yield* effectTestViolations([
        {
          file: FILE,
          sourceText: 'import { Effect } from "effect"; Effect.void;',
        },
      ]).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "TestCompilerError");
      assert.strictEqual(failure.cause, cause);
      assert.strictEqual(failure.message, `Unable to inspect ${FILE}.`);
      assert.strictEqual(close.mock.calls.length, 1);
    })
  );

  it.effect("fails when the native compiler omits the test project", () =>
    Effect.gen(function* () {
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const failure = yield* effectTestViolations([
        { file: FILE, sourceText: "export {};" },
      ]).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "TestCompilerError");
      assert.strictEqual(failure.cause, "The native test project is missing.");
      assert.strictEqual(failure.message, `Unable to inspect ${FILE}.`);
    })
  );
});

describe("native compiler startup", () => {
  it.effect("fails both policies with typed errors when it cannot start", () =>
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
        () => import("#scripts/check/effect")
      );
      const failures = [
        yield* policy
          .effectTestViolations([{ file: FILE, sourceText: "export {};" }])
          .pipe(Effect.flip),
        yield* policy
          .effectSourceViolations([
            { file: "packages/example/src/program.ts", sourceText: "" },
          ])
          .pipe(Effect.flip),
      ];
      assert.deepStrictEqual(
        failures.map((failure) => [
          failure._tag,
          failure.cause,
          failure.message,
        ]),
        [
          [
            "TestCompilerError",
            cause,
            "Unable to start the native test compiler.",
          ],
          [
            "TestCompilerError",
            cause,
            "Unable to start the native source compiler.",
          ],
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
});

const BACKEND_FILE = "packages/backend/convex/example/program.ts";
const TRY_VIOLATION = `${BACKEND_FILE}: model failure with Effect instead of a raw try/catch statement.`;
const NARROWING_VIOLATION = `${BACKEND_FILE}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`;

describe("Effect source policy", () => {
  it.effect("rejects raw try statements and typeof-object narrowing", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: BACKEND_FILE,
          sourceText:
            'export function read(value: unknown) {\n  try {\n    JSON.parse("{}");\n  } catch {\n    return null;\n  }\n  return typeof value === "object" && value !== null;\n}',
        },
      ]);
      assert.deepStrictEqual(
        [...violations].sort(),
        [TRY_VIOLATION, NARROWING_VIOLATION].sort()
      );
    })
  );

  it.effect("rejects typeof-object narrowing on either side", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: BACKEND_FILE,
          sourceText:
            'export const isRecord = (value: unknown) => "object" !== typeof value;',
        },
        {
          file: "apps/www/lib/example.ts",
          sourceText:
            'export const isText = (value: unknown) => typeof value === "string" || typeof value === typeof input;',
        },
      ]);
      assert.deepStrictEqual(violations, [NARROWING_VIOLATION]);
    })
  );

  it.effect("allows Effect-native failure and narrowing", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: BACKEND_FILE,
          sourceText:
            'import { Effect, Predicate } from "effect";\nexport const read = Effect.fn("read")(function* (value: unknown) {\n  return Predicate.isObject(value) && Predicate.hasProperty(value, "code");\n});',
        },
        {
          file: BACKEND_FILE,
          sourceText:
            "export async function clean() {\n  try {\n    await write();\n  } finally {\n    await erase();\n  }\n}",
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("covers every authored module, including JSX", () =>
    Effect.gen(function* () {
      const appFile = "apps/www/lib/example.ts";
      const viewFile = "apps/www/components/example.tsx";
      const violations = yield* effectSourceViolations([
        {
          file: appFile,
          sourceText: 'export const value = typeof input === "object";',
        },
        {
          file: viewFile,
          sourceText:
            'export const View = () => (typeof input === "object" ? null : <div />);',
        },
      ]);
      assert.deepStrictEqual(
        [...violations].sort(),
        [
          `${appFile}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`,
          `${viewFile}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`,
        ].sort()
      );
    })
  );

  it.effect("ignores sources that are not authored modules", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: "apps/www/content/example.md",
          sourceText: 'export const value = typeof input === "object";',
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("fails when the native compiler cannot open the sources", () =>
    Effect.gen(function* () {
      const cause = new Error("native snapshot unavailable");
      vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
        throw cause;
      });
      const snapshotFailure = yield* effectSourceViolations([
        { file: BACKEND_FILE, sourceText: "export {};" },
      ]).pipe(Effect.flip);
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const projectFailure = yield* effectSourceViolations([
        { file: BACKEND_FILE, sourceText: "export {};" },
      ]).pipe(Effect.flip);

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

  it.effect("reports a source the native compiler does not expose", () =>
    Effect.gen(function* () {
      vi.spyOn(Program.prototype, "getSourceFile").mockReturnValueOnce(
        undefined
      );
      const violations = yield* effectSourceViolations([
        { file: BACKEND_FILE, sourceText: "export {};" },
      ]);
      assert.deepStrictEqual(violations, [
        `${BACKEND_FILE}: the native compiler did not expose this source file.`,
      ]);
    })
  );
});
