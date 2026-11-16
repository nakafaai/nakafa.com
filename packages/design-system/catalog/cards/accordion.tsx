import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";

export const card = {
  name: "Accordion",
  group: "Content",
  height: 260,
  source: "components/ui/accordion",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-lg p-6">
      <Accordion defaultValue={["free"]}>
        <AccordionItem value="free">
          <AccordionTrigger>Is Nakafa free?</AccordionTrigger>
          <AccordionContent>
            Yes. Every lesson, exercise, and question bank is free to learn
            from.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="curriculum">
          <AccordionTrigger>Which curriculum does it follow?</AccordionTrigger>
          <AccordionContent>
            Lessons follow the Merdeka curriculum for Indonesian schools.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="nina">
          <AccordionTrigger>Who is Nina?</AccordionTrigger>
          <AccordionContent>
            Nina is the learning assistant that answers from Nakafa content.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
