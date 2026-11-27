import type {
  Panel,
  Point,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  bandPath,
  STICK,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { BUNDLE_COLORS } from "@repo/design-system/lib/material/bundle";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo } from "react";
import type { InstancedMesh, Object3D } from "three";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/**
 * One ice-cream stick: a flat strip with round ends and softened edges,
 * lying along x, its middle at the origin.
 */
export function useStickGeometry() {
  const geometry = useMemo(() => {
    const half = STICK.length / 2;
    const end = STICK.width / 2;
    const outline = new Shape();
    outline.moveTo(-half + end, -end);
    outline.lineTo(half - end, -end);
    outline.absarc(half - end, 0, end, -Math.PI / 2, Math.PI / 2, false);
    outline.lineTo(-half + end, end);
    outline.absarc(-half + end, 0, end, Math.PI / 2, (3 * Math.PI) / 2, false);
    const strip = new ExtrudeGeometry(outline, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.0003,
      bevelThickness: 0.0003,
      curveSegments: 10,
      depth: STICK.thickness - 0.0006,
    });
    strip.rotateX(-Math.PI / 2);
    strip.center();
    return strip;
  }, []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** A rubber band round the middle of a bundle of `base` sticks, from the bundle's bottom middle. */
export function useBandGeometry(base: number) {
  const geometry = useMemo(() => {
    const path = new CatmullRomCurve3(
      Arr.map(bandPath(base, 6), ({ x, y, z }) => new Vector3(x, y, z)),
      true
    );
    return new TubeGeometry(path, 96, 0.0009, 12, true);
  }, [base]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The birch of the sticks, its grain along each stick. */
export function StickWood() {
  return <Matter of="maple" />;
}

/** The red rubber of a band. */
export function BandRubber() {
  return <Matter color={BUNDLE_COLORS.band} of="rubber" />;
}

/** The plain brown board of a kraft-card box. */
export function KraftCard() {
  return <Matter color={BUNDLE_COLORS.box} of="paper" />;
}

/** The waxed beech of a tray. */
export function TrayBeech() {
  return <Matter of="beech" />;
}

/**
 * The open containers of one kind, boxes or trays: one instanced mesh for
 * each of their panels, so every container of the kind costs five draw
 * calls, all in the material given as `children`. The scene places them
 * through `meshes`.
 */
export function PanelSet({
  capacity,
  children,
  meshes,
  panels,
}: {
  readonly capacity: number;
  readonly children: ReactNode;
  readonly meshes: { readonly current: (InstancedMesh | null)[] };
  readonly panels: readonly Panel[];
}) {
  return (
    <group>
      {Arr.map(panels, (panel, index) => (
        <instancedMesh
          args={[undefined, undefined, capacity]}
          castShadow
          frustumCulled={false}
          key={`${panel.at.x}-${panel.at.z}`}
          receiveShadow
          ref={(mesh) => {
            meshes.current[index] = mesh;
          }}
        >
          <boxGeometry args={panel.size} />
          {children}
        </instancedMesh>
      ))}
    </group>
  );
}

/** Places every container of a set: the panels of container `index` round the point `at`, and hides the rest. */
export function placePanels(
  meshes: readonly (InstancedMesh | null)[],
  panels: readonly Panel[],
  places: readonly Point[],
  dummy: Object3D
) {
  Arr.forEach(panels, (panel, index) => {
    const mesh = meshes[index];
    if (!mesh) {
      return;
    }
    Arr.forEach(places, (at, slot) => {
      dummy.position.set(
        at.x + panel.at.x,
        at.y + panel.at.y,
        at.z + panel.at.z
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(slot, dummy.matrix);
    });
    mesh.count = places.length;
    mesh.instanceMatrix.needsUpdate = true;
  });
}
