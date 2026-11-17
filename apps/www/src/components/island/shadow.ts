import { Option } from "effect";
import { activate, programOf } from "@/components/island/buffers";
import { CAST_FRAGMENT, CAST_VERTEX } from "@/lib/island/shaders";
import type { Light } from "@/lib/island/sky";
import { SHADOW_SIZE, type sunViewOf } from "@/lib/island/sun";

/**
 * The sun's shadow map (ADR 0047, D43): one hard depth texture, `SHADOW_SIZE`
 * texels a side, drawn from the light's own view each frame. The chunk and
 * body programs compare each pixel's depth from the sun against it, with no
 * filtering, so a shadow's edge is as crisp as the art pixels. None when the
 * driver refuses the cast program.
 */
export function createShadow(gl: WebGL2RenderingContext) {
  return Option.map(programOf(gl, CAST_VERTEX, CAST_FRAGMENT), (program) => {
    const map = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, map);
    gl.texStorage2D(
      gl.TEXTURE_2D,
      1,
      gl.DEPTH_COMPONENT24,
      SHADOW_SIZE,
      SHADOW_SIZE
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_COMPARE_MODE,
      gl.COMPARE_REF_TO_TEXTURE
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const frame = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      map,
      0
    );
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const viewProjection = gl.getUniformLocation(program, "uViewProjection");
    const atlasUnit = gl.getUniformLocation(program, "uAtlas");

    return {
      /**
       * Clears the map and draws what casts a shadow from the light's view
       * `sun` through `casters`, which starts with the cast program in use
       * and may switch to its own for the bodies. The map leaves `unit` while
       * it is drawn into, so no program reads it then.
       */
      cast(sun: Float32Array, unit: number, casters: () => void) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
        gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        activate(gl, program);
        gl.uniformMatrix4fv(viewProjection, false, sun);
        gl.uniform1i(atlasUnit, 0);
        casters();
      },
      /** Gives a program, by its uniform finder `at`, the sun's view of the world, the light's direction and the map on texture unit `unit` (D43). */
      shine(
        at: (name: string) => WebGLUniformLocation | null,
        light: Light,
        sun: ReturnType<typeof sunViewOf>,
        unit: number
      ) {
        gl.uniformMatrix4fv(at("uSunView"), false, sun.matrix);
        gl.uniform3fv(at("uToward"), light.toward);
        gl.uniform1f(at("uShadowTexel"), sun.texel);
        gl.uniform1i(at("uShadowMap"), unit);
      },
      /** Puts the map on texture unit `unit` for the programs that read it. */
      bind(unit: number) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, map);
        gl.activeTexture(gl.TEXTURE0);
      },
      /** Lets the GPU go of the map and its program. */
      release() {
        gl.deleteTexture(map);
        gl.deleteFramebuffer(frame);
        gl.deleteProgram(program);
      },
    };
  });
}
