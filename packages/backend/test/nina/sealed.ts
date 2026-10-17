import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { readFile } from "@repo/backend/confect/nina/sealed/file";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import { savePrompt } from "@repo/backend/confect/nina/sealed/save";
import {
  readThread,
  type ThreadRead,
} from "@repo/backend/confect/nina/sealed/thread";
import {
  type createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Effect } from "effect";

/** A test deployment of the backend, as the sealed reads are run against it. */
type Deployment = ReturnType<typeof createConvexTestWithBetterAuth>;
/** The learner whose key opens the rows a read names. */
type Owner = ThreadRead["owner"];

/** The moment the sealed tests run at. */
const NOW = Date.UTC(2026, 8, 27, 12);

/** A learner's message to save: the files it carries, its content, and the thread it opens. */
type Prompt = Parameters<typeof savePrompt>[2];

/** Saves a learner's message in a thread, in a mutation of the test deployment, and returns the stored message opened. */
export function savePromptIn(t: Deployment, owner: Owner, prompt: Prompt) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      savePrompt(ctx, owner, prompt).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** The tag of the failure that saving a learner's message gives. */
export function savePromptFailureIn(
  t: Deployment,
  owner: Owner,
  prompt: Prompt
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      savePrompt(ctx, owner, prompt).pipe(
        Effect.flip,
        Effect.map((failure) => failure._tag),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** Creates one learner who has a vault key, and returns the learner's id. */
export function learnerWithKeyIn(t: Deployment, suffix: string) {
  return t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, { now: NOW, suffix });
    await Effect.runPromise(
      ensureLearnerKeys(userId).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    );
    return userId;
  });
}

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
 * Reads one stored file for `owner`, in a mutation of the test deployment, and
 * returns the name and the part a model reads. A URL is not a Convex value, so the
 * part keeps its name, its media type and its kind only.
 */
export function readFileIn(t: Deployment, owner: Owner, fileId: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readFile(ctx, owner, fileId).pipe(
        Effect.map((saved) => ({
          filename: saved.file.filename,
          filePart: {
            filename:
              "filename" in saved.filePart
                ? saved.filePart.filename
                : undefined,
            mediaType: saved.filePart.mediaType,
            type: saved.filePart.type,
          },
        })),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/**
 * The failure of one read of a file for `owner`: its tag, and for a vault failure
 * the reason that the vault gives. A value of the test runs as plain data.
 */
export function fileFailureIn(t: Deployment, owner: Owner, fileId: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      readFile(ctx, owner, fileId).pipe(
        Effect.flip,
        Effect.map((failure) => ({
          reason: failure._tag === "VaultError" ? failure.reason : undefined,
          tag: failure._tag,
        })),
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
