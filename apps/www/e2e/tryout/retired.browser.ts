import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";
import answers from "@/e2e/tryout/retired.json" with { type: "json" };

/** How the release answers one try-out address: its status and, for a redirect, where it leads. */
const Answer = Schema.Struct({
  location: Schema.NullOr(Schema.String),
  status: Schema.Int,
});

/**
 * The answer of every retired try-out address that the acceptance catalog's
 * pages derive, as the release answered it while the redirects still read the
 * signed catalog: the hub, every exam, group and track address, the track-less
 * and track-only spellings of every set and section, SNBT's product and part
 * addresses, the retired section names, the renamed exams, and misses. Each
 * redirect now reads the try-out map the build writes (`tryout/map.ts`), so any
 * address whose answer moved names a map that lost what its rule reads. A
 * change to the acceptance catalog regenerates this table.
 */
const ANSWERS = Schema.decodeSync(Schema.Record(Schema.String, Answer))(
  answers
);

/** How many addresses the test asks at once, few enough that the preview server keeps every connection. */
const ANSWERS_AT_ONCE = 8;

test("every retired try-out address answers as it did before the try-out map", async ({
  request,
}) => {
  const answered = await Effect.runPromise(
    Effect.forEach(
      Rec.toEntries(ANSWERS),
      ([path, expected]) =>
        Effect.promise(async () => {
          const response = await request.get(path, { maxRedirects: 0 });
          const location = response.headers().location;
          return {
            actual: {
              location:
                location === undefined
                  ? null
                  : new URL(location, "https://nakafa.com").pathname,
              status: response.status(),
            },
            expected,
            path,
          };
        }),
      { concurrency: ANSWERS_AT_ONCE }
    )
  );
  const moved = Arr.filter(
    answered,
    ({ actual, expected }) =>
      actual.status !== expected.status || actual.location !== expected.location
  );

  expect(Arr.length(Rec.keys(ANSWERS))).toBeGreaterThan(0);
  expect(moved).toEqual([]);
});
