# ADR 0032: Country Profiles Are Signed Data, And Five Locale Settings Stay Separate

## Status

Accepted on 13 October 2026 with owner decisions K2, K4, K17, and K20. The owner
approved decisions K1 to K20 on that day. Planned.
The profile module, `confect/jurisdiction`, does not exist yet. The organisation
record has no country, time zone, language, or currency field:
`packages/backend/confect/tenancy/schema.ts` defines the tenant as `kind`, `name`,
`slug`, and `status`, and nothing else.

## Context

Nakafa School serves schools in any country with the same concepts and the same
engine. Only the country data differs. Today the country rules sit in code. For
example, the unit levels are a fixed list of ten choices, `UnitLevel` in
`packages/backend/confect/tenancy/schema.ts`.

Owner decisions set the order of countries. Indonesia comes first (K4). The second
country is the first country in which a school signs a contract. The candidates
follow their readiness: English-speaking international schools come first, then
Germany, which needs an eu data cell (ADR 0026) and a German identity standard
later (K4). Each country's law differs, and counsel reviews Indonesia before the
first school and every new country before its launch (K20).

## Decision

### A profile is signed Aksara data

- Aksara publishes a country profile, signed, the same way it publishes a learning
  program (K17). A new country enters through data, not through a code release.
- The module is `confect/jurisdiction`. It is not named `profile`, because tenancy
  already uses that word.
- The module reads a frozen, signed bundle. Nakafa checks the signature before it
  uses the profile, and an unsigned profile is never used.

### What a profile holds, and what stays in code

| Part | The profile holds | Code keeps |
| --- | --- | --- |
| Calendar | The rule for the start of the school year, and the period names, such as semester ganjil and genap, Halbjahr, and term | The period model: rows with a type, an order, and dates |
| Levels and grades | Labels per language, with the ISCED 2011 code | The ontology and its rules |
| Grading scheme | A dated scheme with a version, bands, and report labels | The grading engine, and its normalisation from 0 to 1 for analytics |
| Report and credentials | The report template, the signers, and the credential issuer | The report renderer, the import, and the export |
| Identity | The name, format, purpose, legal basis, and sensitivity of identifiers such as NISN, NPSN, and UPN | Encrypted storage. An identifier is never a key. |
| National exam catalogue | Dates, delivery mode, and scale | The assessment engine and IRT (ADR 0031) |
| Exam profile | The official name per language, the sections and their durations, navigation, interactions, tools, accommodations, scoring, and the report form | The player, the scoring, and the scale (ADR 0031) |
| Age and consent | The age limit, and the rule for consent by a parent or guardian (K2) | The consent flow, with its time, method, and policy version |
| Attendance | The attendance codes of the country | The summaries and the exports |
| Locale and direction | The text direction, the number system, and the calendar, Gregorian or Hijri | The formatting engine, and the direction rules of the design system |

### Five locale settings, each on its own

Each setting is a separate value. None is derived from another, so a German
school may use Indonesian content, and a country may have no interface language
yet.

| Setting | Standard | Indonesia | Germany (Berlin) | Saudi Arabia |
| --- | --- | --- | --- | --- |
| Interface language | BCP 47 | `id-ID` | `de-DE` | `ar`, not active yet |
| Content language | The languages that Aksara publishes | `id` | `de` | None yet, because Aksara has no Arabic content |
| Country | ISO 3166-1, with an optional ISO 3166-2 | `ID` | `DE`, Berlin (`DE-BE`) | `SA` |
| School time zone | IANA | `Asia/Jakarta` | `Europe/Berlin` | `Asia/Riyadh` |
| Billing currency | ISO 4217, as the contract states | `IDR` | `EUR` | `SAR`, per contract |

The Saudi Arabia column is an example of the design only. No Saudi profile exists,
and Arabic is not an active interface language.

The organisation holds the country profile and the billing currency of its
contract. Each school holds its time zone and its content language. A person's
interface language comes from the `NEXT_LOCALE` cookie (ADR 0026). The columns
for these fields are added in program wave A.

### Indonesia, the first profile

- Age and consent (K2): UU 27/2022 Pasal 25 ayat 2 requires the consent of a
  parent or guardian to process a child's data. The law does not set an age for a
  child. The Indonesian profile uses under 18, as UU 35/2014 Pasal 1 angka 1
  defines it. The source is a secondary copy, and the official text has not been
  read yet. Counsel confirms it (K20).
- PP 33/2026 takes effect on 16 January 2027. Four secondary sources agree on the
  date, and the official text has not been read. It requires that a child is
  identified and that a parent's consent is verified and recorded. The sources
  disagree on the child article, so counsel is asked before the first school.
- PP 17/2025 requires a platform to be rated for risk. The deadline for the
  self-assessment, 6 June 2026, has passed. Nakafa assesses itself before its
  first school.

### Germany, the next candidate

- GDPR Article 8 sets the age of 16 for consent to a direct service for a child,
  and a member state may lower it to 13. Germany's age is 16 in a legal
  commentary, and no national change has been found (a secondary source).
- GDPR Article 28 makes Nakafa a processor for each school. Each school has a data
  processing agreement with Nakafa, and sub-processors are notified and can be
  objected to.
- Germany needs the eu data cell (ADR 0026) and, later, the FWU or VIDIS standard
  (K4). The sources do not yet name the protocol for VIDIS.

### Design-system rules that depend on the locale

These are targets. They are not live.

- The text direction comes from the interface language, through one helper and
  the `DirectionProvider` of Base UI.
- New code uses logical CSS properties, not physical left and right values.
- A language is named in its own language (an endonym), such as `Bahasa
  Indonesia`, `Deutsch`, or `English`. A flag stands for a country, never for a
  language.

## Consequences

- A new country is data work and counsel review. It is not a code release, but a
  new kind of rule still needs code.
- A profile without a valid signature is never used, so a broken publication
  cannot change a school's grades or report labels.
- Indonesian legal sources are secondary until counsel confirms them. The product
  makes no claim that a source has not confirmed.
- Keeping the five settings apart means one setting can change without touching
  the others.

## Rejected Alternatives

- Country rules in Nakafa code (K17 moves them to signed data).
- One setting derived from another, for example language implies country. The
  settings stand apart, so a country can have an unusual language mix.
- The module name `profile`, because tenancy already uses it.

## Implementation Status

| Part | Status |
| --- | --- |
| `UnitLevel`, the ten level choices in `packages/backend/confect/tenancy/schema.ts` | Live. The country profile replaces this list (K17). |
| `confect/jurisdiction` | Planned, program wave A |
| Signed Aksara profile for Indonesia | Planned, program wave A |
| The five locale settings as stored fields | Planned |
| Text direction through one helper | Target |
