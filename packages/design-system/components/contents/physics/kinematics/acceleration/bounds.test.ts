// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { measureRocketMotionBounds } from "@repo/design-system/components/contents/physics/kinematics/acceleration/bounds";
import { Effect } from "effect";
import { BoxGeometry, Euler, Group, Mesh, Vector3 } from "three";

describe("acceleration flight bounds", () => {
  it.effect("contains the full flight and sway of an off-center model", () =>
    Effect.gen(function* () {
      const model = new Group();
      const geometry = new BoxGeometry(4, 2, 12);
      const body = new Mesh(geometry);
      const center = new Vector3(3, -2, 5);
      body.position.copy(center);
      model.add(body);

      const pose = {
        modelRotationY: Math.PI / 2,
        scale: 0.3,
        yawAmplitude: 0.025,
        rollAmplitude: 0.018,
        rollPerAcceleration: -0.015,
      } satisfies Parameters<typeof measureRocketMotionBounds>[2];
      const vertices = Array.from(geometry.attributes.position.array);

      for (const acceleration of [-4, 0, 4]) {
        const motion = {
          acceleration,
          startX: -6.48,
          worldDisplacement: 12.96,
        };
        const bounds = yield* measureRocketMotionBounds(model, motion, pose);

        // These extrema keep a long rocket's sway compact instead of treating
        // the asset as if its length could point vertically in a full tumble.
        expect((bounds.y.max - bounds.y.min) / pose.scale).toBeLessThan(3);
        expect((bounds.z.max - bounds.z.min) / pose.scale).toBeLessThan(4.34);

        for (let sampleIndex = 0; sampleIndex <= 240; sampleIndex += 1) {
          const elapsed = (sampleIndex / 240) * ((10 * Math.PI) / 3);
          const position =
            motion.startX + (sampleIndex / 240) * motion.worldDisplacement;
          const rotation = new Euler(
            0,
            (motion.acceleration < 0 ? Math.PI : 0) +
              Math.sin(elapsed * 1.8) * pose.yawAmplitude,
            motion.acceleration * pose.rollPerAcceleration +
              Math.sin(elapsed * 2.4) * pose.rollAmplitude
          );

          for (const x of [-2, 2]) {
            for (const y of [-1, 1]) {
              for (const z of [-6, 6]) {
                const point = new Vector3(x, y, z)
                  .applyAxisAngle(new Vector3(0, 1, 0), pose.modelRotationY)
                  .multiplyScalar(pose.scale)
                  .applyEuler(rotation);
                point.x += position;
                for (const axis of ["x", "y", "z"] as const) {
                  expect(point[axis]).toBeGreaterThanOrEqual(
                    bounds[axis].min - 1e-10
                  );
                  expect(point[axis]).toBeLessThanOrEqual(
                    bounds[axis].max + 1e-10
                  );
                }
              }
            }
          }
        }
      }

      expect(body.position.equals(center)).toBe(true);
      expect(Array.from(geometry.attributes.position.array)).toEqual(vertices);
      geometry.dispose();
    })
  );
});
