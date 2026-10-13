import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
} from "@repo/backend/test/material/catalog";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import {
  materialContext,
  materialGroup,
  PROGRAM_ROOT,
} from "@repo/backend/test/program/route";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { activateTryoutStartSource } from "@repo/backend/test/tryout/source";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Exit } from "effect";

const material = makeMaterialProjection("en", 1, 1);
const seedUser = Effect.fn("test.nina.context.user")(function* () {
  const writer = yield* DatabaseWriter;
  const id = yield* writer.table("users").insert({
    email: "context@example.invalid",
    authId: "context",
    name: "Learner",
    plan: "free",
    credits: 10,
    creditsResetAt: 0,
  });
  return yield* (yield* DatabaseReader).table("users").get(id);
});

function routes(cardTitle?: string) {
  const subject = CurriculumRouteSchema.make({
    ...materialGroup(0, 0),
    level: "subject",
    nodeKey: "subject",
    publicPath: PublicPathSchema.make(`${PROGRAM_ROOT}/subject`),
    parentPath: PublicPathSchema.make(PROGRAM_ROOT),
  });
  const group = CurriculumRouteSchema.make({
    ...materialGroup(1, 1),
    publicPath: PublicPathSchema.make(`${subject.publicPath}/group-1`),
    parentPath: subject.publicPath,
    ...(cardTitle ? { materialCardTitle: cardTitle } : {}),
  });
  const mapping = CurriculumRouteSchema.make({
    ...materialContext(1, group),
    materialContextParentPath: subject.publicPath,
  });
  return [subject, group, mapping];
}

describe("Nina signed learning context", () => {
  it.effect(
    "does not invent verified content for home or unknown material routes",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const user = yield* seedUser();
            for (const slug of ["", "/home/", "subjects/missing"]) {
              const value = yield* resolveNinaContext(
                { locale: "en", slug },
                user
              );
              expect(value.page.nina.learning.verified).toBe(false);
              expect(value.page.needsFetch).toBe(false);
              expect(value.user).toEqual({});
            }
          })
        );
      })
  );

  it.effect(
    "captures authenticated signed material and ignores a stale placement hint",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const user = yield* seedUser();
            yield* activateMaterialCatalog([material]);
            for (const materialContextHint of [
              undefined,
              "technical-program-1~missing",
            ]) {
              const value = yield* resolveNinaContext(
                {
                  locale: "en",
                  slug: material.publicPath,
                  ...(materialContextHint ? { materialContextHint } : {}),
                },
                { ...user, role: "student" }
              );
              // The whole page is compared, so any field beside these would
              // fail it.
              expect(value.page).toEqual({
                locale: "en",
                needsFetch: true,
                nina: {
                  learning: {
                    assetId: material.graph.assetId,
                    locale: "en",
                    materialKey: material.materialKey,
                    section: expect.any(String),
                    slug: material.publicPath,
                    sourcePath: expect.any(String),
                    title: material.metadata.title,
                    url: `${SITE_ORIGIN}/en/${material.publicPath}`,
                    verified: true,
                  },
                  tools: {
                    allowPageFetch: true,
                    evidenceScope: "verified-page",
                  },
                },
                slug: material.publicPath,
              });
              expect(value.user.role).toBe("student");
            }
          })
        );
      })
  );

  for (const cardTitle of [undefined, "Learning Functions"]) {
    it.effect(
      `preserves signed placement and explicit curriculum preference with card ${cardTitle}`,
      () =>
        Effect.gen(function* () {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          const snapshot = yield* makeProgramSnapshotData(
            [makeTechnicalProgram(1)],
            undefined,
            routes(cardTitle)
          );
          yield* t.run(
            Effect.gen(function* () {
              const user = yield* seedUser();
              yield* activateProgramSnapshot(snapshot);
              yield* insertMaterialProjection(material);
              yield* (yield* DatabaseWriter)
                .table("learningPreferences")
                .insert({
                  userId: user._id,
                  preferredCurriculumProgramKey: "technical-program-1",
                  updatedAt: 1,
                });
              const value = yield* resolveNinaContext(
                {
                  locale: "en",
                  slug: material.publicPath,
                  materialContextHint: "technical-program-1~group-1",
                },
                user
              );
              expect(value.page.nina.placement).toMatchObject({
                programKey: "technical-program-1",
                nodeKey: "group-1",
                parentTitle: cardTitle ?? "Technical Group 1",
                parentHref: `/en/${PROGRAM_ROOT}/subject#${cardTitle ? "learning-functions" : "technical-group-1"}`,
              });
              expect(value.user.curriculumPreference?.program).toEqual({
                key: "technical-program-1",
                title: "Technical Program 1",
              });
            })
          );
        })
    );
  }

  it.effect(
    "names the page of the current turn when a chat continues away from a signed page",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const user = yield* seedUser();
            yield* activateMaterialCatalog([material]);
            const original = yield* resolveNinaContext(
              { locale: "en", slug: material.publicPath },
              user
            );
            const writer = yield* DatabaseWriter;
            const chatId = yield* writer.table("chats").insert({
              userId: user._id,
              type: "study",
              visibility: "private",
              updatedAt: 1,
              threadId: "thread",
            });
            yield* writer.table("ninaTurns").insert({
              phase: "settled",
              chatId,
              userId: user._id,
              threadId: "thread",
              promptMessageId: "prompt",
              order: 0,
              usage: [],
              state: { status: "complete", finishedAt: 1 },
              page: original.page,
            });
            const continued = yield* resolveNinaContext(
              { locale: "id", slug: "chat" },
              user,
              chatId
            );
            // The learning asset and its tool policy are the current page's.
            expect(continued.page).toEqual({
              locale: "id",
              needsFetch: false,
              nina: {
                learning: {
                  locale: "id",
                  slug: "chat",
                  url: `${SITE_ORIGIN}/id/chat`,
                  verified: false,
                },
                tools: {
                  allowPageFetch: false,
                  evidenceScope: "general-learning",
                },
              },
              slug: "chat",
            });
            expect(continued.page.nina.learning.url).not.toBe(
              original.page.nina.learning.url
            );
            const current = yield* resolveNinaContext(
              { locale: "en", slug: material.publicPath },
              user,
              chatId
            );
            expect(current.page.nina.learning).toEqual(
              original.page.nina.learning
            );
          })
        );
      })
  );

  it.effect(
    "returns a typed admission failure for a corrupt signed material",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const user = yield* seedUser();
            yield* activateMaterialCatalog([material]);
            const row = yield* (yield* DatabaseReader)
              .table("materialCatalog")
              .index("by_creation_time")
              .first();
            if (row._tag === "None") {
              return yield* Effect.die("Material fixture missing");
            }
            yield* (yield* DatabaseWriter)
              .table("materialCatalog")
              .patch(row.value._id, { projectionJson: "{}" });
            const failure = yield* resolveNinaContext(
              { locale: "en", slug: material.publicPath },
              user
            ).pipe(Effect.flip);
            expect(failure.code).toBe("NINA_CONTEXT_FAILED");
          })
        );
      })
  );

  it("keeps a signed try-out route out of current-page fetch", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const { set } = await activateTryoutStartSource(ctx, "visible");
      const context = await Effect.runPromise(
        Effect.gen(function* () {
          const user = yield* seedUser();
          return yield* resolveNinaContext(
            { locale: "id", slug: set.publicPath },
            user
          );
        }).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      );
      // Try-out pages have no signed Markdown, so a forced read could only fail.
      expect(context.page.nina.learning.verified).toBe(false);
      expect(context.page.needsFetch).toBe(false);
      expect(context.page.nina.tools.allowPageFetch).toBe(false);
    });
  });

  for (const { legacy, shape } of [
    { legacy: false, shape: "new" },
    { legacy: true, shape: "old" },
  ]) {
    it(`freezes an asked question and keeps it for the conversation's next turn, when the last turn is stored in the ${shape} shape`, async () => {
      const f = await createFocusTest({ legacy });
      const learner = () =>
        Effect.flatMap(DatabaseReader, (database) =>
          database.table("users").get(f.identity.userId)
        ).pipe(Effect.orDie);
      await f.expectExit(
        Effect.flatMap(learner(), (user) =>
          resolveNinaContext({ locale: "en", slug: "", focus: f.focus }, user)
        ),
        (exit) =>
          expect(exit).toMatchObject({
            _tag: "Success",
            value: { page: { needsFetch: false, nina: { focus: f.frozen } } },
          })
      );
      await f.focusTurn();
      await f.expectExit(
        Effect.flatMap(learner(), (user) =>
          resolveNinaContext({ locale: "en", slug: "" }, user, f.chatId)
        ),
        (exit) =>
          expect(exit).toMatchObject({
            _tag: "Success",
            value: { page: { nina: { focus: f.frozen } } },
          })
      );
      await f.t.mutation((ctx) =>
        ctx.db.patch("users", f.identity.userId, { plan: "free" })
      );
      await f.expectExit(
        Effect.flatMap(learner(), (user) =>
          resolveNinaContext({ locale: "en", slug: "", focus: f.focus }, user)
        ),
        (exit) => {
          expect(Exit.isFailure(exit)).toBe(true);
          expect(exit).toMatchObject({
            cause: { reasons: [{ error: { code: "NINA_CONTEXT_FAILED" } }] },
          });
        }
      );
      await f.expectExit(
        Effect.flatMap(learner(), (user) =>
          resolveNinaContext({ locale: "en", slug: "" }, user, f.chatId)
        ),
        (exit) =>
          expect(Exit.isSuccess(exit) && exit.value.page.nina.focus).toBe(
            undefined
          )
      );
    });
  }
});
