import { Image } from "@repo/design-system/components/image";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import type { TileLook } from "@repo/design-system/lib/look";
import { Predicate } from "effect";
import { type ReactElement, type ReactNode, use } from "react";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";

interface CatalogCardProps {
  readonly action: ReactElement;
  readonly children: ReactElement;
  readonly title: string;
}

/** Renders one image or tile catalog choice with the action its grid names. */
export function CatalogCard({ action, children, title }: CatalogCardProps) {
  const actionLabel = use(CatalogActionLabelContext);
  if (actionLabel === null) {
    throw new Error(
      "CatalogCard must be used within CatalogActionLabelContext"
    );
  }
  return (
    <Card className="relative mx-auto h-full w-full max-w-sm pt-0 pb-0 [--card-spacing:--spacing(4)]">
      {children}
      <CardHeader className="flex-1">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardFooter className="border-t bg-muted/50 p-(--card-spacing)">
        <Button
          aria-label={`${actionLabel} ${title}`}
          className="w-full"
          nativeButton={false}
          render={action}
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Renders the tile of a catalog choice in the same 1200 by 630 visual frame.
 * The choices of one grid take their `shift` from `getTileLooks` or
 * `getTileShifts`, so that no two tiles of the grid share a blend.
 */
export function CatalogCardTile({
  children,
  seed,
  shift,
}: {
  children: ReactNode;
  seed: string;
  shift: number;
}) {
  return (
    <Tile className="aspect-40/21" seed={seed} shift={shift} variant="card">
      {children}
    </Tile>
  );
}

/**
 * Renders what one card of a catalog grid draws: its reviewed artwork when
 * `visual` is the source of that artwork, or the tile that the grid gave it.
 * `getTileLooks` hands a grid the one or the other for each card, and a card
 * with artwork takes no icon and no hue from the tiles around it.
 */
export function CatalogCardVisual({
  preload,
  visual,
}: {
  preload: boolean;
  visual: TileLook | string;
}) {
  if (Predicate.isString(visual)) {
    // The reviewed artwork, 1200 by 630, without cropping.
    return (
      <Image
        alt=""
        className="h-auto w-full"
        height={630}
        preload={preload}
        sizes="(min-width: 640px) 384px, calc(100vw - 48px)"
        src={visual}
        width={1200}
      />
    );
  }

  return (
    <CatalogCardTile seed={visual.seed} shift={visual.shift}>
      <TileIcon icon={visual.icon} />
    </CatalogCardTile>
  );
}
