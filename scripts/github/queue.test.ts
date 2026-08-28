import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Schema } from "effect";
import { parse as yamlParse } from "yaml";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);
const Workflow = Schema.Struct({
  concurrency: Schema.Unknown,
  jobs: Schema.Unknown,
  on: Schema.Unknown,
  permissions: Schema.Unknown,
});
const Triggers = Schema.Struct({
  merge_group: Schema.Struct({
    branches: Schema.Tuple([Schema.Literal("main")]),
    types: Schema.Tuple([Schema.Literal("checks_requested")]),
  }),
  pull_request: Schema.Struct({
    types: Schema.Tuple([
      Schema.Literal("opened"),
      Schema.Literal("synchronize"),
    ]),
  }),
  push: Schema.Struct({
    branches: Schema.Tuple([Schema.Literal("main")]),
  }),
});
const Permissions = Schema.Struct({
  contents: Schema.Literal("read"),
  "pull-requests": Schema.Literal("read"),
});
const JobMap = Schema.Record(Schema.String, UnknownRecord);
const StepList = Schema.Array(UnknownRecord);

const PROVENANCE_FINGERPRINT =
  "a414932cc93fede0c16e28467437e25517cfee002754c519cd0ff372831eb33a";
const TREE_FINGERPRINT =
  "08716c9771f93f5193180e5b5a41bac0fea1481bacc720e395f9e5d671c2744e";
const TRUST_FINGERPRINT =
  "8c76e4971e4d8ca251c4c08f1c4b1aecc4385f316ae7b6e8d3ec5453e0ec4432";

function actionExpression(expression: string) {
  return ["$", "{{ ", expression, " }}"].join("");
}

function fingerprint(value: unknown) {
  expect(typeof value).toBe("string");
  return typeof value === "string"
    ? createHash("sha256").update(value).digest("hex")
    : "";
}

function stepAt(
  steps: readonly Readonly<Record<string, unknown>>[],
  index: number
) {
  const step = steps[index];
  expect(step).toBeDefined();
  return step ?? {};
}

describe("GitHub merge queue", () => {
  it.effect("keeps signed admission on one exact parsed contract", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const source = yield* fileSystem.readFileString(
        `${REPOSITORY_ROOT}/.github/workflows/agent-docs.yml`
      );
      const parsed = yield* Effect.sync(() => yamlParse(source));
      const workflow = yield* Schema.decodeUnknownEffect(Workflow)(parsed);
      const triggers = yield* Schema.decodeUnknownEffect(Triggers, {
        onExcessProperty: "error",
      })(workflow.on);
      const permissions = yield* Schema.decodeUnknownEffect(Permissions, {
        onExcessProperty: "error",
      })(workflow.permissions);
      const concurrency = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          "cancel-in-progress": Schema.Literal(
            actionExpression("github.event_name == 'pull_request'")
          ),
          group: Schema.Literal(
            `Agent-Friendly Docs-${actionExpression(
              "github.event_name == 'pull_request' && github.event.pull_request.number || github.sha"
            )}`
          ),
        }),
        { onExcessProperty: "error" }
      )(workflow.concurrency);
      const jobs = yield* Schema.decodeUnknownEffect(JobMap)(workflow.jobs);

      expect(triggers).toEqual({
        merge_group: {
          branches: ["main"],
          types: ["checks_requested"],
        },
        pull_request: { types: ["opened", "synchronize"] },
        push: { branches: ["main"] },
      });
      expect(permissions).toEqual({
        contents: "read",
        "pull-requests": "read",
      });
      expect(concurrency).toEqual({
        "cancel-in-progress": actionExpression(
          "github.event_name == 'pull_request'"
        ),
        group: `Agent-Friendly Docs-${actionExpression(
          "github.event_name == 'pull_request' && github.event.pull_request.number || github.sha"
        )}`,
      });
      for (const job of Object.values(jobs)) {
        expect(Object.hasOwn(job, "permissions")).toBe(false);
      }

      const scope = jobs["production-scope"] ?? {};
      expect(scope.name).toBe("Production Scope");
      expect(scope["runs-on"]).toBe("ubuntu-latest");
      expect(scope["timeout-minutes"]).toBe(5);
      expect(Object.hasOwn(scope, "if")).toBe(false);
      expect(scope.env).toEqual({
        DIRECT_TRUSTED_CONTENT_ENVIRONMENT: actionExpression(
          "github.event_name == 'push' || (github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login == 'nabilfatih' && github.actor == 'nabilfatih')"
        ),
      });
      expect(scope.outputs).toEqual({
        required: actionExpression(
          "steps.classify.outputs.required || steps.default.outputs.required"
        ),
        trusted: actionExpression("steps.trust.outputs.trusted"),
      });

      const steps = yield* Schema.decodeUnknownEffect(StepList)(scope.steps);
      expect(steps).toHaveLength(8);
      const defaultStep = stepAt(steps, 0);
      const checkoutStep = stepAt(steps, 1);
      const provenanceStep = stepAt(steps, 2);
      const treeStep = stepAt(steps, 3);
      const trustStep = stepAt(steps, 4);
      const setupStep = stepAt(steps, 5);
      const installStep = stepAt(steps, 6);
      const classifyStep = stepAt(steps, 7);

      expect(defaultStep).toEqual({
        env: {
          REQUIRED: actionExpression("env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT"),
        },
        id: "default",
        name: "Set fail-closed default",
        run: 'echo "required=$REQUIRED" >> "$GITHUB_OUTPUT"',
      });
      expect(checkoutStep).toEqual({
        if: "env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT == 'true' || github.event_name == 'merge_group'",
        uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        with: { "fetch-depth": 0 },
      });

      expect(Object.keys(provenanceStep).sort()).toEqual(
        ["id", "if", "name", "uses", "with"].sort()
      );
      expect(provenanceStep).toMatchObject({
        id: "merge-group-provenance",
        if: "github.event_name == 'merge_group'",
        name: "Verify merge group provenance",
        uses: "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3",
      });
      const provenanceInputs = yield* Schema.decodeUnknownEffect(UnknownRecord)(
        provenanceStep.with
      );
      expect(Object.keys(provenanceInputs).sort()).toEqual(
        ["result-encoding", "script"].sort()
      );
      expect(provenanceInputs["result-encoding"]).toBe("string");
      expect(fingerprint(provenanceInputs.script)).toBe(PROVENANCE_FINGERPRINT);

      expect(Object.keys(treeStep).sort()).toEqual(
        ["env", "if", "name", "run"].sort()
      );
      expect(treeStep).toMatchObject({
        env: {
          BASE_SHA: actionExpression("github.event.merge_group.base_sha"),
          GROUP_SHA: actionExpression("github.event.merge_group.head_sha"),
          PULL_HEAD: actionExpression(
            "steps.merge-group-provenance.outputs.pull-head"
          ),
        },
        if: "github.event_name == 'merge_group'",
        name: "Verify merge group tree",
      });
      expect(fingerprint(treeStep.run)).toBe(TREE_FINGERPRINT);

      expect(Object.keys(trustStep).sort()).toEqual(
        ["env", "id", "name", "run"].sort()
      );
      expect(trustStep).toMatchObject({
        env: {
          DIRECT_TRUST: actionExpression(
            "env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT"
          ),
          MERGE_GROUP_TRUST: actionExpression(
            "steps.merge-group-provenance.outputs.result"
          ),
        },
        id: "trust",
        name: "Export content environment trust",
      });
      expect(fingerprint(trustStep.run)).toBe(TRUST_FINGERPRINT);

      expect(setupStep).toEqual({
        if: "steps.trust.outputs.trusted == 'true'",
        name: "Setup toolchain",
        uses: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
        with: { cache: true, install: false },
      });
      expect(installStep).toEqual({
        if: "steps.trust.outputs.trusted == 'true'",
        name: "Install dependencies",
        run: "pnpm install --frozen-lockfile",
      });
      expect(classifyStep).toEqual({
        env: {
          BASE_SHA: actionExpression(
            "github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before"
          ),
          HEAD_SHA: actionExpression(
            "github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.event_name == 'merge_group' && github.event.merge_group.head_sha || github.sha"
          ),
        },
        id: "classify",
        if: "steps.trust.outputs.trusted == 'true'",
        name: "Classify production acceptance",
        run: "pnpm ci:production-acceptance",
      });

      const production = jobs.production ?? {};
      expect(production.needs).toBe("production-scope");
      expect(production.if).toBe(
        "needs.production-scope.outputs.required == 'true' && needs.production-scope.outputs.trusted == 'true'"
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
