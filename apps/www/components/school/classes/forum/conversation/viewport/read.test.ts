import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Deferred, Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  conversationTestFirstPost as firstPost,
  conversationTestSecondPost as secondPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import { ViewportReadError } from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  createAdapters,
  createViewport,
  dispatchMeasure,
  makeMeasurement,
  makePostMeasurement,
  openReadyViewport,
  openTranscript,
  shutdownViewport,
  waitForState,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/read", () => {
  it("keeps detached scroll detached and suppresses duplicate read sync", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openReadyViewport(viewport);
    const detachedView = makePostMeasurement(firstPost._id);
    rig.setMeasurement(detachedView);

    await dispatchMeasure(viewport, detachedView, "scroll");
    await dispatchMeasure(viewport, detachedView, "scroll");
    const state = await waitForState(
      viewport,
      (nextState) => nextState.latestAffinity === "detached"
    );

    expect(state.shouldShowLatestButton).toBe(true);
    await waitForState(viewport, () => rig.readPostIds.length === 2);
    expect(rig.readPostIds).toEqual([secondPost._id, firstPost._id]);
    await shutdownViewport(viewport);
  });

  it("keeps viewport state alive when read sync fails", async () => {
    const rig = createAdapters();
    const viewport = await createViewport({
      ...rig.adapters,
      read: {
        markPostRead: () =>
          Effect.fail(
            new ViewportReadError({
              cause: "test",
              message: "Read sync failed in test.",
            })
          ),
      },
    });

    await openTranscript(viewport);
    await dispatchMeasure(viewport, makeMeasurement());
    const state = await waitForState(
      viewport,
      (nextState) => nextState.lifecycle === "ready"
    );

    expect(state.isAtLatest).toBe(true);
    expect(rig.readPostIds).toEqual([]);
    await shutdownViewport(viewport);
  });

  it("retries the same visible post after failed read sync", async () => {
    const rig = createAdapters();
    const readAttempts: Id<"schoolClassForumPosts">[] = [];
    const viewport = await createViewport({
      ...rig.adapters,
      read: {
        markPostRead: (postId) =>
          Effect.gen(function* () {
            readAttempts.push(postId);

            if (readAttempts.length === 1) {
              return yield* Effect.fail(
                new ViewportReadError({
                  cause: "test",
                  message: "First read sync failed in test.",
                })
              );
            }

            rig.readPostIds.push(postId);
          }),
      },
    });

    await openTranscript(viewport);
    await dispatchMeasure(viewport, makePostMeasurement(firstPost._id));
    await waitForState(viewport, () => readAttempts.length === 1);
    await dispatchMeasure(viewport, makePostMeasurement(firstPost._id));
    await waitForState(viewport, () => rig.readPostIds.length === 1);

    expect(readAttempts).toEqual([firstPost._id, firstPost._id]);
    expect(rig.readPostIds).toEqual([firstPost._id]);
    await shutdownViewport(viewport);
  });

  it("suppresses duplicate read sync while the post is in flight", async () => {
    const rig = createAdapters();
    const readAttempts: Id<"schoolClassForumPosts">[] = [];
    const viewport = await createViewport({
      ...rig.adapters,
      read: {
        markPostRead: (postId) =>
          Effect.gen(function* () {
            readAttempts.push(postId);
            return yield* Effect.never;
          }),
      },
    });

    await openTranscript(viewport);
    await dispatchMeasure(viewport, makePostMeasurement(firstPost._id));
    await waitForState(viewport, () => readAttempts.length === 1);
    await dispatchMeasure(viewport, makePostMeasurement(firstPost._id));

    expect(readAttempts).toEqual([firstPost._id]);
    await shutdownViewport(viewport);
  });

  it("keeps a newer in-flight read marker when an older sync fails", async () => {
    const rig = createAdapters();
    const firstRead = await Effect.runPromise(
      Deferred.make<void, ViewportReadError>()
    );
    const readAttempts: Id<"schoolClassForumPosts">[] = [];
    const viewport = await createViewport({
      ...rig.adapters,
      read: {
        markPostRead: (postId) => {
          readAttempts.push(postId);

          if (postId === firstPost._id) {
            return Deferred.await(firstRead);
          }

          return Effect.never;
        },
      },
    });

    await openTranscript(viewport);
    await dispatchMeasure(viewport, makePostMeasurement(firstPost._id));
    await waitForState(viewport, () => readAttempts.length === 1);
    await dispatchMeasure(viewport, makePostMeasurement(secondPost._id));
    await waitForState(viewport, () => readAttempts.length === 2);
    await Effect.runPromise(
      Deferred.fail(
        firstRead,
        new ViewportReadError({
          cause: "test",
          message: "Older read sync failed in test.",
        })
      )
    );
    await dispatchMeasure(viewport, makePostMeasurement(secondPost._id));

    expect(readAttempts).toEqual([firstPost._id, secondPost._id]);
    await shutdownViewport(viewport);
  });

  it("does not mark read when no visible post is measured", async () => {
    const rig = createAdapters();
    const viewport = await createViewport(rig.adapters);

    await openTranscript(viewport);
    await dispatchMeasure(
      viewport,
      makeMeasurement({ lastVisiblePostId: null })
    );
    await waitForState(viewport, (state) => state.lifecycle === "ready");

    expect(rig.readPostIds).toEqual([]);
    await shutdownViewport(viewport);
  });
});
