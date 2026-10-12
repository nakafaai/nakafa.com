/**
 * What the decision model reads about a note: the sentence the capture model
 * proposes, then the words of the learner that it quotes. The judgments of a
 * note (`ownNote`, `private`) read this one form, in production and in the run
 * that measures them (`judgment:measure`), so a threshold is set on the
 * question the product asks. The module imports nothing, so the measuring
 * command loads it without the gateway or the tokenizer behind `ask`.
 */
export function noteText({
  quote,
  text,
}: {
  readonly quote: string;
  readonly text: string;
}) {
  return `Note: ${text}\nQuote: ${quote}`;
}
