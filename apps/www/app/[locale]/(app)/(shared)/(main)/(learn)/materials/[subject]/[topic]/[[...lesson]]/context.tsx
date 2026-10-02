"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { LearningContextInput } from "@repo/backend/confect/contents/context";
import {
  MATERIAL_CONTEXT_QUERY_PARAM,
  readMaterialContextHint,
} from "@repo/contents/route/material/context";
import { Effect } from "effect";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  type MaterialNavigationPage,
  readMaterialNavigation,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { BreadcrumbHeaderSegment } from "@/components/shared/breadcrumb/header";
import { PaginationContent } from "@/components/shared/content/pagination";
import { SidebarRightHeader } from "@/components/shared/outline/panel";
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
    refs.public.contentRelease.program.context,
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
  if (QueryResult.isFailure(result)) {
    throw result.error;
  }
  const published =
    enabled && QueryResult.isSuccess(result)
      ? Effect.runSync(
          decodePublishedMaterialContext(
            page.appLocale,
            page.route,
            context,
            result.value
          )
        )
      : null;
  return {
    navigation: readMaterialNavigation(page, published),
    pending: enabled && QueryResult.isLoading(result),
  };
}

/**
 * Marks navigation that carries the verified learning context. Its slot hides
 * the static canonical navigation while this is mounted.
 */
function MaterialContextual({ children }: { children: ReactNode }) {
  return (
    <div className="contents" data-material-context="">
      {children}
    </div>
  );
}

/** Replaces the lesson title with the return link once the context is verified. */
export function MaterialBreadcrumb({
  context,
}: {
  context: MaterialContextProps;
}) {
  const { navigation } = useMaterialNavigation(context);
  return (
    <BreadcrumbHeaderSegment
      item={navigation.link ?? { label: context.page.metadata.title }}
    />
  );
}

/** Keeps the verified context on the outline's current-lesson link. */
export function MaterialHeading({
  context,
}: {
  context: MaterialContextProps;
}) {
  const { navigation } = useMaterialNavigation(context);
  const { metadata } = context.page;
  if (navigation.context === undefined) {
    return null;
  }
  return (
    <MaterialContextual>
      <SidebarRightHeader
        description={metadata.description ?? metadata.subject}
        href={navigation.currentHref}
        title={metadata.title}
      />
    </MaterialContextual>
  );
}

/** Records the lesson view and keeps the verified context on its pagination. */
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
      {navigation.context === undefined ? null : (
        <MaterialContextual>
          <PaginationContent pagination={navigation.pagination} />
        </MaterialContextual>
      )}
    </>
  );
}
