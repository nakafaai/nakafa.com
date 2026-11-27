import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

function roundedHexShape(rx: number, ry: number): Shape {
  const shape = new Shape();
  const pts = Arr.makeBy(6, (i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * rx, Math.sin(a) * ry] as const;
  });
  for (let i = 0; i < 6; i += 1) {
    const curr = pts[i];
    const next = pts[(i + 1) % 6];
    const prev = pts[(i + 5) % 6];
    const mx0 = curr[0] * 0.72 + prev[0] * 0.28;
    const my0 = curr[1] * 0.72 + prev[1] * 0.28;
    const mx1 = curr[0] * 0.72 + next[0] * 0.28;
    const my1 = curr[1] * 0.72 + next[1] * 0.28;
    if (i === 0) {
      shape.moveTo(mx0, my0);
    } else {
      shape.lineTo(mx0, my0);
    }
    shape.quadraticCurveTo(curr[0], curr[1], mx1, my1);
  }
  shape.closePath();
  return shape;
}

/** Organic cellular root cross-section geometries: granular soil bed, curved root hair, polygonal parenchyma, Casparian endodermis, lignified xylem, water teardrops. */
export function useRootAnatomyGeometries() {
  const geos = useMemo(() => {
    // Organic undulating dark soil cutaway mound on the left.
    const soilShape = new Shape();
    soilShape.moveTo(-0.38, -0.32);
    soilShape.lineTo(0.32, -0.32);
    soilShape.quadraticCurveTo(0.35, 0.0, 0.3, 0.26);
    soilShape.bezierCurveTo(0.14, 0.34, -0.06, 0.26, -0.22, 0.32);
    soilShape.quadraticCurveTo(-0.38, 0.32, -0.38, 0.14);
    soilShape.closePath();
    const soilMound = new ExtrudeGeometry(soilShape, {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.03,
      bevelThickness: 0.035,
      depth: 0.56,
    });
    soilMound.translate(0, 0, -0.28);

    // Living tubular root hair tapering gently into the moist soil.
    const hairCurve = new CatmullRomCurve3([
      new Vector3(-0.5, 0.56, 0.02),
      new Vector3(-0.74, 0.57, 0.04),
      new Vector3(-0.98, 0.54, 0.05),
      new Vector3(-1.18, 0.51, 0.03),
    ]);
    const rootHairOuter = new TubeGeometry(hairCurve, 28, 0.062, 16, false);
    // Gently taper the tip of the root hair for realistic apical shape.
    const hp = rootHairOuter.attributes.position;
    for (let i = 0; i < hp.count; i += 1) {
      const px = hp.getX(i);
      const t = Math.min(1, Math.max(0, (-0.5 - px) / 0.68));
      const scale = 1 - t * 0.38;
      const center = hairCurve.getPoint(Math.min(1, Math.max(0, t)));
      hp.setXYZ(
        i,
        px,
        center.y + (hp.getY(i) - center.y) * scale,
        center.z + (hp.getZ(i) - center.z) * scale
      );
    }
    rootHairOuter.computeVertexNormals();

    const rootHairVacuole = new TubeGeometry(hairCurve, 22, 0.036, 12, false);

    // Rounded epidermal, cortical parenchyma, and barrel endodermal cells.
    const epidermisCell = new ExtrudeGeometry(roundedHexShape(0.088, 0.125), {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.016,
      bevelThickness: 0.022,
      depth: 0.44,
    });
    epidermisCell.translate(0, 0, -0.22);

    const cortexCell = new ExtrudeGeometry(roundedHexShape(0.118, 0.122), {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.018,
      bevelThickness: 0.024,
      depth: 0.42,
    });
    cortexCell.translate(0, 0, -0.21);

    const cortexVacuole = new ExtrudeGeometry(roundedHexShape(0.068, 0.072), {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.008,
      bevelThickness: 0.01,
      depth: 0.34,
    });
    cortexVacuole.translate(0, 0, -0.17);

    const endodermisCell = new ExtrudeGeometry(roundedHexShape(0.082, 0.124), {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.014,
      bevelThickness: 0.02,
      depth: 0.44,
    });
    endodermisCell.translate(0, 0, -0.22);

    // Waxy Casparian strip collar sealing endodermal radial walls.
    const casparianLoop = new TubeGeometry(
      new CatmullRomCurve3(
        [
          new Vector3(0, -0.37, 0.24),
          new Vector3(0, 0.37, 0.24),
          new Vector3(0, 0.37, -0.24),
          new Vector3(0, -0.37, -0.24),
        ],
        true
      ),
      32,
      0.018,
      10,
      true
    );

    // Hollow lignified xylem vessel with front cutaway facing +Z.
    const xylemPts = [
      new Vector2(0.115, -0.38),
      new Vector2(0.15, -0.38),
      new Vector2(0.15, 0.38),
      new Vector2(0.115, 0.38),
      new Vector2(0.115, -0.38),
    ];
    const xylemTube = new LatheGeometry(
      xylemPts,
      28,
      Math.PI * 0.25,
      Math.PI * 1.5
    );

    // Teardrop refractive water droplet profile.
    const dropPts = Arr.map(Arr.range(0, 14), (s) => {
      const t = s / 14;
      const y = (t - 0.5) * 0.1;
      const r = Math.max(
        0.002,
        Math.sin(t * Math.PI) ** 0.72 * 0.044 * (1 - t * 0.45)
      );
      return new Vector2(r, y);
    });
    const waterDroplet = new LatheGeometry(dropPts, 16);

    // Symplast water flow curve from moist soil -> root hair -> cortex -> endodermis -> xylem.
    const waterPath = new CatmullRomCurve3([
      new Vector3(-1.24, 0.52, 0.25),
      new Vector3(-0.88, 0.56, 0.26),
      new Vector3(-0.48, 0.58, 0.27),
      new Vector3(-0.08, 0.62, 0.27),
      new Vector3(0.32, 0.57, 0.27),
      new Vector3(0.68, 0.58, 0.26),
      new Vector3(0.98, 0.68, 0.16),
    ]);

    const ionPath = new CatmullRomCurve3([
      new Vector3(-1.18, 0.42, 0.25),
      new Vector3(-0.8, 0.46, 0.27),
      new Vector3(-0.42, 0.44, 0.28),
      new Vector3(0.0, 0.46, 0.28),
      new Vector3(0.4, 0.44, 0.28),
      new Vector3(0.68, 0.46, 0.27),
      new Vector3(0.98, 0.5, 0.16),
    ]);

    return {
      casparianLoop,
      cortexCell,
      cortexVacuole,
      endodermisCell,
      epidermisCell,
      ionPath,
      rootHairOuter,
      rootHairVacuole,
      soilMound,
      waterDroplet,
      waterPath,
      xylemTube,
    };
  }, []);

  useEffect(
    () => () => {
      geos.casparianLoop.dispose();
      geos.cortexCell.dispose();
      geos.cortexVacuole.dispose();
      geos.endodermisCell.dispose();
      geos.epidermisCell.dispose();
      geos.rootHairOuter.dispose();
      geos.rootHairVacuole.dispose();
      geos.soilMound.dispose();
      geos.waterDroplet.dispose();
      geos.xylemTube.dispose();
    },
    [geos]
  );

  return geos;
}
