"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  NumberFormat,
  NumberFormatGroup,
} from "@repo/design-system/components/ui/number-flow";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/part-summary";
import { getTryoutHref } from "@/components/tryout/routes";
import { StartTryoutButton } from "@/components/tryout/start-button";

interface TryoutSectionPageClientProps {
  country: string;
  exam: string;
  locale: Locale;
  publicPath: string;
  section: string;
  set: string;
}

/** Renders one realtime try-out section page from Convex. */
export function TryoutSectionPageClient({
  country,
  exam,
  locale,
  publicPath,
  section,
  set,
}: TryoutSectionPageClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getSectionPage, {
    locale,
    publicPath,
  });
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");

  if (!page) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          icon={getMaterialIcon(page.section.sectionKey)}
          link={{
            href: getTryoutHref({ country, exam, set }),
            label: tCommon("back"),
          }}
          meta={<TryoutMeta items={[page.exam.title, page.set.title]} />}
          status={tTryouts("part-head-needs-tryout")}
          title={page.section.title}
        />

        <div className="space-y-12">
          <TryoutPartSummary>
            <TryoutPartBody>
              <TryoutPartLead>
                <TryoutPartStats>
                  <TryoutPartStat label={tTryouts("part-questions-label")}>
                    <TryoutMetricNumber value={page.section.questionCount} />
                  </TryoutPartStat>
                </TryoutPartStats>
              </TryoutPartLead>

              <TryoutPartCtas>
                <StartTryoutButton
                  countryKey={page.set.countryKey}
                  examKey={page.set.examKey}
                  firstSectionHref={getTryoutHref({
                    country,
                    exam,
                    section,
                    set,
                  })}
                  label={tTryouts("start-cta")}
                  locale={locale}
                  setKey={page.set.setKey}
                />
              </TryoutPartCtas>
            </TryoutPartBody>
          </TryoutPartSummary>
        </div>
      </div>
    </div>
  );
}

/** Renders the production try-out metric number style. */
function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <NumberFormatGroup>
      <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none tracking-tighter">
        <NumberFormat
          format={{ maximumFractionDigits: 0 }}
          trend={0}
          value={value}
        />
      </div>
    </NumberFormatGroup>
  );
}
