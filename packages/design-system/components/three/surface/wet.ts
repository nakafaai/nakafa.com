/** The look of a dry surface: nothing passes through it and nothing lies over it but its own coat. */
const DRY = {
  ior: 1.5,
  opacity: 1,
  sheen: 0,
  smooth: 1,
  thickness: 0,
  transmission: 0,
  transparent: false,
  varnish: 0,
} as const;

/**
 * The look of thin living tissue or a membrane that is wet: a film of water
 * lies over it as a clear coat, it shines softly at grazing angles, and it
 * is smoother than it would be dry. On a device that can afford the extra
 * pass (`deep`), light also passes through it and takes its colour on the
 * way, bent as water bends it. Elsewhere it lets a little of what lies
 * behind it show instead, which still reads as wet and costs nothing more.
 *
 * @param wet - Whether the surface is wet tissue at all
 * @param deep - Whether light is traced through the surface
 */
export function wetLook(wet: boolean, deep: boolean) {
  if (!wet) {
    return DRY;
  }
  return {
    ior: 1.36,
    opacity: deep ? 1 : 0.86,
    sheen: 0.5,
    smooth: 0.35,
    thickness: deep ? 0.35 : 0,
    transmission: deep ? 0.55 : 0,
    transparent: !deep,
    varnish: 1,
  };
}
