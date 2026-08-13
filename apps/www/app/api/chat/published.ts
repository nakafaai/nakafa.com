import "server-only";

import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { NinaLearningSessionInput } from "@repo/ai/nina/memory/pack";
import { readMaterialContextHint } from "@repo/contents/_types/route/material/context";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import { readPublishedMaterialRoute } from "@/lib/content/material/route";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Returns whether one localized path belongs to the material route surface. */
export function isPublishedMaterialPath(locale: Locale, publicPath: string) {
  const [namespace] = publicPath.split("/");
  return PUBLIC_ROUTE_SURFACES.some(
    (surface) =>
      surface.key === "subject" && surface.routeSlugs[locale] === namespace
  );
}

/** Reads Nina context only from the active release-owned material model. */
export const readPublishedNinaMaterial = Effect.fn(
  "chat.readPublishedNinaMaterial"
)(function* (input: {
  readonly contextHint?: null | string;
  readonly locale: Locale;
  readonly publicPath: string;
  readonly url: string;
}) {
  const published = yield* readPublishedMaterialRoute(
    input.locale,
    input.publicPath
  );
  if (!published.projection) {
    return yield* new PublishedProjectionError({
      locale: input.locale,
      publicPath: input.publicPath,
    });
  }
  const learning = {
    assetId: published.projection.graph.assetId,
    contentId: published.projection.graph.assetId,
    locale: input.locale,
    materialKey: published.projection.materialKey,
    section: published.projection.kind,
    slug: input.publicPath,
    sourcePath: published.sourcePath,
    title: published.projection.metadata.title,
    url: input.url,
    verified: true,
  } satisfies NinaLearningSessionInput["learning"];
  const context = readMaterialContextHint(input.contextHint);
  if (!context) {
    return {
      learning,
      placement: undefined,
    };
  }
  const resolved = yield* readPublishedMaterialContext(
    input.locale,
    published.projection,
    context,
    published.activeReleaseId
  );
  if (!resolved) {
    return {
      learning,
      placement: undefined,
    };
  }
  const programKey = yield* Schema.decodeUnknown(LearningProgramKeySchema)(
    resolved.context.programKey
  ).pipe(
    Effect.mapError(
      () =>
        new PublishedProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        })
    )
  );
  return {
    learning,
    placement: {
      mode: "placement",
      nodeKey: resolved.context.nodeKey,
      parentHref: resolved.href,
      parentTitle: resolved.label,
      programKey,
    } satisfies NinaLearningSessionInput["placement"],
  };
});
