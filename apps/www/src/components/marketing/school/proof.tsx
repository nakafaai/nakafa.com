import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/** The facts a school can check for itself, each one a value and the sentence that holds it. */
const SCHOOL_PROOFS = ["languages", "features", "engine", "trial"] as const;

/** One fact: its value large, its sentence under it. */
function SchoolProofItem({ proof }: { proof: (typeof SCHOOL_PROOFS)[number] }) {
  const t = useTranslations("SchoolSite");

  return (
    <div className="grid content-start gap-2">
      <dt className="text-2xl font-medium tracking-tight">
        {t(`proof-${proof}-value`)}
      </dt>
      <dd className="text-nina-face/80 text-base text-pretty">
        {t(`proof-${proof}-text`)}
      </dd>
    </div>
  );
}

/** Why a school can rely on it: a dark band of four facts about the Nakafa it is built on. */
export function SchoolProof() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="proof" labelledBy="school-proof-title">
      <div className="mx-auto w-full max-w-7xl">
        <div className="bg-nina-ink text-nina-face grid gap-12 rounded-xl px-6 py-16 lg:px-16">
          <h2
            className="max-w-2xl text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-proof-title"
          >
            {t("proof-title")}
          </h2>
          <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {Arr.map(SCHOOL_PROOFS, (proof) => (
              <SchoolProofItem key={proof} proof={proof} />
            ))}
          </dl>
        </div>
      </div>
    </MarketingSection>
  );
}
