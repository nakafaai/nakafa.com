"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/curriculum/material";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";

/**
 * The fields one home list row renders.
 *
 * Continue Learning and Trending both extend the shared content-summary
 * contract, so one projection of it covers both and excludes the fields only
 * one ranked query returns.
 */
type RankedMaterial = FunctionReturnType<
  typeof api.contents.queries.recent.getRecentlyViewed
>[number];

export type HomeMaterial = Pick<
  RankedMaterial,
  | "content_id"
  | "contextKey"
  | "description"
  | "href"
  | "materialDomain"
  | "title"
>;

/**
 * Renders one home learning row.
 *
 * Continue Learning and Trending read the same row shape, so they share this
 * markup and differ only through `trailing`.
 */
export function MaterialRow({
  material,
  trailing,
}: {
  material: HomeMaterial;
  trailing?: ReactNode;
}) {
  return (
    <NavigationLink
      className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
      href={material.href}
    >
      <div className="flex items-start gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
          <GradientBlock
            className="absolute inset-0"
            colorScheme="vibrant"
            intensity="medium"
            keyString={material.content_id}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <HugeIcons
              className="size-4 text-background drop-shadow-md"
              icon={getMaterialIcon(material.materialDomain)}
            />
          </div>
        </div>
        <div className="-mt-1 flex flex-1 flex-col gap-0.5">
          {trailing ? (
            <div className="relative">
              <h3 className="pr-20">{material.title}</h3>
              {trailing}
            </div>
          ) : (
            <h3>{material.title}</h3>
          )}
          <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground sm:mr-12">
            {material.description}
          </span>
        </div>
      </div>
    </NavigationLink>
  );
}
