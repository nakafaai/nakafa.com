import { Array as Arr, Schema } from "effect";

/**
 * A training-only crawler that Nakafa refuses. `sentAsUserAgent` is false for a
 * token that only robots.txt names: Applebot-Extended is never sent in a
 * request, because Apple fetches the pages as Applebot.
 */
const TrainingCrawler = Schema.Struct({
  sentAsUserAgent: Schema.Boolean,
  token: Schema.String,
});

const TrainingCrawlers = Schema.Array(TrainingCrawler);

/**
 * The training-only crawlers that robots.txt names and the edge refuses. No other
 * module lists these names.
 */
export const TRAINING_CRAWLERS: typeof TrainingCrawlers.Type = [
  { sentAsUserAgent: true, token: "GPTBot" },
  { sentAsUserAgent: true, token: "ClaudeBot" },
  { sentAsUserAgent: true, token: "CCBot" },
  { sentAsUserAgent: true, token: "Bytespider" },
  { sentAsUserAgent: true, token: "meta-externalagent" },
  { sentAsUserAgent: true, token: "Amazonbot" },
  { sentAsUserAgent: false, token: "Applebot-Extended" },
];

/**
 * The edge rule's expression: the lowercased user agent contains one refused
 * token. A token that no request carries is left out.
 */
export function renderTrainingCrawlerExpression(
  crawlers: typeof TrainingCrawlers.Type
) {
  const matches = Arr.map(
    Arr.filter(crawlers, (crawler) => crawler.sentAsUserAgent),
    ({ token }) => `lower(http.user_agent) contains "${token.toLowerCase()}"`
  );
  return `(${Arr.join(matches, " or ")})`;
}
