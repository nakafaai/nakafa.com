"use client";

import type { BlockKey } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, MutableHashMap, Option } from "effect";
import {
  plantPixels,
  speciesPixels,
  type TileName,
  tilePixels,
} from "@/lib/island/atlas";
import { isPlant, looksOf } from "@/lib/island/look";
import { TILE } from "@/lib/island/tiles/paint";

/** The side of a block icon in art pixels. */
const ICON = 26;

/** One tile on its own canvas, every color darkened by `shade`, for the 2D canvas to draw. */
function tileCanvas(name: TileName, shade: number) {
  return pixelsCanvas(tilePixels(name), shade);
}

/** Pixels of one tile on their own canvas, every color darkened by `shade`. */
function pixelsCanvas(pixels: Uint8ClampedArray<ArrayBuffer>, shade: number) {
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
  if (isPlant(block)) {
    context.setTransform(1.5, 0, 0, 1.5, 1, 1);
    context.drawImage(
      pixelsCanvas(
        plantPixels(
          Arr.findFirstIndex(PLANT_KEYS, (key) => key === block).pipe(
            Option.getOrElse(() => 0)
          )
        ),
        0
      ),
      0,
      0
    );
    return canvas.toDataURL();
  }
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

/** Each species' picture as an image address, drawn once a page. */
const PICTURES = MutableHashMap.empty<number, string>();

/** The address of a species' picture, drawn on first use. */
function pictureOf(index: number) {
  return Option.getOrElse(MutableHashMap.get(PICTURES, index), () => {
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    canvas
      .getContext("2d")
      ?.putImageData(new ImageData(speciesPixels(index), TILE, TILE), 0, 0);
    const url = canvas.toDataURL();
    MutableHashMap.set(PICTURES, index, url);
    return url;
  });
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
