import { describe, expect, it } from "@effect/vitest";
import {
  glowingOf,
  tendShine,
} from "@repo/design-system/components/three/matter/cast";
import {
  BoxGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from "three";

describe("glowingOf", () => {
  it("measures the whole surface of a mesh and finds its middle", () => {
    const box = new Mesh(new BoxGeometry(2, 1, 3).translate(4, 0, 0));
    const glowing = glowingOf(box);

    expect(glowing.area).toBeCloseTo(22);
    expect(glowing.x).toBeCloseTo(4);
    expect(glowing.y).toBeCloseTo(0);
    expect(glowing.z).toBeCloseTo(0);
  });

  it("reads a part drawn without shared corners the same way", () => {
    const sheet = new Mesh(new PlaneGeometry(3, 2).toNonIndexed());

    expect(glowingOf(sheet).area).toBeCloseTo(6);
  });

  it("adds up every piece of a group where the group draws it", () => {
    const bars = new Group();
    const near = new Mesh(new PlaneGeometry(1, 1));
    const far = new Mesh(new PlaneGeometry(1, 1));
    const inner = new Group();
    near.position.set(-2, 0, 0);
    far.scale.setScalar(2);
    far.visible = false;
    inner.position.set(3, 1, 0);
    inner.add(far);
    bars.add(near, inner, new PointLight());
    const glowing = glowingOf(bars);

    expect(glowing.area).toBeCloseTo(5);
    expect(glowing.x).toBeCloseTo((-2 * 1 + 3 * 4) / 5);
    expect(glowing.y).toBeCloseTo(4 / 5);
  });

  it("finds nothing glowing in a part that draws nothing", () => {
    expect(glowingOf(new Group())).toStrictEqual({
      area: 0,
      x: 0,
      y: 0,
      z: 0,
    });
  });
});

describe("tendShine", () => {
  it("throws light by the glowing surface of the part it stands in, from its middle", () => {
    const part = new Mesh(new SphereGeometry(1, 64, 48).translate(0, 2, 0));
    const lamp = new PointLight();
    part.add(lamp);
    tendShine(3, false)(lamp, 0.5, 1);

    expect(lamp.intensity).toBeCloseTo(0.5 * 4 * Math.PI, 1);
    expect(lamp.position.y).toBeCloseTo(2);
    expect(lamp.decay).toBe(2);
    expect(lamp.distance).toBe(6);
  });

  it("fades with the level a rig lets through and goes dark at none", () => {
    const part = new Mesh(new PlaneGeometry(2, 2));
    const lamp = new PointLight();
    part.add(lamp);
    const tend = tendShine(1, false);
    tend(lamp, 3, 0.25);

    expect(lamp.intensity).toBeCloseTo(3);

    tend(lamp, 3, 0);

    expect(lamp.intensity).toBe(0);
  });

  it("shines as much brighter as the lab draws the part larger", () => {
    const stand = new Group();
    const part = new Mesh(new PlaneGeometry(1, 1));
    const lamp = new PointLight();
    stand.scale.setScalar(3);
    stand.add(part);
    part.add(lamp);
    tendShine(1, false)(lamp, 1, 1);

    expect(lamp.intensity).toBeCloseTo(9);
  });

  it("stays where its author set it", () => {
    const part = new Mesh(new PlaneGeometry(1, 1).translate(5, 0, 0));
    const lamp = new PointLight();
    lamp.position.set(0, 0.5, 0);
    part.add(lamp);
    tendShine(1, true)(lamp, 1, 1);

    expect(lamp.position.toArray()).toStrictEqual([0, 0.5, 0]);
    expect(lamp.intensity).toBeCloseTo(1);
  });

  it("measures again only when the part takes another shape", () => {
    const part = new Mesh(new PlaneGeometry(1, 1));
    const lamp = new PointLight();
    part.add(lamp);
    const tend = tendShine(1, false);
    tend(lamp, 1, 1);
    part.scale.setScalar(4);
    tend(lamp, 1, 1);

    expect(lamp.intensity).toBeCloseTo(1);

    part.geometry = new PlaneGeometry(2, 1);
    tend(lamp, 1, 1);

    expect(lamp.intensity).toBeCloseTo(32);
  });

  it("waits for a part before it shines", () => {
    const lamp = new PointLight(undefined, 0);
    tendShine(1, false)(lamp, 5, 1);

    expect(lamp.intensity).toBe(0);
  });
});
