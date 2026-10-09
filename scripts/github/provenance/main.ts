import { Array as Arr, Effect, FileSystem, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import { SigstoreProvenanceBundleVerifierLive } from "#scripts/github/provenance/bundle";
import {
  CliArgumentsSchema,
  ProvenanceVerificationError,
} from "#scripts/github/provenance/schema";
import { verifyProvenance } from "#scripts/github/provenance/verify";
import { writeOutput } from "#scripts/output";

/** Verifies one transported npm signature audit named by CLI arguments. */
export const verifyProvenanceAudit = Effect.fn("GithubProvenance.verifyAudit")(
  function* (argv: readonly string[]) {
    const args = yield* Schema.decodeUnknownEffect(CliArgumentsSchema)(
      argv
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ProvenanceVerificationError({
            cause,
            message: "Provenance verification arguments are invalid.",
          })
      )
    );
    const [
      auditPath,
      packageName,
      packageVersion,
      packageSha512,
      repository,
      workflow,
      ref,
      sourceSha,
      environment,
    ] = args;
    const fileSystem = yield* FileSystem.FileSystem;
    const source = yield* fileSystem.readFileString(auditPath).pipe(
      Effect.mapError(
        (cause) =>
          new ProvenanceVerificationError({
            cause,
            message: "Unable to read the npm signature audit.",
          })
      )
    );
    yield* verifyProvenance(source, {
      environment,
      packageName,
      packageSha512,
      packageVersion,
      ref,
      repository,
      sourceSha,
      workflow,
    });
    yield* writeOutput(
      `Verified ${packageName}@${packageVersion} with exact trusted-publisher provenance.\n`
    );
  }
);

runEntry(
  import.meta.main,
  verifyProvenanceAudit(Arr.drop(process.argv, 2)).pipe(
    Effect.provide(SigstoreProvenanceBundleVerifierLive)
  )
);
