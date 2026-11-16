"use client";

import type { BlockKey } from "@repo/backend/confect/island/blocks";
import { MutableHashMap, Option } from "effect";
import { type TileName, tilePixels } from "@/lib/island/atlas";
import { looksOf } from "@/lib/island/look";
import { TILE } from "@/lib/island/tiles/paint";

/** The side of a block icon in art pixels. */
const ICON = 26;

/** One tile on its own canvas, every color darkened by `shade`, for the 2D canvas to draw. */
function tileCanvas(name: TileName, shade: number) {
  const pixels = tilePixels(name);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] *= 1 - shade;
    pixels[index + 1] *= 1 - shade;
    pixels[index + 2] *= 1 - shade;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(pixels, TILE, TILE), 0, 0);
  return canvas;
}

/** Each block's icon as an image address, drawn once a page. */
const ICONS = MutableHashMap.empty<BlockKey, string>();

/** Draws a block as a small cube, three faces lit from the upper left; a plant is drawn flat. */
function drawIcon(block: BlockKey) {
  const canvas = document.createElement("canvas");
  canvas.width = ICON;
  canvas.height = ICON;
  const context = canvas.getContext("2d");
  if (context === null) {
    return "";
  }
  context.imageSmoothingEnabled = false;
  const look = looksOf(block);
  if (look.kind === "cross") {
    context.setTransform(1.5, 0, 0, 1.5, 1, 1);
    context.drawImage(tileCanvas(look.side, 0), 0, 0);
    return canvas.toDataURL();
  }
  context.setTransform(0.75, 0.375, -0.75, 0.375, 13, 1);
  context.drawImage(tileCanvas(look.top, 0), 0, 0);
  context.setTransform(0.75, 0.375, 0, 0.75, 1, 7);
  context.drawImage(tileCanvas(look.side, 0.18), 0, 0);
  context.setTransform(0.75, -0.375, 0, 0.75, 13, 13);
  context.drawImage(tileCanvas(look.side, 0.36), 0, 0);
  return canvas.toDataURL();
}

/** The address of a block's icon, drawn on first use. */
function iconOf(block: BlockKey) {
  return Option.getOrElse(MutableHashMap.get(ICONS, block), () => {
    const url = drawIcon(block);
    MutableHashMap.set(ICONS, block, url);
    return url;
  });
}

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
