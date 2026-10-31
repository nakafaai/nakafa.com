import { getRouteApi } from "@tanstack/react-router";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion";
import { Faq } from "@/components/marketing/about/faq/landing";

const homeRoute = getRouteApi("/$locale/_marketing/");

/** The questions part of the home page, the first one open. */
export function HomeFaq() {
  const { faqs } = homeRoute.useLoaderData();
  return (
    <Faq>
      <FaqAccordion faqs={faqs} openFirst />
    </Faq>
  );
}
