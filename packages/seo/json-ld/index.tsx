import type { Thing, WithContext } from "schema-dts";

type JsonLdProps = {
  jsonLd: WithContext<Thing>;
};

export function JsonLd({ jsonLd }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: "This is a JSON-LD script, not user-generated content."
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
