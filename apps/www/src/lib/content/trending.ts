import "@tanstack/react-start/server-only";
import { HttpClient } from "@confect/js";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { trendingSubjectValidator } from "@repo/backend/confect/lib/validators/trending";
import { Duration, Effect, Option, Schema } from "effect";
import { readStoreEntry, writeStoreEntry } from "@/lib/content/store/entry";
import { httpLayer } from "@/lib/convex/http";

/** The ranking of one locale, as the home page lists it. */
const TrendingSubjectsSchema = Schema.Array(trendingSubjectValidator);

/** The tag of every stored ranking, so one purge drops all of them. */
const TRENDING_TAG = "trending";

/**
 * The ranking counts the last seven days and drops its oldest day once a night,
 * so a snapshot an hour old lists the same subjects for practical purposes. A
 * visitor's home page therefore reads the deployment once an hour per locale,
 * not once per visit.
 */
const TRENDING_LIFETIME = Duration.hours(1);

/** Loads the ranking of one locale from the deployment. */
const loadTrendingSubjects = Effect.fn("www.content.trending.load")(function* (
  locale: ActiveAppLocaleCode
) {
  return yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contents.queries.trending.getTrendingSubjects, { locale })
  ).pipe(Effect.provide(httpLayer()));
});

/**
 * Reads the ranking of one locale for the home page. A stored snapshot answers
 * while it is fresh. Otherwise the deployment answers, and the answer is stored
 * for an hour under the trending tag. Popularity is live analytics rather than
 * signed content, so it does not follow a content release.
 */
export const readHomeTrendingSubjects = Effect.fn("www.content.trending.read")(
  function* (locale: ActiveAppLocaleCode) {
    const parts = ["trending", locale];
    const stored = yield* readStoreEntry({
      parts,
      schema: TrendingSubjectsSchema,
    });
    if (Option.isSome(stored)) {
      return stored.value;
    }
    const subjects = yield* loadTrendingSubjects(locale);
    yield* writeStoreEntry({
      parts,
      schema: TrendingSubjectsSchema,
      tags: [TRENDING_TAG],
      ttl: TRENDING_LIFETIME,
      value: subjects,
    });
    return subjects;
  }
);
