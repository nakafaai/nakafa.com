import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps<T extends Thing = Thing> {
  jsonLd: WithContext<T>;
}

export function JsonLd<T extends Thing>({ jsonLd }: JsonLdProps<T>) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: This is a JSON-LD script, not user-generated content.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}
