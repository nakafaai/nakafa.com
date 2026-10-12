import { LearningGraphAssetIdSchema } from "@nakafa/aksara-contracts/graph/family";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import {
  MEMORY_TOPIC_LENGTH,
  MEMORY_TOPIC_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Option, pipe, Schema, String as Str } from "effect";

/** Marks a topic that names the lesson a page shows. */
const LESSON_TAG = "lesson:";
/** Marks a topic that names a path above a page. */
const PATH_TAG = "path:";
/**
 * Segments the shallowest kept path has. The first segment is the surface of
 * the site, such as the materials, which every lesson shares and which says
 * nothing about one of them; the second is its subject.
 */
const SHALLOWEST_PATH = 2;

/**
 * The lesson an open page shows, named the same in every language. A page's
 * asset id reads `asset:<locale>:<family>:<identity>`; without its locale it
 * names the lesson for all of its translations. A page with no asset id, such
 * as the home page, shows no lesson.
 */
function lessonOf(page: NinaPage | undefined) {
  return Option.fromUndefinedOr(page?.nina.learning.assetId).pipe(
    Option.flatMap(Schema.decodeUnknownOption(LearningGraphAssetIdSchema)),
    Option.map((assetId) =>
      Arr.join(Arr.drop(Str.split(assetId, ":"), 2), ":")
    ),
    Option.getOrUndefined
  );
}

/**
 * The paths above a page, the deepest first, from the slug of its learning
 * context. For `materi/matematika/integral/jumlahan-riemann` they are
 * `materi/matematika/integral` and `materi/matematika`. A path of one segment
 * names the whole surface, so it is no topic. A slug is localized, so these
 * paths link the pages of one language.
 */
function pathsAbove(slug: string | undefined) {
  const segments = Arr.filter(Str.split(slug ?? "", "/"), Str.isNonEmpty);
  // The paths from the surface down to the page itself, as a running join.
  const prefixes = Arr.scan(segments, "", (path, segment) =>
    Str.isEmpty(path) ? segment : `${path}/${segment}`
  );
  return Arr.reverse(Arr.dropRight(Arr.drop(prefixes, SHALLOWEST_PATH), 1));
}

/**
 * Where a learner is: the topics of the page they have open, the most specific
 * first. A topic is the lesson the page shows (`lesson:<identity>`, when it
 * shows one) or a path above it (`path:<route>`). A memory said on the page is
 * linked to them, and a search for the page finds it by them. A page has at
 * most `MEMORY_TOPIC_LIMIT` topics, and a path longer than
 * `MEMORY_TOPIC_LENGTH` characters is no page of Nakafa and names none.
 */
export function topicsOf(page: NinaPage | undefined) {
  return pipe(
    Arr.appendAll(
      Arr.map(Arr.fromNullishOr(lessonOf(page)), (id) => `${LESSON_TAG}${id}`),
      Arr.map(
        pathsAbove(page?.nina.learning.slug),
        (path) => `${PATH_TAG}${path}`
      )
    ),
    Arr.filter((topic) => Str.length(topic) <= MEMORY_TOPIC_LENGTH),
    Arr.take(MEMORY_TOPIC_LIMIT)
  );
}

/** Whether a topic names a lesson, which is the page itself, rather than a path above it. */
export function isLesson(topic: string) {
  return Str.startsWith(LESSON_TAG)(topic);
}
