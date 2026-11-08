import { useElementSize } from "@mantine/hooks";
import { Canvas } from "@react-three/fiber";
import { getPowerPreference } from "@repo/design-system/lib/device";
import { useMemo } from "react";
import { useClipCanvas } from "@/components/island/clip";
import { Descent } from "@/components/island/descent";
import { PixelPipeline } from "@/components/island/pipeline";
import { IslandScene } from "@/components/island/scene";
import { useIsland } from "@/lib/island/context";
import { artPixelFor, bufferFor, cameraFor } from "@/lib/island/view";

/**
 * The island's canvas, loaded with `import()` on intent so three.js never
 * reaches a route's first JavaScript (ADR 0042, D14). Its drawing buffer is the
 * art resolution, sized in whole art pixels and centred on a whole CSS pixel,
 * and the browser enlarges it with nearest-neighbour sampling (D15). The sky
 * above it comes from the frame's `SkyProvider` (D18).
 */
export default function IslandCanvas({
  descend = false,
  turn = 0,
  zoom,
}: {
  /** Whether the camera comes down from the sky as the canvas opens, as it does when the island's page opens. */
  descend?: boolean;
  /** Quarter turns of the island clockwise, seen from above. */
  turn?: number;
  /** An art pixel the reader chose; the island fits the frame without one. */
  zoom?: number;
}) {
  const { layout, size } = useIsland();
  const clip = useClipCanvas();
  const { height, ref, width } = useElementSize();
  const artPixel = zoom ?? artPixelFor(width, height, size);
  const buffer = bufferFor(width, height, artPixel);
  const camera = useMemo(
    () => cameraFor(size, buffer.columns, buffer.rows),
    [buffer.columns, buffer.rows, size]
  );
  const angle = (-turn * Math.PI) / 2;
  return (
    <div className="relative size-full overflow-hidden" ref={ref}>
      {width > 0 && height > 0 ? (
        <div
          className="absolute"
          style={{
            height: buffer.cssHeight,
            left: Math.floor((width - buffer.cssWidth) / 2),
            top: Math.floor((height - buffer.cssHeight) / 2),
            width: buffer.cssWidth,
          }}
        >
          <Canvas
            camera={camera}
            className="[&_canvas]:[image-rendering:pixelated]"
            dpr={1 / artPixel}
            flat
            frameloop="demand"
            gl={{
              alpha: true,
              antialias: false,
              powerPreference: getPowerPreference(),
              // A clip copies the drawn frame between frames; at art resolution keeping it costs little.
              preserveDrawingBuffer: true,
            }}
            linear
            onCreated={(state) => {
              clip.current = state.gl.domElement;
            }}
            orthographic
          >
            {descend ? <Descent /> : null}
            <PixelPipeline
              angle={angle}
              columns={buffer.columns}
              rows={buffer.rows}
              size={size}
            >
              <IslandScene angle={angle} layout={layout} size={size} />
            </PixelPipeline>
          </Canvas>
        </div>
      ) : null}
    </div>
  );
}
