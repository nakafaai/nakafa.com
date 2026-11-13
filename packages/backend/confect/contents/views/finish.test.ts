import { describe, expect, it } from "@effect/vitest";
import contents from "@repo/backend/confect/_generated/refs/contents";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import {
  ARTICLE_VIEW_ID,
  ARTICLE_VIEW_ROUTE,
  makeMaterialViewArgs,
  CONTENT_VIEW_NOW as NOW,
  seedMaterialViewer,
} from "@repo/backend/test/content/view";
import { Effect } from "effect";

const views = contents.mutations.views;

/** A signed-in reader of the test lesson, and the lesson's finish arguments. */
const readerWorld = Effect.fn("test.contents.finish.reader")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithAuth();
  const reader = yield* Effect.promise(() =>
    t.mutation((ctx) => seedMaterialViewer(ctx, "reader"))
  );
  const { contentId, locale, publicPath } = makeMaterialViewArgs();
  return {
    finish: { contentId, locale, publicPath },
    reader: client(
      t.withIdentity({ subject: reader.sessionId })
    ),
    t,
  };
});

describe("contents/views/finish", () => {
  it.effect(
    "grants a lesson read for 45 seconds once, and nothing before",
    () =>
      Effect.gen(function* () {
        const world = yield* readerWorld();
        expect(
          yield* world.reader.mutation(views.finishLesson, world.finish)
        ).toEqual({ _tag: "unread" });
        vi.setSystemTime(NOW + 60_000);
        yield* world.reader.mutation(
          views.recordContentView,
          makeMaterialViewArgs("reader-device")
        );
        vi.setSystemTime(NOW + 60_000 + 44_000);
        expect(
          yield* world.reader.mutation(views.finishLesson, world.finish)
        ).toEqual({ _tag: "unread" });
        vi.setSystemTime(NOW + 60_000 + 45_000);
        expect(
          yield* world.reader.mutation(views.finishLesson, world.finish)
        ).toEqual({ _tag: "granted", badges: [], stars: 5 });
        expect(
          yield* world.reader.mutation(views.finishLesson, world.finish)
        ).toEqual({ _tag: "duplicate" });
        const grants = yield* Effect.promise(() =>
          world.t.query((ctx) => ctx.db.query("islandAwards").collect())
        );
        expect(grants).toMatchObject([
          { kind: "lesson", stars: 5, subject: "mathematics" },
        ]);
      })
  );

  it.effect(
    "grants nothing for a page that is no lesson, and refuses a visitor",
    () =>
      Effect.gen(function* () {
        const world = yield* readerWorld();
        expect(
          yield* world.reader.mutation(views.finishLesson, {
            contentId: ARTICLE_VIEW_ID,
            locale: "en",
            publicPath: ARTICLE_VIEW_ROUTE,
          })
        ).toEqual({ _tag: "unread" });
        const visitor = client(world.t);
        expect(
          (yield* visitor
            .mutation(views.finishLesson, world.finish)
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect("needs the lesson's own view, not another reader's", () =>
    Effect.gen(function* () {
      const world = yield* readerWorld();
      const other = yield* Effect.promise(() =>
        world.t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, { now: NOW, suffix: "other" })
        )
      );
      vi.setSystemTime(NOW + 60_000);
      yield* client(
        world.t.withIdentity({ subject: other.sessionId })
      ).mutation(views.recordContentView, makeMaterialViewArgs());
      vi.setSystemTime(NOW + 600_000);
      expect(
        yield* world.reader.mutation(views.finishLesson, world.finish)
      ).toEqual({ _tag: "unread" });
    })
  );
});
