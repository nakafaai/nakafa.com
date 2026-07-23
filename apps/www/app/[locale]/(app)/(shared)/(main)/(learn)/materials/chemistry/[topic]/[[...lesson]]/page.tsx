import { importChemistryMaterial } from "@repo/contents/_lib/material/chemistry";
import { chemistryComponents } from "@repo/design-system/lib/markdown/domain/chemistry";
import { Effect } from "effect";
import { listDomainMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  generateMaterialMetadata,
  type MaterialPageConfig,
  type MaterialPageProps,
  renderMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/view";
import { renderPublishedChemistry } from "@/lib/content/published/chemistry";

const config = {
  components: chemistryComponents,
  importer: importChemistryMaterial,
  published: renderPublishedChemistry,
  target: "chemistry",
} satisfies MaterialPageConfig;

/** Builds the chemistry share of one globally bounded material selection. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return Effect.runSync(
    listDomainMaterialStaticParams("chemistry", params.locale)
  );
}

/** Generates chemistry metadata through the shared material implementation. */
export function generateMetadata(props: Pick<MaterialPageProps, "params">) {
  return generateMaterialMetadata(props, config);
}

/** Renders one chemistry lesson with only its complete physical registry. */
export default function Page(props: MaterialPageProps) {
  return renderMaterialPage(props, config);
}
