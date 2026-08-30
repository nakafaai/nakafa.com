import { Effect, Schema } from "effect";
import { ProvenanceBundleVerifier } from "#scripts/github/provenance/bundle";
import {
  AuditSchema,
  type ProvenanceExpectation,
  ProvenanceStatementSchema,
  ProvenanceVerificationError,
  SLSA_PREDICATE,
} from "#scripts/github/provenance/schema";

function expectedAttestationUrl(expectation: ProvenanceExpectation) {
  const encodedName = expectation.packageName.replace("/", "%2f");
  return `https://registry.npmjs.org/-/npm/v1/attestations/${encodedName}@${expectation.packageVersion}`;
}

function expectedPackageUrl(expectation: ProvenanceExpectation) {
  return `pkg:npm/${expectation.packageName.replace("@", "%40")}@${expectation.packageVersion}`;
}

/** Verifies npm audit state, the signer certificate, and the signed SLSA statement. */
export const verifyProvenance = Effect.fn("GithubProvenance.verify")(function* (
  source: string,
  expectation: ProvenanceExpectation
) {
  const audit = yield* Schema.decodeEffect(Schema.fromJsonString(AuditSchema))(
    source
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ProvenanceVerificationError({
          cause,
          message: "The npm signature audit is not valid JSON evidence.",
        })
    )
  );
  if (audit.invalid.length > 0 || audit.missing.length > 0) {
    return yield* new ProvenanceVerificationError({
      message: "The npm signature audit contains invalid or missing evidence.",
    });
  }

  const expectedUrl = expectedAttestationUrl(expectation);
  const publications = audit.verified.filter(
    (entry) =>
      entry.name === expectation.packageName &&
      entry.version === expectation.packageVersion &&
      entry.attestations.url === expectedUrl &&
      entry.attestations.provenance.predicateType === SLSA_PREDICATE
  );
  if (publications.length !== 1) {
    return yield* new ProvenanceVerificationError({
      message: "The npm audit does not contain one exact package publication.",
    });
  }

  const bundles = publications[0].attestationBundles.filter(
    ({ predicateType }) => predicateType === SLSA_PREDICATE
  );
  if (bundles.length !== 1) {
    return yield* new ProvenanceVerificationError({
      message: "The npm audit does not contain one exact SLSA bundle.",
    });
  }

  const verifier = yield* ProvenanceBundleVerifier;
  const payload = yield* verifier.verify(bundles[0].bundle, expectation);
  const statement = yield* Schema.decodeEffect(
    Schema.fromJsonString(ProvenanceStatementSchema)
  )(payload).pipe(
    Effect.mapError(
      (cause) =>
        new ProvenanceVerificationError({
          cause,
          message: "The authenticated SLSA statement is invalid.",
        })
    )
  );
  const [subject] = statement.subject;
  const [dependency] = statement.predicate.buildDefinition.resolvedDependencies;
  const workflow =
    statement.predicate.buildDefinition.externalParameters.workflow;
  const expectedDependency = `git+${expectation.repository}@${expectation.ref}`;

  if (
    statement.subject.length !== 1 ||
    subject?.name !== expectedPackageUrl(expectation) ||
    subject.digest.sha512 !== expectation.packageSha512 ||
    workflow.repository !== expectation.repository ||
    workflow.path !== expectation.workflow ||
    workflow.ref !== expectation.ref ||
    statement.predicate.buildDefinition.resolvedDependencies.length !== 1 ||
    dependency?.uri !== expectedDependency ||
    dependency.digest.gitCommit !== expectation.sourceSha
  ) {
    return yield* new ProvenanceVerificationError({
      message:
        "The authenticated SLSA statement does not match the exact release.",
    });
  }
});
