import type { Thing, WithContext } from "schema-dts";

interface JsonLdProps {
  jsonLd: WithContext<Thing>;
  id: string;
}

export function JsonLd({ jsonLd, id }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // We need to use dangerouslySetInnerHTML here as this is the recommended
      // way to add JSON-LD to a page according to the Next.js documentation
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
