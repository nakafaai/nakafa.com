import { cn } from "cn";
import { useTranslations } from "use-intl";

interface Props {
  className?: string;
}

export function HomeTitle({ className }: Props) {
  const tCommon = useTranslations("Common");

  return (
    <h1
      className={cn(
        "mb-8 text-center text-4xl leading-none font-medium tracking-tight text-pretty",
        className
      )}
    >
      <span className="hidden md:inline">
        {tCommon("what-do-you-want-to-learn")}
      </span>
      <span className="inline md:hidden">Nakafa</span>
    </h1>
  );
}
