# ADR 0045: One Locale Module Writes Every Message, Date And Number

## Status

Accepted on 9 November 2026.

## Context

The architecture review of 8 November 2026 (candidate 4) measured locale handling on main 44e487e146, and Malay (`ms`) had just touched every place it names:

| Concern | Homes before |
| --- | --- |
| Message selection | `packages/internationalization/src/messages.ts` (lazy loaders), `namespaces.ts` (every locale imported eagerly for the server's picker), `apps/www/src/lib/i18n/standalone.ts` (the standalone dictionaries read a third time) |
| Dates | `apps/www/src/lib/i18n/date.ts` (a moment with a separator table, a publication day always in English), `packages/internationalization/src/school/time.ts`, `apps/www/src/components/user/age.ts`, `user/settings/memory/time.ts`, `lib/billing/plan.ts`, and about 25 `useFormatter` calls that each spelled their own options |
| Numbers | 7 `Intl.NumberFormat` constructions in www, 3 more in the backend, two currency formatters and a third in the receipts, a currency symbol read twice, a storage size written three ways, a decimal mark table, and math options kept as constants in the design system |

So a new locale had a separator, a decimal mark and three dictionary imports to add, the same day was written `6. Okt. 2026 15:30` in a try-out's history and `06.10.2026, 15:30` in School, and a list column could build a formatter per row.

## Decision

D1. `packages/internationalization/src/messages.ts` owns every dictionary: the lazy app dictionary of each locale, the standalone dictionary that the error, not-found and head read at once (`readStandaloneMessages`), the route pick that the server and the browser both run (`getRouteMessages`), and the compile-time proof that the namespace list and the dictionaries name the same namespaces. `namespaces.ts` and `lib/i18n/standalone.ts` are gone.

D2. `packages/internationalization/src/formats.ts` names every shape Nakafa writes in `FORMATS`, use-intl's own `formats` configuration: dates (`date`, `dateTime`, `time`, `day`, `dayTime`, `long`, `full`, `month`, `clock`, and the zoned `calendar`, `calendarLong`, `billing`, `billingDay`), numbers (`math`, `trig`, `score`, `grade`, `precise`, `plain`, `coefficient`, `currency`, and the byte units) and lists (`and`, `or`). The locale roots pass it to `IntlProvider`, and `i18n.d.ts` registers it, so `format.dateTime(at, "date")` is typed and a name that is not in `FORMATS` is a compile error. Code outside a provider (server modules, emails, documents, the backend) reads `formatterOf(locale)`, one cached formatter per locale in that locale's zone. The module also writes an age (`formatAge`), a size (`formatBytes`) and a school's time in its own zone (`formatSchoolTime`).

D3. `packages/internationalization/src/money.ts` writes an amount in a currency's own locale (`formatCurrency`, one cached platform formatter per locale, currency and digits, with the no-break space after a symbol in letters that keeps Chrome and Safari alike) and a currency's symbol (`currencySymbol`). The Pro and School prices and the receipts read it.

D4. `scripts/check/formats.ts` refuses, outside those two modules, tests and Playwright specs, a platform formatter built by hand (`Intl.DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`, `ListFormat`, `PluralRules`) and a use-intl formatter call that writes a format's options instead of its name. An override such as a school's time zone goes third.

D5. One shape is written one way everywhere. A try-out's history writes its moments in School's `dateTime`; an article card writes its day in the reader's language, as the byline does; the home page's lesson reads its decimal mark from the locale's own numbers.

## Consequences

- A new locale needs its dictionaries, their imports in `messages.ts` and its time zone in `locale.ts`; every format follows from the platform.
- A new shape is one entry in `FORMATS`, which every page and the backend then share.
- `lib/i18n/date.ts`, `school/time.ts`, `user/age.ts`, `memory/time.ts`, `lib/marketing/decimal.ts`, `formatBillingDate`, `formatBillingDay`, `formatCount`, `formatStorage`, `spaceLetterSymbol` and the design system's `MATH_NUMBER_OPTIONS` and `TRIG_NUMBER_OPTIONS` are gone.
- German moments in the try-out history now read `06.10.2026, 15:30`, and article cards no longer write English months on Indonesian, German or Malay pages.
