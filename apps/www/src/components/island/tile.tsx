"use client";

import { Button } from "@repo/design-system/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { tileVariants } from "@/components/island/tiles";

/** One control of the HUD: a button drawn as a tile, which holds an icon and a `HudTileLabel`. */
export function HudTile({
  className,
  ground,
  ...props
}: ComponentProps<typeof Button> & VariantProps<typeof tileVariants>) {
  return <Button className={tileVariants({ className, ground })} {...props} />;
}

/** A tile's label under its icon, on one line. */
export function HudTileLabel({ children }: { children: ReactNode }) {
  return <span className="max-w-full shrink-0 truncate">{children}</span>;
}
