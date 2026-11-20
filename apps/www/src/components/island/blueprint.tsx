"use client";

import { useMutation } from "@confect/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import island from "@repo/backend/confect/_generated/refs/island";
import type { Thing } from "@repo/backend/confect/island/things";
import { balanceOf, priceOf } from "@repo/backend/confect/island/things";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@tanstack/react-router";
import { Effect, Match, Option, Result } from "effect";
import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ThingIcon } from "@/components/island/icon";
import { useGame } from "@/components/island/store";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * The blueprint of a thing the learner has not opened yet (ADR 0050, W5): its
 * picture, its price and the Stars they hold, with the press that opens it
 * for good. With too few Stars it says how many are missing and leads to
 * learning, where Stars come from. The server decides: when it finds the
 * learner short after all, the dialog shows what the server counted.
 */
export function BlueprintDialog({
  kind,
  open,
  setOpen,
}: {
  kind: Thing;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const locale = useCurrentLocale();
  const balance = useGame((state) =>
    balanceOf(state.progress.lifetime, state.blueprints)
  );
  const opened = useGame((state) => state.opened);
  const hold = useGame((state) => state.hold);
  const setNotice = useGame((state) => state.setNotice);
  const unlock = useMutation(island.mutations.unlock);
  const [isOpening, startOpening] = useTransition();
  const [refused, setRefused] = useState<Option.Option<number>>(Option.none);
  const price = priceOf(kind);
  const missing = Option.getOrElse(refused, () => Math.max(0, price - balance));
  /** Opens the blueprint on the server, then holds the thing for the next press on the land. */
  const openBlueprint = () =>
    startOpening(() =>
      Effect.runPromise(
        Effect.tryPromise(() => unlock({ kind })).pipe(
          Effect.map((result) =>
            Result.match(result, {
              onFailure: (failure) =>
                Match.value(failure).pipe(
                  Match.tag("Short", (short) =>
                    setRefused(Option.some(short.price - short.balance))
                  ),
                  Match.orElse(() => setNotice("refused"))
                ),
              onSuccess: (held) => {
                opened(held.blueprints);
                hold(kind);
                setOpen(false);
              },
            })
          ),
          Effect.catch(() => Effect.sync(() => setNotice("refused")))
        )
      )
    );
  return (
    <ResponsiveDialog
      action={
        missing > 0 ? (
          <Link
            className={buttonVariants({ className: "h-11" })}
            params={{ locale }}
            to="/$locale/home"
          >
            {tCommon("start-learning")}
          </Link>
        ) : (
          <Button
            className="h-11"
            disabled={isOpening}
            onClick={openBlueprint}
            type="button"
          >
            {t("unlock")}
          </Button>
        )
      }
      description={t("blueprint-description")}
      open={open}
      setOpen={setOpen}
      title={t(`thing-${kind}`)}
    >
      <div className="flex items-center gap-4">
        <span className="bg-muted size-28 shrink-0 rounded-lg p-2">
          <ThingIcon kind={kind} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-2xl font-medium tabular-nums">
            <HugeIcons icon={StarIcon} />
            <span aria-hidden="true">{format.number(price)}</span>
            <span className="sr-only">
              {t("stars", { stars: format.number(price) })}
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            {missing > 0
              ? t("blueprint-short", {
                  have: format.number(balance),
                  stars: format.number(missing),
                })
              : t("blueprint-have", { stars: format.number(balance) })}
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
