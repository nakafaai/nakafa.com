import { MutableHashMap, Option } from "effect";
import type { Model } from "@/lib/island/models/kinds";
import { modelFaces, modelKey } from "@/lib/island/models/kinds";
import { sketchOf } from "@/lib/island/sketch";

/*
 * The small pictures the HUD shows of the world's own models (ADR 0050, W7):
 * a thing on its shelf tile and an animal in the field guide, each drawn once
 * a page from the model the world itself draws, and kept as an image address.
 */

/** The side of a picture in art pixels, which the HUD enlarges with whole pixels. */
export const PICTURE = 64;

/** Each model's picture as an image address, by the model's key, drawn once a page. */
const PICTURES = MutableHashMap.empty<string, string>();

/** A model's picture on a canvas of its own, as an image address. */
function draw(model: Model) {
  const canvas = document.createElement("canvas");
  canvas.width = PICTURE;
  canvas.height = PICTURE;
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(sketchOf(modelFaces(model), PICTURE), PICTURE, PICTURE),
      0,
      0
    );
  return canvas.toDataURL();
}

/** The address of a model's picture when it was already drawn, none before. */
export function drawnPicture(model: Model) {
  return MutableHashMap.get(PICTURES, modelKey(model));
}

/** The address of a model's picture, drawn on first use. */
export function pictureOf(model: Model) {
  return Option.getOrElse(drawnPicture(model), () => {
    const url = draw(model);
    MutableHashMap.set(PICTURES, modelKey(model), url);
    return url;
  });
}
