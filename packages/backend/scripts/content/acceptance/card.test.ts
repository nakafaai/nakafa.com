import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { createAcceptanceCard } from "@repo/backend/scripts/content/acceptance/card";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { CardFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  Array as Arr,
  Effect,
  Exit,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

/** The arguments of the seed function, as the Convex CLI receives them. */
const SeedArgs = Schema.fromJsonString(Schema.Struct({ slug: Schema.String }));

/** A runtime whose backend folder sits under the test's own temporary root. */
const runtimeIn = (root: string) =>
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));

describe("acceptance card", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds one card through the seed function and writes its login name and code",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-card-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(
              spec.stdoutPath,
              '{"code":"ABCDE-FGHJK","loginName":"siswa.uji"}'
            );
          })
        );

        yield* createAcceptanceCard(root, "acc-1234abcd", `${root}/card.json`);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "identity/seed:card",
        ]);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({ slug: "acc-1234abcd" });
        const seeded = yield* fs
          .readFileString(`${root}/card.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(CardFixture)));
        expect(seeded).toEqual({
          code: "ABCDE-FGHJK",
          loginName: "siswa.uji",
        });
        expect((yield* fs.stat(`${root}/card.json`)).mode % 0o1000).toBe(0o600);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no card when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-card-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceCard(root, "acc-1234abcd", `${root}/card.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
