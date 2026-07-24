import { Effect } from "effect";
import { resolveGenericMaterialRuntime } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/registry";
import { listGenericMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  generateMaterialMetadata,
  type MaterialPageConfig,
  type MaterialPageProps,
  renderMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/view";

const config = {
  resolveRuntime: resolveGenericMaterialRuntime,
  target: "generic",
} satisfies MaterialPageConfig;

/** Builds bounded params for the three domains sharing this physical route. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return Effect.runSync(listGenericMaterialStaticParams(params.locale));
}

/** Generates metadata through the shared material page implementation. */
export function generateMetadata(props: Pick<MaterialPageProps, "params">) {
  return generateMaterialMetadata(props, config);
}

/** Renders one generic material route through its exact domain registry. */
export default function Page(props: MaterialPageProps) {
  return renderMaterialPage(props, config);
}
