import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
} from "@repo/backend/test/material/catalog";
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
import { Effect } from "effect";

const capturedAt = "2026-09-27T12:00:00.000Z";
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
                user,
                capturedAt
              );
              expect(value.page.verified).toBe(false);
              expect(value.page.needsFetch).toBe(false);
              expect(value.page.nina.snapshot.source).toBe("current-page");
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
                { ...user, role: "student" },
                capturedAt
              );
              expect(value.page).toMatchObject({
                verified: true,
                needsFetch: true,
              });
              expect(value.page.nina.learning).toMatchObject({
                assetId: material.graph.assetId,
                title: material.metadata.title,
                materialKey: material.materialKey,
              });
              expect(value.page.nina.placement).toBeUndefined();
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
                user,
                capturedAt
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

  for (const savedPage of [false, true]) {
    it.effect(
      `pins prior context away from content and refreshes it on a signed page (${savedPage})`,
      () =>
        Effect.gen(function* () {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* t.run(
            Effect.gen(function* () {
              const user = yield* seedUser();
              yield* activateMaterialCatalog([material]);
              const original = yield* resolveNinaContext(
                { locale: "en", slug: material.publicPath },
                user,
                capturedAt
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
                ...(savedPage
                  ? { page: original.page }
                  : { snapshot: original.page.nina.snapshot }),
              });
              const pinned = yield* resolveNinaContext(
                { locale: "id", slug: "chat" },
                user,
                capturedAt,
                chatId
              );
              expect(pinned.page.locale).toBe("id");
              expect(pinned.page.nina.learning).toEqual(
                original.page.nina.learning
              );
              expect(pinned.page.nina.snapshot.source).toBe("pinned-chat");
              expect(pinned.page.needsFetch).toBe(true);
              const current = yield* resolveNinaContext(
                { locale: "en", slug: material.publicPath },
                user,
                capturedAt,
                chatId
              );
              expect(current.page.nina.snapshot.source).toBe("current-page");
            })
          );
        })
    );
  }

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
              user,
              capturedAt
            ).pipe(Effect.flip);
            expect(failure.code).toBe("NINA_CONTEXT_FAILED");
          })
        );
      })
  );
});
