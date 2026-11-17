import { describe, expect, it } from "@effect/vitest";
import {
  cliffDrop,
  connectedBlocks,
  embedAndSlide,
  heightOfThrown,
  liftAcceleration,
  recoil,
  slideUp,
  springChain,
} from "@repo/design-system/components/contents/physics/mechanics/force";

describe("embedAndSlide", () => {
  it("slides the block 2.25 m after a 20 g bullet at 300 m/s embeds in it", () => {
    const motion = embedAndSlide({
      block: 1.98,
      bullet: 0.02,
      friction: 4,
      speed: 300,
    });
    expect(motion.velocity).toBeCloseTo(3, 9);
    expect(motion.deceleration).toBeCloseTo(2, 9);
    expect(motion.distance).toBeCloseTo(2.25, 9);
    expect(motion.time).toBeCloseTo(1.5, 9);
    expect(motion.lostEnergy).toBeCloseTo(891, 9);
  });
});

describe("cliffDrop", () => {
  it("lands ball B at about 2.73 s and ball A at 3.0 s", () => {
    const drop = cliffDrop({ delay: 1, gravity: 10, height: 15, speed: 10 });
    expect(drop.first).toBeCloseTo(3, 9);
    expect(drop.second).toBeCloseTo(1 + Math.sqrt(3), 9);
    expect(drop.peak).toBeCloseTo(20, 9);
    expect(
      heightOfThrown({ gravity: 10, height: 15, speed: 10 }, 3)
    ).toBeCloseTo(0, 9);
  });
});

describe("recoil", () => {
  it("needs 200 N from the shoulder to stop a 4.0 kg rifle in 4.0 cm", () => {
    const shot = recoil({ bullet: 0.02, rifle: 4, speed: 400, stop: 0.04 });
    expect(shot.velocity).toBeCloseTo(2, 9);
    expect(shot.energy).toBeCloseTo(8, 9);
    expect(shot.force).toBeCloseTo(200, 9);
  });
});

describe("connectedBlocks", () => {
  it("pulls the back block with 19 N of tension", () => {
    const blocks = connectedBlocks({
      back: 6,
      friction: 4,
      front: 2,
      pull: 24,
    });
    expect(blocks.acceleration).toBeCloseTo(2.5, 9);
    expect(blocks.tension).toBeCloseTo(19, 9);
  });
});

describe("liftAcceleration", () => {
  it("accelerates upward at 2 m/s2 when the scale reads 720 N for 60 kg", () => {
    expect(liftAcceleration(60, 720, 10)).toBe(2);
  });
});

describe("slideUp", () => {
  it("rises 3.5 m up a 30 degree plane from 7.0 m/s with 10 N of friction", () => {
    const slide = slideUp({
      angle: 30,
      friction: 10,
      gravity: 10,
      mass: 5,
      speed: 7,
    });
    expect(slide.along).toBeCloseTo(25, 9);
    expect(slide.deceleration).toBeCloseTo(7, 9);
    expect(slide.distance).toBeCloseTo(3.5, 9);
  });
});

describe("springChain", () => {
  it("stretches 15 cm in all with 20 N on one spring above a pair", () => {
    const chain = springChain(200, 20);
    expect(chain.top).toBeCloseTo(0.1, 9);
    expect(chain.pair).toBeCloseTo(0.05, 9);
    expect(chain.total).toBeCloseTo(0.15, 9);
  });
});
