import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LOGO_BYTE_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { storageUrl, storeFile } from "@repo/backend/test/logo";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const nf = slugOf("nf");
const { remove, set, uploadUrl } = refs.public.tenancy.logo;
const denied = {
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason: "role",
};
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };

/** An image of exactly this many bytes, typed as a PNG. */
const pngOf = (bytes: number) =>
  new Blob([new Uint8Array(bytes)], { type: "image/png" });

/** Whether the storage still holds the file. */
const fileHeld = (storageId: GenericId.GenericId<"_storage">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("_storage").get(storageId)
  ).pipe(Effect.option, Effect.map(Option.isSome));

/** The stored row of a school. */
const tenantRow = (tenantId: GenericId.GenericId<"tenants">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("tenants").get(tenantId)
  );

describe("tenancy/logo uploadUrl", () => {
  it.effect(
    "answers an Owner with the address that a logo is uploaded to",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const upload = yield* fixture
          .as("owner")
          .mutation(uploadUrl, { slug: nf });
        expect(String(upload)).toContain("/api/storage/upload");
      })
  );
});

describe("tenancy/logo set", () => {
  it.effect(
    "lets an Owner give the school a PNG logo, answers with its address, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const file = yield* storeFile(fixture.convex, pngOf(8));
        const answer = yield* owner.mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: file,
        });
        const row = yield* fixture.run(tenantRow(fixture.tenants.nf));
        expect(answer).toEqual({
          _tag: "LogoSet",
          logo: yield* storageUrl(fixture.convex, file),
        });
        expect(row.logo).toBe(file);
        expect(yield* fixture.run(fileHeld(file))).toBe(true);
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: { type: "tenant.logo.set" },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
        ]);
      })
  );

  it.effect(
    "takes an SVG logo of exactly one megabyte, and a PNG of one byte more is refused",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const svg = yield* storeFile(
          fixture.convex,
          new Blob([new Uint8Array(LOGO_BYTE_LIMIT)], {
            type: "image/svg+xml",
          })
        );
        const accepted = yield* owner.mutation(set, {
          contentType: "image/svg+xml",
          slug: nf,
          storageId: svg,
        });
        const large = yield* storeFile(
          fixture.convex,
          pngOf(LOGO_BYTE_LIMIT + 1)
        );
        const refused = yield* owner.mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: large,
        });
        expect(accepted._tag).toBe("LogoSet");
        expect(refused).toEqual({ _tag: "LogoRefused", reason: "size" });
      })
  );

  it.effect(
    "answers a file of more than one megabyte as refused, deletes it, and changes nothing else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const large = yield* storeFile(
          fixture.convex,
          pngOf(LOGO_BYTE_LIMIT + 1)
        );
        const answer = yield* fixture.as("owner").mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: large,
        });
        const row = yield* fixture.run(tenantRow(fixture.tenants.nf));
        expect(answer).toEqual({ _tag: "LogoRefused", reason: "size" });
        expect(row.logo).toBeUndefined();
        expect(yield* fixture.run(fileHeld(large))).toBe(false);
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect(
    "replaces the logo with an SVG, and deletes the file of the logo it replaces",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const png = yield* storeFile(fixture.convex, pngOf(8));
        const svg = yield* storeFile(
          fixture.convex,
          new Blob(["<svg></svg>"], { type: "image/svg+xml" })
        );
        yield* owner.mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: png,
        });
        const answer = yield* owner.mutation(set, {
          contentType: "image/svg+xml",
          slug: nf,
          storageId: svg,
        });
        const row = yield* fixture.run(tenantRow(fixture.tenants.nf));
        expect(answer).toEqual({
          _tag: "LogoSet",
          logo: yield* storageUrl(fixture.convex, svg),
        });
        expect(row.logo).toBe(svg);
        expect(yield* fixture.run(fileHeld(png))).toBe(false);
        expect(yield* fixture.run(fileHeld(svg))).toBe(true);
        expect(yield* fixture.run(journal)).toHaveLength(2);
      })
  );

  it.effect(
    "writes and records nothing when the file is already the logo",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const file = yield* storeFile(fixture.convex, pngOf(8));
        yield* owner.mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: file,
        });
        const again = yield* owner.mutation(set, {
          contentType: "image/png",
          slug: nf,
          storageId: file,
        });
        expect(again).toEqual({
          _tag: "LogoSet",
          logo: yield* storageUrl(fixture.convex, file),
        });
        expect(yield* fixture.run(fileHeld(file))).toBe(true);
        expect(yield* fixture.run(journal)).toHaveLength(1);
      })
  );
});

describe("tenancy/logo remove", () => {
  it.effect("removes the logo, deletes its file, and records the removal", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const file = yield* storeFile(fixture.convex, pngOf(8));
      yield* owner.mutation(set, {
        contentType: "image/png",
        slug: nf,
        storageId: file,
      });
      const answer = yield* owner.mutation(remove, { slug: nf });
      const row = yield* fixture.run(tenantRow(fixture.tenants.nf));
      expect(answer).toEqual({});
      expect(row.logo).toBeUndefined();
      expect(yield* fixture.run(fileHeld(file))).toBe(false);
      expect(yield* fixture.run(journal)).toMatchObject([
        { change: { type: "tenant.logo.set" } },
        {
          actor: { id: fixture.people.owner.personId, kind: "person" },
          change: { type: "tenant.logo.removed" },
          subject: { id: fixture.tenants.nf, kind: "tenant" },
        },
      ]);
    })
  );

  it.effect(
    "writes and records nothing when the school has no logo to remove",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const answer = yield* fixture
          .as("owner")
          .mutation(remove, { slug: nf });
        expect(answer).toEqual({});
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );
});

describe("tenancy/logo access", () => {
  it.effect(
    "refuses every logo change to a role but Owner and Admin, a Person without a grant, and a stranger",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const file = yield* storeFile(fixture.convex, pngOf(8));
        const refused = (account: Parameters<typeof fixture.as>[0]) => {
          const client = fixture.as(account);
          return Effect.all([
            client.mutation(uploadUrl, { slug: nf }).pipe(Effect.flip),
            client
              .mutation(set, {
                contentType: "image/png",
                slug: nf,
                storageId: file,
              })
              .pipe(Effect.flip),
            client.mutation(remove, { slug: nf }).pipe(Effect.flip),
          ]);
        };
        const byRole = yield* Effect.forEach(
          [
            "teacher",
            "student",
            "principal",
            "auditor",
            "visitor",
            "unitAdmin",
          ] satisfies readonly Parameters<typeof fixture.as>[0][],
          refused
        );
        const outside = yield* Effect.forEach(
          ["suspended", "stranger", "otherOwner"] satisfies readonly Parameters<
            typeof fixture.as
          >[0][],
          refused
        );
        expect(Arr.flatten(byRole)).toMatchObject(Arr.replicate(denied, 18));
        expect(Arr.flatten(outside)).toMatchObject(Arr.replicate(notMember, 9));
        expect(yield* fixture.run(journal)).toEqual([]);
        expect(yield* fixture.run(fileHeld(file))).toBe(true);
      })
  );
});
