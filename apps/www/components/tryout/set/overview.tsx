"use client";

import { useTranslations } from "next-intl";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { TryoutSetAction } from "@/components/tryout/set/action.client";
import type { TryoutSetView } from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

/** Renders a set page that offers visible nested sections. */
export function TryoutSetOverview({ value }: { value: TryoutSetView }) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const trackHref = getTryoutHref({
    country: value.route.country,
    exam: value.route.exam,
    track: value.route.track,
  });
  const setHref = getTryoutHref(value.route);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            value={{
              description:
                value.page.set.description ?? tTryouts("slug-description"),
              link: {
                href: trackHref,
                label: tCommon("back"),
              },
              meta: (
                <TryoutMeta
                  items={[
                    value.page.exam.title,
                    value.page.track.title,
                    value.page.set.title,
                  ]}
                />
              ),
              title: value.page.set.title,
            }}
          />

          <TryoutSetAction
            value={{
              activeAttempt: value.activeAttempt,
              currentHref: setHref,
              currentAttempt: value.actionAttempt,
              entryHref: value.entryHref,
              entrySection: value.entrySection,
              locale: value.route.locale,
              set: value.page.set,
            }}
          />
        </div>

        {value.runtimeContent ? (
          <TryoutRuntime
            value={{
              expired: value.runtimeContent.section.status !== "in-progress",
              questions: value.content.entryQuestions,
              returnHref: setHref,
              runtime: value.runtimeContent,
            }}
          />
        ) : null}

        {value.page.sections.length > 0 ? (
          <TryoutSectionRows
            value={{
              attempt: value.actionAttempt,
              emptyLabel: tTryouts("list-empty"),
              questionUnitLabel: tTryouts("question-unit"),
              sections: value.page.sections,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
