import { Effect, FileSystem, Option, Path, Schema } from "effect";
import { parse as yamlParse } from "yaml";

const WORKFLOW_FILE_PATTERN = /\.ya?ml$/u;
const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);
const NonNegativeInteger = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

export const GithubActionReviewSchema = Schema.Struct({
  action: Schema.String,
  approvedSha: Schema.String,
  expectedInputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  expectedTag: Schema.String,
  expectedUsages: NonNegativeInteger,
  reason: Schema.String,
});
export type GithubActionReview = Schema.Schema.Type<
  typeof GithubActionReviewSchema
>;

export const GithubActionUseSchema = Schema.Struct({
  inputs: UnknownRecord,
  reference: Schema.String,
  workflowPath: Schema.String,
});
export type GithubActionUse = Schema.Schema.Type<typeof GithubActionUseSchema>;

export const GITHUB_ACTION_REVIEWS = Schema.decodeSync(
  Schema.Array(GithubActionReviewSchema)
)([
  {
    action: "actions/checkout",
    approvedSha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
    expectedTag: "v7.0.1",
    expectedUsages: 7,
    reason: "Checkout is pinned to the latest reviewed stable release.",
  },
  {
    action: "actions/github-script",
    approvedSha: "3a2844b7e9c422d3c10d287c895573f7108da1b3",
    expectedTag: "v9.0.0",
    expectedUsages: 1,
    reason: "Merge groups verify every candidate through the GitHub API.",
  },
  {
    action: "pnpm/setup",
    approvedSha: "84cb39b217b10273981911c288cd62326dc7c6d2",
    expectedInputs: { cache: "true", install: "false" },
    expectedTag: "v2.0.2",
    expectedUsages: 7,
    reason:
      "The signed successor action owns Node, pnpm, and dependency caching.",
  },
  {
    action: "changesets/action",
    approvedSha: "8488615a623b1b9c987934bb89eae8af6a946ac1",
    expectedTag: "v2.1.1",
    expectedUsages: 1,
    reason: "The v2 release API and renamed inputs are migrated together.",
  },
  {
    action: "astral-sh/setup-uv",
    approvedSha: "20cfd1bf945f4377ade1205e4dbc17946fc9a30d",
    expectedTag: "v10.0.1",
    expectedUsages: 2,
    reason: "Python quality and production jobs share the reviewed release.",
  },
  {
    action: "actions/cache/restore",
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedTag: "v6.1.0",
    expectedUsages: 2,
    reason: "The cache restore and save actions move as one cohort.",
  },
  {
    action: "actions/cache/save",
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedTag: "v6.1.0",
    expectedUsages: 1,
    reason: "The cache restore and save actions move as one cohort.",
  },
  {
    action: "actions/upload-artifact",
    approvedSha: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    expectedTag: "v7.0.1",
    expectedUsages: 1,
    reason: "Failure diagnostics use the reviewed stable release.",
  },
]);

/** Expected failure while reading or decoding repository workflow policy. */
export class GithubActionPolicyError extends Schema.TaggedError<GithubActionPolicyError>()(
  "GithubActionPolicyError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function collectActionUses(
  value: unknown,
  workflowPath: string,
  uses: GithubActionUse[]
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectActionUses(item, workflowPath, uses);
    }
    return;
  }

  const record = Schema.decodeUnknownOption(UnknownRecord)(value);
  if (Option.isNone(record)) {
    return;
  }

  if (typeof record.value.uses === "string") {
    const inputs = Schema.decodeUnknownOption(UnknownRecord)(record.value.with);
    uses.push({
      inputs: Option.getOrElse(inputs, () => ({})),
      reference: record.value.uses,
      workflowPath,
    });
  }

  for (const child of Object.values(record.value)) {
    collectActionUses(child, workflowPath, uses);
  }
}

function parseActionReference(reference: string) {
  const separator = reference.lastIndexOf("@");
  if (separator <= 0 || separator === reference.length - 1) {
    return;
  }

  return {
    action: reference.slice(0, separator),
    revision: reference.slice(separator + 1),
  };
}

function policyError(message: string, cause: unknown) {
  return new GithubActionPolicyError({ cause, message });
}

/** Reads every external action used by first-party GitHub workflows. */
export const readWorkflowActionUses = Effect.fn(
  "RepositoryPolicy.readWorkflowActionUses"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workflowRoot = path.join(root, ".github", "workflows");
  const workflowFiles = yield* fileSystem.readDirectory(workflowRoot).pipe(
    Effect.map((files) =>
      files.filter((fileName) => WORKFLOW_FILE_PATTERN.test(fileName)).sort()
    ),
    Effect.mapError((cause) =>
      policyError("Unable to read GitHub workflow files.", cause)
    )
  );
  const uses: GithubActionUse[] = [];

  for (const fileName of workflowFiles) {
    const workflowPath = path.join(".github", "workflows", fileName);
    const source = yield* fileSystem
      .readFileString(path.join(root, workflowPath))
      .pipe(
        Effect.mapError((cause) =>
          policyError(`Unable to read ${workflowPath}.`, cause)
        )
      );
    const workflow = yield* Effect.try({
      try: () => yamlParse(source),
      catch: (cause) => policyError(`Unable to decode ${workflowPath}.`, cause),
    });
    collectActionUses(workflow, workflowPath, uses);
  }

  return uses.filter(({ reference }) => !reference.startsWith("./"));
});

/** Validates immutable revisions, expected inputs, and complete action coverage. */
export function validateGithubActionPolicy(
  actionUses: readonly GithubActionUse[]
) {
  const problems: string[] = [];
  const reviews = new Map(
    GITHUB_ACTION_REVIEWS.map((review) => [review.action, review])
  );
  const usageCounts = new Map<string, number>();

  for (const use of actionUses) {
    const parsed = parseActionReference(use.reference);
    if (!parsed) {
      problems.push(
        `${use.workflowPath} has an unpinned external action ${use.reference}.`
      );
      continue;
    }

    const review = reviews.get(parsed.action);
    if (!review) {
      problems.push(
        `${use.workflowPath} uses unreviewed GitHub Action ${parsed.action}.`
      );
      continue;
    }

    usageCounts.set(parsed.action, (usageCounts.get(parsed.action) ?? 0) + 1);
    if (parsed.revision !== review.approvedSha) {
      problems.push(
        `${use.workflowPath} pins ${parsed.action} to ${parsed.revision}; approved ${review.approvedSha}.`
      );
    }

    for (const [input, expected] of Object.entries(
      review.expectedInputs ?? {}
    )) {
      if (String(use.inputs[input] ?? "") !== expected) {
        problems.push(
          `${use.workflowPath} configures ${parsed.action} ${input} as ${String(use.inputs[input] ?? "missing")}; approved ${expected}.`
        );
      }
    }
  }

  for (const review of GITHUB_ACTION_REVIEWS) {
    const actualUsages = usageCounts.get(review.action) ?? 0;
    if (actualUsages !== review.expectedUsages) {
      problems.push(
        `${review.action} has ${actualUsages} workflow usages; expected ${review.expectedUsages}.`
      );
    }
  }

  return problems;
}

/** Reads and validates the repository GitHub Action policy. */
export const inspectGithubActionPolicy = Effect.fn(
  "RepositoryPolicy.inspectGithubActions"
)((root: string) =>
  readWorkflowActionUses(root).pipe(
    Effect.map(validateGithubActionPolicy),
    Effect.catch((error) =>
      Effect.succeed([`Unable to inspect GitHub Actions: ${error.message}`])
    )
  )
);
