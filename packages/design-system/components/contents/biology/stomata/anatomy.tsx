import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

function buildGuardCrescent(side: -1 | 1, openFraction: number) {
  // Both ends stay anchored at the stomatal poles (z = +/- 0.44) while the belly bows outward with turgor.
  const poleX = side * 0.085;
  const midBow = side * (0.14 + openFraction * 0.27);
  const shoulderBow = side * (0.125 + openFraction * 0.21);

  const outerCurve = new CatmullRomCurve3([
    new Vector3(poleX, 0, -0.44),
    new Vector3(shoulderBow, 0.02, -0.24),
    new Vector3(midBow, 0.03, 0),
    new Vector3(shoulderBow, 0.02, 0.24),
    new Vector3(poleX, 0, 0.44),
  ]);

  const innerOffset = -side * 0.082;
  const innerCurve = new CatmullRomCurve3([
    new Vector3(poleX + innerOffset * 0.45, 0.01, -0.39),
    new Vector3(shoulderBow + innerOffset * 0.9, 0.02, -0.2),
    new Vector3(midBow + innerOffset, 0.03, 0),
    new Vector3(shoulderBow + innerOffset * 0.9, 0.02, 0.2),
    new Vector3(poleX + innerOffset * 0.45, 0.01, 0.39),
  ]);

  const outerTube = new TubeGeometry(outerCurve, 28, 0.135, 18, false);
  // Taper the polar ends so the two guard cells fuse like real kidney beans instead of blunt cylinders.
  const pos = outerTube.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const pz = pos.getZ(i);
    const t = Math.min(1, Math.max(0, (pz + 0.44) / 0.88));
    const swell = 0.56 + 0.48 * Math.sin(t * Math.PI) ** 0.55;
    const center = outerCurve.getPoint(t);
    pos.setXYZ(
      i,
      center.x + (pos.getX(i) - center.x) * swell,
      center.y + (pos.getY(i) - center.y) * swell * 0.78,
      pz
    );
  }
  outerTube.computeVertexNormals();

  const innerWall = new TubeGeometry(innerCurve, 24, 0.044, 12, false);

  const vacuoleScale = 0.48 + openFraction * 0.52;
  const vacuoleTube = new TubeGeometry(
    outerCurve,
    20,
    0.072 * vacuoleScale,
    12,
    false
  );
  const vPos = vacuoleTube.attributes.position;
  for (let i = 0; i < vPos.count; i += 1) {
    const pz = vPos.getZ(i);
    const t = Math.min(1, Math.max(0, (pz + 0.44) / 0.88));
    const taper = Math.sin(t * Math.PI) ** 0.7;
    const center = outerCurve.getPoint(t);
    vPos.setXYZ(
      i,
      center.x + (vPos.getX(i) - center.x) * taper,
      center.y + (vPos.getY(i) - center.y) * taper * 0.7,
      pz
    );
  }
  vacuoleTube.computeVertexNormals();

  // Radial cellulose microfibril hoops + biconvex chloroplast slots along the outer arc.
  const microfibrils = Arr.makeBy(7, (idx) => {
    const t = 0.14 + (idx / 6) * 0.72;
    const pt = outerCurve.getPoint(t);
    const tan = outerCurve.getTangent(t);
    const yaw = Math.atan2(tan.x, tan.z);
    const r = 0.118 * (0.56 + 0.48 * Math.sin(t * Math.PI) ** 0.55);
    return {
      id: `mf-${side}-${idx}`,
      pos: [pt.x, pt.y, pt.z] as const,
      r,
      yaw,
    };
  });

  const chloroplasts = Arr.makeBy(5, (idx) => {
    const t = 0.18 + (idx / 4) * 0.64;
    const pt = outerCurve.getPoint(t);
    return {
      id: `chl-${side}-${idx}`,
      pos: [pt.x + side * 0.04, pt.y + 0.065, pt.z] as const,
    };
  });

  return {
    chloroplasts,
    innerWall,
    microfibrils,
    outerTube,
    vacuoleTube,
  };
}

/** Microscopic stomatal complex geometries: interlocking jigsaw epidermal pavement cells, dynamic crescent guard cells, thick inner walls, radial microfibrils, and almond pore cavity. */
export function useStomataGeometries(openFraction: number) {
  const staticGeos = useMemo(() => {
    // 8 interlocking wavy jigsaw pavement cells hugging closely around the stomatal pore cavity.
    const pavementCells = Arr.makeBy(8, (idx) => {
      const a0 = (idx / 8) * Math.PI * 2;
      const a1 = ((idx + 1) / 8) * Math.PI * 2;
      const aMid = (a0 + a1) * 0.5;
      const rIn = 0.34;
      const rOut = 1.24;
      const shape = new Shape();
      shape.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn * 1.12);
      shape.quadraticCurveTo(
        Math.cos(aMid) * (rIn + 0.05),
        Math.sin(aMid) * (rIn + 0.05) * 1.12,
        Math.cos(a1) * rIn,
        Math.sin(a1) * rIn * 1.12
      );
      shape.bezierCurveTo(
        Math.cos(a1 + 0.09) * 0.82,
        Math.sin(a1 + 0.09) * 0.82,
        Math.cos(a1 - 0.07) * 1.04,
        Math.sin(a1 - 0.07) * 1.04,
        Math.cos(a1) * rOut,
        Math.sin(a1) * rOut
      );
      shape.quadraticCurveTo(
        Math.cos(aMid) * (rOut + 0.07),
        Math.sin(aMid) * (rOut + 0.07),
        Math.cos(a0) * rOut,
        Math.sin(a0) * rOut
      );
      shape.bezierCurveTo(
        Math.cos(a0 - 0.07) * 1.04,
        Math.sin(a0 - 0.07) * 1.04,
        Math.cos(a0 + 0.09) * 0.82,
        Math.sin(a0 + 0.09) * 0.82,
        Math.cos(a0) * rIn,
        Math.sin(a0) * rIn
      );
      const geo = new ExtrudeGeometry(shape, {
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.018,
        bevelThickness: 0.022,
        depth: 0.09,
      });
      geo.rotateX(-Math.PI / 2);
      return { geo, id: `pv-${idx}` };
    });

    return { pavementCells };
  }, []);

  useEffect(
    () => () => {
      for (const cell of staticGeos.pavementCells) {
        cell.geo.dispose();
      }
    },
    [staticGeos]
  );

  const dynamicGeos = useMemo(() => {
    const left = buildGuardCrescent(-1, openFraction);
    const right = buildGuardCrescent(1, openFraction);

    // Almond/lens-shaped stomatal pore opening matching inner wall contour.
    const poreHalfW = Math.max(0.016, openFraction * 0.23);
    const poreShape = new Shape();
    poreShape.moveTo(0, -0.38);
    poreShape.quadraticCurveTo(poreHalfW * 1.35, 0, 0, 0.38);
    poreShape.quadraticCurveTo(-poreHalfW * 1.35, 0, 0, -0.38);
    const poreVoid = new ExtrudeGeometry(poreShape, {
      bevelEnabled: false,
      depth: 0.04,
    });
    poreVoid.rotateX(-Math.PI / 2);

    return { left, poreVoid, right };
  }, [openFraction]);

  useEffect(
    () => () => {
      dynamicGeos.left.outerTube.dispose();
      dynamicGeos.left.innerWall.dispose();
      dynamicGeos.left.vacuoleTube.dispose();
      dynamicGeos.right.outerTube.dispose();
      dynamicGeos.right.innerWall.dispose();
      dynamicGeos.right.vacuoleTube.dispose();
      dynamicGeos.poreVoid.dispose();
    },
    [dynamicGeos]
  );

  return { dynamicGeos, staticGeos };
}
