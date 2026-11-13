import { useThree } from "@react-three/fiber";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import {
  type CrystalId,
  CrystalIdSchema,
  countIons,
  getCrystal,
  rockSalt,
} from "@repo/design-system/components/contents/chemistry/lattice/crystal";
import { ELEMENTS } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Schema } from "effect";
import {
  type ReactNode,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type InstancedMesh, Object3D } from "three";
import { useFormatter } from "use-intl";

/** How many picometres one scene unit spans. */
const PICOMETRES = 100;

/** The share of its ionic radius each ion is drawn at, so touching ions do not overlap. */
const ION_SCALE = 0.94;

/** The widest block offered, in unit cells along an edge. */
const MOST_CELLS = 3;

/** The words a lattice lab reads from its lesson. */
interface LatticeLabels {
  /** The name of the slider that grows the block, and its readout. */
  readonly cells: string;
  /** The name of the toggle that chooses a crystal, for assistive technology. */
  readonly choose: string;
  /** The readout of how many ions the block holds. */
  readonly count: ReactNode;
  /** The readout of the formula. */
  readonly formula: ReactNode;
  /** The readout of the two ions and their radii. */
  readonly ions: ReactNode;
  /** The readout of the edge of one unit cell. */
  readonly lattice: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A rock-salt crystal at real size: cations and anions at their measured
 * ionic radii on the lattice X-ray diffraction finds, every ion touching six
 * of the other kind. The slider grows the block from one unit cell to three
 * along each edge, and the count shows the 1 : 1 ratio the formula records.
 *
 * @param crystals - The crystals to offer, in order
 */
export function IonLatticeLab({
  crystals,
  description,
  labels,
  title,
}: {
  readonly crystals: readonly CrystalId[];
  readonly description: ReactNode;
  readonly labels: LatticeLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const offered = Arr.filter(crystals, (id) => Schema.is(CrystalIdSchema)(id));
  const [chosen, setChosen] = useState<CrystalId | undefined>(undefined);
  const [cells, setCells] = useState(2);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const crystal = getCrystal(shown);
  const sites = rockSalt(cells);
  const { anions, cations } = countIons(sites);
  const number = (value: number) =>
    mathNumber(format.number(value, MATH_NUMBER_OPTIONS));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          {offered.length > 1 ? (
            <ToggleGroup
              aria-label={labels.choose}
              gridColumns={toggleColumns(offered.length)}
              onValueChange={(value: string) => {
                if (Schema.is(CrystalIdSchema)(value)) {
                  setChosen(value);
                }
              }}
              type="single"
              value={shown}
              variant="outline"
            >
              {Arr.map(offered, (id) => (
                <ToggleGroupItem
                  aria-label={`${getCrystal(id).cation.symbol}${getCrystal(id).anion.symbol}`}
                  key={id}
                  value={id}
                >
                  <InlineMath math={getCrystal(id).formula} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.cells}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${cells} \\times ${cells} \\times ${cells}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.cells}
            max={MOST_CELLS}
            min={1}
            onValueChange={(value: number) => setCells(value)}
            step={1}
            value={cells}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          reach={(MOST_CELLS * crystal.lattice) / PICOMETRES}
          setting="studio"
        >
          <Suspense>
            <LatticeCamera lattice={crystal.lattice} />
            <LatticeBlock crystalId={shown} sites={sites} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.formula}
            value={<InlineMath math={crystal.formula} />}
          />
          <VisualFact
            label={labels.ions}
            value={
              <InlineMath
                math={`${crystal.cation.tex}\\ ${number(crystal.cation.radius)}\\ \\mathrm{pm},\\ ${crystal.anion.tex}\\ ${number(crystal.anion.radius)}\\ \\mathrm{pm}`}
              />
            }
          />
          <VisualFact
            label={labels.lattice}
            value={
              <InlineMath
                math={`a = ${number(crystal.lattice)}\\ \\mathrm{pm}`}
              />
            }
          />
          <VisualFact
            label={labels.count}
            value={
              <InlineMath
                math={`${cations}\\ ${crystal.cation.tex} : ${anions}\\ ${crystal.anion.tex}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The block of ions, drawn as two instanced meshes, one per kind, so a
 * three-cell block of 343 ions costs two draw calls.
 */
function LatticeBlock({
  crystalId,
  sites,
}: {
  readonly crystalId: CrystalId;
  readonly sites: ReturnType<typeof rockSalt>;
}) {
  const crystal = getCrystal(crystalId);
  const spacing = crystal.lattice / 2 / PICOMETRES;
  const kinds = useMemo(
    () =>
      Arr.map(["cation", "anion"] as const, (kind) => ({
        ion: crystal[kind],
        kind,
        sites: Arr.filter(sites, (site) => site.kind === kind),
      })),
    [crystal, sites]
  );

  return (
    <group>
      {Arr.map(kinds, (each) => (
        <IonInstances
          color={ELEMENTS[each.ion.symbol].color}
          key={`${crystalId}-${each.kind}-${sites.length}`}
          positions={Arr.map(each.sites, (site) =>
            Arr.map(site.position, (coordinate) => coordinate * spacing)
          )}
          radius={(each.ion.radius / PICOMETRES) * ION_SCALE}
        />
      ))}
    </group>
  );
}

/** Every ion of one kind as one instanced mesh of glossy spheres. */
function IonInstances({
  color,
  positions,
  radius,
}: {
  readonly color: string;
  readonly positions: readonly (readonly number[])[];
  readonly radius: number;
}) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (instances === null) {
      return;
    }
    const place = new Object3D();
    for (const [index, [x = 0, y = 0, z = 0]] of Arr.map(
      positions,
      (position, at) => [at, position] as const
    )) {
      place.position.set(x, y, z);
      place.scale.setScalar(radius);
      place.updateMatrix();
      instances.setMatrixAt(index, place.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  }, [positions, radius]);

  return (
    <instancedMesh args={[undefined, undefined, positions.length]} ref={mesh}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshPhysicalMaterial
        clearcoat={0.7}
        clearcoatRoughness={0.15}
        color={color}
        roughness={0.32}
      />
    </instancedMesh>
  );
}

/** Frames the widest block from a corner above, so all three axes of the cube show. */
function LatticeCamera({ lattice }: { readonly lattice: number }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = ((MOST_CELLS * lattice) / PICOMETRES) * (narrow ? 2.7 : 2.2);
  return (
    <CameraControls
      cameraPosition={[distance * 0.62, distance * 0.48, distance * 0.62]}
      cameraTarget={[0, 0, 0]}
      fov={38}
      maxDistance={distance * 1.8}
      minDistance={distance * 0.3}
    />
  );
}
