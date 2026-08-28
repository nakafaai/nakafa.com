import { Effect, Schema } from "effect";
import {
  actionExpression,
  decodeQueuePolicy,
  requireQueueExact,
  requireQueueFingerprint,
} from "./guard.ts";

const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);
const StepList = Schema.Array(UnknownRecord);
const PROVENANCE_FINGERPRINT =
  "a414932cc93fede0c16e28467437e25517cfee002754c519cd0ff372831eb33a";
const TREE_FINGERPRINT =
  "08716c9771f93f5193180e5b5a41bac0fea1481bacc720e395f9e5d671c2744e";
const TRUST_FINGERPRINT =
  "8c76e4971e4d8ca251c4c08f1c4b1aecc4385f316ae7b6e8d3ec5453e0ec4432";

function stepAt(
  steps: readonly Readonly<Record<string, unknown>>[],
  index: number
) {
  return steps[index] ?? {};
}

/** Validates the signed Production Scope admission and Production consumer. */
export const validateQueueAdmission = Effect.fn("GithubQueue.admission")(
  function* (scope: Readonly<Record<string, unknown>>) {
    yield* requireQueueExact(
      Object.keys(scope).sort(),
      ["env", "name", "outputs", "runs-on", "steps", "timeout-minutes"].sort(),
      "Production Scope has unreviewed configuration."
    );
    yield* requireQueueExact(
      scope.name,
      "Production Scope",
      "Production Scope was renamed."
    );
    yield* requireQueueExact(
      scope["runs-on"],
      "ubuntu-latest",
      "Production Scope changed runners."
    );
    yield* requireQueueExact(
      scope["timeout-minutes"],
      5,
      "Production Scope changed its timeout."
    );
    yield* requireQueueExact(
      scope.env,
      {
        DIRECT_TRUSTED_CONTENT_ENVIRONMENT: actionExpression(
          "github.event_name == 'push' || (github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login == 'nabilfatih' && github.actor == 'nabilfatih')"
        ),
      },
      "Production Scope changed its direct-trust boundary."
    );
    yield* requireQueueExact(
      scope.outputs,
      {
        required: actionExpression(
          "steps.classify.outputs.required || steps.default.outputs.required"
        ),
        trusted: actionExpression("steps.trust.outputs.trusted"),
      },
      "Production Scope changed its admission outputs."
    );

    const steps = yield* decodeQueuePolicy(StepList, scope.steps);
    yield* requireQueueExact(
      steps.length,
      8,
      "Production Scope must contain eight reviewed steps."
    );
    const defaultStep = stepAt(steps, 0);
    const checkoutStep = stepAt(steps, 1);
    const provenanceStep = stepAt(steps, 2);
    const treeStep = stepAt(steps, 3);
    const trustStep = stepAt(steps, 4);
    const setupStep = stepAt(steps, 5);
    const installStep = stepAt(steps, 6);
    const classifyStep = stepAt(steps, 7);

    yield* requireQueueExact(
      defaultStep,
      {
        env: {
          REQUIRED: actionExpression("env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT"),
        },
        id: "default",
        name: "Set fail-closed default",
        run: 'echo "required=$REQUIRED" >> "$GITHUB_OUTPUT"',
      },
      "The fail-closed default step changed."
    );
    yield* requireQueueExact(
      checkoutStep,
      {
        if: "env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT == 'true' || github.event_name == 'merge_group'",
        uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        with: { "fetch-depth": 0 },
      },
      "The trusted checkout step changed."
    );

    yield* requireQueueExact(
      Object.keys(provenanceStep).sort(),
      ["id", "if", "name", "uses", "with"].sort(),
      "The provenance step has unreviewed configuration."
    );
    yield* requireQueueExact(
      {
        id: provenanceStep.id,
        if: provenanceStep.if,
        name: provenanceStep.name,
        uses: provenanceStep.uses,
      },
      {
        id: "merge-group-provenance",
        if: "github.event_name == 'merge_group'",
        name: "Verify merge group provenance",
        uses: "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3",
      },
      "The provenance step identity changed."
    );
    const provenanceInputs = yield* decodeQueuePolicy(
      UnknownRecord,
      provenanceStep.with
    );
    yield* requireQueueExact(
      Object.keys(provenanceInputs).sort(),
      ["result-encoding", "script"],
      "The provenance step inputs changed."
    );
    yield* requireQueueExact(
      provenanceInputs["result-encoding"],
      "string",
      "The provenance result encoding changed."
    );
    yield* requireQueueFingerprint(
      provenanceInputs.script,
      PROVENANCE_FINGERPRINT,
      "Merge-group provenance"
    );

    yield* requireQueueExact(
      {
        env: treeStep.env,
        if: treeStep.if,
        keys: Object.keys(treeStep).sort(),
        name: treeStep.name,
      },
      {
        env: {
          BASE_SHA: actionExpression("github.event.merge_group.base_sha"),
          GROUP_SHA: actionExpression("github.event.merge_group.head_sha"),
          PULL_HEAD: actionExpression(
            "steps.merge-group-provenance.outputs.pull-head"
          ),
        },
        if: "github.event_name == 'merge_group'",
        keys: ["env", "if", "name", "run"],
        name: "Verify merge group tree",
      },
      "The merge-group tree step changed."
    );
    yield* requireQueueFingerprint(
      treeStep.run,
      TREE_FINGERPRINT,
      "Merge-group tree verification"
    );

    yield* requireQueueExact(
      {
        env: trustStep.env,
        id: trustStep.id,
        keys: Object.keys(trustStep).sort(),
        name: trustStep.name,
      },
      {
        env: {
          DIRECT_TRUST: actionExpression(
            "env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT"
          ),
          MERGE_GROUP_TRUST: actionExpression(
            "steps.merge-group-provenance.outputs.result"
          ),
        },
        id: "trust",
        keys: ["env", "id", "name", "run"],
        name: "Export content environment trust",
      },
      "The trust export step changed."
    );
    yield* requireQueueFingerprint(
      trustStep.run,
      TRUST_FINGERPRINT,
      "Trust export"
    );
    yield* requireQueueExact(
      setupStep,
      {
        if: "steps.trust.outputs.trusted == 'true'",
        name: "Setup toolchain",
        uses: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
        with: { cache: true, install: false },
      },
      "The trusted toolchain step changed."
    );
    yield* requireQueueExact(
      installStep,
      {
        if: "steps.trust.outputs.trusted == 'true'",
        name: "Install dependencies",
        run: "pnpm install --frozen-lockfile",
      },
      "The trusted install step changed."
    );
    yield* requireQueueExact(
      classifyStep,
      {
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
      },
      "The production classification step changed."
    );
  }
);
