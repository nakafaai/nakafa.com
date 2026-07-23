import { importAiDsMaterial } from "@repo/contents/_lib/material/ai-ds";
import { importBiologyMaterial } from "@repo/contents/_lib/material/biology";
import { MaterialModuleImportError } from "@repo/contents/_lib/material/error";
import { importPhysicsMaterial } from "@repo/contents/_lib/material/physics";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import { Effect } from "effect";
import { listGenericMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  generateMaterialMetadata,
  type MaterialPageConfig,
  type MaterialPageProps,
  renderMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/view";
import type { MaterialModuleImporter } from "@/lib/content/material";

/** Selects one bounded base-registry material import context. */
const importGenericMaterial: MaterialModuleImporter = (
  sourcePath,
  locale,
  rendererDomain
) => {
  if (rendererDomain === "ai-ds") {
    return importAiDsMaterial(sourcePath, locale);
  }
  if (rendererDomain === "biology") {
    return importBiologyMaterial(sourcePath, locale);
  }
  if (rendererDomain === "physics") {
    return importPhysicsMaterial(sourcePath, locale);
  }

  return Promise.reject(
    new MaterialModuleImportError({
      domain: rendererDomain,
      sourcePath,
    })
  );
};

const config = {
  components: mdxComponents,
  importer: importGenericMaterial,
  target: "generic",
} satisfies MaterialPageConfig;

/** Builds bounded params for material domains that only need the base registry. */
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

/** Renders a base-registry material route without rich domain implementations. */
export default function Page(props: MaterialPageProps) {
  return renderMaterialPage(props, config);
}
