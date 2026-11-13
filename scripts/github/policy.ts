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
  /** Other reviewed input sets of the same action, for workflows that use it for another purpose. */
  alternativeInputs: Schema.optional(
    Schema.Array(Schema.Record(Schema.String, Schema.String))
  ),
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

/** One GitHub Actions expression, as a workflow writes it, such as `${{ github.run_id }}`. */
function expression(body: string) {
  return `$\{{ ${body} }}`;
}

/** The prefix of the deploy's read store saves for one stage. */
const STAGE_READS = `reads-${expression("env.NAKAFA_DEPLOY_STAGE")}-`;

/** The prefix of the deploy's read store saves for one release of one stage. */
const RELEASE_READS = `${STAGE_READS}${expression("steps.release.outputs.id")}-`;

/** The folders a proof caches its prepared runtime in: the snapshot store and the Convex backend binary. */
const PREPARED_PATHS = `${expression("runner.temp")}/snapshots\n~/.cache/convex/binaries\n`;

export const GITHUB_ACTION_REVIEWS = Schema.decodeSync(
  Schema.Array(GithubActionReviewSchema)
)([
  {
    action: "actions/checkout",
    approvedSha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
    expectedTag: "v7.0.1",
    expectedUsages: 5,
    reason:
      "Checkout is pinned to the latest reviewed stable release. The CLI publication and the deploy workflow each check out the commit, the proof workflow checks out the proven head without credentials in its build and spec jobs, and the gate workflow checks out the gated head without credentials on each part's machine.",
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
    approvedSha: "68559e99cc807c1eb7e9238fd43a15bba460eec2",
    expectedInputs: {
      "cache-dependency-glob": "apps/cas/uv.lock",
      version: "0.13.8",
    },
    expectedTag: "v10.3.3",
    expectedUsages: 2,
    reason:
      "The CAS engine's Python dependencies are vendored with uv for the Pyodide runtime, so the deploy job installs the pinned uv release before the stack deploys, and the gate workflow installs it for the engine's typecheck, lint and tests. Its cache key reads only the CAS lockfile, because the default glob walks every folder, node_modules included, for 3.5 minutes.",
  },
  {
    action: "actions/cache/restore",
    alternativeInputs: [
      {
        key: `prepared-${expression("steps.key.outputs.key")}`,
        path: PREPARED_PATHS,
      },
      {
        "fail-on-cache-miss": "true",
        key: `prepared-${expression("needs.build.outputs.key")}`,
        path: PREPARED_PATHS,
      },
    ],
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedInputs: {
      key: `${RELEASE_READS}${expression("github.run_id")}-${expression("github.run_attempt")}`,
      path: ".cache/reads",
      "restore-keys": `${RELEASE_READS}\n${STAGE_READS}\n`,
    },
    expectedTag: "v6.1.0",
    expectedUsages: 3,
    reason:
      "The proof workflow restores the prepared acceptance runtime only by its exact key, the hash of everything that state depends on, so a changed input never reuses it; its spec machines refuse a miss. The deploy job restores the newest Convex reads that a deploy of the same stage kept, the same release first: every store entry is keyed by what its answer depends on, so the cache key names the stage and the release alone, never the code or the dependencies, which would read the whole release again (docs/convex/cost.md, Deploy reads).",
  },
  {
    action: "actions/cache/save",
    alternativeInputs: [
      {
        key: `prepared-${expression("steps.key.outputs.key")}`,
        path: PREPARED_PATHS,
      },
    ],
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedInputs: {
      key: expression("steps.reads.outputs.cache-primary-key"),
      path: ".cache/reads",
    },
    expectedTag: "v6.1.0",
    expectedUsages: 2,
    reason:
      "The proof workflow saves a prepared acceptance runtime it had to prepare, under its exact key. The deploy job saves the Convex reads it added under its own run's key, so the next deploy of the release restores them (docs/convex/cost.md, Deploy reads).",
  },
  {
    action: "actions/upload-artifact",
    approvedSha: "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    expectedTag: "v7.0.2",
    expectedUsages: 7,
    reason:
      "Separated CLI artifacts use the reviewed release, and the proof workflow hands its build to the spec machines and keeps each engine's shard result and the failure traces.",
  },
  {
    action: "actions/download-artifact",
    approvedSha: "9000827ccba6bdab643e8b6fd33ac0654aef8333",
    expectedTag: "v8.0.2",
    expectedUsages: 5,
    reason:
      "CLI publishing and verification download separated artifacts, a proof's spec machines download its build, and its report collects the shard results.",
  },
  {
    action: "actions/setup-node",
    approvedSha: "949feb2413d6458794dcd2491c4babbbce0c15c1",
    expectedInputs: {
      "node-version": NODE_RUNTIME_VERSION,
      "package-manager-cache": "false",
    },
    expectedTag: "v7.1.0",
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

/**
 * The input problems of one use: none when its inputs are exactly one of the
 * review's alternative sets, otherwise those against the expected set.
 */
function reviewedInputProblems(
  use: GithubActionUse,
  action: string,
  expectedInputs: Readonly<Record<string, string>>,
  alternativeInputs: readonly Readonly<Record<string, string>>[]
) {
  const alternative = Arr.some(
    alternativeInputs,
    (inputs) => inputProblems(use, action, inputs).length === 0
  );
  return alternative ? [] : inputProblems(use, action, expectedInputs);
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
          ? reviewedInputProblems(
              use,
              parsed.action,
              review.expectedInputs,
              review.alternativeInputs ?? []
            )
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
