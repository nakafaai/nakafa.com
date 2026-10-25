import { Array as Arr, HashMap, Option, Record as Rec, Schema } from "effect";
import { NODE_RUNTIME_VERSION } from "#scripts/dependencies/policy";
import { problemWhen } from "#scripts/problem";

/** The one folder whose composite actions this policy reads. */
const LOCAL_ACTION_ROOT = "./.github/actions/";
const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);
const NonNegativeInteger = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);

const GithubActionReviewSchema = Schema.Struct({
  action: Schema.String,
  approvedSha: Schema.String,
  expectedInputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  expectedTag: Schema.String,
  expectedUsages: NonNegativeInteger,
  reason: Schema.String,
});
export type GithubActionReview = typeof GithubActionReviewSchema.Type;

const GithubActionUseSchema = Schema.Struct({
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
    expectedUsages: 2,
    reason:
      "Checkout is pinned to the latest reviewed stable release. The CLI publication and the deploy workflow each check out the commit.",
  },
  {
    action: "oven-sh/setup-bun",
    approvedSha: "0c5077e51419868618aeaa5fe8019c62421857d6",
    expectedInputs: { "bun-version": "1.4.4", "no-cache": "true" },
    expectedTag: "v2.2.0",
    expectedUsages: 1,
    reason:
      "The install action pins Bun 1.4.4 and installs the workspace from its frozen bun.lock. The cache stays off because a cold install beats restoring it on hosted runners.",
  },
  {
    action: "astral-sh/setup-uv",
    approvedSha: "07a047e608db84b3d8c06cd9a7c7dcc9c355c18e",
    expectedInputs: { version: "0.13.5" },
    expectedTag: "v10.3.2",
    expectedUsages: 1,
    reason:
      "The CAS engine's Python dependencies are vendored with uv for the Pyodide runtime, so the deploy job installs the pinned uv release before the stack deploys.",
  },
  {
    action: "actions/upload-artifact",
    approvedSha: "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    expectedTag: "v7.0.2",
    expectedUsages: 2,
    reason: "Separated CLI artifacts use the reviewed release.",
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
      "node-version": NODE_RUNTIME_VERSION,
      "package-manager-cache": "false",
    },
    expectedTag: "v7.0.0",
    expectedUsages: 4,
    reason:
      "CLI publication, its verification, and the deploy job pin Node without dependency caching, and the install action pins it for every job that installs dependencies, because Bun does not provision the Node runtime that pnpm's devEngines download used to provide.",
  },
]);

/** Returns every action one workflow value uses, at any depth, in document order. */
export function collectActionUses(
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

/** Validates immutable revisions, exact reviewed inputs, complete action coverage, and where local actions live. */
export function validateGithubActionPolicy(
  actionUses: readonly GithubActionUse[]
) {
  const reviews = HashMap.fromIterable(
    Arr.map(GITHUB_ACTION_REVIEWS, (review) => [review.action, review])
  );
  const inspected = Arr.map(actionUses, (use) => {
    if (use.reference.startsWith("./")) {
      return {
        problems: problemWhen(
          !use.reference.startsWith(LOCAL_ACTION_ROOT),
          `${use.workflowPath} uses the local action ${use.reference}; keep a local action below .github/actions, where this policy reads the actions it uses.`
        ),
        reviewed: [],
      };
    }

    const parsed = parseActionReference(use.reference);
    if (!parsed) {
      return {
        problems: [
          `${use.workflowPath} has an unpinned external action ${use.reference}.`,
        ],
        reviewed: [],
      };
    }

    const review = Option.getOrUndefined(HashMap.get(reviews, parsed.action));
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
