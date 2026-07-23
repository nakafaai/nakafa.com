import { importMathematicsMaterial } from "@repo/contents/_lib/material/mathematics";
import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import { Effect } from "effect";
import { listDomainMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  generateMaterialMetadata,
  type MaterialPageConfig,
  type MaterialPageProps,
  renderMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/view";
import { renderPublishedMathematics } from "@/lib/content/published/mathematics";

const config = {
  components: mathematicsComponents,
  importer: importMathematicsMaterial,
  published: renderPublishedMathematics,
  target: "mathematics",
} satisfies MaterialPageConfig;

/** Builds the mathematics share of one globally bounded material selection. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return Effect.runSync(
    listDomainMaterialStaticParams("mathematics", params.locale)
  );
}

/** Generates mathematics metadata through the shared material implementation. */
export function generateMetadata(props: Pick<MaterialPageProps, "params">) {
  return generateMaterialMetadata(props, config);
}

/** Renders one mathematics lesson with only its complete physical registry. */
export default function Page(props: MaterialPageProps) {
  return renderMaterialPage(props, config);
}
