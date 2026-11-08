import { afterEach, describe, expect, it } from "@effect/vitest";
import { SchoolFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  ownerAddress,
  schoolMode,
  seedSchool,
} from "@repo/backend/scripts/content/acceptance/school";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, FileSystem, Schema } from "effect";

const mocks = vi.hoisted(() => ({ layer: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/convex",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/convex")
    >()),
    localConvexLayer: mocks.layer,
  })
);

const OPEN = "tenancy/provision:open";
/** The address of a school that the seed opens: a word and eight hex digits. */
const SLUG = /^acc-[0-9a-f]{8}$/u;

describe("acceptance school", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "opens a new school with its unit and an Owner invite, and answers its address and name",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble();

        const first = yield* seedSchool().pipe(Effect.provide(backend.layer));
        const second = yield* seedSchool().pipe(Effect.provide(backend.layer));

        expect(first.slug).toMatch(SLUG);
        expect(first.name).toBe(`Sekolah ${first.slug.slice(4)}`);
        expect(second.slug).not.toBe(first.slug);
        expect(backend.argsOf(OPEN)).toMatchObject({
          kind: "school",
          name: first.name,
          owner: { email: ownerAddress(first.slug), name: "Acceptance Owner" },
          slug: first.slug,
          units: [{ contentLanguage: "id", level: "sma" }],
        });
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect(
    "writes the school the mode opened to the file it names, mode 600",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-school-test-",
        });
        mocks.layer.mockReturnValue(localConvexDouble().layer);

        yield* schoolMode.run(root, [`${root}/school.json`]);

        const school = yield* fs
          .readFileString(`${root}/school.json`)
          .pipe(
            Effect.flatMap(
              Schema.decodeEffect(Schema.fromJsonString(SchoolFixture))
            )
          );
        expect(school.slug).toMatch(SLUG);
        expect((yield* fs.stat(`${root}/school.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("refuses the school mode without its school file", () =>
    Effect.gen(function* () {
      expect(
        yield* schoolMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance school <school-file>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});
