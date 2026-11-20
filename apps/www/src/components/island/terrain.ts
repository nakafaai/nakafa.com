import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import {
  activate,
  seaRing,
  uploadList,
  uploadMap,
} from "@/components/island/buffers";
import type { createFrame } from "@/components/island/frame";
import { ATLAS_TILES, SLOTS } from "@/lib/island/atlas";
import { coastOf } from "@/lib/island/coast";
import { columnsOf } from "@/lib/island/ground";
import type { islesMesh } from "@/lib/island/isles";
import { CLIP } from "@/lib/island/matrix";
import type { meshChunk } from "@/lib/island/mesh";
import { DEEP } from "@/lib/island/terrain";
import type { Cells } from "@/lib/island/world";
import { CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/** The texture unit the column map takes while the blocks are drawn: the atlas holds 0, the depth under the water 1, the wind's lean map 2. */
const COLUMNS = 3;

/** The texture unit the depth under the water takes, which the water pass reads (D43). */
const SEABED = 1;

/** The texture unit the coast map takes while the water is drawn: how far each column lies from land, and whether its water lies still (D51). */
const COAST = 5;

/** The texture unit the solid pass's colors take while the water is drawn, which still water mirrors (D51). */
const SCENE = 6;

/** A uniform finder of the chunk program. */
type Uniforms = (name: string) => WebGLUniformLocation | null;

/** The atlas tile a slot sits in, as its column and row. */
function tileOf(slot: number) {
  return [slot % ATLAS_TILES, Math.floor(slot / ATLAS_TILES)] as const;
}

/**
 * The island's ground and water on the GPU (ADR 0047, D2): every chunk's
 * solid, tuft and water lists, the sea floor and the sea past the world's
 * cells, the other isles (D23), and the maps the cells decide beside them,
 * which columns hold what (D39) and how far each lies from land (D51). It
 * draws them with the chunk program: the solid pass, then the water over it.
 */
export function createTerrain(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  atlas: WebGLTexture | null
) {
  const chunks = Arr.makeBy(CHUNKS * CHUNKS, () => ({
    solid: Option.none<ReturnType<typeof uploadList>>(),
    tufts: Option.none<ReturnType<typeof uploadList>>(),
    water: Option.none<ReturnType<typeof uploadList>>(),
  }));
  const sea = uploadList(gl, seaRing(SEA_LEVEL - 0.125, [0, 0], 1));
  const [sandColumn, sandRow] = tileOf(SLOTS.sand);
  const floor = uploadList(
    gl,
    seaRing(
      SEA_LEVEL - DEEP,
      [(sandColumn + 0.5) / ATLAS_TILES, (sandRow + 0.5) / ATLAS_TILES],
      0.35
    )
  );
  // What tops each column: where a drop stops and which ground the blocks blend (D39).
  const columns = uploadMap(gl, SPAN, 2);
  // How far each column lies from land and whether its water lies still, which the water pass reads (D51).
  const coast = uploadMap(gl, SPAN, 2);
  let isles = Option.none<ReturnType<typeof uploadList>>();
  const uniform: Uniforms = (name) => gl.getUniformLocation(program, name);
  const waterTile = tileOf(SLOTS.water);

  /** Draws one list's triangles. */
  const drawList = (list: ReturnType<typeof uploadList>) => {
    gl.bindVertexArray(list.vao);
    gl.drawElements(gl.TRIANGLES, list.count, gl.UNSIGNED_INT, 0);
  };

  /** Draws one pass of every chunk's lists. */
  const drawLists = (pass: "solid" | "tufts" | "water") => {
    for (const chunk of chunks) {
      Option.map(chunk[pass], drawList);
    }
  };

  return {
    /** The column map, which the air reads too: where a drop stops (D33). */
    columns,
    /** Replaces the maps the cells decide beside the chunks: the column map (D39) and the coast map (D51). */
    maps(cells: Cells) {
      columns.write(columnsOf(cells));
      coast.write(coastOf(cells));
    },
    /** Sets the other isles of the archipelago, drawn with the blocks from then on (D23). */
    isles(mesh: ReturnType<typeof islesMesh>) {
      Option.map(isles, (list) => list.release());
      isles = Option.some(uploadList(gl, mesh));
    },
    /** Replaces one chunk's buffers with its new mesh. */
    upload(index: number, mesh: ReturnType<typeof meshChunk>) {
      const slot = chunks[index];
      for (const pass of ["solid", "tufts", "water"] as const) {
        Option.map(slot[pass], (list) => list.release());
        slot[pass] =
          mesh[pass].indices.length > 0
            ? Option.some(uploadList(gl, mesh[pass]))
            : Option.none();
      }
    },
    /** Draws what casts the sun's shadow with the cast program already in use (D43): every solid face and the isles. */
    cast() {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      drawLists("solid");
      Option.map(isles, drawList);
    },
    /**
     * Draws the sea floor and every solid face from `camera`, lit by `lit`,
     * the tufts when `tufts` allows them (D44), then `between` (the island's
     * life), then the water over them, which reads the depth and the colors
     * the solid pass left in `frame` (D43, D51).
     */
    draw({
      between,
      camera,
      frame,
      lit,
      tufts,
    }: {
      readonly between: () => void;
      readonly camera: Float32Array;
      readonly frame: ReturnType<typeof createFrame>;
      readonly lit: (at: Uniforms) => void;
      readonly tufts: boolean;
    }) {
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.CULL_FACE);
      activate(gl, program);
      gl.uniformMatrix4fv(uniform("uViewProjection"), false, camera);
      gl.uniform2f(uniform("uWaterTile"), waterTile[0], waterTile[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.uniform1i(uniform("uAtlas"), 0);
      // The edge pass leaves the frame's own faces on unit 1, which this pass must not read while it draws them.
      gl.activeTexture(gl.TEXTURE0 + SEABED);
      gl.bindTexture(gl.TEXTURE_2D, frame.seabed);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(uniform("uSeabed"), SEABED);
      gl.uniform2f(uniform("uClip"), CLIP.near, CLIP.far);
      gl.uniform1f(uniform("uSea"), SEA_LEVEL);
      columns.bind(COLUMNS);
      gl.uniform1i(uniform("uColumns"), COLUMNS);
      lit(uniform);
      gl.uniform1f(uniform("uWater"), 0);
      drawList(floor);
      drawLists("solid");
      Option.map(isles, drawList);
      gl.disable(gl.CULL_FACE);
      if (tufts) {
        drawLists("tufts");
      }
      between();
      // The water reads how much of it lies under each pixel from the depth the solid pass left (D43).
      frame.keepSeabed();
      activate(gl, program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      // Water tints what lies under it but keeps those faces' edges (D20).
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.uniform1f(uniform("uWater"), 1);
      // The water rolls toward the shore by the coast map, and still water mirrors the colors the solid pass left (D51).
      coast.bind(COAST);
      gl.uniform1i(uniform("uCoast"), COAST);
      gl.activeTexture(gl.TEXTURE0 + SCENE);
      gl.bindTexture(gl.TEXTURE_2D, frame.scene);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(uniform("uScene"), SCENE);
      drawLists("water");
      drawList(sea);
    },
    /** Lets the GPU go of every list and map. */
    release() {
      for (const chunk of chunks) {
        Option.map(chunk.solid, (list) => list.release());
        Option.map(chunk.tufts, (list) => list.release());
        Option.map(chunk.water, (list) => list.release());
      }
      Option.map(isles, (list) => list.release());
      sea.release();
      floor.release();
      columns.release();
      coast.release();
    },
  };
}
