import { BotManagement, Ruleset, type Zone } from "@alchemy.run/cloudflare";
import { adopt } from "alchemy/AdoptPolicy";
import { Effect } from "effect";
import {
  renderTrainingCrawlerExpression,
  TRAINING_CRAWLERS,
} from "#www/src/lib/seo/crawlers";

/**
 * The bot policy of the nakafa.com zone, deployed from production only. The AI
 * search, user and training classes all allow at the edge, so answer services can
 * read and cite, and training is refused by robots.txt and one WAF rule. Bot
 * Preference Sync, Bot Fight Mode and AI Labyrinth stay off. The Free plan accepts
 * `fightMode` and the shared fields that this resource sets, and no other field.
 */
export const deployNakafaBots = Effect.fn("deploy.nakafaBots")(function* (
  zone: Zone.Zone
) {
  yield* BotManagement.BotManagement("NakafaBots", {
    zoneId: zone.zoneId,
    aiSearch: "disabled",
    aiUser: "disabled",
    aiTraining: "disabled",
    botPreferenceSyncEnabled: false,
    crawlerProtection: "disabled",
    fightMode: false,
  });

  // The Ruleset owns the whole custom firewall phase of the zone, as the
  // nakafa.id redirect does for its phase, so the rule replaces what the phase held.
  yield* Ruleset.Ruleset("NakafaTrainingCrawlers", {
    zone,
    phase: "http_request_firewall_custom",
    rules: [
      {
        action: "block",
        description: "Refuse the training-only crawlers by user agent",
        enabled: true,
        expression: renderTrainingCrawlerExpression(TRAINING_CRAWLERS),
      },
    ],
  }).pipe(adopt(true));
});
