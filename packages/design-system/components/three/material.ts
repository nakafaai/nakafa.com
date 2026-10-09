import { Array as Arr } from "effect";
import { Color, type Material, type Mesh } from "three";

/** Tints a mesh material, or each material of a multi-material mesh, on clones. */
export function tintMaterial(material: Mesh["material"], color: string) {
  if (Arr.isArray(material)) {
    return Arr.map(material, (item) => tintSingleMaterial(item, color));
  }

  return tintSingleMaterial(material, color);
}

function tintSingleMaterial(material: Material, color: string) {
  const nextMaterial = material.clone();

  if (hasMaterialColor(nextMaterial)) {
    nextMaterial.color.set(color);
  }

  return nextMaterial;
}

function hasMaterialColor(
  material: Material
): material is Material & { color: Color } {
  return "color" in material && material.color instanceof Color;
}
