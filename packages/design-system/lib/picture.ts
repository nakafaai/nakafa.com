/** The window on a picture: where it starts, and how wide and high it is. */
export type Box = readonly [
  left: number,
  top: number,
  width: number,
  height: number,
];

/**
 * The height, in whole pixels, that a picture takes at a width: the width in
 * the proportion of its window. The picture sets it on its svg, and a page that
 * reserves the room of a picture before it is drawn asks for it too, so what
 * the page reserves is what the picture takes.
 */
export function pictureHeight(width: number, box: Box) {
  return Math.round((width * box[3]) / box[2]);
}
