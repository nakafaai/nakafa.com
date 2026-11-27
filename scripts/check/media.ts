import { Array as Arr, HashSet, Option, Result } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import {
  isCallExpression,
  isIdentifier,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  isTemplateExpression,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { opening } from "#scripts/check/jsx";
import { TEST_PATTERN } from "#scripts/check/kinds";
import { place } from "#scripts/check/places";

const CONTENTS_PREFIX = "packages/design-system/components/contents/";
const PUBLIC_MEDIA_PREFIXES = [
  "apps/www/public/textures/",
  "apps/www/public/models/",
] as const;
const EARTH_GLOBE_ASSETS_MODULE =
  "packages/design-system/components/contents/biology/assets.ts";
const EARTH_GLOBE_TEXTURE_MODULES = HashSet.make(
  "packages/design-system/components/contents/biology/climate/observation.tsx",
  "packages/design-system/components/contents/biology/climate/planet.tsx",
  "packages/design-system/components/contents/physics/kepler/scene.tsx"
);
const ALLOWED_PUBLIC_RASTER_FILES = HashSet.make(
  "apps/www/public/models/physics/kinematics/kenney-car-kit/Textures/colormap.png",
  "apps/www/public/models/physics/kinematics/kenney-pirate-kit/Textures/colormap.png",
  "apps/www/public/models/physics/kinematics/kenney-train-kit/Textures/colormap.png",
  "apps/www/public/models/physics/kinematics/water/waternormals.jpg",
  "apps/www/public/textures/biology/blue-marble-january-2048.jpg"
);
const BANNED_CONSTRUCTORS = HashSet.make(
  "Image",
  "ImageLoader",
  "TextureLoader"
);
const RASTER_LITERAL_PATTERN =
  /(?:^data:image\/|\.(?:avif|bmp|gif|jpe?g|png|webp)(?:$|[?#]))/iu;
const RASTER_FILE_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/iu;
const BLUE_MARBLE_PATH_PATTERN =
  /(?:blue-marble-january-2048\.jpg|world\.topo\.bathy\.200401\.3x5400x2700\.jpg)$/u;

const MEDIA_RULE =
  "raw 2D raster photos, image planes, and raster texture loaders are banned in 3D and p5 visuals. Build real 3D geometry or load an open-source .glb/.gltf model instead (web photos are reference only).";

/** Returns the literal text of a string or template node, or none for other nodes. */
function literalText(node: Node): Option.Option<string> {
  if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
    return Option.some(node.text);
  }
  if (isTemplateExpression(node)) {
    const parts = Arr.prepend(
      Arr.map(node.templateSpans, (span) => span.literal.text),
      node.head.text
    );
    return Option.some(Arr.join(parts, ""));
  }
  return Option.none();
}

/** Returns the rightmost identifier name of an identifier or property access expression. */
function memberName(node: Node): Option.Option<string> {
  if (isIdentifier(node)) {
    return Option.some(node.text);
  }
  if (isPropertyAccessExpression(node)) {
    return Option.some(node.name.text);
  }
  return Option.none();
}

/** Whether a call expression invokes `useTexture` or `useTexture.preload`. */
function isUseTextureCall(expression: Node): boolean {
  if (isIdentifier(expression) && expression.text === "useTexture") {
    return true;
  }
  return (
    isPropertyAccessExpression(expression) &&
    isIdentifier(expression.expression) &&
    expression.expression.text === "useTexture"
  );
}

/** Whether a `useTexture` call loads the allowlisted NASA Blue Marble Earth globe map. */
function isAllowedEarthGlobeCall(file: string, args: readonly Node[]): boolean {
  if (!HashSet.has(EARTH_GLOBE_TEXTURE_MODULES, file)) {
    return false;
  }
  const first = args[0];
  return (
    first !== undefined &&
    isPropertyAccessExpression(first) &&
    isIdentifier(first.expression) &&
    first.expression.text === "BLUE_MARBLE_EARTH_TEXTURE_ASSET"
  );
}

/** Checks one AST node for banned raster image tags, constructors, loaders, or literals. */
function nodeViolation(
  file: string,
  sourceFile: SourceFile,
  node: Node
): Option.Option<string> {
  if (Option.exists(opening(node), ({ tag }) => tag === "img")) {
    return Option.some(
      `${place(file, sourceFile, node)}: <img>: ${MEDIA_RULE}`
    );
  }
  if (
    isNewExpression(node) &&
    Option.exists(memberName(node.expression), (name) =>
      HashSet.has(BANNED_CONSTRUCTORS, name)
    )
  ) {
    return Option.some(`${place(file, sourceFile, node)}: ${MEDIA_RULE}`);
  }
  if (isCallExpression(node)) {
    if (
      isUseTextureCall(node.expression) &&
      !isAllowedEarthGlobeCall(file, node.arguments)
    ) {
      return Option.some(`${place(file, sourceFile, node)}: ${MEDIA_RULE}`);
    }
    if (
      Option.exists(memberName(node.expression), (name) => name === "loadImage")
    ) {
      return Option.some(`${place(file, sourceFile, node)}: ${MEDIA_RULE}`);
    }
  }
  return Option.flatMap(literalText(node), (text) => {
    if (!RASTER_LITERAL_PATTERN.test(text)) {
      return Option.none();
    }
    if (
      file === EARTH_GLOBE_ASSETS_MODULE &&
      BLUE_MARBLE_PATH_PATTERN.test(text)
    ) {
      return Option.none();
    }
    return Option.some(`${place(file, sourceFile, node)}: ${MEDIA_RULE}`);
  });
}

/**
 * Bans raw 2D photographs, `<img>` elements, raster image URLs, and raster
 * texture loaders inside `packages/design-system/components/contents/`, allowing
 * only the NASA Blue Marble Earth globe texture in planetary scenes.
 */
export function inspectMediaSource(
  file: string,
  sourceFile: SourceFile
): readonly string[] {
  if (!file.startsWith(CONTENTS_PREFIX) || TEST_PATTERN.test(file)) {
    return [];
  }
  return Arr.filterMap(nodesBelow(sourceFile), (node) =>
    Option.match(nodeViolation(file, sourceFile, node), {
      onNone: () => Result.failVoid,
      onSome: Result.succeed,
    })
  );
}

/**
 * Bans adding new raster image files under `apps/www/public/textures/` or
 * `apps/www/public/models/`, allowing only the existing NASA Earth globe map
 * and legacy model companion textures.
 */
export function inspectMediaFiles(
  repositoryPaths: readonly string[]
): readonly string[] {
  return Arr.filterMap(repositoryPaths, (file) => {
    const underPublicMedia = Arr.some(PUBLIC_MEDIA_PREFIXES, (prefix) =>
      file.startsWith(prefix)
    );
    if (
      !(underPublicMedia && RASTER_FILE_PATTERN.test(file)) ||
      HashSet.has(ALLOWED_PUBLIC_RASTER_FILES, file)
    ) {
      return Result.failVoid;
    }
    return Result.succeed(`${file}: ${MEDIA_RULE}`);
  });
}
