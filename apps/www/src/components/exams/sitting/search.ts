import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * The seat the proctor selected, as the dashboard's address carries it: its attempt, and the cursor
 * of the dashboard page that holds it when that is not the first page. The address keeps the choice,
 * so a seat is a link that opens its panel even before the page's script runs, and a reload keeps it.
 */
const DashboardSearch = Schema.Struct({
  page: Schema.optional(Schema.String),
  seat: Schema.optional(Id("examAttempts")),
});

/** The dashboard route's search, validated by the schema above. */
export const dashboardSearch = Schema.toStandardSchemaV1(DashboardSearch);
