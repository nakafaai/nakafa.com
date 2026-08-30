import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  decodeQueueIdentity,
  QueueEventSchema,
  queueGateError,
  validateQueuePull,
} from "#scripts/github/queue/admission";
import {
  fetchQueuePull,
  verifyResolvedReviews,
  verifySourceChecks,
} from "#scripts/github/queue/remote";
import {
  GateEventSchema,
  GateOutcomeSchema,
  GateRoleSchema,
  validateGateResult,
} from "#scripts/github/queue/result";
import { inspectQueueTree } from "#scripts/github/queue/tree";
import { writeOutput } from "#scripts/output";

const decodeConfig = <S extends Schema.Constraint>(name: string, schema: S) =>
  Config.nonEmptyString(name).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((cause) =>
      queueGateError(`${name} has an invalid CI value.`, cause)
    )
  );

const appendGithubOutput = Effect.fn("QueueGate.appendOutput")(function* (
  outputPath: string,
  values: Readonly<Record<string, string | number | boolean>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const body = Object.entries(values)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
  yield* fileSystem
    .writeFileString(outputPath, `${body}\n`, { flag: "a" })
    .pipe(
      Effect.mapError((cause) =>
        queueGateError("Unable to write merge queue outputs.", cause)
      )
    );
});

const admit = Effect.fn("QueueGate.admit")(function* () {
  const config = yield* Config.all({
    actor: Config.nonEmptyString("GITHUB_ACTOR"),
    eventPath: Config.nonEmptyString("GITHUB_EVENT_PATH"),
    outputPath: Config.nonEmptyString("GITHUB_OUTPUT"),
    ref: Config.nonEmptyString("GITHUB_REF"),
    sha: Config.nonEmptyString("GITHUB_SHA"),
    token: Config.redacted("GITHUB_TOKEN"),
  }).pipe(
    Effect.mapError((cause) =>
      queueGateError("Merge queue environment is incomplete.", cause)
    )
  );
  const fileSystem = yield* FileSystem.FileSystem;
  const event = yield* fileSystem.readFileString(config.eventPath).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.fromJsonString(QueueEventSchema))
    ),
    Effect.mapError((cause) =>
      queueGateError("Unable to decode the merge queue event.", cause)
    )
  );
  const identity = yield* decodeQueueIdentity({
    actor: config.actor,
    event,
    ref: config.ref,
    sha: config.sha,
  });
  const github = { repository: identity.repository, token: config.token };
  const pull = yield* fetchQueuePull(github, identity.pullNumber);
  yield* validateQueuePull(identity, pull);
  const reviewCount = yield* verifyResolvedReviews(github, identity.pullNumber);
  const tree = yield* inspectQueueTree(process.cwd(), identity, pull.head.sha);
  const reuse = tree.reuse
    ? yield* verifySourceChecks(github, pull).pipe(
        Effect.as(true),
        Effect.catchTag("QueueGateError", () =>
          writeOutput(
            "Static source proof is not reusable; Quality will run on the merge-group tree.\n"
          ).pipe(Effect.as(false))
        )
      )
    : false;
  yield* appendGithubOutput(config.outputPath, {
    "pull-head": pull.head.sha,
    "pull-number": pull.number,
    reuse,
    trusted: true,
  });
  yield* writeOutput(
    `Admitted pull request #${pull.number} at ${pull.head.sha}; ${reviewCount} review threads checked; static source proof reuse ${String(reuse)}.\n`
  );
});

const review = Effect.fn("QueueGate.review")(function* () {
  const config = yield* Config.all({
    expectedHead: Config.nonEmptyString("EXPECTED_HEAD"),
    pullNumber: Config.int("PULL_NUMBER"),
    repository: Config.nonEmptyString("GITHUB_REPOSITORY"),
    token: Config.redacted("GITHUB_TOKEN"),
  }).pipe(
    Effect.mapError((cause) =>
      queueGateError("Final review environment is incomplete.", cause)
    )
  );
  const github = { repository: config.repository, token: config.token };
  const pull = yield* fetchQueuePull(github, config.pullNumber);
  if (
    pull.state !== "open" ||
    pull.base.ref !== "main" ||
    pull.base.repo.full_name !== config.repository ||
    pull.head.sha !== config.expectedHead ||
    pull.head.repo?.full_name !== config.repository ||
    pull.user?.login !== "nabilfatih"
  ) {
    return yield* queueGateError(
      "Queued pull request changed after its exact-head admission."
    );
  }
  const reviewCount = yield* verifyResolvedReviews(github, config.pullNumber);
  yield* writeOutput(
    `Final review verification passed for ${reviewCount} threads on pull request #${pull.number}.\n`
  );
});

const gate = Effect.fn("QueueGate.result")(function* (roleInput: unknown) {
  const role = yield* Schema.decodeUnknownEffect(GateRoleSchema)(
    roleInput
  ).pipe(
    Effect.mapError((cause) =>
      queueGateError("CI gate role is invalid.", cause)
    )
  );
  const [event, fullOutcome, productionOutcome, reviewOutcome, scopeOutcome] =
    yield* Effect.all([
      decodeConfig("GITHUB_EVENT_NAME", GateEventSchema),
      decodeConfig("FULL_OUTCOME", GateOutcomeSchema),
      decodeConfig("PRODUCTION_OUTCOME", GateOutcomeSchema),
      decodeConfig("REVIEW_OUTCOME", GateOutcomeSchema),
      decodeConfig("SCOPE_OUTCOME", GateOutcomeSchema),
    ]);
  const flags = yield* Config.all({
    productionRequired: Config.boolean("PRODUCTION_REQUIRED"),
    reuse: Config.boolean("REUSE_SOURCE_PROOF"),
    trusted: Config.boolean("TRUSTED_CANDIDATE"),
  }).pipe(
    Effect.mapError((cause) =>
      queueGateError("CI gate flags are incomplete.", cause)
    )
  );
  const message = yield* validateGateResult({
    event,
    fullOutcome,
    productionOutcome,
    productionRequired: flags.productionRequired,
    reviewOutcome,
    reuse: flags.reuse,
    role,
    scopeOutcome,
    trusted: flags.trusted,
  });
  yield* writeOutput(`${message}\n`);
});

const main = (() => {
  switch (process.argv[2]) {
    case "admit":
      return admit();
    case "review":
      return review();
    case "gate":
      return gate(process.argv[3]);
    default:
      return Effect.fail(
        queueGateError("Usage: queue <admit|review|gate <doctor|required>>")
      );
  }
})().pipe(
  Effect.tapError(() => writeOutput("ERROR: Merge queue gate failed.\n")),
  Effect.scoped,
  Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer))
);

NodeRuntime.runMain(main);
