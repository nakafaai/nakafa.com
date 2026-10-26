import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { runLoadCommand } from "@repo/backend/scripts/load/command";
import type { LoadInput } from "@repo/backend/scripts/load/run";
import { BLUEPRINT_PLAN } from "@repo/backend/scripts/load/plan";
import { Effect, FileSystem, Option } from "effect";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  convex: vi.fn(),
  lease: vi.fn(),
  owner: vi.fn(),
  run: vi.fn(),
  school: vi.fn(),
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    leaseReservedLocalRuntime: mocks.lease,
  })
);
vi.mock(
  "@repo/backend/scripts/content/acceptance/process",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/process")
    >()),
    withLocalBackend: (_runtime: unknown, program: unknown) => program,
  })
);
vi.mock("@repo/backend/scripts/content/acceptance/convex", () => ({
  runLocalConvex: mocks.convex,
}));
vi.mock("@repo/backend/scripts/content/acceptance/school", () => ({
  createAcceptanceSchool: mocks.school,
}));
vi.mock("@repo/backend/scripts/content/acceptance/owner", () => ({
  createAcceptanceOwner: mocks.owner,
}));
vi.mock("@repo/backend/scripts/load/logs", () => ({
  captureLogs: mocks.capture,
}));
vi.mock("@repo/backend/scripts/load/run", () => ({ runLoad: mocks.run }));

const runtime = {
  backend: "/backend",
  query: "http://127.0.0.1:3210",
  site: "http://127.0.0.1:3211",
};

describe("load command", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect("refuses a command without its report file", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(runLoadCommand("/root", []));
      expect(failure.message).toContain(
        "load <report-file> [students] [minutes]"
      );
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses to run before a runtime is prepared", () =>
    Effect.gen(function* () {
      mocks.lease.mockReturnValue(Effect.succeed(Option.none()));
      const failure = yield* Effect.flip(
        runLoadCommand("/root", ["report.json"])
      );
      expect(failure.message).toBe(
        "Run bun run acceptance:prepare before a load test."
      );
      expect(mocks.run).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "runs the blueprint's plan with the students and minutes it names, against the runtime's backend",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        mocks.lease.mockReturnValue(Effect.succeed(Option.some(runtime)));
        mocks.run.mockReturnValue(Effect.void);
        mocks.convex.mockReturnValue(Effect.succeed("printed"));
        mocks.capture.mockReturnValue(Effect.void);
        mocks.owner.mockReturnValue(Effect.void);
        mocks.school.mockImplementation((_root: string, path: string) =>
          fs.writeFileString(path, '{"name":"Sekolah 1","slug":"acc-1"}')
        );
        yield* runLoadCommand("/root", ["report.json", "300", "10"]);
        const [input] = mocks.run.mock.calls[0] ?? [];
        const load: LoadInput<unknown> = input;
        expect(load.output).toBe("report.json");
        expect(load.plan).toEqual({
          ...BLUEPRINT_PLAN,
          minutes: 10,
          students: 300,
        });
        expect(load.runtime).toBe(runtime);
        expect(yield* load.school(directory)).toBe("acc-1");
        expect(mocks.school).toHaveBeenCalledWith(
          "/root",
          `${directory}/school.json`
        );
        expect(mocks.owner).toHaveBeenCalledWith(
          "/root",
          "acc-1",
          `${directory}/owner.json`
        );
        expect(yield* load.run("Stored answers", ["data"], ["secret"])).toBe(
          "printed"
        );
        expect(mocks.convex).toHaveBeenCalledWith(
          runtime,
          "Stored answers",
          ["data"],
          ["secret"]
        );
        yield* load.capture("functions.jsonl");
        expect(mocks.capture).toHaveBeenCalledWith(runtime, "functions.jsonl");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "runs the blueprint's own plan when the command names no size",
    () =>
      Effect.gen(function* () {
        mocks.lease.mockReturnValue(Effect.succeed(Option.some(runtime)));
        mocks.run.mockReturnValue(Effect.void);
        yield* runLoadCommand("/root", ["report.json"]);
        expect(mocks.run.mock.calls[0]?.[0].plan).toEqual(BLUEPRINT_PLAN);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
