import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { BUCKET_BYTE_LIMIT } from "@repo/backend/confect/bucket/use";
import { SCHOOL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/use";
import { fileRows, makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Exit, Order } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const { discard, file, markStored, removeObjects, reserveStored, sweep } =
  refs.internal.bucket;

/** The object key of a file no school is charged for. */
const ACCOUNT_KEY = /^files\/accounts\//u;

/** A PDF of four bytes that the server stores for no school. */
const request = {
  byteSize: 4,
  contentType: "application/pdf",
  tenantId: null,
};

describe("bucket", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    bucket.state.failing = false;
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.effect(
    "reserves bytes the server writes itself, answers their facts, marks them stored, and discards them with their object",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers();
        vi.setSystemTime(TENANCY_NOW);
        const fixture = yield* tenancyFixture;
        const reserved = yield* fixture.internal.mutation(
          reserveStored,
          request
        );
        expect(reserved.objectKey).toMatch(ACCOUNT_KEY);
        bucket.state.objects[reserved.objectKey] = new Uint8Array(4);
        expect(
          yield* fixture.internal.query(file, { fileId: reserved.fileId })
        ).toEqual({
          byteSize: 4,
          contentType: "application/pdf",
          objectKey: reserved.objectKey,
          tenantId: null,
        });
        yield* fixture.internal.mutation(markStored, {
          fileId: reserved.fileId,
        });
        expect(yield* fixture.run(fileRows)).toMatchObject([
          { state: "stored" },
        ]);
        yield* fixture.internal.mutation(discard, { fileId: reserved.fileId });
        yield* fixture.internal.mutation(discard, { fileId: reserved.fileId });
        yield* fixture.internal.mutation(markStored, {
          fileId: reserved.fileId,
        });
        expect(
          yield* fixture.internal.query(file, { fileId: reserved.fileId })
        ).toBeNull();
        yield* fixture.finishScheduled();
        expect(bucket.state.objects).toEqual({});
      })
  );

  it.effect(
    "refuses bytes past the bucket's limit, and bytes past a school's limit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("classroomFileUse").insert({
              bytes: SCHOOL_BYTE_LIMIT,
              tenantId: fixture.tenants.nf,
            })
          ).pipe(Effect.orDie)
        );
        const school = yield* fixture.internal
          .mutation(reserveStored, { ...request, tenantId: fixture.tenants.nf })
          .pipe(Effect.flip);
        expect(school).toMatchObject({ _tag: "StorageFull", reason: "school" });
        const full = yield* fixture.internal
          .mutation(reserveStored, {
            ...request,
            byteSize: BUCKET_BYTE_LIMIT + 1,
          })
          .pipe(Effect.flip);
        expect(full).toMatchObject({ _tag: "StorageFull", reason: "bucket" });
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );

  it.effect(
    "removes objects, retrying R2, and fails as a defect when R2 keeps failing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        bucket.state.objects["files/accounts/a"] = new Uint8Array(1);
        yield* fixture.internal.action(removeObjects, {
          keys: ["files/accounts/a"],
        });
        expect(bucket.state.objects).toEqual({});
        bucket.state.failing = true;
        const exit = yield* fixture.internal
          .action(removeObjects, { keys: ["files/accounts/b"] })
          .pipe(Effect.exit);
        expect(Exit.isFailure(exit)).toBe(true);
      })
  );

  it.effect(
    "sweeps files reserved more than two hours ago in batches, and keeps newer reservations and stored files",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers();
        vi.setSystemTime(TENANCY_NOW);
        const fixture = yield* tenancyFixture;
        const now = TENANCY_NOW;
        const old = now - Duration.toMillis(Duration.hours(3));
        const rows = [
          ...Arr.makeBy(65, (index) => ({
            createdAt: old,
            objectKey: `files/accounts/old-${index}`,
            state: "reserved" as const,
          })),
          {
            createdAt: now,
            objectKey: "files/accounts/new",
            state: "reserved" as const,
          },
          {
            createdAt: old,
            objectKey: "files/accounts/kept",
            state: "stored" as const,
          },
        ];
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(rows, (row) =>
              writer
                .table("bucketFiles")
                .insert({ ...row, byteSize: 1, contentType: "image/png" })
            )
          ).pipe(Effect.orDie)
        );
        yield* fixture.internal.mutation(sweep, {});
        yield* fixture.finishScheduled();
        const left = yield* fixture.run(fileRows);
        expect(
          Arr.sort(
            Arr.map(left, (row) => row.objectKey),
            Order.String
          )
        ).toEqual(["files/accounts/kept", "files/accounts/new"]);
      })
  );
});
