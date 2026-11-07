import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const profile = refs.public.tenancy.profile.get;

describe("tenancy/profile", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "shows a school's public identity and its animal to anyone, signed in or not",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const expected = {
          kind: "school",
          mascot: schoolMascot("other"),
          name: "Sekolah Lain",
          slug: "other",
          status: "active",
        };
        expect(
          yield* fixture.anonymous.query(profile, { slug: slugOf("other") })
        ).toEqual(Option.some(expected));
        expect(
          yield* fixture.as("owner").query(profile, { slug: slugOf("other") })
        ).toEqual(Option.some(expected));
      })
  );

  it.effect(
    "shows the signed R2 address of the logo that a school holds, beside its animal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("bucketFiles")
              .insert({
                byteSize: 4,
                contentType: "image/png",
                createdAt: 0,
                objectKey: "files/other/logo",
                state: "stored",
                tenantId: fixture.tenants.other,
              })
              .pipe(
                Effect.tap((fileId) =>
                  writer
                    .table("tenants")
                    .patch(fixture.tenants.other, { logo: fileId })
                )
              )
          ).pipe(Effect.orDie)
        );
        const shown = yield* fixture.anonymous.query(profile, {
          slug: slugOf("other"),
        });
        expect(shown).toEqual(
          Option.some({
            kind: "school",
            logo: expect.stringContaining("/files/files/other/logo?"),
            mascot: schoolMascot("other"),
            name: "Sekolah Lain",
            slug: "other",
            status: "active",
          })
        );
      })
  );

  it.effect(
    "answers none for an address that no school uses, so a probe of a random School host fails nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        expect(
          yield* fixture.anonymous.query(profile, { slug: slugOf("missing") })
        ).toEqual(Option.none());
      })
  );
});

const refusal = refs.public.tenancy.profile.refusal;

describe("tenancy/profile refusal", () => {
  it.effect(
    "refuses a school that no one has the address of, and admits one that exists",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        expect(
          yield* fixture.anonymous.query(refusal, { slug: slugOf("missing") })
        ).toBe(true);
        expect(
          yield* fixture.anonymous.query(refusal, { slug: slugOf("nf") })
        ).toBe(false);
      })
  );
});
