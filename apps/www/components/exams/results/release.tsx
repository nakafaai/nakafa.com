"use client";

import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Clock, Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useResultsScope } from "@/components/exams/results/context";
import { runSittingCall } from "@/components/exams/sitting/actions.client";
import { ConfirmActions } from "@/components/exams/sitting/dialogs";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The milliseconds on the device clock, for the optimistic guess that the server settles. */
const nowMillis = () => Effect.runSync(Clock.currentTimeMillis);

/**
 * Releases the results at once: the overview shows the release before the server answers, and a
 * refused release rolls the guess back.
 */
function useReleaseResults() {
  return useMutation(exams.results.results.release).withOptimisticUpdate(
    (localStore, args) => {
      const key = { sittingId: args.sittingId, slug: args.slug };
      const current = localStore.getQuery(exams.results.results.overview, key);
      if (Option.isSome(current)) {
        localStore.setQuery(
          exams.results.results.overview,
          key,
          Option.some({ ...current.value, releasedAt: nowMillis() })
        );
      }
    }
  );
}

/**
 * The card that releases a closed sitting's results to its students, with the one primary action of
 * the page. The release asks first, because students see their answers once it is done.
 */
export function ReleaseCard({
  releasedAt,
}: {
  readonly releasedAt: number | null;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const release = useReleaseResults();
  const [open, setOpen] = useState(false);

  if (releasedAt !== null) {
    return (
      <CardSection>
        <CardHeader>
          <CardTitle>{t("results-title")}</CardTitle>
        </CardHeader>
        <CardSectionFooter hint={t("released-footer")} />
      </CardSection>
    );
  }
  return (
    <>
      <CardSection>
        <CardHeader>
          <CardTitle>{t("results-title")}</CardTitle>
          <CardDescription>{t("release-description")}</CardDescription>
        </CardHeader>
        <CardSectionFooter hint={t("release-footer")}>
          <CardSectionActions>
            <Button onClick={() => setOpen(true)} type="button">
              {t("release-action")}
            </Button>
          </CardSectionActions>
        </CardSectionFooter>
      </CardSection>
      <ResponsiveDialog
        description={t("release-description")}
        footer={
          <ConfirmActions
            confirm={t("release-action")}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              setOpen(false);
              runSittingCall(() => release({ sittingId, slug }));
            }}
          />
        }
        open={open}
        setOpen={setOpen}
        title={t("release-title")}
      />
    </>
  );
}
