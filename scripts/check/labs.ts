import { Array as Arr, HashSet, Option, Result, Schema } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import {
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNewExpression,
  isPropertyAccessExpression,
  isStringLiteral,
  SyntaxKind,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { opening } from "#scripts/check/jsx";
import { TEST_PATTERN } from "#scripts/check/kinds";
import { place } from "#scripts/check/places";

/** The folder that holds every lab: each module below it composes engine parts only. */
const LABS_PREFIX = "packages/design-system/components/contents/";
/** The page a model reads before it builds a lab. */
export const LAB_PAGE = "docs/adr/0052-labs.md";

const GEOMETRY_PATTERN = /Geometry$/u;
const MATERIAL_PATTERN = /Material$/u;
const LOADER_PATTERN = /Loader$/u;
const INTRINSIC_PATTERN = /^[a-z][A-Za-z\d]*$/u;
const DREI = "@react-three/drei";
const FIBER = "@react-three/fiber";
/** The drei parts that draw a primitive shape or line with a material of their own. */
const DREI_SHAPES = HashSet.make(
  "Box",
  "Capsule",
  "CatmullRomLine",
  "Circle",
  "Cone",
  "CubicBezierLine",
  "Cylinder",
  "Dodecahedron",
  "Extrude",
  "Icosahedron",
  "Lathe",
  "Line",
  "Octahedron",
  "Plane",
  "Polyhedron",
  "QuadraticBezierLine",
  "Ring",
  "RoundedBox",
  "Shape",
  "Sphere",
  "Tetrahedron",
  "Text3D",
  "Torus",
  "TorusKnot",
  "Tube"
);
/** The drei and fiber parts that load a model, a raster texture or a photograph. */
const LOADERS = HashSet.make(
  "Clone",
  "Gltf",
  "Image",
  "useCubeTexture",
  "useEnvironment",
  "useFBX",
  "useGLTF",
  "useKTX2",
  "useLoader",
  "useMatcapTexture",
  "useNormalTexture",
  "useTexture",
  "useVideoTexture"
);

/** What a lab may not hold, and the engine folder that owns the part to use instead. */
const SHAPE =
  "components/three/form (<Sweep>, <Turn>) or the kit it belongs to";
const MATTER = 'components/three/matter (<Matter of="brass" />)';
const KIT = "the kit it belongs to in components/three, drawn procedurally";

/** One place where a lab draws something the engine owns, with the folder of the lab. */
export const LabFinding = Schema.Struct({
  folder: Schema.String,
  message: Schema.String,
});

/** The engine folder that owns what a name draws, or none for a name that draws nothing of its own. */
function ownerOf(name: string): Option.Option<string> {
  if (GEOMETRY_PATTERN.test(name)) {
    return Option.some(SHAPE);
  }
  if (MATERIAL_PATTERN.test(name)) {
    return Option.some(MATTER);
  }
  return LOADER_PATTERN.test(name) ? Option.some(KIT) : Option.none();
}

/** The engine folder that owns what a drei or fiber import draws or loads, or none for any other import. */
function importOwner(module: string, name: string): Option.Option<string> {
  if (HashSet.has(LOADERS, name) && (module === DREI || module === FIBER)) {
    return Option.some(KIT);
  }
  if (module !== DREI) {
    return Option.none();
  }
  if (HashSet.has(DREI_SHAPES, name)) {
    return Option.some(SHAPE);
  }
  return MATERIAL_PATTERN.test(name) ? Option.some(MATTER) : Option.none();
}

/** The class a `new` expression names: its identifier, or the last name of a property access. */
function className(node: Node): Option.Option<string> {
  if (isIdentifier(node)) {
    return Option.some(node.text);
  }
  return isPropertyAccessExpression(node)
    ? Option.some(node.name.text)
    : Option.none();
}

/** What a lab draws that the engine owns, and the engine folder that owns it. */
const Drawn = Schema.Struct({ owner: Schema.String, what: Schema.String });

/** What one node draws that the engine owns, and the folder that owns it. */
function drawn(node: Node): Option.Option<typeof Drawn.Type> {
  if (isNewExpression(node)) {
    return Option.flatMap(className(node.expression), (name) =>
      Option.map(ownerOf(name), (owner) => ({ owner, what: `new ${name}` }))
    );
  }
  return Option.flatMap(opening(node), ({ tag }) => {
    if (tag === "primitive") {
      return Option.some({ owner: KIT, what: "<primitive>" });
    }
    if (tag === undefined || !INTRINSIC_PATTERN.test(tag)) {
      return Option.none();
    }
    return Option.map(ownerOf(tag), (owner) => ({ owner, what: `<${tag}>` }));
  });
}

/** The drei and fiber imports of a module that draw or load what the engine owns. */
function imported(sourceFile: SourceFile) {
  return Arr.flatMap(sourceFile.statements, (statement) => {
    if (
      !(
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      ) ||
      statement.importClause?.phaseModifier === SyntaxKind.TypeKeyword
    ) {
      return [];
    }
    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !isNamedImports(bindings)) {
      return [];
    }
    return Arr.filterMap(bindings.elements, (element) => {
      const name = (element.propertyName ?? element.name).text;
      return Option.match(
        element.isTypeOnly ? Option.none() : importOwner(module, name),
        {
          onNone: () => Result.failVoid,
          onSome: (owner) =>
            Result.succeed({
              node: element,
              owner,
              what: `${name} from ${module}`,
            }),
        }
      );
    });
  });
}

/** The folder of a lab module, by repository path. */
function folderOf(file: string) {
  return file.slice(0, file.lastIndexOf("/"));
}

/**
 * Reports each place where a lab module draws what the engine owns: a three.js
 * geometry or material, written as an element or built with `new`, a loader
 * of a model or a texture, a raw object placed with `<primitive>`, and the
 * drei parts that draw a bare shape, carry their own material or load a file.
 * A lab composes the parts of `components/three` only. `<group>`, `<mesh>`,
 * `<points>` and `<line>` stay: the engine's shapes and materials attach inside
 * them, and with every bare geometry and material refused they hold nothing
 * else. Tests and modules outside the labs are not judged.
 */
export function inspectLabSource(
  file: string,
  sourceFile: SourceFile
): readonly (typeof LabFinding.Type)[] {
  if (!file.startsWith(LABS_PREFIX) || TEST_PATTERN.test(file)) {
    return [];
  }
  const parts = Arr.appendAll(
    imported(sourceFile),
    Arr.filterMap(nodesBelow(sourceFile), (node) =>
      Option.match(drawn(node), {
        onNone: () => Result.failVoid,
        onSome: (part) => Result.succeed({ node, ...part }),
      })
    )
  );
  return Arr.map(parts, ({ node, owner, what }) => ({
    folder: folderOf(file),
    message: `${place(file, sourceFile, node)}: ${what} is drawn in a lab: build the part in ${owner} and compose it here (${LAB_PAGE}).`,
  }));
}
