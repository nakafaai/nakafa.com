import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Sex } from "@repo/design-system/components/contents/biology/gametogenesis/division";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export type AnatomyPart =
  | "testis"
  | "scrotum"
  | "epididymis"
  | "spermDuct"
  | "seminalVesicle"
  | "prostate"
  | "cowper"
  | "urethra"
  | "penis"
  | "ovary"
  | "oviduct"
  | "uterus"
  | "cervix"
  | "vagina"
  | "tubule"
  | "interstitial"
  | "follicle"
  | "corpusLuteum"
  | "head"
  | "acrosome"
  | "middle"
  | "tail"
  | "follicular"
  | "antrum";

const UTERUS_PROFILE = [
  new Vector2(0.06, 0.08),
  new Vector2(0.075, 0.28),
  new Vector2(0.062, 0.36),
  new Vector2(0.095, 0.48),
  new Vector2(0.185, 0.64),
  new Vector2(0.21, 0.76),
  new Vector2(0.14, 0.85),
  new Vector2(0.002, 0.88),
];

/** 3D sculpted male and female reproductive tract anatomy at the organ-system scale. */
export function SystemView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  const { epididymisGeo, leftOviductGeo, rightOviductGeo, vasDeferensGeo } =
    useMemo(() => {
      const vasCurve = new CatmullRomCurve3([
        new Vector3(-0.32, 0.36, 0.02),
        new Vector3(-0.28, 0.68, 0.03),
        new Vector3(-0.08, 0.9, 0.01),
        new Vector3(0.16, 0.84, -0.02),
        new Vector3(0.18, 0.72, 0),
      ]);
      const epiCurve = new CatmullRomCurve3([
        new Vector3(-0.36, 0.2, 0.04),
        new Vector3(-0.24, 0.27, 0.05),
        new Vector3(-0.23, 0.39, 0.04),
        new Vector3(-0.34, 0.44, 0.02),
      ]);
      const makeOviduct = (side: -1 | 1) =>
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(side * 0.16, 0.76, 0),
            new Vector3(side * 0.36, 0.86, 0.02),
            new Vector3(side * 0.56, 0.82, 0.03),
            new Vector3(side * 0.64, 0.72, 0.02),
          ]),
          28,
          0.026,
          12,
          false
        );
      return {
        epididymisGeo: new TubeGeometry(epiCurve, 24, 0.032, 12, false),
        leftOviductGeo: makeOviduct(-1),
        rightOviductGeo: makeOviduct(1),
        vasDeferensGeo: new TubeGeometry(vasCurve, 36, 0.022, 12, false),
      };
    }, []);

  useEffect(
    () => () => {
      vasDeferensGeo.dispose();
      epididymisGeo.dispose();
      leftOviductGeo.dispose();
      rightOviductGeo.dispose();
    },
    [epididymisGeo, leftOviductGeo, rightOviductGeo, vasDeferensGeo]
  );

  if (sex === "male") {
    return (
      <group>
        {/* Sculpted ovoid testis inside translucent scrotal sac */}
        <mesh castShadow position={[-0.36, 0.3, 0]} scale={[0.9, 1.15, 0.85]}>
          <sphereGeometry args={[0.135, 28, 22]} />
          <meshPhysicalMaterial
            clearcoat={0.42}
            color={BIOLOGY_COLORS.tissuePink}
            roughness={0.42}
          />
        </mesh>
        {/* Coiled epididymis hood */}
        <mesh castShadow geometry={epididymisGeo}>
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={BIOLOGY_COLORS.leydigAmber}
            roughness={0.38}
          />
        </mesh>
        {/* Arched vas deferens duct */}
        <mesh castShadow geometry={vasDeferensGeo}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={PLOT_COLORS.teal}
            roughness={0.35}
          />
        </mesh>
        {/* Walnut-shaped prostate gland */}
        <mesh castShadow position={[0.18, 0.68, 0]} scale={[1.15, 0.95, 1]}>
          <sphereGeometry args={[0.105, 24, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={BIOLOGY_COLORS.tissueDeep}
            roughness={0.44}
          />
        </mesh>
        {/* Lobulated seminal vesicle */}
        <mesh
          castShadow
          position={[0.3, 0.82, -0.05]}
          rotation={[0, 0, -0.42]}
          scale={[0.8, 1.45, 0.7]}
        >
          <sphereGeometry args={[0.068, 18, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={PLOT_COLORS.violet}
            roughness={0.38}
          />
        </mesh>
        {/* Urethral tract */}
        <mesh castShadow position={[0.36, 0.44, 0]} rotation={[0, 0, 0.48]}>
          <capsuleGeometry args={[0.058, 0.38, 14, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.36}
            color={BIOLOGY_COLORS.tissuePink}
            roughness={0.46}
          />
        </mesh>
        <ThreeLabel
          anchorX="right"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.54, 0.3, 0]}
        >
          {parts.testis}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.1, 0.96, 0]}
        >
          {parts.spermDuct}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0.36, 0.72, 0]}
        >
          {parts.prostate}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0.52, 0.42, 0]}
        >
          {parts.urethra}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      {/* Sculpted pear-shaped uterus, cervix, and vaginal canal */}
      <mesh castShadow receiveShadow>
        <latheGeometry args={[UTERUS_PROFILE, 36]} />
        <meshPhysicalMaterial
          clearcoat={0.42}
          color={BIOLOGY_COLORS.tissuePink}
          roughness={0.42}
          side={DoubleSide}
        />
      </mesh>
      {/* Curving Fallopian oviducts with fimbriated ends & sculpted almond ovaries */}
      <mesh castShadow geometry={leftOviductGeo}>
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={BIOLOGY_COLORS.tissueDeep}
          roughness={0.4}
        />
      </mesh>
      <mesh castShadow geometry={rightOviductGeo}>
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={BIOLOGY_COLORS.tissueDeep}
          roughness={0.4}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * 0.58, 0.64, 0.02]}
          rotation={[0, 0, side * 0.3]}
          scale={[1.2, 0.85, 0.72]}
        >
          <sphereGeometry args={[0.095, 24, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.46}
            color={BIOLOGY_COLORS.luteumGold}
            roughness={0.4}
          />
        </mesh>
      ))}
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.72, 0.64, 0]}
      >
        {parts.ovary}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.42, 0.92, 0]}
      >
        {parts.oviduct}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.26, 0.68, 0]}
      >
        {parts.uterus}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.14, 0.36, 0]}
      >
        {parts.cervix}
      </ThreeLabel>
    </group>
  );
}

const TUBULE_CENTERS = [
  [-0.38, 0.6, 0],
  [0, 0.66, -0.06],
  [0.38, 0.58, 0.02],
] as const;

const LEYDIG_CLUSTERS = [
  [-0.19, 0.5, 0.08],
  [0.19, 0.48, 0.08],
  [0, 0.4, 0.06],
] as const;

/** 3D histological cutaway of seminiferous tubules (male) or ovarian follicles & corpus luteum (female). */
export function GonadView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  if (sex === "male") {
    return (
      <group>
        {/* Cutaway seminiferous tubule rings with germinal epithelium & central lumen */}
        {Arr.map(TUBULE_CENTERS, ([x, y, z]) => (
          <group key={`tub-${x}-${y}-${z}`} position={[x, y, z]}>
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.175, 0.175, 0.14, 32, 1, true]} />
              <meshPhysicalMaterial
                clearcoat={0.35}
                color={BIOLOGY_COLORS.tissuePink}
                roughness={0.48}
                side={DoubleSide}
              />
            </mesh>
            <mesh castShadow position={[0, 0, 0.07]}>
              <torusGeometry args={[0.145, 0.036, 16, 36]} />
              <meshPhysicalMaterial
                clearcoat={0.42}
                color={BIOLOGY_COLORS.tubuleLumen}
                roughness={0.42}
              />
            </mesh>
            {/* Spermatogenic epithelium cell ring lining the tubule wall */}
            {Arr.makeBy(8, (i) => {
              const a = (i / 8) * Math.PI * 2;
              const cx = Math.cos(a) * 0.105;
              const cy = Math.sin(a) * 0.105;
              return (
                <mesh
                  key={`ep-${cx.toFixed(3)}-${cy.toFixed(3)}`}
                  position={[cx, cy, 0.06]}
                >
                  <sphereGeometry args={[0.028, 12, 10]} />
                  <meshPhysicalMaterial
                    clearcoat={0.5}
                    color={BIOLOGY_COLORS.spermHeadBlue}
                    roughness={0.35}
                  />
                </mesh>
              );
            })}
          </group>
        ))}

        {/* Interstitial Leydig endocrine cell clusters */}
        {Arr.map(LEYDIG_CLUSTERS, ([x, y, z]) => (
          <group key={`ley-${x}-${y}-${z}`} position={[x, y, z]}>
            <mesh castShadow>
              <sphereGeometry args={[0.048, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.52}
                color={BIOLOGY_COLORS.leydigAmber}
                roughness={0.36}
              />
            </mesh>
            <mesh position={[0.038, 0.025, 0.015]}>
              <sphereGeometry args={[0.032, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={0.52}
                color={BIOLOGY_COLORS.luteumGold}
                roughness={0.38}
              />
            </mesh>
          </group>
        ))}

        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.38, 0.86, 0]}
        >
          {parts.tubule}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0.19, 0.36, 0.1]}
        >
          {parts.interstitial}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      {/* Translucent sculpted ovarian cortex cutaway */}
      <mesh castShadow position={[0, 0.58, 0]} scale={[1.4, 0.96, 0.62]}>
        <sphereGeometry args={[0.42, 36, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={BIOLOGY_COLORS.tissuePink}
          opacity={0.42}
          roughness={0.38}
          transparent
        />
      </mesh>
      {/* Developing Graafian follicle with blue follicular antrum & embedded oocyte */}
      <group position={[-0.24, 0.6, 0.1]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 26, 20]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={BIOLOGY_COLORS.follicleFluid}
            opacity={0.78}
            roughness={0.22}
            transparent
          />
        </mesh>
        <mesh position={[-0.04, 0.02, 0.04]}>
          <sphereGeometry args={[0.068, 20, 16]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={BIOLOGY_COLORS.oocyteYolk}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.04, 0.02, 0.06]}>
          <sphereGeometry args={[0.026, 14, 12]} />
          <meshPhysicalMaterial color={CELL_COLORS.nucleus} roughness={0.32} />
        </mesh>
      </group>
      {/* Folded golden corpus luteum */}
      <group position={[0.24, 0.58, 0.1]}>
        {Arr.makeBy(7, (i) => {
          const a = (i / 7) * Math.PI * 2;
          const cx = Math.cos(a) * 0.075;
          const cy = Math.sin(a) * 0.068;
          return (
            <mesh
              castShadow
              key={`cl-${cx.toFixed(3)}-${cy.toFixed(3)}`}
              position={[cx, cy, 0]}
            >
              <sphereGeometry args={[0.066, 16, 14]} />
              <meshPhysicalMaterial
                clearcoat={0.44}
                color={BIOLOGY_COLORS.luteumGold}
                roughness={0.4}
              />
            </mesh>
          );
        })}
      </group>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.44, 0.72, 0]}
      >
        {parts.follicle}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.44, 0.68, 0]}
      >
        {parts.corpusLuteum}
      </ThreeLabel>
    </group>
  );
}
