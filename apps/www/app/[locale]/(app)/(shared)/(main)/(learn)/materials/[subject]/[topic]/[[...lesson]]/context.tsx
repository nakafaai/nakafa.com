"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import {
  MATERIAL_CONTEXT_QUERY_PARAM,
  readMaterialContextHint,
} from "@repo/contents/_types/route/material/context";
import { useQuery } from "convex/react";
import { Effect } from "effect";
import { useSearchParams } from "next/navigation";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  type MaterialNavigationPage,
  readMaterialNavigation,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { BreadcrumbHeaderSegment } from "@/components/shared/breadcrumb/header";
import { PaginationContent } from "@/components/shared/pagination-content";
import { SidebarRightHeader } from "@/components/shared/sidebar-right";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { decodePublishedMaterialContext } from "@/lib/content/material/projection";

/** Client controls receive navigation identity, never the signed lesson body. */
export interface MaterialContextProps {
  page: MaterialNavigationPage &
    Pick<MaterialPageContent, "appLocale"> & {
      readonly metadata: Pick<
        MaterialPageContent["metadata"],
        "title" | "description" | "subject"
      >;
      readonly contentId: MaterialPageContent["route"]["graph"]["assetId"];
    };
}

/** Convex deduplicates these identical subscriptions across the three controls. */
function useMaterialNavigation({ page }: MaterialContextProps) {
  const searchParams = useSearchParams();
  const hints = searchParams.getAll(MATERIAL_CONTEXT_QUERY_PARAM);
  const context = readMaterialContextHint(
    hints.length === 1 ? hints[0] : hints
  );
  const enabled = context !== undefined && page.kind === "published";
  const result = useQuery(
    api.contentRelease.program.context,
    enabled
      ? {
          appLocale: page.route.appLocale,
          contentKey: page.route.contentKey,
          materialKey: page.route.materialKey,
          nodeKey: context.nodeKey,
          parentPath: page.route.parentPath,
          programKey: context.programKey,
          publicPath: page.route.publicPath,
        }
      : "skip"
  );
  const published =
    enabled && result !== undefined
      ? Effect.runSync(
          decodePublishedMaterialContext(
            page.appLocale,
            page.route,
            context,
            result
          )
        )
      : null;
  return {
    navigation: readMaterialNavigation(page, published),
    pending: enabled && result === undefined,
  };
}

/** Resolves the return breadcrumb without delaying the static lesson body. */
export function MaterialBreadcrumb({
  context,
}: {
  context: MaterialContextProps;
}) {
  const { navigation, pending } = useMaterialNavigation(context);
  if (pending) {
    return null;
  }
  return (
    <BreadcrumbHeaderSegment
      item={navigation.link ?? { label: context.page.metadata.title }}
    />
  );
}

/** Preserves the verified context on the outline's current-lesson link. */
export function MaterialHeading({
  context,
}: {
  context: MaterialContextProps;
}) {
  const { navigation } = useMaterialNavigation(context);
  const { metadata } = context.page;
  return (
    <SidebarRightHeader
      description={metadata.description ?? metadata.subject}
      href={navigation.currentHref}
      title={metadata.title}
    />
  );
}

/** Changes only pagination URLs and records the same verified learning context. */
export function MaterialPagination({
  context,
}: {
  context: MaterialContextProps;
}) {
  const { navigation, pending } = useMaterialNavigation(context);
  const { page } = context;
  const trackerContext: LearningContextInput | undefined = navigation.context
    ? {
        mode: "placement",
        nodeKey: navigation.context.nodeKey,
        programKey: navigation.context.programKey,
      }
    : undefined;
  return (
    <>
      <ContentViewTracker
        contentId={page.contentId}
        context={trackerContext}
        enabled={page.kind === "published" && !pending}
        locale={page.appLocale}
        publicPath={page.route.publicPath}
        section="material"
      />
      <PaginationContent pagination={navigation.pagination} />
    </>
  );
}
