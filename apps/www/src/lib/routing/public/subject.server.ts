import { env } from "cloudflare:workers";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option, Record as Rec, Schema } from "effect";
import {
  type SubjectLocale,
  SubjectMapJson,
  subjectMapPath,
} from "@/lib/routing/public/subject";
import { hasStaticRelease } from "@/lib/routing/release";

/** The release holds no readable map for a locale: a defect of its build, never a reader's miss. */
export class SubjectMapUnavailable extends Schema.TaggedError<SubjectMapUnavailable>()(
  "SubjectMapUnavailable",
  { locale: Schema.String, status: Schema.optionalKey(Schema.Int) }
) {}

/**
 * The public path that succeeds one retired subject lesson, from the map that the
 * build wrote for its locale (`readSubjectMap`), or none when the release holds no
 * lesson with that content key. It is one asset read and no Convex read, so an old
 * link costs the Worker almost nothing. A prerender and a development server bind
 * no assets, so they redirect nothing.
 */
export const readSubjectSuccessor = Effect.fn("www.routing.subject.successor")(
  function* (locale: SubjectLocale, contentKey: string) {
    if (!hasStaticRelease()) {
      return Option.none<string>();
    }
    const file = yield* Effect.promise(() =>
      env.ASSETS.fetch(
        new Request(new URL(subjectMapPath(locale), SITE_ORIGIN))
      )
    );
    if (!file.ok) {
      return yield* new SubjectMapUnavailable({ locale, status: file.status });
    }
    const map = yield* Effect.promise(() => file.text()).pipe(
      Effect.flatMap(Schema.decodeEffect(SubjectMapJson)),
      Effect.mapError(() => new SubjectMapUnavailable({ locale }))
    );
    return Rec.get(map, contentKey);
  }
);
