import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Clock, Effect, Option } from "effect";
import {
  readTryoutSectionPage,
  readTryoutSetPage,
} from "@/components/tryout/catalog/source.server";
import { readTryoutRouteHead } from "@/components/tryout/route/metadata.server";
import { getTryoutPublicPath } from "@/components/tryout/route/path";
import { serverHandler } from "@/lib/server/fn";
import { getTryoutSectionArtwork } from "@/lib/tryout/artwork";

/**
 * Resolves one section URL: the catalog view every visitor sees, with the set page it returns to and the set's
 * sections, which the player's pane offers as the paper's parts, which the build prerenders and keeps as the page's
 * static answer. A learner's own attempt through
 * the section is read in the browser (`useLearnerSection`), so the Worker renders nothing personal.
 */
export const readTryoutSectionRoute = Effect.fn("www.tryout.route.readSection")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
    readonly section: string;
    readonly set: string;
    readonly track: string;
  }) {
    const route = {
      country: input.country,
      exam: input.exam,
      group: input.group,
      locale: input.locale,
      section: input.section,
      set: input.set,
      track: input.track,
    };
    const sectionPath = getTryoutPublicPath(route);
    const setPath = getTryoutPublicPath({
      country: input.country,
      exam: input.exam,
      group: input.group,
      set: input.set,
      track: input.track,
    });
    const [page, setPage, head, tTryouts] = yield* Effect.all(
      [
        readTryoutSectionPage(input.locale, sectionPath),
        readTryoutSetPage(input.locale, setPath),
        readTryoutRouteHead({
          kind: "section",
          locale: input.locale,
          publicPath: sectionPath,
        }),
        Effect.promise(() =>
          readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (!page || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const exam = `${page.exam.title} ${page.group.title} ${page.track.title}`;
    return {
      // Every set of an exam has the same sections, so the page names its set too. A section holds
      // little more than its set says, and search has left these unread, so the set stands for them.
      head: {
        ...head.value,
        // A section with reviewed artwork shares it; any other keeps the generated image.
        image:
          getTryoutSectionArtwork(input.locale, {
            countryKey: page.set.countryKey,
            examKey: page.set.examKey,
            sectionKey: page.section.sectionKey,
          }) ?? head.value.image,
        indexable: false,
        description:
          page.section.description ??
          tTryouts("section-metadata-description", {
            exam,
            section: page.section.title,
            set: page.set.title,
          }),
        title: [page.section.title, page.set.title, exam],
      },
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page,
      // The set's sections that have a page of their own, as the player's pane picks between them.
      parts: Arr.getSomes(
        Arr.map(setPage?.sections ?? [], (section) =>
          Option.map(
            Option.fromUndefinedOr(section.publicPath),
            (publicPath) => ({
              key: section.sectionKey,
              label: section.title,
              publicPath,
            })
          )
        )
      ),
      route,
      sectionPath,
      setPath,
    };
  }
);

/** One section page: its catalog view. */
export const readTryoutSectionHandler = serverHandler(readTryoutSectionRoute);
