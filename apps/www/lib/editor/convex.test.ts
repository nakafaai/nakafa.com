import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { VersionStale } from "@repo/backend/confect/editor/batch";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ConvexError } from "convex/values";
import { Effect, Schema } from "effect";
import { convexTransport } from "@/lib/editor/convex";
import { SyncFailed } from "@/lib/editor/session";

const documentId = Schema.decodeUnknownSync(Id("editorDocuments"))("doc-1");
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const target = { documentId, slug };

/** A document that holds no steps yet, as the server encodes it. */
const opened = {
  client: null,
  snapshot: { content: "{}", version: 0 },
  steps: [],
};

/** A fake of the Convex client that the transport calls, with one mock per call. */
const makeClient = () => ({ mutation: vi.fn(), query: vi.fn() });

describe("convexTransport", () => {
  it.effect("opens the document for the session and decodes its snapshot", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.query.mockResolvedValue(opened);

      const reply = yield* convexTransport(client, target).open("client-1");

      expect(reply).toEqual(opened);
      expect(client.query).toHaveBeenCalledWith(
        Ref.getFunctionReference(editors.documents.open),
        { clientId: "client-1", documentId, slug }
      );
    })
  );

  it.effect("reports a failed open as a sync failure", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.query.mockRejectedValue(new Error("offline"));

      const error = yield* convexTransport(client, target)
        .open("client-1")
        .pipe(Effect.flip);

      expect(error).toEqual(
        new SyncFailed({ reason: "The document could not be opened." })
      );
    })
  );

  it.effect(
    "reports an open reply that does not decode as a sync failure",
    () =>
      Effect.gen(function* () {
        const client = makeClient();
        client.query.mockResolvedValue({ unexpected: true });

        const error = yield* convexTransport(client, target)
          .open("client-1")
          .pipe(Effect.flip);

        expect(error).toEqual(
          new SyncFailed({ reason: "The document could not be opened." })
        );
      })
  );

  it.effect("reads the steps after a version and decodes the reply", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.query.mockResolvedValue({ _tag: "behind", client: null });

      const reply = yield* convexTransport(client, target).since("client-1", 4);

      expect(reply).toEqual({ _tag: "behind", client: null });
      expect(client.query).toHaveBeenCalledWith(
        Ref.getFunctionReference(editors.steps.since),
        { clientId: "client-1", documentId, slug, version: 4 }
      );
    })
  );

  it.effect("reports a failed read of the steps as a sync failure", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.query.mockRejectedValue(new Error("offline"));

      const error = yield* convexTransport(client, target)
        .since("client-1", 4)
        .pipe(Effect.flip);

      expect(error).toEqual(
        new SyncFailed({ reason: "The steps could not be read." })
      );
    })
  );

  it.effect("sends a batch to the submit function and returns nothing", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.mutation.mockResolvedValue(null);

      const reply = yield* convexTransport(client, target).submit("batch-text");

      expect(reply).toBeNull();
      expect(client.mutation).toHaveBeenCalledWith(
        Ref.getFunctionReference(editors.steps.submit),
        { batch: "batch-text", documentId, slug }
      );
    })
  );

  it.effect("keeps a refused batch as the refusal the loop decides", () => {
    const client = makeClient();
    const stale = new VersionStale({ baseVersion: 1, head: 2 });
    client.mutation.mockRejectedValue(
      new ConvexError(Schema.encodeSync(VersionStale)(stale))
    );

    return Effect.gen(function* () {
      const error = yield* convexTransport(client, target)
        .submit("batch-text")
        .pipe(Effect.flip);

      expect(error).toEqual(stale);
    });
  });

  it.effect(
    "reports a refusal the loop does not decide as a sync failure",
    () => {
      const client = makeClient();
      const denied = new AccessDenied({
        action: "document.edit",
        reason: "resource",
      });
      client.mutation.mockRejectedValue(
        new ConvexError(Schema.encodeSync(AccessDenied)(denied))
      );

      return Effect.gen(function* () {
        const error = yield* convexTransport(client, target)
          .submit("batch-text")
          .pipe(Effect.flip);

        expect(error).toEqual(
          new SyncFailed({ reason: "The changes could not be sent." })
        );
      });
    }
  );

  it.effect("reports a refusal that does not decode as a sync failure", () =>
    Effect.gen(function* () {
      const client = makeClient();
      client.mutation.mockRejectedValue(
        new ConvexError({ _tag: "VersionStale" })
      );

      const error = yield* convexTransport(client, target)
        .submit("batch-text")
        .pipe(Effect.flip);

      expect(error).toEqual(
        new SyncFailed({ reason: "The changes could not be sent." })
      );
    })
  );

  it.effect(
    "reports a rejection that is not a Convex error as a sync failure",
    () =>
      Effect.gen(function* () {
        const client = makeClient();
        client.mutation.mockRejectedValue(new Error("offline"));

        const error = yield* convexTransport(client, target)
          .submit("batch-text")
          .pipe(Effect.flip);

        expect(error).toEqual(
          new SyncFailed({ reason: "The changes could not be sent." })
        );
      })
  );
});
