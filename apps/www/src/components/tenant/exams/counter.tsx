import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { useState } from "react";
import { useTranslations } from "use-intl";

/** Puts the cursor in the number field as it opens, as the counter turns into it on a click. */
const focusOnMount = (node: HTMLInputElement | null) => node?.focus();

/**
 * The position of the page in view, `3 / 10`, as a button that turns into a number field, as a design
 * tool's page counter: typing a question's number and pressing Enter goes to it, and Escape or leaving
 * the field keeps the page where it is.
 */
export function PageCounter({
  current,
  onJump,
  total,
}: {
  readonly current: number;
  readonly onJump: (index: number) => void;
  readonly total: number;
}) {
  const t = useTranslations("Exams");
  const [typing, setTyping] = useState<string | null>(null);

  if (typing === null) {
    return (
      <Button
        aria-label={t("page-of", { current, total })}
        className="tabular-nums"
        disabled={total === 0}
        onClick={() => setTyping(String(current))}
        size="sm"
        type="button"
        variant="ghost"
      >
        {current} / {total}
      </Button>
    );
  }

  return (
    <Input
      aria-label={t("page-jump", { total })}
      className="h-8 w-16 text-center tabular-nums"
      inputMode="numeric"
      max={total}
      min={1}
      onBlur={() => setTyping(null)}
      onChange={(event) => setTyping(event.currentTarget.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setTyping(null);
          return;
        }
        if (event.key !== "Enter") {
          return;
        }
        const number = Number(typing);
        setTyping(null);
        if (Number.isInteger(number) && number >= 1 && number <= total) {
          onJump(number - 1);
        }
      }}
      ref={focusOnMount}
      type="number"
      value={typing}
    />
  );
}
