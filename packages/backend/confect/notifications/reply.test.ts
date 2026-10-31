import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";

/** Noon in Jakarta, outside quiet hours. */
const NOON = Date.UTC(2026, 8, 1, 5);
/** 22:00 in Jakarta, inside quiet hours. */
const NIGHT = Date.UTC(2026, 8, 1, 15);
const SLUG = "articles/example";
const SEND = "notifications/deliver:send";
const page = { paginationOpts: { cursor: null, numItems: 10 } };
const list = Ref.getFunctionReference(refs.public.notifications.inbox.list);
const read = Ref.getFunctionReference(refs.public.notifications.inbox.read);
const readAll = Ref.getFunctionReference(
  refs.public.notifications.inbox.readAll
);
const notice = Ref.getFunctionReference(
  refs.internal.notifications.deliver.notice
);

/** A learner who comments and one who replies, each with the client that acts as them. */
async function createLearners() {
  const t = createConvexTestWithBetterAuth();
  const [author, reader] = await t.mutation(async (ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOON, suffix: "reply-author" }),
      seedAuthenticatedUser(ctx, { now: NOON, suffix: "reply-reader" }),
    ])
  );
  const as = (learner: typeof author) =>
    t.withIdentity({
      subject: learner.authUserId,
      sessionId: learner.sessionId,
    });
  return {
    author: { client: as(author), userId: author.userId },
    reader: { client: as(reader), userId: reader.userId },
    t,
  };
}

type Learners = Awaited<ReturnType<typeof createLearners>>;

/** The rows the database holds for one account. */
const rowsOf = (t: Learners["t"], userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_recipientUserId_and_createdAt", (query) =>
        query.eq("recipientUserId", userId)
      )
      .collect()
  );

/** The push sends that the deployment has scheduled, with when each one runs. */
const scheduledSends = (t: Learners["t"]) =>
  t.run(async (ctx) =>
    Arr.filter(
      await ctx.db.system.query("_scheduled_functions").collect(),
      (job) => job.name === SEND
    )
  );

/** Subscribes one account's browser to push. */
const subscribe = (t: Learners["t"], userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db.insert("pushSubscriptions", {
      auth: "auth",
      createdAt: NOON,
      endpoint: "https://push.example.test/learner",
      p256dh: "key",
      userId,
    })
  );

/** A top-level comment by the author, and the reader's reply to it. */
async function reply({ author, reader }: Learners) {
  const parentId = await author.client.mutation(
    api.comments.mutations.addComment,
    { slug: SLUG, text: "Question" }
  );
  const replyId = await reader.client.mutation(
    api.comments.mutations.addComment,
    { parentId, slug: SLUG, text: "Answer" }
  );
  return { parentId, replyId };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notifications/reply", () => {
  it("writes one row for a reply, addressed to the author of the comment it answers", async () => {
    const learners = await createLearners();
    const { replyId } = await reply(learners);

    expect(await rowsOf(learners.t, learners.author.userId)).toMatchObject([
      {
        changeType: "comment.replied",
        commentId: replyId,
        recipientUserId: learners.author.userId,
      },
    ]);
    expect(await rowsOf(learners.t, learners.reader.userId)).toEqual([]);
  });

  it("writes no row for a top-level comment or for a reply to your own comment", async () => {
    const { author, t } = await createLearners();
    const parentId = await author.client.mutation(
      api.comments.mutations.addComment,
      { slug: SLUG, text: "Question" }
    );
    await author.client.mutation(api.comments.mutations.addComment, {
      parentId,
      slug: SLUG,
      text: "A follow-up",
    });

    expect(await rowsOf(t, author.userId)).toEqual([]);
  });

  it("names who replied in the Nakafa inbox, and never inside a school", async () => {
    const learners = await createLearners();
    const { replyId } = await reply(learners);
    const { author } = learners;

    const nakafa = await author.client.query(list, { ...page, personal: true });
    expect(nakafa.page).toMatchObject([
      {
        actor: { name: expect.any(String) },
        changeType: "comment.replied",
        commentId: replyId,
      },
    ]);
    expect((await author.client.query(list, page)).page).toEqual([]);
  });

  it("marks a reply read once, and refuses another account", async () => {
    const learners = await createLearners();
    await reply(learners);
    const { author, reader, t } = learners;
    const [row] = await rowsOf(t, author.userId);
    if (row === undefined) {
      throw new Error("The reply wrote no row.");
    }
    const notificationId = row._id;

    expect(
      await reader.client
        .mutation(read, { notificationId })
        .catch((error: unknown) => error)
    ).toMatchObject({
      data: { _tag: "NotificationNotFound" },
    });
    const first = await author.client.mutation(read, { notificationId });
    expect(first.readAt).toEqual(expect.any(Number));
    vi.setSystemTime(NOON + 60_000);
    const second = await author.client.mutation(read, { notificationId });
    expect(second.readAt).toBe(first.readAt);
  });

  it("marks every row of the account read through a read-all that asks for them", async () => {
    const learners = await createLearners();
    await reply(learners);
    const { author, t } = learners;
    vi.setSystemTime(NOON + 1000);

    await author.client.mutation(readAll, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await rowsOf(t, author.userId))[0]?.readAt).toBeUndefined();

    await author.client.mutation(readAll, { personal: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await rowsOf(t, author.userId))[0]?.readAt).toBeGreaterThan(NOON);
  });

  it("removes the row of a deleted reply", async () => {
    const learners = await createLearners();
    const { replyId } = await reply(learners);
    const { author, reader, t } = learners;

    await reader.client.mutation(api.comments.mutations.deleteComment, {
      commentId: replyId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await rowsOf(t, author.userId)).toEqual([]);
  });

  it("shows no author for a row whose reply is gone", async () => {
    const learners = await createLearners();
    const { replyId } = await reply(learners);
    const { author, t } = learners;
    await t.run((ctx) => ctx.db.delete(replyId));

    const answer = await author.client.query(list, {
      ...page,
      personal: true,
    });
    expect(answer.page).toMatchObject([{ actor: null }]);
  });

  it("pushes at once to a browser the account subscribed, and not to an account with none", async () => {
    const learners = await createLearners();
    await reply(learners);
    const { author, t } = learners;
    expect(await scheduledSends(t)).toEqual([]);

    await subscribe(t, author.userId);
    await reply(learners);
    const sends = await scheduledSends(t);
    expect(sends).toHaveLength(1);
    expect(sends[0]?.scheduledTime).toBeLessThan(NOON + 1000);
  });

  it("holds a student's push until quiet hours end on the clock of Indonesia", async () => {
    const learners = await createLearners();
    const { author, t } = learners;
    await subscribe(t, author.userId);
    await t.run((ctx) => ctx.db.patch(author.userId, { role: "student" }));
    vi.setSystemTime(NIGHT);

    await reply(learners);

    const sends = await scheduledSends(t);
    expect(sends[0]?.scheduledTime).toBe(Date.UTC(2026, 8, 1, 23));
  });

  it("sends the general sentence in Indonesian, to the browsers of the account", async () => {
    const learners = await createLearners();
    await reply(learners);
    const { author, t } = learners;
    await subscribe(t, author.userId);
    const [row] = await rowsOf(t, author.userId);
    if (row === undefined) {
      throw new Error("The reply wrote no row.");
    }

    const answer = await t.query(notice, { notificationId: row._id });

    expect(answer?.targets).toHaveLength(1);
    expect(answer?.payload).toContain("Ada yang membalas komentarmu.");
  });
});
