import { describe, expect, it } from "vitest";
import {
  inspectEffectTestRunnerPolicy,
  type TestSource,
} from "./effect-test-policy.ts";

const effectProgram = "program";

/** Creates one synthetic repository test module. */
function testSource(path: string, source: string): TestSource {
  return { path, source };
}

describe("Effect test runner policy", () => {
  it("rejects direct runners hidden behind the Effect test adapter", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/program.test.ts",
          `import { it } from "@repo/testing/effect";
import { Effect as Program } from "effect";

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
import { Effect } from "effect";

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

  it("keeps ordinary Vitest runner boundaries outside the adapter policy", () => {
    const problems = inspectEffectTestRunnerPolicy(
      [
        testSource(
          "packages/example/schema.test.ts",
          `import { Effect } from "effect";
import { it } from "vitest";

it("encodes", async () => Effect.runPromise(${effectProgram}));`
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
          `import { it } from "@repo/testing/effect";
import * as Runtime from "effect/Effect";

it("runs", () => Runtime.runSync(${effectProgram}));`
        ),
        testSource(
          "packages/example/contextual.test.ts",
          `import { it } from "@repo/testing/effect";
import { Effect } from "effect";

it("runs", () => Effect.runCallbackWith(context)(${effectProgram}));`
        ),
        testSource(
          "packages/example/direct.test.ts",
          `import { it } from "@repo/testing/effect";
import { runPromiseExit as run } from "effect/Effect";

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
          `import { it } from "@repo/testing/effect";
import { Effect } from "effect";

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
import { Effect } from "effect";

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
