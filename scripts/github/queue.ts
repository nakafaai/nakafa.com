import { Effect, FileSystem, Schema } from "effect";
import { parse as yamlParse } from "yaml";
import { validateQueueAdmission } from "./admission.ts";
import {
  actionExpression,
  decodeQueuePolicy,
  queuePolicyError,
  requireQueueExact,
  requireQueuePolicy,
} from "./guard.ts";
import { validateRequiredJob } from "./required.ts";

const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);
const Workflow = Schema.Struct({
  concurrency: Schema.Unknown,
  jobs: Schema.Unknown,
  name: Schema.Literal("CI"),
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
const EXPECTED_JOB_IDS = [
  "agent-docs",
  "production",
  "production-scope",
  "quality",
] as const;

/** Validates the complete signed merge-queue policy. */
export const validateGithubQueuePolicy = Effect.fn("GithubQueue.validate")(
  function* (source: string) {
    const parsed = yield* Effect.try({
      try: () => yamlParse(source),
      catch: (cause) =>
        queuePolicyError("Unable to decode the merge-queue workflow.", cause),
    });
    const workflow = yield* decodeQueuePolicy(Workflow, parsed);
    yield* decodeQueuePolicy(Triggers, workflow.on);
    yield* decodeQueuePolicy(Permissions, workflow.permissions);
    yield* decodeQueuePolicy(
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
      workflow.concurrency
    );
    const jobs = yield* decodeQueuePolicy(JobMap, workflow.jobs);

    yield* requireQueueExact(
      Object.keys(jobs).sort(),
      [...EXPECTED_JOB_IDS].sort(),
      "The merge-queue workflow must contain only its four reviewed jobs."
    );
    for (const job of Object.values(jobs)) {
      yield* requireQueuePolicy(
        !Object.hasOwn(job, "permissions"),
        "Merge-queue jobs cannot override the read-only workflow permissions.",
        job
      );
    }

    yield* validateQueueAdmission(
      jobs["production-scope"] ?? {},
      jobs.production ?? {}
    );
    yield* validateRequiredJob(jobs["agent-docs"] ?? {});
  }
);

/** Reads and validates the repository merge-queue policy. */
export const inspectGithubQueuePolicy = Effect.fn("GithubQueue.inspect")(
  (root: string) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const source = yield* fileSystem
        .readFileString(`${root}/.github/workflows/agent-docs.yml`)
        .pipe(
          Effect.mapError((cause) =>
            queuePolicyError("Unable to read the merge-queue workflow.", cause)
          )
        );
      yield* validateGithubQueuePolicy(source);
      return [] as string[];
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed([`Unable to inspect the merge queue: ${error.message}`])
      )
    )
);
