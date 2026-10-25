import { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { VersionStale } from "@repo/backend/confect/editor/batch";
import {
  DocumentInvalid,
  DocumentTooLarge,
} from "@repo/backend/confect/editor/document";
import { ClientTaken, FoldPending } from "@repo/backend/confect/editor/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { ConvexReactClient } from "convex/react";
import { Data, Effect, Option, Schema } from "effect";
import { SyncFailed, type SyncTransport } from "@/lib/editor/session";

/** The Convex calls the sync loop makes, which the editor's React client provides. */
type Client = Pick<ConvexReactClient, "mutation" | "query">;

/** The document an editor syncs, and the school it belongs to. */
const Target = Schema.Struct({
  documentId: Id("editorDocuments"),
  slug: TenantSlug,
});

type Target = typeof Target.Type;

/** The refusals of a submit that the sync loop decides for itself, which pass through as they are. */
const SubmitRefusal = Schema.Union([
  VersionStale,
  ClientTaken,
  DocumentInvalid,
  DocumentTooLarge,
  FoldPending,
]);

/** One refusal of a submit that the loop decides. */
type SubmitRefusal = typeof SubmitRefusal.Type;

/** A submit that Convex rejected before the function answered, such as a lost connection. */
class SubmitRejected extends Data.TaggedError("SubmitRejected")<{
  readonly cause: unknown;
}> {}

/** The message of a call that failed for a reason the loop does not decide. */
const failed = (reason: string) => new SyncFailed({ reason });

/**
 * The sync transport of one document over the Convex client of the page. Each call sends
 * the arguments as Confect names them and decodes the reply with the Confect function it
 * came from, so the editor reads the same shapes the server writes. A refused submit keeps
 * the refusal the loop decides (`VersionStale`, `ClientTaken`, `DocumentInvalid`,
 * `DocumentTooLarge`, `FoldPending`), and every other failure becomes `SyncFailed`.
 */
export const convexTransport = (
  client: Client,
  target: Target
): SyncTransport => ({
  open: (clientId) =>
    Effect.tryPromise({
      try: () =>
        client.query(Ref.getFunctionReference(editors.documents.open), {
          clientId,
          documentId: target.documentId,
          slug: target.slug,
        }),
      catch: () => failed("The document could not be opened."),
    }).pipe(
      Effect.flatMap((encoded) =>
        Ref.decodeReturns(editors.documents.open, encoded)
      ),
      Effect.mapError(() => failed("The document could not be opened."))
    ),
  since: (clientId, version) =>
    Effect.tryPromise({
      try: () =>
        client.query(Ref.getFunctionReference(editors.steps.since), {
          clientId,
          documentId: target.documentId,
          slug: target.slug,
          version,
        }),
      catch: () => failed("The steps could not be read."),
    }).pipe(
      Effect.flatMap((encoded) =>
        Ref.decodeReturns(editors.steps.since, encoded)
      ),
      Effect.mapError(() => failed("The steps could not be read."))
    ),
  submit: (batch) =>
    Effect.tryPromise({
      catch: (cause) => new SubmitRejected({ cause }),
      try: () =>
        client.mutation(Ref.getFunctionReference(editors.steps.submit), {
          batch,
          documentId: target.documentId,
          slug: target.slug,
        }),
    }).pipe(
      Effect.matchEffect({
        onFailure: (rejected) => refusalOf(rejected.cause),
        onSuccess: () => Effect.succeed(null),
      })
    ),
});

/**
 * The typed refusal of a submit that Convex rejected, or `SyncFailed` when the rejection
 * is not one of the refusals the loop decides, or when it did not come from the function.
 */
const refusalOf = (
  cause: unknown
): Effect.Effect<never, SyncFailed | SubmitRefusal> => {
  if (!Ref.isConvexError(cause)) {
    return Effect.fail(failed("The changes could not be sent."));
  }
  return Effect.gen(function* () {
    const decoded = yield* Ref.decodeError(
      editors.steps.submit,
      cause.data
    ).pipe(Effect.mapError(() => failed("The changes could not be sent.")));
    const refusal = Option.filter(decoded, Schema.is(SubmitRefusal));
    if (Option.isNone(refusal)) {
      return yield* failed("The changes could not be sent.");
    }
    return yield* refusal.value;
  });
};
