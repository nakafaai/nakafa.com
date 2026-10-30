import { useMutation } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  LockKeyholeOpenIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Clock, Effect, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useResultsScope } from "@/components/exams/results/context";
import { runSittingCall } from "@/components/exams/sitting/actions";
import { ConfirmActions } from "@/components/exams/sitting/dialogs";

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
 * Release results, the results page's main action, in its header row: it opens the confirmation, and the
 * release shows at once. Once the results are released the button says so and stays still, and while the
 * viewer may not release them yet it stays disabled. On a phone it shows its icon alone, as the header's
 * other actions do, so the header keeps one row.
 */
export function ReleaseAction({
  canRelease,
  releasedAt,
}: {
  readonly canRelease: boolean;
  readonly releasedAt: number | null;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const release = useReleaseResults();
  const [open, setOpen] = useState(false);

  if (releasedAt !== null) {
    return (
      <Button disabled type="button" variant="outline">
        <HugeIcons icon={CheckmarkCircle02Icon} />
        <span className="max-sm:sr-only">{t("released")}</span>
      </Button>
    );
  }
  if (!canRelease) {
    return (
      <Button disabled type="button">
        <HugeIcons icon={LockKeyholeOpenIcon} />
        <span className="max-sm:sr-only">{t("release-action")}</span>
      </Button>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <HugeIcons icon={LockKeyholeOpenIcon} />
        <span className="max-sm:sr-only">{t("release-action")}</span>
      </Button>
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
