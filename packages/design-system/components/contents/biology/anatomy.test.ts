import { describe, expect, it } from "@effect/vitest";
import {
  computeFitTransform,
  prepareAnatomicalScene,
  selectAnatomyRule,
} from "@repo/design-system/components/contents/biology/anatomy";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

describe("anatomical specimen helpers", () => {
  it("computes uniform fit scale and centered translation offset", () => {
    const result = computeFitTransform([2, 4, -2], [6, 12, 2], 2);
    expect(result.scale).toBeCloseTo(0.25, 6);
    expect(result.offset[0]).toBeCloseTo(-1, 6);
    expect(result.offset[1]).toBeCloseTo(-2, 6);
    expect(result.offset[2]).toBeCloseTo(0, 6);
  });

  it("handles degenerate zero-size bounds safely", () => {
    const result = computeFitTransform([0, 0, 0], [0, 0, 0], 1);
    expect(Number.isFinite(result.scale)).toBe(true);
  });

  it("matches material rules case-insensitively and falls back when unmatched", () => {
    const fallback = { color: "#e8dfc8", roughness: 0.52 };
    const cartilage = {
      color: "#8fc6db",
      match: "cartilage",
      roughness: 0.25,
    };
    expect(
      selectAnatomyRule("VH_M_Articular_Cartilage", [cartilage], fallback)
    ).toBe(cartilage);
    expect(selectAnatomyRule("VH_M_Femur", [cartilage], fallback)).toBe(
      fallback
    );
  });

  it("clones, normalizes, and applies physical materials to anatomical GLB groups", () => {
    const root = new Group();
    const bone = new Mesh(
      new BoxGeometry(2, 4, 2),
      new MeshStandardMaterial({ name: "Bone_Mat" })
    );
    bone.name = "VH_M_femur";
    bone.position.set(1, 2, 0);
    const fluid = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ name: "Amnion_Mat" })
    );
    fluid.name = "VH_F_amnion";
    const bare = new Mesh(new BoxGeometry(1, 1, 1), [
      new MeshStandardMaterial(),
    ]);
    bare.name = "unnamed";
    root.add(bone, fluid, bare);

    const prepared = prepareAnatomicalScene(root, {
      fallback: { color: "#ede6d6", roughness: 0.5 },
      rules: [
        {
          clearcoat: 0.8,
          clearcoatRoughness: 0.15,
          color: "#cfe4ec",
          match: "amnion",
          opacity: 0.45,
          roughness: 0.2,
          sheen: 0.2,
          sheenColor: "#ffffff",
          sheenRoughness: 0.3,
        },
      ],
      targetExtent: 1,
    });

    expect(prepared).not.toBe(root);
    expect(prepared.scale.x).toBeGreaterThan(0);
    expect(prepared.children.length).toBe(3);

    const preparedNoRules = prepareAnatomicalScene(root, {
      fallback: { color: "#ede6d6", roughness: 0.5 },
      targetExtent: 1,
    });
    expect(preparedNoRules.children.length).toBe(3);
  });
});
