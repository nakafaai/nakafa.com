import { Schema } from "effect";

export const SLSA_PREDICATE = "https://slsa.dev/provenance/v1";
export const GITHUB_BUILD_TYPE =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
export const GITHUB_BUILDER = "https://github.com/actions/runner/github-hosted";

const GitSha = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/u));
const Sha512 = Schema.String.check(Schema.isPattern(/^[a-f0-9]{128}$/u));
const Version = Schema.String.check(
  Schema.isPattern(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u)
);
const PackageName = Schema.String.check(
  Schema.isPattern(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/u)
);
const Repository = Schema.String.check(
  Schema.isPattern(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
);
const Workflow = Schema.String.check(
  Schema.isPattern(/^\.github\/workflows\/[a-z0-9-]+\.yml$/u)
);

export const PublisherIdentity = Schema.Struct({
  environment: Schema.Literal("npm-production"),
  ref: Schema.Literal("refs/heads/main"),
  repository: Repository,
  sourceSha: GitSha,
  workflow: Workflow,
});
export type PublisherIdentity = Schema.Schema.Type<typeof PublisherIdentity>;

export const ProvenanceExpectation = Schema.Struct({
  ...PublisherIdentity.fields,
  packageName: PackageName,
  packageSha512: Sha512,
  packageVersion: Version,
});
export type ProvenanceExpectation = Schema.Schema.Type<
  typeof ProvenanceExpectation
>;

export const AuditSchema = Schema.Struct({
  invalid: Schema.Array(Schema.Unknown),
  missing: Schema.Array(Schema.Unknown),
  verified: Schema.Array(
    Schema.Struct({
      attestationBundles: Schema.Array(
        Schema.Struct({
          bundle: Schema.Unknown,
          predicateType: Schema.String,
        })
      ),
      attestations: Schema.Struct({
        provenance: Schema.Struct({ predicateType: Schema.String }),
        url: Schema.String,
      }),
      name: Schema.String,
      version: Schema.String,
    })
  ),
});

export const ProvenanceStatementSchema = Schema.Struct({
  _type: Schema.Literal("https://in-toto.io/Statement/v1"),
  predicate: Schema.Struct({
    buildDefinition: Schema.Struct({
      buildType: Schema.Literal(GITHUB_BUILD_TYPE),
      externalParameters: Schema.Struct({
        workflow: Schema.Struct({
          path: Schema.String,
          ref: Schema.String,
          repository: Schema.String,
        }),
      }),
      resolvedDependencies: Schema.Array(
        Schema.Struct({
          digest: Schema.Struct({ gitCommit: Schema.String }),
          uri: Schema.String,
        })
      ),
    }),
    runDetails: Schema.Struct({
      builder: Schema.Struct({ id: Schema.Literal(GITHUB_BUILDER) }),
    }),
  }),
  predicateType: Schema.Literal(SLSA_PREDICATE),
  subject: Schema.Array(
    Schema.Struct({
      digest: Schema.Struct({ sha512: Schema.String }),
      name: Schema.String,
    })
  ),
});

export const CliArgumentsSchema = Schema.Tuple([
  Schema.String,
  PackageName,
  Version,
  Sha512,
  Repository,
  Workflow,
  PublisherIdentity.fields.ref,
  GitSha,
  PublisherIdentity.fields.environment,
]);

export class ProvenanceVerificationError extends Schema.TaggedError<ProvenanceVerificationError>()(
  "ProvenanceVerificationError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}
