import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readCurrentCurriculumProgram } from "@repo/backend/confect/learningPreferences/program";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import type {
  NinaPage,
  NinaUser,
} from "@repo/backend/confect/nina/contract/turn";
import {
  resolveQuestionFocus,
  retainQuestionFocus,
} from "@repo/backend/confect/nina/focus";
import {
  type NinaPageInput,
  NinaTurnError,
} from "@repo/backend/confect/nina/turns.spec";
import { articleLayer } from "@repo/backend/content/article/confect";
import { materialLayer } from "@repo/backend/content/material/confect";
import { resolveMaterialRoute } from "@repo/backend/content/material/route";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramContext } from "@repo/backend/content/program/context";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readContentReference } from "@repo/backend/content/reference/read";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { NAKAFA_BASE_URL } from "@repo/contents/agent/constants";
import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { cleanSlug } from "@repo/utilities/helper";
import { toAnchorSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

const referenceLayer = Layer.mergeAll(
  articleLayer,
  materialLayer,
  quranLayer,
  tryoutLayer
);

/** Freeze authenticated page and learner facts in the admission transaction. */
export const resolveNinaContext = Effect.fn("nina.context.resolve")(
  function* (
    input: typeof NinaPageInput.Type,
    user: Docs["users"],
    capturedAt: string,
    chatId?: Docs["chats"]["_id"]
  ) {
    const locale = input.locale;
    const slug = cleanSlug(input.slug);
    const url = `${NAKAFA_BASE_URL}/${locale}${slug ? `/${slug}` : ""}`;
    const previous = chatId
      ? yield* (yield* DatabaseReader)
          .table("ninaTurns")
          .index(
            "by_chatId_and_order",
            (index) => index.eq("chatId", chatId),
            "desc"
          )
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie)
      : null;
    const published = yield* resolvePublishedContext(input, slug, url);
    const pinned = published.learning.verified
      ? undefined
      : (previous?.page?.nina.snapshot ?? previous?.snapshot);
    // A question focus stays with its conversation for follow-up turns.
    const focus = input.focus
      ? yield* resolveQuestionFocus(input.focus, user._id)
      : yield* retainQuestionFocus(previous?.page?.nina.focus, user._id);
    const session = yield* openNinaLearningSession({
      capturedAt,
      ...(focus ? { focus } : {}),
      learning: pinned?.learning ?? published.learning,
      ...((pinned?.placement ?? published.placement)
        ? { placement: pinned?.placement ?? published.placement }
        : {}),
      source: pinned ? "pinned-chat" : "current-page",
    });
    const curriculum = yield* readCurrentCurriculumProgram(locale, user._id);
    const preference = curriculum
      ? {
          program: {
            key: yield* Schema.decodeEffect(LearningProgramKeySchema)(
              curriculum.program.key
            ),
            title: curriculum.program.title,
          },
        }
      : undefined;
    return {
      page: {
        locale,
        slug,
        url,
        verified: published.learning.verified,
        // The active publication can change between turns. Re-read verified page
        // evidence instead of treating an old model context as current content.
        needsFetch: session.context.learning.verified,
        nina: session.context,
      } satisfies NinaPage,
      user: {
        ...(user.role ? { role: user.role } : {}),
        ...(preference ? { curriculumPreference: preference } : {}),
      } satisfies NinaUser,
    };
  },
  Effect.mapError(
    () =>
      new NinaTurnError({
        code: "NINA_CONTEXT_FAILED",
        message: "Unable to verify the learning context for this response.",
      })
  )
);

/** Resolve context using the same signed owners used by lesson navigation. */
const resolvePublishedContext = Effect.fn("nina.context.publication")(
  function* (input: typeof NinaPageInput.Type, slug: string, url: string) {
    const appLocale = AppLocaleSchema.make(input.locale);
    const isMaterial = Arr.some(
      PUBLIC_ROUTE_SURFACES,
      (surface) =>
        surface.key === "subject" &&
        surface.routeSlugs[input.locale] === slug.split("/")[0]
    );
    if (isMaterial) {
      const route = yield* resolveMaterialRoute(appLocale, slug).pipe(
        Effect.provide(materialLayer)
      );
      if (route.material) {
        const { projection, resolved } = route.material;
        const hint = readMaterialContextHint(input.materialContextHint);
        const context = hint
          ? yield* readProgramContext(
              appLocale,
              { ...projection, ...hint },
              route.active?.releaseId
            ).pipe(Effect.provide(programLayer))
          : null;
        const placement = context?.context
          ? yield* resolvePlacement(context.context, input.locale)
          : undefined;
        return {
          learning: {
            assetId: projection.graph.assetId,
            contentId: projection.graph.assetId,
            locale: input.locale,
            materialKey: projection.materialKey,
            section: projection.kind,
            slug,
            sourcePath: resolved.sourcePath,
            title: projection.metadata.title,
            url,
            verified: true,
          },
          placement,
        };
      }
    }
    const reference = yield* readContentReference({
      kind: "route",
      appLocale,
      publicPath: slug,
    }).pipe(Effect.provide(referenceLayer));
    return {
      learning: {
        locale: input.locale,
        slug,
        url,
        // Page fetch reads signed Markdown; try-out and topic pages have none.
        verified: reference?.markdown_url !== undefined,
      },
      placement: undefined,
    };
  }
);

/** Signed group titles and parent paths own the curriculum return link. */
const resolvePlacement = Effect.fn("nina.context.placement")(function* (
  context: NonNullable<
    Effect.Success<ReturnType<typeof readProgramContext>>["context"]
  >,
  locale: (typeof NinaPageInput.Type)["locale"]
) {
  const label = context.group.materialCardTitle ?? context.group.title;
  const programKey = yield* Schema.decodeEffect(LearningProgramKeySchema)(
    context.mapping.programKey
  );
  return {
    mode: "placement" as const,
    nodeKey: context.mapping.materialContextNodeKey,
    parentHref: `/${locale}/${context.mapping.materialContextParentPath}#${toAnchorSlug(label)}`,
    parentTitle: label,
    programKey,
  };
});
