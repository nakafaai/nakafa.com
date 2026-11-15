"use client";

import type { BlockKey } from "@repo/backend/confect/island/blocks";
import {
  ICON,
  iconOf,
  pictureOf,
  toolPictureOf,
} from "@/components/island/picture";
import { TILE } from "@/lib/island/tiles/paint";

/**
 * A block as the hotbar and the block book show it, from the same tiles the
 * world uses (ADR 0047, D4), enlarged with whole pixels. It is decoration:
 * the button around it carries the block's name.
 */
export function BlockIcon({ block }: { block: BlockKey }) {
  return (
    <img
      alt=""
      className="size-full [image-rendering:pixelated]"
      height={ICON}
      src={iconOf(block)}
      width={ICON}
    />
  );
}

/** A species as the field guide shows it, the same drawing the world uses, enlarged with whole pixels. */
export function SpeciesIcon({ index }: { index: number }) {
  return (
    <img
      alt=""
      className="size-full [image-rendering:pixelated]"
      height={TILE}
      src={pictureOf(index)}
      width={TILE}
    />
  );
}

/** A farming tool as the hotbar shows it, from the same pixels as its cursor. */
export function ToolIcon({
  tool,
}: {
  tool: Parameters<typeof toolPictureOf>[0];
}) {
  return (
    <img
      alt=""
      className="size-full [image-rendering:pixelated]"
      height={TILE}
      src={toolPictureOf(tool)}
      width={TILE}
    />
  );
}
