import { createStableId } from "@repo/utilities/helper";
import Script from "next/script";
import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps<T extends Thing = Thing> {
  jsonLd: WithContext<T>;
}

/**
 * Renders escaped JSON-LD through Next.js Script with a deterministic inline id.
 */
export function JsonLd<T extends Thing>({ jsonLd }: JsonLdProps<T>) {
  const serializedJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <Script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: This is a JSON-LD script, not user-generated content.
      dangerouslySetInnerHTML={{
        __html: serializedJsonLd,
      }}
      id={createStableId("json-ld", serializedJsonLd)}
      type="application/ld+json"
    />
  );
}
