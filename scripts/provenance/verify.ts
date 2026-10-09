import { Array as Arr, Effect, Schema } from "effect";
import { ProvenanceBundleVerifier } from "#scripts/provenance/bundle";
import {
  AuditSchema,
  type ProvenanceExpectation,
  ProvenanceStatementSchema,
  ProvenanceVerificationError,
  SLSA_PREDICATE,
} from "#scripts/provenance/schema";

/** Builds the exact npm registry attestation endpoint for one package version. */
function expectedAttestationUrl(expectation: ProvenanceExpectation) {
  const encodedName = expectation.packageName.replace("/", "%2f");
  return `https://registry.npmjs.org/-/npm/v1/attestations/${encodedName}@${expectation.packageVersion}`;
}

/** Builds the canonical scoped npm package URL signed in the SLSA subject. */
function expectedPackageUrl(expectation: ProvenanceExpectation) {
  return `pkg:npm/${expectation.packageName.replace("@", "%40")}@${expectation.packageVersion}`;
}

/** Verifies npm audit state, the signer certificate, and the signed SLSA statement. */
export const verifyProvenance = Effect.fn("Provenance.verify")(function* (
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
  const publications = Arr.filter(
    audit.verified,
    (entry) =>
      entry.name === expectation.packageName &&
      entry.version === expectation.packageVersion &&
      entry.attestations.url === expectedUrl &&
      entry.attestations.provenance.predicateType === SLSA_PREDICATE
  );
  const [publication] = publications;
  if (publications.length !== 1 || !publication) {
    return yield* new ProvenanceVerificationError({
      message: "The npm audit does not contain one exact package publication.",
    });
  }

  const bundles = Arr.filter(
    publication.attestationBundles,
    ({ predicateType }) => predicateType === SLSA_PREDICATE
  );
  const [bundle] = bundles;
  if (bundles.length !== 1 || !bundle) {
    return yield* new ProvenanceVerificationError({
      message: "The npm audit does not contain one exact SLSA bundle.",
    });
  }

  const verifier = yield* ProvenanceBundleVerifier;
  const payload = yield* verifier.verify(bundle.bundle, expectation);
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
  const {
    externalParameters: { workflow },
    resolvedDependencies,
  } = statement.predicate.buildDefinition;
  const [dependency] = resolvedDependencies;
  const expectedDependency = `git+${expectation.repository}@${expectation.ref}`;

  if (
    statement.subject.length !== 1 ||
    subject?.name !== expectedPackageUrl(expectation) ||
    subject.digest.sha512 !== expectation.packageSha512 ||
    workflow.repository !== expectation.repository ||
    workflow.path !== expectation.workflow ||
    workflow.ref !== expectation.ref ||
    resolvedDependencies.length !== 1 ||
    dependency?.uri !== expectedDependency ||
    dependency.digest.gitCommit !== expectation.sourceSha
  ) {
    return yield* new ProvenanceVerificationError({
      message:
        "The authenticated SLSA statement does not match the exact release.",
    });
  }
});
