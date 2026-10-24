import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/**
 * What an exam's page shows when the exam cannot be read, for a viewer who may not open it
 * or an exam that is gone: one sentence and the way back to the exams. The editor and the
 * try both show it, so it has one owner.
 */
export function ExamUnavailable() {
  const { slug } = useTenant();
  const t = useTranslations("Exams");

  return (
    <main className="flex h-svh flex-col items-center justify-center gap-4 p-4">
      <p className="max-w-xs text-center text-sm">{t("unavailable")}</p>
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        params={{ slug }}
        to="/school/$slug/exams"
      >
        {t("title")}
      </Link>
    </main>
  );
}
