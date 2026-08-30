import { Effect, type Redacted, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  type QueuePull,
  QueuePullSchema,
  queueGateError,
} from "#scripts/github/queue/admission";

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = `${GITHUB_API}/graphql`;
const GITHUB_ACTIONS_APP_ID = 15_368;
const TRUSTED_WORKFLOW = ".github/workflows/ci.yml";
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;
const PositiveIntegerSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
const NonNegativeIntegerSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

const CheckRunSchema = Schema.Struct({
  app: Schema.Struct({ id: PositiveIntegerSchema }),
  conclusion: Schema.NullOr(Schema.String),
  details_url: Schema.NullOr(Schema.String),
  head_sha: Schema.String,
  name: Schema.String,
  status: Schema.String,
});
const CheckRunsSchema = Schema.Struct({
  check_runs: Schema.Array(CheckRunSchema),
  total_count: NonNegativeIntegerSchema,
});
const WorkflowRunSchema = Schema.Struct({
  actor: Schema.Struct({ login: Schema.String }),
  conclusion: Schema.NullOr(Schema.String),
  event: Schema.String,
  head_branch: Schema.NullOr(Schema.String),
  head_repository: Schema.Struct({ full_name: Schema.String }),
  head_sha: Schema.String,
  path: Schema.String,
  pull_requests: Schema.Array(
    Schema.Struct({
      base: Schema.Struct({
        ref: Schema.String,
        repo: Schema.Struct({ url: Schema.String }),
        sha: Schema.String,
      }),
      head: Schema.Struct({
        ref: Schema.String,
        repo: Schema.Struct({ url: Schema.String }),
        sha: Schema.String,
      }),
      number: PositiveIntegerSchema,
    })
  ),
  status: Schema.String,
});
const ReviewPageSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.NullOr(
      Schema.Struct({
        pullRequest: Schema.NullOr(
          Schema.Struct({
            reviewThreads: Schema.Struct({
              nodes: Schema.Array(
                Schema.Struct({
                  isResolved: Schema.Boolean,
                })
              ),
              pageInfo: Schema.Struct({
                endCursor: Schema.NullOr(Schema.String),
                hasNextPage: Schema.Boolean,
              }),
            }),
          })
        ),
      })
    ),
  }),
  errors: Schema.optional(
    Schema.Array(Schema.Struct({ message: Schema.String }))
  ),
});
type ReviewPage = Schema.Schema.Type<typeof ReviewPageSchema>;

export interface GithubQueueContext {
  readonly repository: string;
  readonly token: Redacted.Redacted;
}

const githubHeaders = {
  Accept: "application/vnd.github+json",
  "User-Agent": "nakafa-merge-queue-gate",
  "X-GitHub-Api-Version": "2022-11-28",
};

const authorizeGithub = (token: Redacted.Redacted) =>
  HttpClientRequest.bearerToken(token);

const getGithubJson = <S extends Schema.Constraint>(
  context: GithubQueueContext,
  url: string,
  schema: S,
  message: string
) =>
  Effect.flatMap(HttpClient.HttpClient, (client) =>
    HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeaders(githubHeaders),
      authorizeGithub(context.token),
      client.execute,
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.mapError((cause) => queueGateError(message, cause))
    )
  );

const postGithubJson = <S extends Schema.Constraint>(
  context: GithubQueueContext,
  body: unknown,
  schema: S,
  message: string
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = yield* HttpClientRequest.post(GITHUB_GRAPHQL).pipe(
      HttpClientRequest.setHeaders(githubHeaders),
      authorizeGithub(context.token),
      HttpClientRequest.bodyJson(body),
      Effect.mapError((cause) => queueGateError(message, cause))
    );
    return yield* client.execute(request).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.mapError((cause) => queueGateError(message, cause))
    );
  });

/** Reads the exact current pull-request head admitted by the merge queue. */
export const fetchQueuePull = Effect.fn("QueueGate.fetchPull")(
  (context: GithubQueueContext, pullNumber: number) =>
    getGithubJson(
      context,
      `${GITHUB_API}/repos/${context.repository}/pulls/${pullNumber}`,
      QueuePullSchema,
      "Unable to read the queued pull request."
    )
);

const REVIEW_QUERY = `
  query QueueReview($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $cursor) {
          nodes { isResolved }
          pageInfo { endCursor hasNextPage }
        }
      }
    }
  }
`;

/** Fails while any review thread on the queued pull remains unresolved. */
export const verifyResolvedReviews = Effect.fn("QueueGate.verifyReviews")(
  function* (context: GithubQueueContext, pullNumber: number) {
    const [owner, repo, ...unexpected] = context.repository.split("/");
    if (!(owner && repo) || unexpected.length > 0) {
      return yield* queueGateError("GitHub repository identity is invalid.");
    }

    let cursor: string | null = null;
    let threadCount = 0;
    for (;;) {
      const response: ReviewPage = yield* postGithubJson(
        context,
        {
          query: REVIEW_QUERY,
          variables: { cursor, number: pullNumber, owner, repo },
        },
        ReviewPageSchema,
        "Unable to read pull-request review threads."
      );
      if (response.errors && response.errors.length > 0) {
        return yield* queueGateError(
          `GitHub review query failed: ${response.errors[0]?.message ?? "unknown error"}.`
        );
      }
      const pull = response.data.repository?.pullRequest;
      if (!pull) {
        return yield* queueGateError("Queued pull request no longer exists.");
      }
      const threads = pull.reviewThreads.nodes;
      threadCount += threads.length;
      if (threads.some((thread) => !thread.isResolved)) {
        return yield* queueGateError(
          "Queued pull request has an unresolved review thread."
        );
      }
      if (!pull.reviewThreads.pageInfo.hasNextPage) {
        return threadCount;
      }
      cursor = pull.reviewThreads.pageInfo.endCursor;
      if (!cursor) {
        return yield* queueGateError(
          "GitHub review pagination did not return a continuation cursor."
        );
      }
    }
  }
);

const readTrustedCheck = Effect.fn("QueueGate.readTrustedCheck")(function* (
  context: GithubQueueContext,
  sourceHead: string,
  checkName: "Doctor" | "Required"
) {
  const params = new URLSearchParams({
    check_name: checkName,
    filter: "latest",
    per_page: "100",
  });
  const response = yield* getGithubJson(
    context,
    `${GITHUB_API}/repos/${context.repository}/commits/${sourceHead}/check-runs?${params}`,
    CheckRunsSchema,
    `Unable to read exact-head ${checkName} checks.`
  );
  const candidates = response.check_runs.filter(
    (check) =>
      check.name === checkName &&
      check.head_sha === sourceHead &&
      check.app.id === GITHUB_ACTIONS_APP_ID &&
      check.status === "completed" &&
      check.conclusion === "success" &&
      check.details_url !== null
  );
  if (
    response.total_count > response.check_runs.length ||
    candidates.length !== 1
  ) {
    return yield* queueGateError(
      `Exact-head ${checkName} proof is missing or ambiguous.`
    );
  }
  const detailsUrl = candidates[0]?.details_url;
  const prefix = `https://github.com/${context.repository}/actions/runs/`;
  if (!detailsUrl?.startsWith(prefix)) {
    return yield* queueGateError(
      `Exact-head ${checkName} proof has invalid Actions provenance.`
    );
  }
  const [runId, jobId, ...unexpected] = detailsUrl
    .slice(prefix.length)
    .split("/job/");
  if (
    unexpected.length > 0 ||
    !runId ||
    !jobId ||
    !POSITIVE_INTEGER_PATTERN.test(runId) ||
    !POSITIVE_INTEGER_PATTERN.test(jobId)
  ) {
    return yield* queueGateError(
      `Exact-head ${checkName} proof has invalid Actions identifiers.`
    );
  }
  return runId;
});

/** Proves Required and Doctor succeeded in one trusted exact-head source run. */
export const verifySourceChecks = Effect.fn("QueueGate.verifySourceChecks")(
  function* (context: GithubQueueContext, pull: QueuePull) {
    const [requiredRun, doctorRun] = yield* Effect.all(
      [
        readTrustedCheck(context, pull.head.sha, "Required"),
        readTrustedCheck(context, pull.head.sha, "Doctor"),
      ],
      { concurrency: 2 }
    );
    if (requiredRun !== doctorRun) {
      return yield* queueGateError(
        "Exact-head Required and Doctor proof came from different workflow runs."
      );
    }
    const run = yield* getGithubJson(
      context,
      `${GITHUB_API}/repos/${context.repository}/actions/runs/${requiredRun}`,
      WorkflowRunSchema,
      "Unable to verify exact-head workflow provenance."
    );
    const [runPull, ...unexpectedPulls] = run.pull_requests;
    const repositoryUrl = `${GITHUB_API}/repos/${context.repository}`;
    if (
      !runPull ||
      unexpectedPulls.length > 0 ||
      runPull.number !== pull.number ||
      runPull.base.ref !== pull.base.ref ||
      runPull.base.sha !== pull.base.sha ||
      runPull.base.repo.url !== repositoryUrl ||
      runPull.head.ref !== pull.head.ref ||
      runPull.head.sha !== pull.head.sha ||
      runPull.head.repo.url !== repositoryUrl ||
      run.event !== "pull_request" ||
      run.path !== TRUSTED_WORKFLOW ||
      run.head_sha !== pull.head.sha ||
      run.head_branch !== pull.head.ref ||
      run.head_repository.full_name !== context.repository ||
      run.actor.login !== "nabilfatih" ||
      run.status !== "completed" ||
      run.conclusion !== "success"
    ) {
      return yield* queueGateError(
        "Exact-head source checks do not belong to the trusted CI workflow."
      );
    }
    return requiredRun;
  }
);
