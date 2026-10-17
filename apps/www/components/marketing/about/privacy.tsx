import { useTranslations } from "next-intl";
import { PrivacyRoom } from "@/components/marketing/about/privacy/room.client";

/**
 * The privacy part, in a dark room from edge to edge. Its ink is the same in
 * both themes, so the words on it keep one colour.
 */
export function Privacy() {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 bg-nina-ink text-nina-face" id="privacy">
      <div className="mx-auto grid w-full max-w-3xl justify-items-center gap-10 px-6 py-20 text-center lg:py-32">
        <div className="grid justify-items-center gap-3">
          <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
            {t("privacy-title")}
          </h2>
          <p className="max-w-xl text-pretty text-base">{t("privacy-lead")}</p>
        </div>
        <PrivacyRoom words={t("privacy-words")} />
      </div>
    </section>
  );
}
