# Handoff: Realism 7, kinematics labs not shipped in #2931

Work branch only, no pull request. Cut from `nabil/realism-kinematics` at 15fbe5eb3 (before the owner and coordinator fixes of 27 Nov), so it predates the camera fit helper (`kinematics/sight.ts`), the flush road, `three/matter` and the "Engine only" rule.

## What is here

- `packages/design-system/components/contents/physics/kinematics/hunter/lab.tsx` and `hunter/rig.tsx`, `lib/material/target.ts`: a 3D `FallingTargetAimLab` on a lab bench (three tables, launcher, magnet stand, tin target, ghost images every 0.05 s). Rendered once with zero errors; never reviewed against the brief.
- `.handoff/fountain/`: a draft 3D `HoseJetProjectileLab` (`lab.tsx`, `swivel.tsx`, `hose.ts`). Not wired into the package; it still uses bare geometries.

## What it needs before a PR

1. Rebase on `main` and on the merged #2931.
2. Engine only: replace every bare `<...Geometry>` and `<mesh...Material>` with `three/form` (`Turn`, `Sweep`), a kit, `three/matter` (`Matter`) or `SurfaceMaterial`; report the counts.
3. Frame with `useSight` from `kinematics/follow.tsx` so the subject fills 80% of the frame at 1280 and 390.
4. Labels per the 16:34 rule: next to their part, at least 14 CSS px, values that do not fit go to the card readout in matching colours.
5. Check light and dark, 1280 and 390, every control extreme, against the brief's "Physically true" list; then delete the p5 sketch the lab replaces.
