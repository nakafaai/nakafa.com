import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect } from "react";
import { useAmbientLoop } from "@/components/island/loop";
import { gradePass, usePasses } from "@/components/island/passes";
import { useSkyStore } from "@/components/island/sky";
import { Water } from "@/components/island/water";
import { gradeOf } from "@/lib/island/sky";

/**
 * Draws the island in three passes at the art resolution (ADR 0042, D15): the
 * scene into a colour and normal target with its depth, the outline, sky and
 * weather pass into a second target, graded by the sky of the moment (D18),
 * and that target to the screen with the water drawn over it. Each pass clears
 * its target first, as the renderer does by default. The browser enlarges the
 * canvas with nearest-neighbour sampling.
 */
export function PixelPipeline({
  angle,
  children,
  columns,
  rows,
  size,
}: {
  angle: number;
  children: ReactNode;
  columns: number;
  rows: number;
  size: number;
}) {
  const passes = usePasses(columns, rows);
  const afterFrame = useAmbientLoop();
  const sky = useSkyStore();
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => sky.subscribe(() => invalidate()), [invalidate, sky]);
  useEffect(
    () => () => {
      passes.scene.dispose();
      passes.outlined.dispose();
    },
    [passes]
  );
  useFrame((state) => {
    const startedAt = performance.now();
    const renderer = state.gl;
    const { phase, weather } = sky.getState();
    gradePass(passes.grade, gradeOf(phase, weather), state.clock.elapsedTime);
    renderer.setRenderTarget(passes.scene);
    renderer.render(state.scene, state.camera);
    renderer.setRenderTarget(passes.outlined);
    renderer.render(passes.outline, passes.flat);
    renderer.setRenderTarget(null);
    renderer.render(passes.screen, state.camera);
    // The browser specs wait on these marks: the first finished frame, and the sky it drew.
    renderer.domElement.toggleAttribute("data-drawn", true);
    renderer.domElement.setAttribute("data-sky", `${phase} ${weather}`);
    afterFrame(startedAt);
  }, 1);
  return (
    <>
      {children}
      {createPortal(
        <group position={[size / 2, 0, size / 2]} rotation={[0, angle, 0]}>
          <group position={[-size / 2, 0, -size / 2]}>
            <Water outlined={passes.outlined} scene={passes.scene} />
          </group>
        </group>,
        passes.screen
      )}
    </>
  );
}
