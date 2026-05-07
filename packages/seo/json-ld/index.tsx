import { createStableId } from "@repo/utilities/helper";
import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps<T extends Thing = Thing> {
  jsonLd: WithContext<T>;
}

/**
 * Renders escaped JSON-LD in the initial server HTML with a deterministic id.
 */
export function JsonLd<T extends Thing>({ jsonLd }: JsonLdProps<T>) {
  const serializedJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: This is a JSON-LD script, not user-generated content.
      dangerouslySetInnerHTML={{
        __html: serializedJsonLd,
      }}
      id={createStableId("json-ld", serializedJsonLd)}
      type="application/ld+json"
    />
  );
}
