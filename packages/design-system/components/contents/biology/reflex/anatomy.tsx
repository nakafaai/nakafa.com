import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/**
 * Builds sculpted anatomical spinal cord cross-section (white matter with
 * anterior/posterior fissures + butterfly grey matter H-core) and curved
 * sensory, relay, and motor neuron pathways for ReflexArcScene.
 */
export function useReflexGeometries() {
  const assets = useMemo(() => {
    // Authentic oval spinal cord white matter cross-section with dorsal sulcus & ventral fissure.
    const whiteShape = new Shape();
    whiteShape.moveTo(0, 0.34);
    whiteShape.bezierCurveTo(0.28, 0.36, 0.52, 0.22, 0.52, 0);
    whiteShape.bezierCurveTo(0.52, -0.24, 0.3, -0.36, 0.05, -0.33);
    whiteShape.lineTo(0, -0.2);
    whiteShape.lineTo(-0.05, -0.33);
    whiteShape.bezierCurveTo(-0.3, -0.36, -0.52, -0.24, -0.52, 0);
    whiteShape.bezierCurveTo(-0.52, 0.22, -0.28, 0.36, 0, 0.34);
    const whiteMatter = new ExtrudeGeometry(whiteShape, {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.028,
      bevelThickness: 0.032,
      depth: 0.36,
    });
    whiteMatter.translate(0, 0, -0.18);

    // Authentic butterfly-shaped grey matter H-core (dorsal & ventral horns + grey commissure).
    const greyShape = new Shape();
    greyShape.moveTo(-0.08, 0.05);
    greyShape.bezierCurveTo(-0.18, 0.14, -0.22, 0.26, -0.31, 0.24);
    greyShape.bezierCurveTo(-0.36, 0.21, -0.26, 0.08, -0.22, 0);
    greyShape.bezierCurveTo(-0.26, -0.09, -0.38, -0.18, -0.28, -0.25);
    greyShape.bezierCurveTo(-0.18, -0.28, -0.12, -0.14, -0.07, -0.05);
    greyShape.lineTo(0.07, -0.05);
    greyShape.bezierCurveTo(0.12, -0.14, 0.18, -0.28, 0.28, -0.25);
    greyShape.bezierCurveTo(0.38, -0.18, 0.26, -0.09, 0.22, 0);
    greyShape.bezierCurveTo(0.26, 0.08, 0.36, 0.21, 0.31, 0.24);
    greyShape.bezierCurveTo(0.22, 0.26, 0.18, 0.14, 0.08, 0.05);
    greyShape.closePath();
    const greyMatter = new ExtrudeGeometry(greyShape, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.012,
      bevelThickness: 0.016,
      depth: 0.4,
    });
    greyMatter.translate(0, 0, -0.2);

    // Curved sensory pathway: skin receptor -> dorsal root ganglion -> dorsal horn.
    const sensoryCurve = new CatmullRomCurve3([
      new Vector3(-1.16, 0.28, 0.34),
      new Vector3(-0.92, 0.56, 0.26),
      new Vector3(-0.62, 0.84, 0.16),
      new Vector3(-0.26, 0.78, 0.14),
    ]);
    const sensoryTube = new TubeGeometry(sensoryCurve, 36, 0.024, 12, false);

    // Curved relay interneuron inside grey matter (dorsal horn -> ventral horn).
    const relayCurve = new CatmullRomCurve3([
      new Vector3(-0.22, 0.74, 0.22),
      new Vector3(0, 0.64, 0.24),
      new Vector3(0.22, 0.46, 0.22),
    ]);
    const relayTube = new TubeGeometry(relayCurve, 22, 0.022, 10, false);

    // Curved motor pathway: ventral horn -> ventral root -> effector skeletal muscle.
    const motorCurve = new CatmullRomCurve3([
      new Vector3(0.26, 0.44, 0.14),
      new Vector3(0.62, 0.36, 0.18),
      new Vector3(0.92, 0.34, 0.28),
      new Vector3(1.16, 0.3, 0.34),
    ]);
    const motorTube = new TubeGeometry(motorCurve, 36, 0.024, 12, false);

    // Continuous full-arc spline for smooth action potential propagation.
    const impulseCurve = new CatmullRomCurve3([
      new Vector3(-1.16, 0.28, 0.34),
      new Vector3(-0.88, 0.6, 0.24),
      new Vector3(-0.56, 0.84, 0.18),
      new Vector3(-0.22, 0.74, 0.24),
      new Vector3(0, 0.62, 0.26),
      new Vector3(0.24, 0.44, 0.24),
      new Vector3(0.62, 0.36, 0.2),
      new Vector3(1.16, 0.3, 0.34),
    ]);

    // Myelin sheath Schwann-cell beads along sensory & motor axons (Nodes of Ranvier visible).
    const sensoryMyelin = Arr.map([0.18, 0.36, 0.56, 0.76] as const, (t) => {
      const p = sensoryCurve.getPoint(t);
      return { id: `sm-${t}`, pos: [p.x, p.y, p.z] as const };
    });
    const motorMyelin = Arr.map([0.22, 0.44, 0.66, 0.84] as const, (t) => {
      const p = motorCurve.getPoint(t);
      return { id: `mm-${t}`, pos: [p.x, p.y, p.z] as const };
    });

    return {
      greyMatter,
      impulseCurve,
      motorMyelin,
      motorTube,
      relayTube,
      sensoryMyelin,
      sensoryTube,
      whiteMatter,
    };
  }, []);

  useEffect(
    () => () => {
      assets.whiteMatter.dispose();
      assets.greyMatter.dispose();
      assets.sensoryTube.dispose();
      assets.relayTube.dispose();
      assets.motorTube.dispose();
    },
    [assets]
  );

  return assets;
}
