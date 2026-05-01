import { cva } from "class-variance-authority";

export const threeSceneFrameVariants = cva(
  "relative aspect-square overflow-hidden rounded-md bg-card sm:aspect-[1.43/1]"
);

export function isNarrowThreeScene(
  size: { height: number; width: number },
  aspectRatio: number
) {
  return size.width < size.height * aspectRatio;
}
