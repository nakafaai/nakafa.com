import { describe, expect, it } from "vitest";
import {
  inspectEffectTestRunnerPolicy,
  type TestSource,
} from "#testing/effect-test-policy";

const effectProgram = "program";

/** Creates one synthetic repository test module. */
function testSource(path: string, source: string): TestSource {
  return { path, source };
}

describe("Effect test runner policy", () => {
  it("rejects direct runners behind ordinary Vitest", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/program.test.ts",
          `import { Effect as Program } from "effect";
import { it } from "vitest";

it("runs", async () => Program.runPromise(${effectProgram}));`
        ),
      ],
      new Set()
    );

    expect(problems).toEqual({
      resolvedBaselineFiles: [],
      unexpectedRunnerFiles: ["packages/example/program.test.ts"],
    });
  });

  it("accepts Effect programs returned through it.effect", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/program.test.ts",
          `import { it } from "@repo/testing/effect";

it.effect("runs", () => ${effectProgram});`
        ),
      ],
      new Set()
    );

    expect(problems).toEqual({
      resolvedBaselineFiles: [],
      unexpectedRunnerFiles: [],
    });
  });

  it("accepts pure Effect values in ordinary Vitest", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/exit.test.ts",
          `import { Exit } from "effect";
import { expect, it } from "vitest";

it("constructs an exit", () => {
  expect(Exit.succeed("ok")._tag).toBe("Success");
});`
        ),
      ],
      new Set()
    );

    expect(problems).toEqual({
      resolvedBaselineFiles: [],
      unexpectedRunnerFiles: [],
    });
  });

  it("recognizes namespace, contextual, and direct Effect runners", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/namespace.test.ts",
          `import * as Runtime from "effect/Effect";
import { it } from "vitest";

it("runs", () => Runtime.runSync(${effectProgram}));`
        ),
        testSource(
          "packages/example/contextual.test.ts",
          `import { Effect } from "effect";
import { it } from "vitest";

it("runs", () => Effect.runCallbackWith(context)(${effectProgram}));`
        ),
        testSource(
          "packages/example/direct.test.ts",
          `import { runPromiseExit as run } from "effect/Effect";
import { it } from "vitest";

it("runs", () => run(${effectProgram}));`
        ),
      ],
      new Set()
    );

    expect(problems.unexpectedRunnerFiles).toEqual([
      "packages/example/contextual.test.ts",
      "packages/example/direct.test.ts",
      "packages/example/namespace.test.ts",
    ]);
  });

  it("does not match runner names inside comments or strings", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/text.test.ts",
          `import { Effect } from "effect";
import { it } from "vitest";

// Effect.runPromise(${effectProgram})
it("documents", () => "Effect.runSync(program)");`
        ),
      ],
      new Set()
    );

    expect(problems).toEqual({
      resolvedBaselineFiles: [],
      unexpectedRunnerFiles: [],
    });
  });

  it("forces resolved migration baseline entries to be removed", () => {
    const path = "packages/example/migrated.test.ts";
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          path,
          `import { it } from "@repo/testing/effect";

it.effect("runs", () => ${effectProgram});`
        ),
      ],
      new Set([path])
    );

    expect(problems).toEqual({
      resolvedBaselineFiles: [path],
      unexpectedRunnerFiles: [],
    });
  });
});
