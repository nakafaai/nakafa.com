// @vitest-environment node

import { layer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Option } from "effect";
import { formatHeartbeat, readHeartbeat } from "@/scripts/build/heartbeat";

const MEBIBYTE = 1024 * 1024;

describe("build heartbeat", () => {
  it("formats every reading on one line", () => {
    expect(
      formatHeartbeat({
        load: Option.some("0.52 0.58 0.59"),
        memory: Option.some({
          current: 1024 * MEBIBYTE,
          high: "max",
          max: 8192 * MEBIBYTE,
        }),
        pressure: Option.some(
          "some avg10=0.00 avg60=0.00 avg300=0.00 total=0 | full avg10=0.00 avg60=0.00 avg300=0.00 total=0"
        ),
        silentSeconds: 15,
      })
    ).toBe(
      "build heartbeat: silent 15s; memory 1024 MiB, high max, max 8192 MiB; pressure some avg10=0.00 avg60=0.00 avg300=0.00 total=0 | full avg10=0.00 avg60=0.00 avg300=0.00 total=0; load 0.52 0.58 0.59"
    );
  });

  it("names each reading that the machine does not provide", () => {
    expect(
      formatHeartbeat({
        load: Option.none(),
        memory: Option.none(),
        pressure: Option.none(),
        silentSeconds: 300,
      })
    ).toBe(
      "build heartbeat: silent 300s; memory unavailable; pressure unavailable; load unavailable"
    );
  });

  it.effect("reads the container files that exist and omits the rest", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped();
      yield* fileSystem.writeFileString(
        `${directory}/memory.current`,
        `${1024 * MEBIBYTE}\n`
      );
      yield* fileSystem.writeFileString(`${directory}/memory.high`, "max\n");
      yield* fileSystem.writeFileString(
        `${directory}/memory.max`,
        `${8192 * MEBIBYTE}\n`
      );
      yield* fileSystem.writeFileString(
        `${directory}/memory.pressure`,
        "some avg10=0.00\nfull avg10=0.00\n"
      );

      expect(
        yield* readHeartbeat(
          {
            cgroupDirectory: directory,
            loadAverageFile: `${directory}/loadavg`,
          },
          15
        )
      ).toEqual({
        load: Option.none(),
        memory: Option.some({
          current: 1024 * MEBIBYTE,
          high: "max",
          max: 8192 * MEBIBYTE,
        }),
        pressure: Option.some("some avg10=0.00 | full avg10=0.00"),
        silentSeconds: 15,
      });
    }).pipe(Effect.scoped, Effect.provide(layer))
  );

  it.effect("treats empty and malformed container files as unavailable", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped();
      yield* fileSystem.writeFileString(`${directory}/memory.current`, "\n");
      yield* fileSystem.writeFileString(`${directory}/memory.high`, "max\n");
      yield* fileSystem.writeFileString(`${directory}/memory.max`, "lots\n");
      yield* fileSystem.writeFileString(`${directory}/memory.pressure`, "\n");
      yield* fileSystem.writeFileString(`${directory}/loadavg`, "  \n");

      expect(
        yield* readHeartbeat(
          {
            cgroupDirectory: directory,
            loadAverageFile: `${directory}/loadavg`,
          },
          0
        )
      ).toEqual({
        load: Option.none(),
        memory: Option.none(),
        pressure: Option.none(),
        silentSeconds: 0,
      });
    }).pipe(Effect.scoped, Effect.provide(layer))
  );

  it.effect("keeps the first three load averages from the load file", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped();
      yield* fileSystem.writeFileString(
        `${directory}/loadavg`,
        "0.52 0.58 0.59 1/389 12345\n"
      );

      expect(
        yield* readHeartbeat(
          {
            cgroupDirectory: directory,
            loadAverageFile: `${directory}/loadavg`,
          },
          1
        )
      ).toMatchObject({ load: Option.some("0.52 0.58 0.59") });
    }).pipe(Effect.scoped, Effect.provide(layer))
  );
});
