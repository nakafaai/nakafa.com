import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { readTryoutCountryCode } from "@repo/contents/_types/tryout/countries";
import type { Locale } from "next-intl";
import type {
  TryoutCountrySelectorOption,
  TryoutExamSelectorOption,
} from "@/components/tryout/catalog/selector.client";

/** Reads one source-projected try-out route for static header context. */
export function readStaticTryoutRoute({
  kind,
  locale,
  publicPath,
}: {
  kind: "tryout-country" | "tryout-exam" | "tryout-track";
  locale: Locale;
  publicPath: string;
}) {
  return readStaticPublicTryoutRoutes().find(
    (route) =>
      route.kind === kind &&
      route.locale === locale &&
      route.publicPath === publicPath
  );
}

/** Reads source-projected try-out country selector options for one locale. */
export function readStaticTryoutCountryOptions(
  locale: Locale
): readonly TryoutCountrySelectorOption[] {
  return readStaticPublicTryoutRoutes().flatMap((route) => {
    if (route.kind !== "tryout-country" || route.locale !== locale) {
      return [];
    }

    const countryCode = readTryoutCountryCode(route.countryKey);

    if (!countryCode) {
      return [];
    }

    return [
      {
        countryCode,
        countryKey: route.countryKey,
        href: `/${locale}/${route.publicPath}`,
        title: route.title,
        value: route.publicPath,
      },
    ];
  });
}

/** Reads source-projected try-out exam selector options for one country page. */
export function readStaticTryoutExamOptions({
  countryPath,
  locale,
}: {
  countryPath: string;
  locale: Locale;
}): readonly TryoutExamSelectorOption[] {
  return readStaticPublicTryoutRoutes().flatMap((route) => {
    if (
      route.kind !== "tryout-exam" ||
      route.locale !== locale ||
      route.parentPath !== countryPath
    ) {
      return [];
    }

    return [
      {
        examKey: route.examKey,
        href: `/${locale}/${route.publicPath}`,
        title: route.title,
        value: route.publicPath,
      },
    ];
  });
}
