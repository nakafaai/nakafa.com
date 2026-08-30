import { Effect, Schema } from "effect";

const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PULL_NUMBER_PATTERN = /^[1-9][0-9]*$/u;
const REF_PREFIX_PATTERN = /^refs\/heads\//u;

const GitShaSchema = Schema.String.check(Schema.isPattern(GIT_SHA_PATTERN));
const PullNumberSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
const LoginSchema = Schema.Struct({ login: Schema.String });

export const QueueEventSchema = Schema.Struct({
  action: Schema.Literal("checks_requested"),
  merge_group: Schema.Struct({
    base_ref: Schema.String,
    base_sha: GitShaSchema,
    head_ref: Schema.String,
    head_sha: GitShaSchema,
  }),
  repository: Schema.Struct({ full_name: Schema.String }),
  sender: LoginSchema,
});
export type QueueEvent = Schema.Schema.Type<typeof QueueEventSchema>;

export const QueuePullSchema = Schema.Struct({
  base: Schema.Struct({
    ref: Schema.String,
    repo: Schema.Struct({ full_name: Schema.String }),
    sha: GitShaSchema,
  }),
  head: Schema.Struct({
    ref: Schema.String,
    repo: Schema.NullOr(Schema.Struct({ full_name: Schema.String })),
    sha: GitShaSchema,
  }),
  number: PullNumberSchema,
  state: Schema.String,
  user: Schema.NullOr(LoginSchema),
});
export type QueuePull = Schema.Schema.Type<typeof QueuePullSchema>;

export interface QueueIdentity {
  readonly actor: string;
  readonly baseBranch: string;
  readonly baseSha: string;
  readonly groupRef: string;
  readonly groupSha: string;
  readonly pullNumber: number;
  readonly repository: string;
  readonly sender: string;
}

/** Expected failure while admitting or checking one merge-queue candidate. */
export class QueueGateError extends Schema.TaggedError<QueueGateError>()(
  "QueueGateError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}

export const queueGateError = (message: string, cause?: unknown) =>
  new QueueGateError({ cause, message });

/** Decodes the immutable identity carried by one merge-group event. */
export const decodeQueueIdentity = Effect.fn("QueueGate.decodeIdentity")(
  function* (input: {
    readonly actor: string;
    readonly event: unknown;
    readonly ref: string;
    readonly sha: string;
  }) {
    const event = yield* Schema.decodeUnknownEffect(QueueEventSchema)(
      input.event,
      { onExcessProperty: "ignore" }
    ).pipe(
      Effect.mapError((cause) =>
        queueGateError("Merge queue event payload is invalid.", cause)
      )
    );
    const baseBranch = event.merge_group.base_ref.replace(
      REF_PREFIX_PATTERN,
      ""
    );
    const groupRef = event.merge_group.head_ref.startsWith("refs/heads/")
      ? event.merge_group.head_ref
      : `refs/heads/${event.merge_group.head_ref}`;
    const queuePrefix = `refs/heads/gh-readonly-queue/${baseBranch}/pr-`;
    const queueIdentity = groupRef.slice(queuePrefix.length).split("-");
    const [pullNumber, refBaseSha] = queueIdentity;

    if (
      baseBranch.length === 0 ||
      !groupRef.startsWith(queuePrefix) ||
      queueIdentity.length !== 2 ||
      !pullNumber ||
      !PULL_NUMBER_PATTERN.test(pullNumber) ||
      refBaseSha !== event.merge_group.base_sha ||
      event.merge_group.head_sha !== input.sha ||
      groupRef !== input.ref
    ) {
      return yield* queueGateError(
        "Merge group ref does not identify one exact pull request."
      );
    }

    return {
      actor: input.actor,
      baseBranch,
      baseSha: event.merge_group.base_sha,
      groupRef,
      groupSha: event.merge_group.head_sha,
      pullNumber: Number(pullNumber),
      repository: event.repository.full_name,
      sender: event.sender.login,
    } satisfies QueueIdentity;
  }
);

const identifyQueueLane = Effect.fn("QueueGate.identifyLane")(function* (
  pull: QueuePull,
  trustedOwner: string
) {
  if (pull.user?.login === trustedOwner) {
    return "owner" as const;
  }
  if (
    pull.user?.login === "github-actions[bot]" &&
    pull.head.ref === "changeset-release/main"
  ) {
    return "release" as const;
  }
  return yield* queueGateError(
    "Merge queue entry is not in a trusted pull-request lane."
  );
});

/** Proves that one queued pull request belongs to an admitted lane. */
export const validateQueuePull = Effect.fn("QueueGate.validatePull")(function* (
  identity: QueueIdentity,
  pull: QueuePull,
  trustedOwner = "nabilfatih"
) {
  if (
    pull.number !== identity.pullNumber ||
    pull.state !== "open" ||
    pull.base.ref !== identity.baseBranch ||
    pull.base.sha !== identity.baseSha ||
    pull.base.repo.full_name !== identity.repository ||
    pull.head.repo?.full_name !== identity.repository ||
    identity.actor !== trustedOwner ||
    identity.sender !== trustedOwner
  ) {
    return yield* queueGateError(
      "Merge queue entry is not trusted for production acceptance."
    );
  }
  return yield* identifyQueueLane(pull, trustedOwner);
});

/** Revalidates the immutable pull identity before the final queue gate. */
export const validateQueueHead = Effect.fn("QueueGate.validateHead")(function* (
  repository: string,
  expectedHead: string,
  pull: QueuePull,
  trustedOwner = "nabilfatih"
) {
  if (
    pull.state !== "open" ||
    pull.base.ref !== "main" ||
    pull.base.repo.full_name !== repository ||
    pull.head.sha !== expectedHead ||
    pull.head.repo?.full_name !== repository
  ) {
    return yield* queueGateError(
      "Queued pull request changed after its exact-head admission."
    );
  }
  return yield* identifyQueueLane(pull, trustedOwner);
});
