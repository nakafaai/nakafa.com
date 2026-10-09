import { Schema } from "effect";

const TooltipPayloadItemSchema = Schema.Struct({
  payload: Schema.optionalKey(
    Schema.Struct({
      time: Schema.optionalKey(Schema.Unknown),
    })
  ),
});

type TooltipPayloadItem = typeof TooltipPayloadItemSchema.Type;

/** The tooltip label of a kinematics chart: "t = 2 s", or "t" without a time. */
export function formatTooltipTime(
  _: unknown,
  payload: readonly TooltipPayloadItem[] = []
) {
  const time = payload[0]?.payload?.time;

  if (typeof time !== "number") {
    return "t";
  }

  return `t = ${time} s`;
}
