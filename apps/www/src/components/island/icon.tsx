"use client";

import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Option } from "effect";
import { drawnPicture, PICTURE, pictureOf } from "@/components/island/picture";
import type { Model } from "@/lib/island/models/kinds";

/**
 * A model's small picture, enlarged with whole pixels and drawn the first
 * time it nears the screen, so a long list draws only what its reader sees.
 * It is decoration: the tile around it carries the name.
 */
function ModelPicture({ model }: { model: Model }) {
  return (
    <img
      alt=""
      className="size-full object-contain [image-rendering:pixelated]"
      height={PICTURE}
      ref={(image) => {
        if (image === null || image.getAttribute("src") !== null) {
          return;
        }
        const watch = new IntersectionObserver(
          (entries) => {
            if (Arr.some(entries, (entry) => entry.isIntersecting)) {
              image.src = pictureOf(model);
              watch.disconnect();
            }
          },
          { rootMargin: "200px" }
        );
        watch.observe(image);
        return () => watch.disconnect();
      }}
      src={Option.getOrUndefined(drawnPicture(model))}
      width={PICTURE}
    />
  );
}

/** A thing as its shelf tile shows it: the first look of its own model. */
export function ThingIcon({ kind }: { kind: Thing }) {
  return <ModelPicture model={{ _tag: "thing", kind, look: 0 }} />;
}

/** A species as the field guide shows it: the model the world draws of it. */
export function SpeciesIcon({ index }: { index: number }) {
  return <ModelPicture model={{ _tag: "species", index }} />;
}
