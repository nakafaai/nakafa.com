import { useGLTF } from "@react-three/drei";
import {
  CC0_DEER_ASSET,
  CC0_FOX_ASSET,
} from "@repo/design-system/components/contents/biology/assets";
import { prepareFaunaScene } from "@repo/design-system/components/contents/biology/fauna";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/** Sculpted mossy nurse log and rising thermal heat-loss ribbons for the trophic pyramid. */
export function useTrophicProps() {
  const assets = useMemo(() => {
    const log = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.22, 0.07, 0.08),
        new Vector3(0, 0.09, 0),
        new Vector3(0.2, 0.06, -0.08),
      ]),
      14,
      0.09,
      12,
      false
    );

    const heatRibbonA = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.08, 0.24, 0.04),
        new Vector3(-0.04, 0.48, -0.04),
        new Vector3(0.06, 0.72, 0.02),
      ]),
      24,
      0.022,
      8,
      false
    );
    const heatRibbonB = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.16, 0.14, -0.05),
        new Vector3(0.24, 0.36, 0.03),
        new Vector3(0.12, 0.58, -0.02),
        new Vector3(0.2, 0.82, 0.04),
      ]),
      24,
      0.018,
      8,
      false
    );

    return { heatRibbonA, heatRibbonB, log };
  }, []);

  useEffect(
    () => () => {
      assets.log.dispose();
      assets.heatRibbonA.dispose();
      assets.heatRibbonB.dispose();
    },
    [assets]
  );
  return assets;
}

/** Real CC0 grazing deer specimen grounded flush on its trophic deck. */
export function TrophicDeerSpecimen({
  position,
  rotationY,
  scale,
}: {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly scale: number;
}) {
  const { scene } = useGLTF(CC0_DEER_ASSET.path);
  const deer = useMemo(
    () =>
      prepareFaunaScene(scene, {
        groundBottom: true,
        targetExtent: 0.32,
      }),
    [scene]
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={deer} />
    </group>
  );
}

/** Real CC0 mid-tier fox predator specimen grounded flush on its trophic deck. */
export function TrophicFoxSpecimen({
  position,
  rotationY,
  scale,
}: {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly scale: number;
}) {
  const { scene } = useGLTF(CC0_FOX_ASSET.path);
  const fox = useMemo(
    () =>
      prepareFaunaScene(scene, {
        groundBottom: true,
        targetExtent: 0.34,
      }),
    [scene]
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={fox} />
    </group>
  );
}

useGLTF.preload(CC0_DEER_ASSET.path);
useGLTF.preload(CC0_FOX_ASSET.path);
