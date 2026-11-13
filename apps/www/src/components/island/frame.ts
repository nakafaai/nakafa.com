import { Array as Arr } from "effect";

/** The art pixel for a screen: a whole number of device pixels, so its short side spans about 270 art pixels. */
function artPixelOf(width: number, height: number) {
  return Math.max(1, Math.round(Math.min(width, height) / 270));
}

/**
 * The small frame the island is drawn into (ADR 0047, D2 and D20): the
 * scene's colors, the direction of each pixel's face and its depth, then the
 * edged frame the edge pass paints, which the weather and the aim outline are
 * drawn over against the scene's depth. It follows the canvas's size in
 * whole art pixels.
 */
export function createFrame(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement
) {
  /** Sizes the small frame to the canvas, in whole art pixels. */
  function resize() {
    const pixel = artPixelOf(canvas.width, canvas.height);
    const width = Math.max(1, Math.floor(canvas.width / pixel));
    const height = Math.max(1, Math.floor(canvas.height / pixel));
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
    const attach = (
      frame: WebGLFramebuffer | null,
      colors: readonly (WebGLTexture | null)[],
      depth: boolean
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
        depth ? target.depth : null,
        0
      );
    };
    attach(target.frame, [target.color, target.surface], true);
    attach(target.final, [target.edged], false);
    attach(target.overlay, [target.edged], true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Lets the GPU go of the frame's textures and framebuffers. */
  function release() {
    Arr.forEach(
      [target.color, target.surface, target.edged, target.depth],
      (texture) => gl.deleteTexture(texture)
    );
    Arr.forEach([target.frame, target.final, target.overlay], (frame) =>
      gl.deleteFramebuffer(frame)
    );
  }

  const target = {
    color: gl.createTexture(),
    depth: gl.createTexture(),
    edged: gl.createTexture(),
    final: gl.createFramebuffer(),
    frame: gl.createFramebuffer(),
    height: 1,
    overlay: gl.createFramebuffer(),
    release,
    resize,
    surface: gl.createTexture(),
    width: 1,
  };
  return target;
}
