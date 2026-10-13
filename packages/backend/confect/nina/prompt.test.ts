import { Ref } from "@confect/core";
import { saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import {
  args,
  cancel,
  contextFor,
  fixture,
  NOW,
  start,
} from "@repo/backend/test/nina/admission";
import { oldPage } from "@repo/backend/test/nina/legacy";
import { homePage } from "@repo/backend/test/nina/page";
import { Array as Arr } from "effect";

vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));

describe("a retried Nina prompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("rejects retry without a stored conversation before committing a credit hold", async () => {
    const f = await fixture();
    await expect(
      f.owner.mutation(start, { ...args, input: { kind: "retry", order: 0 } })
    ).rejects.toMatchObject({ data: { code: "NINA_RETRY_UNAVAILABLE" } });
    expect(
      await f.t.query((ctx) => ctx.db.query("creditTransactions").collect())
    ).toEqual([]);
  });

  it("retries an owned Agent text prompt without optional file metadata", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    await f.t.mutation(async (ctx) => {
      const saved = await saveMessage(ctx, components.nina, {
        threadId: first.threadId,
        userId: f.identity.userId,
        prompt: "An owned text-only prompt.",
      });
      await ctx.db.patch("ninaTurns", first.turnId, {
        promptMessageId: saved.messageId,
      });
    });
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...args,
        chatId: first.chatId,
        requestId: "retry-text",
        input: { kind: "retry", order: first.order },
      })
    );
    expect(retried.prompt.text).toBe("An owned text-only prompt.");
  });

  it("stores the turn that first asked the question on a retry, even a retry of a retry, and none for a new message", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    const retry = async (requestId: string, order: number) => {
      const receipt = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, {
          ...args,
          chatId: first.chatId,
          requestId,
          input: { kind: "retry", order },
        })
      );
      await f.owner.mutation(cancel, { chatId: first.chatId });
      return receipt;
    };
    const second = await retry("retry-order", first.order);
    const third = await retry("retry-of-retry", second.order);
    const [original, ...retries] = await f.t.query((ctx) =>
      Promise.all(
        Arr.map([first, second, third], ({ turnId }) =>
          ctx.db.get("ninaTurns", turnId)
        )
      )
    );
    expect(original).not.toHaveProperty("retryOf");
    // A retry of a retry names the first asking, not the retry it came from.
    expect(Arr.map(retries, (turn) => turn?.retryOf)).toEqual([
      first.order,
      first.order,
    ]);
  });

  it("names the page a retry comes from when it is not the page the turn was asked on", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    vi.mocked(resolveNinaContext).mockClear();
    vi.mocked(resolveNinaContext).mockReturnValueOnce(contextFor("chat"));
    const page = { locale: "en", slug: "chat" };
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...args,
        chatId: first.chatId,
        requestId: "retry-elsewhere",
        input: { kind: "retry", order: first.order, page },
      })
    );
    expect(vi.mocked(resolveNinaContext)).toHaveBeenCalledOnce();
    expect(vi.mocked(resolveNinaContext)).toHaveBeenLastCalledWith(
      page,
      expect.objectContaining({ _id: f.identity.userId }),
      first.chatId
    );
    const [original, retry] = await f.t.query((ctx) =>
      Promise.all([
        ctx.db.get("ninaTurns", first.turnId),
        ctx.db.get("ninaTurns", retried.turnId),
      ])
    );
    expect(original?.page?.nina.learning.url).toBe(
      "https://nakafa.com/en/home"
    );
    expect(retry?.page?.nina.learning.url).toBe("https://nakafa.com/en/chat");
  });

  it.each([
    ["the page the turn was asked on", { locale: "en", slug: "/home/" }],
    ["no page", undefined],
  ] as const)(
    "keeps the context the turn was asked with when a retry comes from %s",
    async (_case, page) => {
      const f = await fixture();
      const first = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, args)
      );
      await f.owner.mutation(cancel, { chatId: first.chatId });
      vi.mocked(resolveNinaContext).mockClear();
      const retried = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, {
          ...args,
          chatId: first.chatId,
          requestId: "retry-here",
          input: {
            kind: "retry",
            order: first.order,
            ...(page ? { page } : {}),
          },
        })
      );
      expect(resolveNinaContext).not.toHaveBeenCalled();
      const [original, retry] = await f.t.query((ctx) =>
        Promise.all([
          ctx.db.get("ninaTurns", first.turnId),
          ctx.db.get("ninaTurns", retried.turnId),
        ])
      );
      expect(retry?.page).toEqual(original?.page);
      expect(retry?.user).toEqual(original?.user);
    }
  );

  it("retries a saved response without run context only after resolving the current page", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", first.turnId, {
        page: undefined,
        user: undefined,
      })
    );
    const retry = {
      ...args,
      chatId: first.chatId,
      requestId: "saved-prompt-retry",
      input: { kind: "retry", order: first.order },
    };
    await expect(f.owner.mutation(start, retry)).rejects.toMatchObject({
      data: { code: "NINA_RETRY_UNAVAILABLE" },
    });
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...retry,
        input: { ...retry.input, page: args.input.page },
      })
    );
    expect(retried.prompt.text).toBe(args.input.prompt.text);
    expect(vi.mocked(resolveNinaContext)).toHaveBeenLastCalledWith(
      args.input.page,
      expect.objectContaining({ _id: f.identity.userId }),
      first.chatId
    );
  });

  it("gives a retry of a turn stored in the old shape a page without the fields only old turns hold", async () => {
    const f = await fixture();
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, args)
    );
    await f.owner.mutation(cancel, { chatId: first.chatId });
    // The turn was stored before turns stored only what their readers use.
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", first.turnId, { page: oldPage(homePage) })
    );
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await f.owner.mutation(start, {
        ...args,
        chatId: first.chatId,
        requestId: "retry-old",
        input: { kind: "retry", order: first.order },
      })
    );
    const [original, retry] = await f.t.query((ctx) =>
      Promise.all([
        ctx.db.get("ninaTurns", first.turnId),
        ctx.db.get("ninaTurns", retried.turnId),
      ])
    );
    // The retry is a new turn, so it holds the page as a turn holds it now. The
    // turn it asks again stays as it was stored.
    expect(retry?.page).toEqual(homePage);
    expect(original?.page).toEqual(oldPage(homePage));
    expect(retry?.user).toEqual(original?.user);
  });
});
