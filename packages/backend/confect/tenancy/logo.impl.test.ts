import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LOGO_BYTE_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const nf = slugOf("nf");
const other = slugOf("other");
const { remove, reserve, set } = refs.public.tenancy.logo;

/** Every file row the bucket holds. */
const files = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("bucketFiles").index("by_creation_time").take(20)
);

/** The stored row of the school `nf`. */
const nfRow = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenants").get(fixture.tenants.nf)
    ).pipe(Effect.orDie)
  );

describe("tenancy/logo", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.effect(
    "reserves a logo's bytes at an R2 address that binds its length and type, and refuses a file over the limit before any byte moves",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const reserved = yield* owner.mutation(reserve, {
          byteSize: 8,
          contentType: "image/png",
          slug: nf,
        });
        expect(reserved).toMatchObject({ _tag: "LogoReserved" });
        expect(reserved._tag === "LogoReserved" && reserved.address).toContain(
          "X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"
        );
        expect(
          yield* owner.mutation(reserve, {
            byteSize: LOGO_BYTE_LIMIT + 1,
            contentType: "image/png",
            slug: nf,
          })
        ).toEqual({ _tag: "LogoRefused", reason: "size" });
        expect(yield* fixture.run(files)).toHaveLength(1);
      })
  );

  it.effect(
    "sets a reserved logo, shows it at a signed address, deletes the logo it replaces, refuses another school's file, and removes it",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers();
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const reserveOne = (slug: typeof nf) =>
          fixture
            .as(slug === nf ? "owner" : "otherOwner")
            .mutation(reserve, { byteSize: 8, contentType: "image/png", slug })
            .pipe(
              Effect.map((answer) =>
                answer._tag === "LogoReserved" ? answer.fileId : null
              )
            );
        const first = yield* reserveOne(nf);
        if (first === null) {
          return yield* Effect.die("The logo was reserved.");
        }
        const answer = yield* owner.mutation(set, { fileId: first, slug: nf });
        expect(answer).toMatchObject({ _tag: "LogoSet" });
        expect(answer._tag === "LogoSet" && answer.logo).toContain(
          "X-Amz-Signature="
        );
        expect(yield* owner.mutation(set, { fileId: first, slug: nf })).toEqual(
          answer
        );
        expect((yield* nfRow(fixture)).logo).toBe(first);
        const second = yield* reserveOne(nf);
        if (second === null) {
          return yield* Effect.die("The logo was reserved.");
        }
        yield* owner.mutation(set, { fileId: second, slug: nf });
        expect(
          yield* fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader.table("bucketFiles").get(first)
            ).pipe(Effect.option, Effect.map(Option.isNone))
          )
        ).toBe(true);
        const foreign = yield* reserveOne(other);
        if (foreign === null) {
          return yield* Effect.die("The logo was reserved.");
        }
        expect(
          yield* owner.mutation(set, { fileId: foreign, slug: nf })
        ).toEqual({ _tag: "LogoRefused", reason: "file" });
        expect(yield* fixture.run(journal)).toHaveLength(2);
        expect(yield* owner.mutation(remove, { slug: nf })).toEqual({});
        expect(yield* owner.mutation(remove, { slug: nf })).toEqual({});
        expect((yield* nfRow(fixture)).logo).toBeUndefined();
        yield* fixture.finishScheduled();
      })
  );

  it.effect("refuses a teacher every change to the logo", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      expect(
        yield* fixture
          .as("teacher")
          .mutation(reserve, {
            byteSize: 8,
            contentType: "image/png",
            slug: nf,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AccessDenied", reason: "role" });
    })
  );
});
