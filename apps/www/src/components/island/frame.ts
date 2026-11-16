import { Array as Arr } from "effect";
import { artPixelFor } from "@/lib/island/camera";

/**
 * The art pixels the frame reaches past each edge of the screen: the camera's
 * snap moves the enlarged frame by up to half an art pixel, which must never
 * show past the frame's edge.
 */
const MARGIN = 2;

/** A color as red, green and blue from 0 to 1. */
type Color = readonly [number, number, number];

/**
 * The small frame the island is drawn into (ADR 0047, D2 and D20): the
 * scene's colors, the direction of each pixel's face and its depth, a copy of
 * that depth under the water (D43), then the
 * edged frame the edge pass paints, which the weather and the aim outline are
 * drawn over against the scene's depth. It covers the canvas in whole art
 * pixels, `MARGIN` more on every side, so it fills the screen with no band at
 * its edges and its pixels can slide under them.
 */
export function createFrame(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement
) {
  /**
   * Sizes the small frame to the canvas in whole art pixels, the art pixel
   * as fine as the ground `distance` blocks away needs (D47), or the screen's
   * own when `coarse`.
   */
  function resize(distance: number, coarse: boolean) {
    const pixel = artPixelFor(
      canvas.width,
      canvas.height,
      distance,
      target.pixel,
      coarse
    );
    // The screen's height in art pixels, which the camera's grid reads, and the share the frame's taller view adds to it.
    target.pixel = pixel;
    target.rows = Math.max(1, canvas.height / pixel);
    const width = Math.max(1, Math.ceil(canvas.width / pixel)) + 2 * MARGIN;
    const height = Math.max(1, Math.ceil(canvas.height / pixel)) + 2 * MARGIN;
    target.lens = height / target.rows;
    if (width === target.width && height === target.height) {
      return;
    }
    target.width = width;
    target.height = height;
    const sized = (
      texture: WebGLTexture | null,
      inner: number,
      format: number,
      type: number
    ) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        inner,
        width,
        height,
        0,
        format,
        type,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    sized(target.color, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    sized(target.surface, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    sized(target.edged, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    sized(
      target.depth,
      gl.DEPTH_COMPONENT24,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT
    );
    sized(
      target.seabed,
      gl.DEPTH_COMPONENT24,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT
    );
    const attach = (
      frame: WebGLFramebuffer | null,
      colors: readonly (WebGLTexture | null)[],
      depth: WebGLTexture | null
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
      Arr.forEach(colors, (texture, index) =>
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + index,
          gl.TEXTURE_2D,
          texture,
          0
        )
      );
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        depth,
        0
      );
    };
    attach(target.frame, [target.color, target.surface], target.depth);
    attach(target.final, [target.edged], null);
    attach(target.overlay, [target.edged], target.depth);
    attach(target.bed, [], target.seabed);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Enlarges the edged frame onto the canvas by its whole art pixel, centered,
   * moved back by `shift`, the art pixels the camera's snap rounded away, so a
   * pan glides while the pixels hold still (D20). Nothing is stretched by a
   * fraction, so the pixels stay sharp at every zoom.
   */
  function enlarge(horizon: Color, shift: readonly [number, number]) {
    const { pixel, width, height } = target;
    const left =
      Math.floor((canvas.width - width * pixel) / 2) +
      Math.round(shift[0] * pixel);
    const top =
      Math.floor((canvas.height - height * pixel) / 2) +
      Math.round(shift[1] * pixel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.final);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.clearColor(horizon[0], horizon[1], horizon[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blitFramebuffer(
      0,
      0,
      width,
      height,
      left,
      top,
      left + width * pixel,
      top + height * pixel,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }

  /**
   * Copies the scene's depth as the solid pass left it into `seabed`, which
   * the water pass reads to know how much water lies under each of its
   * pixels (D43), then draws on into the scene again.
   */
  function keepSeabed() {
    const { width, height } = target;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.frame);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.bed);
    gl.blitFramebuffer(
      0,
      0,
      width,
      height,
      0,
      0,
      width,
      height,
      gl.DEPTH_BUFFER_BIT,
      gl.NEAREST
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame);
  }

  /** Lets the GPU go of the frame's textures and framebuffers. */
  function release() {
    Arr.forEach(
      [target.color, target.surface, target.edged, target.depth, target.seabed],
      (texture) => gl.deleteTexture(texture)
    );
    Arr.forEach(
      [target.frame, target.final, target.overlay, target.bed],
      (frame) => gl.deleteFramebuffer(frame)
    );
  }

  const target = {
    bed: gl.createFramebuffer(),
    color: gl.createTexture(),
    depth: gl.createTexture(),
    edged: gl.createTexture(),
    enlarge,
    final: gl.createFramebuffer(),
    frame: gl.createFramebuffer(),
    height: 1,
    keepSeabed,
    lens: 1,
    overlay: gl.createFramebuffer(),
    pixel: 1,
    release,
    resize,
    rows: 1,
    seabed: gl.createTexture(),
    surface: gl.createTexture(),
    width: 1,
  };
  return target;
}
