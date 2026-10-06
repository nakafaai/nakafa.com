import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Order,
  Path,
  Record as Rec,
  Schema,
} from "effect";
import { parse as yamlParse } from "yaml";
import { problemWhen } from "#scripts/problem";

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
export type GithubActionReview = typeof GithubActionReviewSchema.Type;

export const GithubActionUseSchema = Schema.Struct({
  inputs: UnknownRecord,
  reference: Schema.String,
  workflowPath: Schema.String,
});
export type GithubActionUse = typeof GithubActionUseSchema.Type;

export const GITHUB_ACTION_REVIEWS = Schema.decodeSync(
  Schema.Array(GithubActionReviewSchema)
)([
  {
    action: "actions/checkout",
    approvedSha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
    expectedTag: "v7.0.1",
    expectedUsages: 6,
    reason: "Checkout is pinned to the latest reviewed stable release.",
  },
  {
    action: "pnpm/setup",
    approvedSha: "fbda4c85fc2e1e08721cd8763afea8f48d60f024",
    expectedInputs: { cache: "false", install: "false" },
    expectedTag: "v3.0.0",
    expectedUsages: 6,
    reason:
      "The signed successor action owns Node and pnpm. The store stays uncached because a cold install beats restoring it on hosted runners.",
  },
  {
    action: "astral-sh/setup-uv",
    approvedSha: "c18668ad3cf93ea998bef934396af7bb5c839dc7",
    expectedTag: "v10.2.0",
    expectedUsages: 2,
    reason: "Python quality and production jobs share the reviewed release.",
  },
  {
    action: "actions/upload-artifact",
    approvedSha: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    expectedTag: "v7.0.1",
    expectedUsages: 3,
    reason:
      "Failure diagnostics and separated CLI artifacts use the reviewed release.",
  },
  {
    action: "actions/download-artifact",
    approvedSha: "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
    expectedTag: "v8.0.1",
    expectedUsages: 3,
    reason: "CLI publishing and verification download separated artifacts.",
  },
  {
    action: "actions/setup-node",
    approvedSha: "820762786026740c76f36085b0efc47a31fe5020",
    expectedInputs: {
      "node-version": "24.21.0",
      "package-manager-cache": "false",
    },
    expectedTag: "v7.0.0",
    expectedUsages: 2,
    reason:
      "CLI publication and verification pin Node without dependency caching.",
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

/** Returns every action one workflow value uses, at any depth, in document order. */
function collectActionUses(
  value: unknown,
  workflowPath: string
): GithubActionUse[] {
  if (Arr.isArray(value)) {
    return Arr.flatMap(value, (item) => collectActionUses(item, workflowPath));
  }

  const record = Schema.decodeUnknownOption(UnknownRecord)(value);
  if (Option.isNone(record)) {
    return [];
  }

  const inputs = Schema.decodeUnknownOption(UnknownRecord)(record.value.with);
  return Arr.appendAll(
    typeof record.value.uses === "string"
      ? [
          {
            inputs: Option.getOrElse(inputs, () => ({})),
            reference: record.value.uses,
            workflowPath,
          },
        ]
      : [],
    Arr.flatMap(Rec.values(record.value), (child) =>
      collectActionUses(child, workflowPath)
    )
  );
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

function inputProblems(
  use: GithubActionUse,
  action: string,
  expectedInputs: Readonly<Record<string, string>>
) {
  return Arr.appendAll(
    Arr.flatMap(Rec.toEntries(expectedInputs), ([input, expected]) =>
      problemWhen(
        String(use.inputs[input] ?? "") !== expected,
        `${use.workflowPath} configures ${action} ${input} as ${String(use.inputs[input] ?? "missing")}; approved ${expected}.`
      )
    ),
    Arr.flatMap(Rec.keys(use.inputs), (input) =>
      problemWhen(
        !Object.hasOwn(expectedInputs, input),
        `${use.workflowPath} configures unreviewed ${action} input ${input}.`
      )
    )
  );
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
      Arr.sort(
        Arr.filter(files, (fileName) => WORKFLOW_FILE_PATTERN.test(fileName)),
        Order.String
      )
    ),
    Effect.mapError((cause) =>
      policyError("Unable to read GitHub workflow files.", cause)
    )
  );
  const uses = yield* Effect.forEach(
    workflowFiles,
    Effect.fnUntraced(function* (fileName) {
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
        catch: (cause) =>
          policyError(`Unable to decode ${workflowPath}.`, cause),
      });
      return collectActionUses(workflow, workflowPath);
    })
  );

  return Arr.filter(
    Arr.flatten(uses),
    ({ reference }) => !reference.startsWith("./")
  );
});

/** Validates immutable revisions, exact reviewed inputs, and complete action coverage. */
export function validateGithubActionPolicy(
  actionUses: readonly GithubActionUse[]
) {
  const reviews = new Map(
    Arr.map(GITHUB_ACTION_REVIEWS, (review) => [review.action, review])
  );
  const inspected = Arr.map(actionUses, (use) => {
    const parsed = parseActionReference(use.reference);
    if (!parsed) {
      return {
        problems: [
          `${use.workflowPath} has an unpinned external action ${use.reference}.`,
        ],
        reviewed: [],
      };
    }

    const review = reviews.get(parsed.action);
    if (!review) {
      return {
        problems: [
          `${use.workflowPath} uses unreviewed GitHub Action ${parsed.action}.`,
        ],
        reviewed: [],
      };
    }

    return {
      problems: Arr.appendAll(
        problemWhen(
          parsed.revision !== review.approvedSha,
          `${use.workflowPath} pins ${parsed.action} to ${parsed.revision}; approved ${review.approvedSha}.`
        ),
        review.expectedInputs
          ? inputProblems(use, parsed.action, review.expectedInputs)
          : []
      ),
      reviewed: [parsed.action],
    };
  });
  const reviewedActions = Arr.flatMap(inspected, ({ reviewed }) => reviewed);

  return Arr.appendAll(
    Arr.flatMap(inspected, ({ problems }) => problems),
    Arr.flatMap(GITHUB_ACTION_REVIEWS, (review) => {
      const actualUsages = Arr.filter(
        reviewedActions,
        (action) => action === review.action
      ).length;
      return problemWhen(
        actualUsages !== review.expectedUsages,
        `${review.action} has ${actualUsages} workflow usages; expected ${review.expectedUsages}.`
      );
    })
  );
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
