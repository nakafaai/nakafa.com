import { Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

export const CONVEX_CONSUMERS = ["www", "api", "mcp"] as const;
export type ConvexConsumer = (typeof CONVEX_CONSUMERS)[number];

const GitSha = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u));
const GithubDeployment = Schema.Struct({
  environment: Schema.String,
  id: Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
  sha: GitSha,
});
const GithubDeployments = Schema.Array(GithubDeployment);
const GithubDeploymentStatuses = Schema.Array(
  Schema.Struct({ state: Schema.String })
);
const GITHUB_DEPLOYMENTS_URL =
  "https://api.github.com/repos/nakafaai/nakafa.com/deployments?per_page=100";

export interface ProductionDeployment {
  readonly consumer: ConvexConsumer;
  readonly revision: string;
}

/** Expected failure while resolving the live production revisions. */
export class ConvexDeploymentError extends Schema.TaggedError<ConvexDeploymentError>()(
  "ConvexDeploymentError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "nakafa-convex-rollout",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function consumerForEnvironment(environment: string) {
  if (!environment.startsWith("Production ")) {
    return;
  }
  return CONVEX_CONSUMERS.find((consumer) =>
    environment.endsWith(` ${consumer}`)
  );
}

const readGithubJson = Effect.fn("ConvexRollout.readGithubJson")(
  <S extends Schema.Constraint>(url: string, schema: S) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return yield* client
        .get(url, { headers: githubHeaders() })
        .pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap(HttpClientResponse.schemaBodyJson(schema))
        );
    })
);

const isSuccessfulDeployment = Effect.fn(
  "ConvexRollout.isSuccessfulDeployment"
)(function* (deploymentId: number) {
  const statuses = yield* readGithubJson(
    `https://api.github.com/repos/nakafaai/nakafa.com/deployments/${deploymentId}/statuses`,
    GithubDeploymentStatuses
  );
  return statuses[0]?.state === "success";
});

/** Reads the last successful production revision for every Convex consumer. */
export const readProductionDeployments = Effect.fn(
  "ConvexRollout.readProductionDeployments"
)(function* () {
  const deployments = yield* readGithubJson(
    GITHUB_DEPLOYMENTS_URL,
    GithubDeployments
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ConvexDeploymentError({
          cause,
          message: "Unable to read GitHub production deployments.",
        })
    )
  );

  return yield* Effect.forEach(
    CONVEX_CONSUMERS,
    (consumer) =>
      Effect.gen(function* () {
        const candidates = deployments
          .filter(
            (deployment) =>
              consumerForEnvironment(deployment.environment) === consumer
          )
          .sort((left, right) => right.id - left.id);

        for (const candidate of candidates) {
          const isSuccessful = yield* isSuccessfulDeployment(candidate.id);
          if (isSuccessful) {
            return {
              consumer,
              revision: candidate.sha,
            } satisfies ProductionDeployment;
          }
        }

        return yield* new ConvexDeploymentError({
          cause: consumer,
          message: `No successful production deployment was found for ${consumer}.`,
        });
      }).pipe(
        Effect.mapError((cause) =>
          cause instanceof ConvexDeploymentError
            ? cause
            : new ConvexDeploymentError({
                cause,
                message: `Unable to verify the production deployment for ${consumer}.`,
              })
        )
      ),
    { concurrency: 3 }
  );
});
