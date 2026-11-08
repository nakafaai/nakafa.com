import { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { ConvexReactClient } from "convex/react";
import { Effect, Schema } from "effect";
import { SyncFailed, type SyncTransport } from "@/lib/editor/session";

/** The Convex calls the sync loop makes, which the editor's React client provides. */
type Client = Pick<ConvexReactClient, "mutation" | "query">;

/** The document an editor syncs, and the school it belongs to. */
const Target = Schema.Struct({
  documentId: Id("editorDocuments"),
  slug: TenantSlug,
});

type Target = typeof Target.Type;

/** The message of a call that failed for a reason the loop does not decide. */
const failed = (reason: string) => new SyncFailed({ reason });

/**
 * The sync transport of one document over the Convex client of the page. Each call sends
 * the arguments as Confect names them and decodes the reply with the Confect function it
 * came from, so the editor reads the same shapes the server writes. A submit's reply carries
 * every outcome the loop decides (`SubmitReply`), so every failure of a call, a refused
 * submit included, becomes `SyncFailed`.
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
      try: () =>
        client.mutation(Ref.getFunctionReference(editors.steps.submit), {
          batch,
          documentId: target.documentId,
          slug: target.slug,
        }),
      catch: () => failed("The changes could not be sent."),
    }).pipe(
      Effect.flatMap((encoded) =>
        Ref.decodeReturns(editors.steps.submit, encoded)
      ),
      Effect.mapError(() => failed("The changes could not be sent."))
    ),
});
