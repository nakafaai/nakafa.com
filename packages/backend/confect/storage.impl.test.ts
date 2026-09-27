import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import {
  createThread,
  getFile,
  saveMessage,
  storeFile,
} from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { sweepStorage } from "@repo/backend/confect/storage.impl";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 8, 27);
const DAY = 24 * 60 * 60 * 1000;
const sweep = Ref.getFunctionReference(refs.internal.storage.sweep);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Agent file ownership retention", () => {
  it.each(["runQuery", "runMutation"] as const)(
    "preserves files when the component %s fails",
    async (operation) => {
      const t = createConvexTestWithBetterAuth();
      const file = await t.action(
        async (ctx) =>
          (
            await storeFile(
              ctx,
              components.nina,
              new Blob(["component failure"])
            )
          ).file
      );
      vi.setSystemTime(NOW + DAY + 1);
      await expect(
        t.mutation((ctx) => {
          vi.spyOn(ctx, operation).mockRejectedValueOnce(
            new Error("Component unavailable")
          );
          return Effect.runPromise(
            sweepStorage().pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(schema, ctx)
              )
            )
          );
        })
      ).rejects.toThrow();
      expect(
        await t.query((ctx) =>
          ctx.runQuery(components.nina.files.get, { fileId: file.fileId })
        )
      ).not.toBeNull();
      expect(
        await t.run((ctx) =>
          ctx.storage.get(file.storageId).then((blob) => blob?.text() ?? null)
        )
      ).not.toBeNull();
    }
  );

  it("keeps a blob if the component declines its deletion", async () => {
    const t = createConvexTestWithBetterAuth();
    const file = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["retained"]))).file
    );
    vi.setSystemTime(NOW + DAY + 1);
    const result = await t.mutation((ctx) => {
      vi.spyOn(ctx, "runMutation").mockResolvedValueOnce([]);
      return Effect.runPromise(
        sweepStorage().pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      );
    });
    expect(result).toEqual({ scanned: 1, deleted: 0, done: true });
    expect(
      await t.run((ctx) =>
        ctx.storage.get(file.storageId).then((blob) => blob?.text() ?? null)
      )
    ).not.toBeNull();
  });
  it("reclaims expired unreferenced Agent files and preserves referenced, recent and unknown-owner storage", async () => {
    const t = createConvexTestWithBetterAuth();
    const unused = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["unused"]))).file
    );
    const retained = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["attached"]))).file
    );
    const foreign = await t.run((ctx) =>
      ctx.storage.store(new Blob(["another capability owns this"]))
    );
    await t.mutation(async (ctx) => {
      const threadId = await createThread(ctx, components.nina, {});
      const { filePart } = await getFile(ctx, components.nina, retained.fileId);
      await saveMessage(ctx, components.nina, {
        threadId,
        message: { role: "user", content: [filePart] },
        metadata: { fileIds: [retained.fileId] },
      });
    });
    vi.setSystemTime(NOW + DAY + 1);
    const recent = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["new upload"]))).file
    );
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 1,
      done: true,
      scanned: 1,
    });
    expect(
      await t.run((ctx) =>
        ctx.storage.get(unused.storageId).then((blob) => blob?.text() ?? null)
      )
    ).toBeNull();
    for (const id of [retained.storageId, foreign, recent.storageId]) {
      expect(
        await t.run((ctx) =>
          ctx.storage.get(id).then((blob) => blob?.text() ?? null)
        )
      ).not.toBeNull();
    }
    expect(
      await t.query((ctx) =>
        ctx.runQuery(components.nina.files.get, { fileId: retained.fileId })
      )
    ).toMatchObject({ refcount: 1 });
  });

  it("continues from the first remaining bounded batch after deleting a full page", async () => {
    const t = createConvexTestWithBetterAuth();
    for (let index = 0; index < 18; index += 1) {
      await t.action(
        async (ctx) =>
          (await storeFile(ctx, components.nina, new Blob([`${index}`]))).file
      );
    }
    vi.setSystemTime(NOW + DAY + 1);
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 16,
      done: false,
      scanned: 16,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await t.query((ctx) => ctx.db.system.query("_storage").collect())
    ).toEqual([]);
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 0,
      done: true,
      scanned: 0,
    });
  });

  it("rolls back component deletion when blob deletion fails, then retries safely", async () => {
    const t = createConvexTestWithBetterAuth();
    const file = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["retry"]))).file
    );
    vi.setSystemTime(NOW + DAY + 1);
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.storage, "delete").mockRejectedValueOnce(
          new Error("Storage temporarily unavailable")
        );
        return Effect.runPromise(
          sweepStorage().pipe(
            Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
          )
        );
      })
    ).rejects.toThrow();
    expect(
      await t.query((ctx) =>
        ctx.runQuery(components.nina.files.get, { fileId: file.fileId })
      )
    ).not.toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.storage.get(file.storageId).then((blob) => blob?.text() ?? null)
      )
    ).not.toBeNull();
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 1,
      done: true,
      scanned: 1,
    });
  });

  it("removes an expired component row whose old storage is already missing", async () => {
    const t = createConvexTestWithBetterAuth();
    const file = await t.action(
      async (ctx) =>
        (await storeFile(ctx, components.nina, new Blob(["lost previously"])))
          .file
    );
    await t.mutation((ctx) => ctx.storage.delete(file.storageId));
    vi.setSystemTime(NOW + DAY + 1);
    expect(await t.mutation(sweep, {})).toEqual({
      deleted: 1,
      done: true,
      scanned: 1,
    });
    expect(
      await t.query((ctx) =>
        ctx.runQuery(components.nina.files.get, { fileId: file.fileId })
      )
    ).toBeNull();
  });
});
