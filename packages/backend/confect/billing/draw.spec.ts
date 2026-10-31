import { FunctionSpec, GroupSpec } from "@confect/core";
import { InvoiceInput } from "@repo/backend/confect/pdf/invoice/contract";
import { Schema } from "effect";

/** Draws one invoice in the Node runtime, where the PDF renderer runs, and answers its bytes in Base64. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "invoice",
    args: () => InvoiceInput.fields,
    returns: () => Schema.String,
  })
);
