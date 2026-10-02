import { createStableId } from "@repo/utilities/helper";
import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps {
  /** One node, or the independent nodes of one page as a JSON array. */
  jsonLd: WithContext<Thing> | readonly WithContext<Thing>[];
}

/**
 * Renders escaped JSON-LD in the initial server HTML with a deterministic id.
 */
export function JsonLd({ jsonLd }: JsonLdProps) {
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
