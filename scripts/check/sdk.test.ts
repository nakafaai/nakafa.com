import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { readAuthoredTree } from "#scripts/check/files";
import { inspectSdkReach, reachFindings } from "#scripts/check/sdk";

/** The repository root, two folders above this test. */
const REPOSITORY = `${import.meta.dirname}/../..`;
const RULE =
  "move the AI SDK import out of the module that specs and tables load";
const SPEC = "packages/backend/confect/nina/lifecycle.spec.ts";
const PLAIN = "packages/backend/confect/nina/plain.ts";
const REEXPORT = "packages/backend/confect/nina/reexport.ts";
const MIDDLE = "packages/backend/confect/nina/middle.ts";
const LEAF = "packages/backend/confect/nina/leaf.ts";
const GENERATED = "packages/backend/confect/_generated/refs.ts";
const PACKAGES = "packages/backend/confect/nina/packages.ts";
const TABLE = "packages/backend/confect/tables/chats.ts";
const SCHEMA = "packages/backend/confect/_generated/schema.ts";
const DOMAIN_SCHEMA = "packages/backend/confect/nina/math/schema.ts";
const UNLOADED = "packages/backend/confect/nina/unloaded.ts";

/** A backend module as the check reads it: its repository path and its text. */
function source(file: string, sourceText: string) {
  return { file, sourceText };
}

describe("AI SDK reach of the Confect contracts", () => {
  it.effect(
    "reports an AI SDK module that a spec loads through an import or a re-export, with the chain that loads it",
    () =>
      Effect.gen(function* () {
        const findings = yield* reachFindings([
          source(
            SPEC,
            `import { plain } from "@repo/backend/confect/nina/plain";
export { reexported } from "./reexport";
export { plain as renamed };
export const spec = plain;
`
          ),
          source(
            PLAIN,
            'import { generateText } from "ai";\nexport const plain = generateText;\n'
          ),
          source(
            REEXPORT,
            'import { Agent } from "@convex-dev/agent";\nexport const reexported = Agent;\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          `${SPEC} -> ${PLAIN} imports "ai": ${RULE}.`,
          `${SPEC} -> ${REEXPORT} imports "@convex-dev/agent": ${RULE}.`,
        ]);
      })
  );

  it.effect(
    "reports a module that is loaded in more than one way through its shortest chain",
    () =>
      Effect.gen(function* () {
        const findings = yield* reachFindings([
          source(
            SPEC,
            'import "./middle";\nimport { leaf } from "./leaf";\nexport const spec = leaf;\n'
          ),
          source(
            MIDDLE,
            'import { leaf } from "./leaf";\nexport const middle = leaf;\n'
          ),
          source(
            LEAF,
            'import { generateText } from "ai";\nexport const leaf = generateText;\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          `${SPEC} -> ${LEAF} imports "ai": ${RULE}.`,
        ]);
      })
  );

  it.effect(
    "follows a generated module into the authored module that it loads",
    () =>
      Effect.gen(function* () {
        const findings = yield* reachFindings([
          source(
            SPEC,
            'import { refs } from "@repo/backend/confect/_generated/refs";\nexport const spec = refs;\n'
          ),
          source(GENERATED, 'export * from "../nina/plain";\n'),
          source(
            PLAIN,
            'import { generateText } from "ai";\nexport const plain = generateText;\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          `${SPEC} -> ${GENERATED} -> ${PLAIN} imports "ai": ${RULE}.`,
        ]);
      })
  );

  it.effect("skips type-only imports and re-exports, which load nothing", () =>
    Effect.gen(function* () {
      const findings = yield* reachFindings([
        source(
          SPEC,
          `import type { Model } from "@repo/backend/confect/nina/model";
import { type Shape, type Tool } from "./shape";
export type { Result } from "./result";
export { type Input } from "./input";
export const spec = 1;
`
        ),
        source(
          "packages/backend/confect/nina/model.ts",
          'import { generateText } from "ai";\nexport type Model = typeof generateText;\n'
        ),
        source(
          "packages/backend/confect/nina/shape.ts",
          'import { generateText } from "ai";\nexport type Shape = typeof generateText;\nexport type Tool = Shape;\n'
        ),
        source(
          "packages/backend/confect/nina/result.ts",
          'import { generateText } from "ai";\nexport type Result = typeof generateText;\n'
        ),
        source(
          "packages/backend/confect/nina/input.ts",
          'import { generateText } from "ai";\nexport type Input = typeof generateText;\n'
        ),
      ]);
      assert.deepStrictEqual(findings, []);
    })
  );

  it.effect(
    "names each AI SDK package that a module imports, and no other package",
    () =>
      Effect.gen(function* () {
        const findings = yield* reachFindings([
          source(SPEC, 'import "./packages";\n'),
          source(
            PACKAGES,
            `import "ai";
import "ai/rsc";
import "@ai-sdk/gateway";
import "@convex-dev/agent";
import "@convex-dev/agent/react";
import "@convex-dev/agent";
import "ai-utils";
import "@convex-dev/agentic";
import "effect";
`
          ),
        ]);
        assert.deepStrictEqual(findings, [
          `${SPEC} -> ${PACKAGES} imports "ai", "ai/rsc", "@ai-sdk/gateway", "@convex-dev/agent", "@convex-dev/agent/react": ${RULE}.`,
        ]);
      })
  );

  it.effect(
    "starts from each table and the schema root, and reports nothing that no start loads",
    () =>
      Effect.gen(function* () {
        const findings = yield* reachFindings([
          source(
            TABLE,
            'import { generateText } from "ai";\nexport default generateText;\n'
          ),
          source(
            SCHEMA,
            'import { Agent } from "@convex-dev/agent";\nexport default Agent;\n'
          ),
          source(
            DOMAIN_SCHEMA,
            'import { generateText } from "ai";\nexport default generateText;\n'
          ),
          source(
            UNLOADED,
            'import { generateText } from "ai";\nexport default generateText;\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          `${SCHEMA} imports "@convex-dev/agent": ${RULE}.`,
          `${TABLE} imports "ai": ${RULE}.`,
        ]);
      })
  );

  it.effect("reaches a domain schema only through a spec that loads it", () =>
    Effect.gen(function* () {
      const findings = yield* reachFindings([
        source(
          SPEC,
          'import { schema } from "@repo/backend/confect/nina/math/schema";\nexport const spec = schema;\n'
        ),
        source(
          DOMAIN_SCHEMA,
          'import { generateText } from "ai";\nexport const schema = generateText;\n'
        ),
      ]);
      assert.deepStrictEqual(findings, [
        `${SPEC} -> ${DOMAIN_SCHEMA} imports "ai": ${RULE}.`,
      ]);
    })
  );

  it.effect("reports nothing in a repository without a Confect backend", () =>
    Effect.gen(function* () {
      const findings = yield* reachFindings([
        source(
          "packages/backend/convex/nina.spec.ts",
          'import { generateText } from "ai";\nexport default generateText;\n'
        ),
        source(
          "apps/www/src/lib/agent.spec.ts",
          'import { Agent } from "@convex-dev/agent";\nexport default Agent;\n'
        ),
      ]);
      assert.deepStrictEqual(findings, []);
    })
  );

  it.effect(
    "the real repository loads no AI SDK import from a spec, table, or the schema root",
    () =>
      Effect.gen(function* () {
        const { workspaces } = yield* readAuthoredTree(REPOSITORY);
        assert.deepStrictEqual(
          yield* inspectSdkReach(REPOSITORY, workspaces),
          []
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    60_000
  );
});
