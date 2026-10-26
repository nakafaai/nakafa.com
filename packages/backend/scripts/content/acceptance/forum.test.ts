import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { ForumFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceForum,
  forumMode,
} from "@repo/backend/scripts/content/acceptance/forum";
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
const SeedArgs = Schema.fromJsonString(
  Schema.Struct({
    classSlug: Schema.String,
    count: Schema.Finite,
    read: Schema.Finite,
    slug: Schema.String,
  })
);

/** What the seed function prints, as the Convex CLI prints its return. */
const PRINTED =
  '{"channelId":"channel-1","classId":"class-1","messages":["message-1","message-2"]}';

/** A runtime whose backend folder sits under the test's own temporary root, and a seed that prints its history. */
const seedIn = (root: string, specs: MutableList.MutableList<CommandSpec>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
    mocks.command.mockImplementation((spec: CommandSpec) =>
      Effect.gen(function* () {
        MutableList.append(specs, spec);
        yield* fs.writeFileString(spec.stdoutPath, PRINTED);
      })
    );
  });

describe("acceptance forum", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds the seeded class's history through the seed function, and writes it for the browser test",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-forum-test-",
        });
        const specs = MutableList.make<CommandSpec>();
        yield* seedIn(root, specs);

        yield* forumMode.run(root, [
          "acc-1234abcd",
          "60",
          "20",
          `${root}/forum.json`,
        ]);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "classroom/forum/seed:history",
        ]);
        expect(
          yield* Schema.decodeEffect(SeedArgs)(
            Option.getOrThrow(Arr.last(spec?.args ?? []))
          )
        ).toEqual({
          classSlug: "fisika-x-1",
          count: 60,
          read: 20,
          slug: "acc-1234abcd",
        });
        const written = yield* fs
          .readFileString(`${root}/forum.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(ForumFixture)));
        expect(written.messages).toEqual(["message-1", "message-2"]);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds nothing when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-forum-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceForum(root, "acc-1234abcd", 1, 0, `${root}/forum.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
