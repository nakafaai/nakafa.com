import { createStableId } from "@repo/utilities/id";
import { JsonTextSchema } from "@repo/utilities/json";
import { Schema } from "effect";
import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps {
  /**
   * One node, or the independent nodes of one page as a JSON array. A node built
   * by a plain builder, such as `@repo/seo/json-ld/node`, is plain data.
   */
  jsonLd:
    | WithContext<Thing>
    | readonly WithContext<Thing>[]
    | Readonly<Record<string, unknown>>
    | readonly Readonly<Record<string, unknown>>[];
}

const encodeJsonLdText = Schema.encodeUnknownSync(JsonTextSchema);

/**
 * Renders escaped JSON-LD in the initial server HTML with a deterministic id.
 */
export function JsonLd({ jsonLd }: JsonLdProps) {
  const serializedJsonLd = encodeJsonLdText(jsonLd).replace(/</g, "\\u003c");

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
