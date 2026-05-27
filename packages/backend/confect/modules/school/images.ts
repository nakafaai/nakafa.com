import type { SchoolClassImage } from "@repo/backend/confect/modules/school/classes.tables";

const CLASS_IMAGE_ENTRIES = [
  ["retro", "/classes/retro.png"],
  ["time", "/classes/time.png"],
  ["stars", "/classes/stars.png"],
  ["chill", "/classes/chill.png"],
  ["puzzle", "/classes/puzzle.png"],
  ["line", "/classes/line.png"],
  ["shoot", "/classes/shoot.png"],
  ["virus", "/classes/virus.png"],
  ["bacteria", "/classes/bacteria.png"],
  ["cooking", "/classes/cooking.png"],
  ["disco", "/classes/disco.png"],
  ["logic", "/classes/logic.png"],
  ["ball", "/classes/ball.png"],
  ["duck", "/classes/duck.png"],
  ["music", "/classes/music.png"],
  ["nightly", "/classes/nightly.png"],
  ["writer", "/classes/writer.png"],
  ["barbie", "/classes/barbie.png"],
  ["fun", "/classes/fun.png"],
  ["lamp", "/classes/lamp.png"],
  ["lemon", "/classes/lemon.png"],
  ["nighty", "/classes/nighty.png"],
  ["rocket", "/classes/rocket.png"],
  ["sakura", "/classes/sakura.png"],
  ["sky", "/classes/sky.png"],
  ["stamp", "/classes/stamp.png"],
  ["vintage", "/classes/vintage.png"],
] as const;
const CLASS_IMAGES = new Map(CLASS_IMAGE_ENTRIES);

/** Picks a deterministic class image from stable text. */
function getRandomClassImage(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1_000_000_007;
  }
  const index = hash % CLASS_IMAGE_ENTRIES.length;
  return CLASS_IMAGE_ENTRIES[index][0];
}

/** Returns the public image URL for a class image key. */
function getClassImageUrl(image: string) {
  if (!isValidClassImage(image)) {
    return "";
  }

  return CLASS_IMAGES.get(image) || "";
}

/** Checks whether a value is a known class image key. */
function isValidClassImage(image: string): image is SchoolClassImage {
  return CLASS_IMAGE_ENTRIES.some(([key]) => key === image);
}

export {
  CLASS_IMAGES,
  getClassImageUrl,
  getRandomClassImage,
  isValidClassImage,
};
