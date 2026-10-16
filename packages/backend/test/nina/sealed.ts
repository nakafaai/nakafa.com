import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { readFile } from "@repo/backend/confect/nina/sealed/file";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import {
  readThread,
  type ThreadRead,
} from "@repo/backend/confect/nina/sealed/thread";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

/** A test deployment of the backend, as the sealed reads are run against it. */
type Deployment = ReturnType<typeof createConvexTestWithBetterAuth>;
/** The learner whose key opens the rows a read names. */
type Owner = ThreadRead["owner"];

/** Reads one page of a thread, opened, in a mutation of the test deployment. */
export function readThreadIn(t: Deployment, read: ThreadRead) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readThread(ctx, read).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** The tag of the failure that a page read of a thread gives. */
export function threadFailureIn(t: Deployment, read: ThreadRead) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readThread(ctx, read).pipe(
        Effect.flip,
        Effect.map((failure) => failure._tag),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** Reads one message of a thread, opened for `owner`, in a mutation of the test deployment. */
export function readMessageIn(t: Deployment, owner: Owner, messageId: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readMessage(ctx, owner, messageId).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** The tag of the failure that a read of one message gives. */
export function messageFailureIn(
  t: Deployment,
  owner: Owner,
  messageId: string
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readMessage(ctx, owner, messageId).pipe(
        Effect.flip,
        Effect.map((failure) => failure._tag),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/**
 * Reads one stored file, in a mutation of the test deployment, and returns the
 * name and the part a model reads. A URL is not a Convex value, so the part
 * keeps its name, its media type and its kind only.
 */
export function readFileIn(t: Deployment, fileId: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readFile(ctx, fileId).pipe(
        Effect.map((saved) => ({
          filename: saved.file.filename,
          filePart: {
            filename: saved.filePart.filename,
            mediaType: saved.filePart.mediaType,
            type: saved.filePart.type,
          },
        })),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** The tag of the failure that a read of one file gives. */
export function fileFailureIn(t: Deployment, fileId: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readFile(ctx, fileId).pipe(
        Effect.flip,
        Effect.map((failure) => failure._tag),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** Runs one sealed read of an action of the test deployment, with the query runner of the action. */
export function inAction<A, E>(
  t: Deployment,
  body: Effect.Effect<A, E, QueryRunner>
) {
  return t.action((ctx) =>
    Effect.runPromise(
      body.pipe(Effect.provide(RegisteredFunction.actionLayer(schema, ctx)))
    )
  );
}
