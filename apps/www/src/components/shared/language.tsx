import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";

/**
 * The mark of one language in a list of languages: its code, such as EN or
 * DE. A language carries no flag, since a flag names a country and a language
 * is spoken in many, and every option of a list needs a mark of its own.
 */
export function LanguageMark({ code }: { code: AppLocaleCode }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground inline-flex h-4 min-w-5 shrink-0 items-center justify-center rounded-sm border px-0.5 text-[0.625rem] leading-none font-semibold uppercase"
    >
      {code}
    </span>
  );
}
