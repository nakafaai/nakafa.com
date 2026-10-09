import { Ref } from "@confect/core";
import { getFile, storeFile, toModelMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import {
  NINA_FILE_COUNT,
  NINA_FILE_SIZE,
} from "@repo/backend/confect/nina/uploads.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { DateTime, Effect } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));
vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return {
    ...actual,
    getFile: vi.fn(actual.getFile),
    toModelMessage: vi.fn(actual.toModelMessage),
    storeFile: vi.fn(actual.storeFile),
  };
});
const NOW = Date.UTC(2026, 8, 27, 12);
const save = Ref.getFunctionReference(refs.public.nina.uploads.save);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const reserve = Ref.getFunctionReference(refs.internal.nina.uploads.reserve);
const complete = Ref.getFunctionReference(refs.internal.nina.uploads.complete);
const discard = Ref.getFunctionReference(refs.internal.nina.uploads.discard);
const attachment = {
  bytes: new TextEncoder().encode("a diagram").buffer,
  mediaType: "image/png",
  filename: "diagram.png",
};
const admission = {
  requestId: "first",
  modelId: "nakafa-lite",
  input: {
    kind: "message",
    prompt: { text: "Explain this diagram" },
    page: { locale: "en", slug: "home" },
  },
};

async function fixture() {
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(
    openNinaLearningSession({
      capturedAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
      source: "current-page",
      learning: {
        locale: "en",
        slug: "home",
        url: "https://nakafa.com/en/home",
        verified: false,
      },
    }).pipe(
      Effect.orDie,
      Effect.map((session) => ({
        page: {
          locale: "en" as const,
          slug: "home",
          url: "https://nakafa.com/en/home",
          verified: false,
          needsFetch: false,
          nina: session.context,
        },
        user: {},
      }))
    )
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("native Nina attachment ownership", () => {
  it("authenticates before storage and rejects empty or oversized binary payloads", async () => {
    const { t, owner } = await fixture();
    await expect(t.action(save, attachment)).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    });
    for (const bytes of [
      new ArrayBuffer(0),
      new ArrayBuffer(NINA_FILE_SIZE + 1),
    ]) {
      await expect(
        owner.action(save, { ...attachment, bytes })
      ).rejects.toMatchObject({ data: { code: "NINA_UPLOAD_INVALID" } });
    }
    expect(storeFile).not.toHaveBeenCalled();
    expect(
      await t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toEqual([]);
  });

  it("saves original bytes with the SDK and atomically transfers the owned grant to the prompt", async () => {
    const { t, owner, identity } = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await owner.action(save, attachment)
    );
    const grant = await t.query((ctx) => ctx.db.get("ninaUploads", uploadId));
    if (grant?.state.status !== "ready") {
      throw new Error("Expected ready upload");
    }
    const fileId = grant.state.fileId;
    const args = {
      ...admission,
      input: {
        ...admission.input,
        prompt: { ...admission.input.prompt, uploadIds: [uploadId] },
      },
    };
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    const repeated = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, args)
    );
    expect(repeated).toEqual(first);
    expect(first.prompt.files).toEqual([
      expect.objectContaining({ type: "file", mediaType: "image/png" }),
    ]);
    const state = await t.query(async (ctx) => ({
      grant: await ctx.db.get("ninaUploads", uploadId),
      user: await ctx.db.get("users", identity.userId),
      file: await ctx.runQuery(components.nina.files.get, { fileId }),
      prompt: await ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [first.promptMessageId],
      }),
    }));
    expect(state.grant).toBeNull();
    expect(state.user?.credits).toBe(8);
    expect(state.file).toMatchObject({ refcount: 1, mediaType: "image/png" });
    expect(state.prompt[0]).toMatchObject({
      fileIds: [fileId],
      message: {
        role: "user",
        content: [
          { type: "text", text: admission.input.prompt.text },
          expect.objectContaining({ type: "image", mediaType: "image/png" }),
        ],
      },
    });
    expect(storeFile).toHaveBeenCalledOnce();
  });

  it("rejects another owner's grant, duplicates, and expiry without consuming credits or the original upload", async () => {
    const { t, owner, identity } = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await owner.action(save, attachment)
    );
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
    );
    const stranger = t.withIdentity({
      subject: other.authUserId,
      sessionId: other.sessionId,
    });
    const args = {
      ...admission,
      input: {
        ...admission.input,
        prompt: { ...admission.input.prompt, uploadIds: [uploadId] },
      },
    };
    await expect(stranger.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_INVALID" },
    });
    await expect(
      owner.mutation(start, {
        ...args,
        input: {
          ...args.input,
          prompt: { ...args.input.prompt, uploadIds: [uploadId, uploadId] },
        },
      })
    ).rejects.toMatchObject({ data: { code: "NINA_UPLOAD_INVALID" } });
    await t.mutation((ctx) =>
      ctx.db.patch("ninaUploads", uploadId, { expiresAt: NOW })
    );
    await expect(owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_INVALID" },
    });
    expect(
      await t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).not.toBeNull();
    expect(
      await t.query((ctx) => ctx.db.get("users", identity.userId))
    ).toMatchObject({ credits: 10 });
    expect(
      await t.query((ctx) => ctx.db.query("creditTransactions").collect())
    ).toEqual([]);
  });

  it("retires a failed upload reservation and bounds pending uploads per account", async () => {
    const { t, owner } = await fixture();
    vi.mocked(storeFile).mockRejectedValueOnce(
      new Error("Storage unavailable")
    );
    await expect(owner.action(save, attachment)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_FAILED" },
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toEqual([]);
    vi.setSystemTime(NOW + 60_000);
    for (let count = 0; count < NINA_FILE_COUNT; count += 1) {
      await owner.mutation(reserve, {});
    }
    await expect(owner.mutation(reserve, {})).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_LIMIT" },
    });
    expect(
      await t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toHaveLength(NINA_FILE_COUNT);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toEqual([]);
  });

  it("does not complete expired or account-deleted grants and discards them idempotently", async () => {
    const { t, owner, identity } = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.internal.nina.uploads.reserve,
      await owner.mutation(reserve, {})
    );
    await t.mutation((ctx) =>
      ctx.db.patch("ninaUploads", uploadId, { expiresAt: NOW })
    );
    await expect(
      owner.mutation(complete, { uploadId, fileId: "unclaimed" })
    ).rejects.toMatchObject({ data: { code: "NINA_UPLOAD_INVALID" } });
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, { deletedAt: NOW })
    );
    await expect(
      owner.mutation(complete, { uploadId, fileId: "unclaimed" })
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await t.mutation(discard, { uploadId });
    await t.mutation(discard, { uploadId });
    expect(
      await t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).toBeNull();
  });

  it("retries only an owned stored prompt and reuses its file references and context", async () => {
    const { t, owner } = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await owner.action(save, attachment)
    );
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        ...admission,
        input: {
          ...admission.input,
          prompt: { ...admission.input.prompt, uploadIds: [uploadId] },
        },
      })
    );
    await owner.mutation(cancel, { chatId: first.chatId });
    vi.mocked(resolveNinaContext).mockClear();
    const second = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        requestId: "retry",
        modelId: "nakafa-lite",
        chatId: first.chatId,
        input: { kind: "retry", order: first.order },
      })
    );
    expect(second.prompt).toEqual(first.prompt);
    expect(second.order).toBeGreaterThan(first.order);
    expect(resolveNinaContext).not.toHaveBeenCalled();
    const [original, retry] = await t.query((ctx) =>
      ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [first.promptMessageId, second.promptMessageId],
      })
    );
    expect(retry?.message).toEqual(original?.message);
    expect(retry?.fileIds).toEqual(original?.fileIds);
    const fileId = original?.fileIds?.[0];
    if (!fileId) {
      throw new Error("Expected referenced file");
    }
    expect(
      await t.query((ctx) =>
        ctx.runQuery(components.nina.files.get, { fileId })
      )
    ).toMatchObject({ refcount: 2 });
    await owner.mutation(cancel, { chatId: first.chatId });
    await expect(
      owner.mutation(start, {
        requestId: "missing",
        modelId: "nakafa-lite",
        chatId: first.chatId,
        input: { kind: "retry", order: 999 },
      })
    ).rejects.toMatchObject({ data: { code: "NINA_RETRY_UNAVAILABLE" } });
  });
  it("limits repeated discarded uploads without counting them as pending files", async () => {
    const f = await fixture();
    for (let i = 0; i < NINA_FILE_COUNT; i += 1) {
      const uploadId = Ref.decodeReturnsSync(
        refs.internal.nina.uploads.reserve,
        await f.owner.mutation(reserve, {})
      );
      await f.t.mutation(discard, { uploadId });
    }
    await expect(f.owner.mutation(reserve, {})).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_LIMIT" },
    });
    expect(
      await f.t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toEqual([]);
  });

  it("rejects a deleted grant and rolls back consumption when its component file is unavailable", async () => {
    const f = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await f.owner.action(save, attachment)
    );
    const args = {
      ...admission,
      input: {
        ...admission.input,
        prompt: { ...admission.input.prompt, uploadIds: [uploadId] },
      },
    };
    vi.mocked(getFile).mockRejectedValueOnce(new Error("File unavailable"));
    await expect(f.owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_FAILED" },
    });
    expect(
      await f.t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).not.toBeNull();
    await f.t.mutation(discard, { uploadId });
    await expect(f.owner.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_INVALID" },
    });
    await expect(
      f.owner.mutation(complete, { uploadId, fileId: "missing" })
    ).rejects.toMatchObject({ data: { code: "NINA_UPLOAD_INVALID" } });
    expect(
      (await f.t.query((ctx) => ctx.db.get("users", f.identity.userId)))
        ?.credits
    ).toBe(10);
  });
  it("stores a PDF as a file part without converting it into an image", async () => {
    const f = await fixture();
    const uploadId = Ref.decodeReturnsSync(
      refs.public.nina.uploads.save,
      await f.owner.action(save, {
        ...attachment,
        mediaType: "application/pdf",
        filename: "exam.pdf",
      })
    );
    const result = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...admission,
        input: {
          ...admission.input,
          prompt: { ...admission.input.prompt, uploadIds: [uploadId] },
        },
      })
    );
    expect(result.prompt.files).toEqual([
      expect.objectContaining({
        type: "file",
        mediaType: "application/pdf",
        filename: "exam.pdf",
      }),
    ]);
  });

  it("rejects a retry whose original prompt cannot be read instead of sending a new or foreign prompt", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, admission)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    const retry = {
      requestId: "retry-error",
      modelId: "nakafa-lite",
      chatId: first.chatId,
      input: { kind: "retry", order: first.order },
    };
    vi.mocked(toModelMessage).mockImplementationOnce(() => {
      throw new Error("Unsupported message");
    });
    await expect(f.owner.mutation(start, retry)).rejects.toMatchObject({
      data: { code: "NINA_RETRY_UNAVAILABLE" },
    });
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.updateMessage, {
        messageId: first.promptMessageId,
        patch: { message: { role: "assistant", content: "Not a user prompt" } },
      })
    );
    await expect(f.owner.mutation(start, retry)).rejects.toMatchObject({
      data: { code: "NINA_RETRY_UNAVAILABLE" },
    });
    expect(
      (await f.t.query((ctx) => ctx.db.get("users", f.identity.userId)))
        ?.credits
    ).toBe(10);
  });
});
