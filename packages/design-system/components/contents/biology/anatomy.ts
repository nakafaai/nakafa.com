import { Array as Arr, Schema } from "effect";
import type { Object3D } from "three";
import { Box3, Mesh, MeshPhysicalMaterial, Vector3 } from "three";

const AnatomyMaterialRuleSchema = Schema.Struct({
  clearcoat: Schema.optional(Schema.Finite),
  clearcoatRoughness: Schema.optional(Schema.Finite),
  color: Schema.String,
  match: Schema.optional(Schema.String),
  opacity: Schema.optional(Schema.Finite),
  roughness: Schema.Finite,
  sheen: Schema.optional(Schema.Finite),
  sheenColor: Schema.optional(Schema.String),
  sheenRoughness: Schema.optional(Schema.Finite),
});
type AnatomyMaterialRule = typeof AnatomyMaterialRuleSchema.Type;

const Vec3TupleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

const FitTransformSchema = Schema.Struct({
  offset: Vec3TupleSchema,
  scale: Schema.Finite,
});
type FitTransform = typeof FitTransformSchema.Type;

/**
 * Computes uniform scale factor and centering offset so any loaded 3D organ
 * mesh fits cleanly inside a target bounding extent centered at the origin.
 */
export function computeFitTransform(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  targetExtent: number
): FitTransform {
  const sizeX = max[0] - min[0];
  const sizeY = max[1] - min[1];
  const sizeZ = max[2] - min[2];
  const largest = Math.max(sizeX, sizeY, sizeZ, 1e-6);
  const scale = targetExtent / largest;
  const centerX = (min[0] + max[0]) / 2;
  const centerY = (min[1] + max[1]) / 2;
  const centerZ = (min[2] + max[2]) / 2;
  return {
    offset: [-centerX * scale, -centerY * scale, -centerZ * scale],
    scale,
  };
}

/**
 * Resolves the physical material rule for an anatomical mesh node by matching
 * case-insensitive substrings against mesh or material names, falling back to
 * the default rule.
 */
export function selectAnatomyRule(
  nodeName: string,
  rules: readonly AnatomyMaterialRule[],
  fallback: AnatomyMaterialRule
): AnatomyMaterialRule {
  const lower = nodeName.toLowerCase();
  const matched = Arr.findFirst(
    rules,
    (rule) =>
      rule.match !== undefined && lower.includes(rule.match.toLowerCase())
  );
  return matched._tag === "Some" ? matched.value : fallback;
}

/**
 * Clones a loaded NIH Human Reference Atlas GLB scene, normalizes its scale
 * and position to `targetExtent`, recomputes smooth normals, enables shadows,
 * and paints each anatomical sub-mesh with physically based organic materials.
 */
export function prepareAnatomicalScene(
  source: Object3D,
  options: {
    readonly fallback: AnatomyMaterialRule;
    readonly rules?: readonly AnatomyMaterialRule[];
    readonly targetExtent: number;
  }
): Object3D {
  const clone = source.clone(true);
  const bounds = new Box3().setFromObject(clone);
  const { offset, scale } = computeFitTransform(
    [bounds.min.x, bounds.min.y, bounds.min.z],
    [bounds.max.x, bounds.max.y, bounds.max.z],
    options.targetExtent
  );
  clone.scale.setScalar(scale);
  clone.position.set(offset[0], offset[1], offset[2]);

  const rules = options.rules ?? [];
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const geometry = child.geometry.clone();
    geometry.computeVertexNormals();
    child.geometry = geometry;
    child.castShadow = true;
    child.receiveShadow = true;

    const matName =
      "name" in child.material && typeof child.material.name === "string"
        ? child.material.name
        : "";
    const rule = selectAnatomyRule(
      `${child.name} ${matName}`,
      rules,
      options.fallback
    );
    const transparent = rule.opacity !== undefined && rule.opacity < 1;
    child.material = new MeshPhysicalMaterial({
      clearcoat: rule.clearcoat ?? 0.38,
      clearcoatRoughness: rule.clearcoatRoughness ?? 0.35,
      color: rule.color,
      depthWrite: !transparent,
      metalness: 0,
      opacity: rule.opacity ?? 1,
      roughness: rule.roughness,
      sheen: rule.sheen ?? 0.35,
      sheenColor: rule.sheenColor ?? rule.color,
      sheenRoughness: rule.sheenRoughness ?? 0.55,
      transparent,
    });
  });

  clone.userData.normalizedSize = bounds.getSize(new Vector3()).length();
  return clone;
}
