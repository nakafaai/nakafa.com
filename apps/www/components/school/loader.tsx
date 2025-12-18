import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { useTranslations } from "next-intl";

export function SchoolLoader() {
  const t = useTranslations("School.Common");
  return (
    <div className="relative flex h-svh items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia
            className="bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] text-primary"
            variant="icon"
          >
            <SpinnerIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("preparing-school")}</EmptyTitle>
          <EmptyDescription>
            {t("preparing-school-description")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
