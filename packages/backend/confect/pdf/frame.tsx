import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { NAKAFA_MARK } from "@repo/backend/confect/pdf/mark";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Match, Schema } from "effect";
import type { ReactNode } from "react";
import { PageNumber, TotalPages } from "takumi-pdf/primitives";

/** The side margins of every page in CSS px, which the header and footer bands keep too. */
export const PAGE_SIDE = 56;

/** The family every document draws with. */
export const PDF_FONT = "Inter";

/** Who a document comes from: Nakafa itself, or a school that issues it through Nakafa. */
const PdfBrand = Schema.Union([
  Schema.TaggedStruct("nakafa", {}),
  Schema.TaggedStruct("school", {
    name: Schema.String,
    note: Schema.optionalKey(Schema.String),
  }),
]);

/**
 * What every page of a document carries around its body: who it comes from,
 * its title and identifier in the header, and the issuer, the contact address,
 * the identifier, and the page number in the footer. `name` is the title the
 * file carries in its properties.
 */
export const PdfFrame = Schema.Struct({
  brand: PdfBrand,
  identifier: Schema.String,
  issuer: Schema.String,
  language: ActiveAppLocaleCodeSchema,
  name: Schema.String,
  title: Schema.String,
});

/** How a page names its number, in each language a document is written in. */
const PAGE_WORDS = {
  de: { of: "von", page: "Seite" },
  en: { of: "of", page: "Page" },
  id: { of: "dari", page: "Halaman" },
} as const;

/** Where a reader of any document reaches Nakafa. */
const CONTACT = `${new URL(SITE_ORIGIN).host}, ${COMPANY_IDENTITY.email}`;

/** A band at the page's full width, inset to the body's edge. */
function Band({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-foreground"
      style={{
        fontFamily: PDF_FONT,
        paddingLeft: PAGE_SIDE,
        paddingRight: PAGE_SIDE,
      }}
      tw="flex w-full flex-col"
    >
      {children}
    </div>
  );
}

/** The header's left side: the Nakafa mark and name, or the school's name and its note. */
function Brand({ brand }: { brand: typeof PdfBrand.Type }) {
  return Match.valueTags(brand, {
    nakafa: () => (
      <div tw="flex items-center gap-3">
        <img
          alt="Nakafa"
          className="border"
          height={32}
          src={NAKAFA_MARK}
          tw="size-8 rounded-sm border"
          width={32}
        />
        <div tw="flex flex-col">
          <span tw="text-[11pt] font-semibold leading-tight">
            {COMPANY_IDENTITY.brandName}
          </span>
          <span className="text-muted-foreground" tw="text-[8pt]">
            {COMPANY_IDENTITY.legalName}
          </span>
        </div>
      </div>
    ),
    school: (school) => (
      <div tw="flex min-w-0 flex-col">
        <span tw="text-[11pt] font-semibold leading-tight">{school.name}</span>
        {school.note === undefined ? null : (
          <span className="text-muted-foreground" tw="text-[8pt]">
            {school.note}
          </span>
        )}
      </div>
    ),
  });
}

/** The band at the top of every page: who the document comes from, its title, and its identifier. */
export function PageHeader({ frame }: { frame: typeof PdfFrame.Type }) {
  return (
    <Band>
      <header
        className="border"
        tw="mt-10 mb-6 flex items-end justify-between gap-8 border-b pb-4"
      >
        <Brand brand={frame.brand} />
        <div tw="flex shrink-0 flex-col items-end text-right">
          <span
            className="text-primary"
            tw="text-[13pt] font-semibold leading-tight"
          >
            {frame.title}
          </span>
          <span className="text-muted-foreground" tw="text-[8pt]">
            {frame.identifier}
          </span>
        </div>
      </header>
    </Band>
  );
}

/** The band at the foot of every page: the issuer, the contact address, the identifier, and the page number. */
export function PageFooter({ frame }: { frame: typeof PdfFrame.Type }) {
  const words = PAGE_WORDS[frame.language];
  return (
    <Band>
      <footer
        className="text-muted-foreground border"
        tw="mt-6 mb-10 flex items-start justify-between gap-8 border-t pt-3 text-[7.5pt]"
      >
        <div tw="flex min-w-0 flex-col">
          <span>{frame.issuer}</span>
          <span>{CONTACT}</span>
        </div>
        <div tw="flex shrink-0 flex-col items-end text-right">
          <span>{frame.identifier}</span>
          <span>
            {words.page} <PageNumber /> {words.of} <TotalPages />
          </span>
        </div>
      </footer>
    </Band>
  );
}
