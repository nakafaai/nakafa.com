import { Ref } from "@confect/core";
import { getFile, storeFile, toModelMessage } from "@convex-dev/agent";
import { MINUTE } from "@convex-dev/rate-limiter";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  NINA_FILE_COUNT,
  NINA_FILE_SIZE,
  NINA_FILENAME_LENGTH,
  NINA_UPLOAD_LIFETIME,
} from "@repo/backend/client/nina/uploads";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import {
  cancel,
  contextFor,
  NOW,
  start,
} from "@repo/backend/test/nina/admission";
import { sealThreadIn } from "@repo/backend/test/nina/seal";
import {
  admission,
  attachment,
  reserve,
  reserved,
  save,
  saved,
  sending,
  started,
  uploadFixture,
} from "@repo/backend/test/nina/uploads";
import { Duration } from "effect";

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
const release = Ref.getFunctionReference(refs.public.nina.uploads.release);
const complete = Ref.getFunctionReference(refs.internal.nina.uploads.complete);
const discard = Ref.getFunctionReference(refs.internal.nina.uploads.discard);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("native Nina attachment ownership", () => {
  it("authenticates before storage and rejects empty or oversized binary payloads", async () => {
    const { t, owner } = await uploadFixture();
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
    const { t, owner, identity } = await uploadFixture();
    const uploadId = await saved(owner);
    const grant = await t.query((ctx) => ctx.db.get("ninaUploads", uploadId));
    if (grant?.state.status !== "ready") {
      throw new Error("Expected ready upload");
    }
    const fileId = grant.state.fileId;
    const args = sending([uploadId]);
    const first = await started(owner, args);
    const repeated = await started(owner, args);
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
    expect(state.user?.credits).toBe(5);
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
    const { t, owner, identity } = await uploadFixture();
    const uploadId = await saved(owner);
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
    );
    const stranger = t.withIdentity({
      subject: other.authUserId,
      sessionId: other.sessionId,
    });
    const args = sending([uploadId]);
    await expect(stranger.mutation(start, args)).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_INVALID" },
    });
    await expect(
      owner.mutation(start, sending([uploadId, uploadId]))
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
    const { t, owner } = await uploadFixture();
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
    const { t, owner, identity } = await uploadFixture();
    const uploadId = await reserved(owner);
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
    const { t, owner } = await uploadFixture();
    const uploadId = await saved(owner);
    const first = await started(owner, sending([uploadId]));
    await owner.mutation(cancel, { chatId: first.chatId });
    vi.mocked(resolveNinaContext).mockClear();
    const second = await started(owner, {
      requestId: "retry",
      chatId: first.chatId,
      input: { kind: "retry", order: first.order },
    });
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
        chatId: first.chatId,
        input: { kind: "retry", order: 999 },
      })
    ).rejects.toMatchObject({ data: { code: "NINA_RETRY_UNAVAILABLE" } });
  });
  it("retries a sealed prompt with its attachment as a plain prompt does", async () => {
    /** The retry of a prompt with an image, with the chat plain, or sealed in place once the prompt is asked. */
    const retried = async (sealed: boolean) => {
      const { t, owner, identity } = await uploadFixture();
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
      if (sealed) {
        await sealThreadIn(t, first.threadId, identity.userId);
      }
      const second = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await owner.mutation(start, {
          requestId: "retry",
          chatId: first.chatId,
          input: { kind: "retry", order: first.order },
        })
      );
      return { order: second.order, prompt: second.prompt };
    };
    const plain = await retried(false);
    const sealed = await retried(true);
    expect(sealed).toEqual(plain);
    expect(sealed.prompt.files).toEqual([
      expect.objectContaining({ type: "file", mediaType: "image/png" }),
    ]);
  });

  it("limits repeated discarded uploads without counting them as pending files", async () => {
    const f = await uploadFixture();
    for (let i = 0; i < NINA_FILE_COUNT; i += 1) {
      const uploadId = await reserved(f.owner);
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
    const f = await uploadFixture();
    const uploadId = await saved(f.owner);
    const args = sending([uploadId]);
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
    const f = await uploadFixture();
    const uploadId = await saved(f.owner, {
      ...attachment,
      mediaType: "application/pdf",
      filename: "exam.pdf",
    });
    const result = await started(f.owner, sending([uploadId]));
    expect(result.prompt.files).toEqual([
      expect.objectContaining({
        type: "file",
        mediaType: "application/pdf",
        filename: "exam.pdf",
      }),
    ]);
  });

  it("gives back the place of an upload the learner will not send", async () => {
    const f = await uploadFixture();
    const uploadId = await saved(f.owner);
    for (let count = 1; count < NINA_FILE_COUNT; count += 1) {
      await f.owner.mutation(reserve, {});
    }
    await expect(f.owner.mutation(reserve, {})).rejects.toMatchObject({
      data: { code: "NINA_UPLOAD_LIMIT" },
    });

    await expect(f.owner.mutation(release, { uploadId })).resolves.toBeNull();

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).toBeNull();
    // The quota gives one place back every MINUTE / NINA_FILE_COUNT, so once it
    // has, only the pending count is left to refuse the next upload.
    vi.setSystemTime(NOW + MINUTE / NINA_FILE_COUNT + 1);
    await expect(f.owner.mutation(reserve, {})).resolves.toBeDefined();
    await expect(f.owner.mutation(release, { uploadId })).rejects.toMatchObject(
      { data: { code: "NINA_UPLOAD_INVALID" } }
    );
  });

  it("keeps an upload for the lifetime that a page reads from the client contract", async () => {
    const f = await uploadFixture();
    const uploadId = await reserved(f.owner);

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).toMatchObject({
      expiresAt: NOW + Duration.toMillis(NINA_UPLOAD_LIFETIME),
    });
  });

  it("counts the characters of a file name by code point, so the longest name may be all emoji", async () => {
    const f = await uploadFixture();
    // Each emoji takes two UTF-16 units, so the longest name is twice as long
    // in units as in characters.
    const longest = "🎉".repeat(NINA_FILENAME_LENGTH);

    const uploadId = await saved(f.owner, {
      ...attachment,
      filename: longest,
    });
    await expect(
      f.owner.action(save, { ...attachment, filename: `${longest}🎉` })
    ).rejects.toThrow();

    expect(
      await f.t.query((ctx) => ctx.db.query("ninaUploads").collect())
    ).toMatchObject([{ _id: uploadId, state: { status: "ready" } }]);
  });

  it("refuses a signed-out caller and another learner's upload, and keeps the upload", async () => {
    const f = await uploadFixture();
    const uploadId = await saved(f.owner);
    const other = await f.t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
    );
    const stranger = f.t.withIdentity({
      subject: other.authUserId,
      sessionId: other.sessionId,
    });

    await expect(f.t.mutation(release, { uploadId })).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    });
    await expect(
      stranger.mutation(release, { uploadId })
    ).rejects.toMatchObject({ data: { code: "NINA_UPLOAD_INVALID" } });

    expect(
      await f.t.query((ctx) => ctx.db.get("ninaUploads", uploadId))
    ).toMatchObject({ userId: f.identity.userId });
  });

  it("refuses an upload that a sent message took, and leaves the message with its file", async () => {
    const f = await uploadFixture();
    const uploadId = await saved(f.owner);
    const grant = await f.t.query((ctx) => ctx.db.get("ninaUploads", uploadId));
    if (grant?.state.status !== "ready") {
      throw new Error("Expected ready upload");
    }
    const fileId = grant.state.fileId;
    const sent = await started(f.owner, sending([uploadId]));

    await expect(f.owner.mutation(release, { uploadId })).rejects.toMatchObject(
      { data: { code: "NINA_UPLOAD_INVALID" } }
    );

    const state = await f.t.query(async (ctx) => ({
      file: await ctx.runQuery(components.nina.files.get, { fileId }),
      prompt: await ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [sent.promptMessageId],
      }),
    }));
    expect(state.file).toMatchObject({ refcount: 1 });
    expect(state.prompt[0]).toMatchObject({ fileIds: [fileId] });
  });

  it("rejects a retry whose original prompt cannot be read instead of sending a new or foreign prompt", async () => {
    const f = await uploadFixture();
    const first = await started(f.owner, admission);
    await f.owner.mutation(cancel, { chatId: first.chatId });
    const retry = {
      requestId: "retry-error",
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
