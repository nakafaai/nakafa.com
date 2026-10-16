import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { NOW, start } from "@repo/backend/test/nina/admission";
import type { FunctionArgs } from "convex/server";

export const save = Ref.getFunctionReference(refs.public.nina.uploads.save);
export const reserve = Ref.getFunctionReference(
  refs.internal.nina.uploads.reserve
);

/** One small image a learner attaches. */
export const attachment = {
  bytes: new TextEncoder().encode("a diagram").buffer,
  mediaType: "image/png",
  filename: "diagram.png",
};

/** The admission of one prompt from the home page, without uploads. */
export const admission = {
  requestId: "first",
  input: {
    kind: "message",
    prompt: { text: "Explain this diagram" },
    page: { locale: "en", slug: "home" },
  },
};

/** The admission of one prompt that sends the given uploads. */
export const sending = <T extends string>(uploadIds: T[]) => ({
  ...admission,
  input: {
    ...admission.input,
    prompt: { ...admission.input.prompt, uploadIds },
  },
});

/** A backend with one signed-in learner who holds ten credits. */
export async function uploadFixture() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return { t, owner, identity };
}

type Owner = Awaited<ReturnType<typeof uploadFixture>>["owner"];

/** Saves a file as a learner does, and returns the upload that holds it. */
export const saved = async (
  owner: Owner,
  args: typeof attachment = attachment
) =>
  Ref.decodeReturnsSync(
    refs.public.nina.uploads.save,
    await owner.action(save, args)
  );

/** Reserves a place for an upload, and returns the upload that holds it. */
export const reserved = async (owner: Owner) =>
  Ref.decodeReturnsSync(
    refs.internal.nina.uploads.reserve,
    await owner.mutation(reserve, {})
  );

/** Starts a turn as a learner does, and returns what the server answered. */
export const started = async (owner: Owner, args: FunctionArgs<typeof start>) =>
  Ref.decodeReturnsSync(
    refs.public.nina.turns.start,
    await owner.mutation(start, args)
  );
