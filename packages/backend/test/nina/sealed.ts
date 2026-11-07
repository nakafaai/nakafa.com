import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { requestFingerprint } from "@repo/backend/confect/nina/fingerprint";
import {
  openFileName,
  sealFileName,
} from "@repo/backend/confect/nina/sealed/file";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import { savePrompt } from "@repo/backend/confect/nina/sealed/save";
import {
  readThread,
  type ThreadRead,
} from "@repo/backend/confect/nina/sealed/thread";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import {
  type createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { BLIND_BYTES } from "@repo/backend/confect/vault/cipher";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { sha256 } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { Base64Url } from "effect/encoding";

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
      ensureLearnerKeys(owner).pipe(
        Effect.flatMap((keys) => savePrompt(ctx, keys, prompt)),
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
      ensureLearnerKeys(owner).pipe(
        Effect.flatMap((keys) => savePrompt(ctx, keys, prompt)),
        Effect.flip,
        Effect.map((failure) => failure._tag),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/**
 * The name a file of `owner` is stored under for `name`, sealed as the upload seals
 * it before the component stores the file, in a mutation of the test deployment.
 */
export function sealedFileNameIn(t: Deployment, owner: Owner, name: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      ensureLearnerKeys(owner).pipe(
        Effect.flatMap((keys) => sealFileName(keys, name)),
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

/** Opens a sealed upload name for `owner`, in a mutation of the test deployment: the name, or the vault's failure. */
export function openedNameIn(t: Deployment, owner: Owner, sealed: string) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      openFileName(readLearnerKeys(owner), sealed).pipe(
        Effect.match({
          onFailure: (failure) => ({
            reason: failure.reason,
            tag: failure._tag,
          }),
          onSuccess: (name) => ({ name }),
        }),
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

/**
 * The unkeyed fingerprint of a request: the SHA-256 of the same JSON that
 * `requestFingerprint` keys, cut to the length of a blind value and written in the same
 * URL-safe Base64. A value stored without a key would hold this one, so a test that
 * compares a stored or computed fingerprint with it fails when the key is removed.
 */
export const unkeyedFingerprint = Effect.fn("test.nina.sealed.unkeyed")(
  function* (chatId: string | null, input: typeof NinaInput.Type) {
    const digest = yield* sha256(
      new TextEncoder().encode(encodeJsonText([chatId, input]))
    );
    return Base64Url.encode(digest.slice(0, BLIND_BYTES));
  }
);

/**
 * The fingerprint that `turns.start` stores for a request of a learner, keyed as the
 * admission keys it, next to the unkeyed fingerprint of the same request, in a mutation
 * of the test deployment.
 */
export function fingerprintsIn(
  t: Deployment,
  learner: Owner,
  input: typeof NinaInput.Type
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      ensureLearnerKeys(learner).pipe(
        Effect.flatMap((keys) =>
          Effect.all({
            keyed: requestFingerprint(keys, null, input),
            unkeyed: unkeyedFingerprint(null, input),
          })
        ),
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}
