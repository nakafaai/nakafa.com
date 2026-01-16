import type { SchoolClassImage } from "@repo/backend/convex/classes/schema";

const CLASS_IMAGE_ENTRIES: [SchoolClassImage, string][] = [
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

export const CLASS_IMAGES = new Map(CLASS_IMAGE_ENTRIES);

/**
 * Get a random class image based on a text input
 *
 * @param text - The text to use for generating the random image
 * @returns A random class image
 */
export function getRandomClassImage(text: string): SchoolClassImage {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1_000_000_007;
  }

  const index = hash % CLASS_IMAGE_ENTRIES.length;
  return CLASS_IMAGE_ENTRIES[index][0];
}

/**
 * Get the URL for a class image
 *
 * @param image - The class image to get the URL for
 * @returns The URL for the class image, or an empty string if the image is invalid
 */
export function getClassImageUrl(image: SchoolClassImage): string {
  return CLASS_IMAGES.get(image) || "";
}

/**
 * Check if a class image is valid
 *
 * @param image - The class image to check
 * @returns True if the image is valid, false otherwise
 */
export function isValidClassImage(image: SchoolClassImage): boolean {
  return CLASS_IMAGES.has(image);
}
