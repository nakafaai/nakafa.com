import { Kind } from "@repo/backend/confect/access/kind";
import type { Rule, RuleRole } from "@repo/backend/confect/access/schema";
import { tenant, unit } from "@repo/backend/confect/tenancy/kinds";

/** The school roles that view and edit the documents of their school, within each document's scope. */
const documentEditors: (typeof RuleRole.Type)[] = ["admin", "teacher"];

/**
 * The rule of `document.edit`: the school roles may edit a document within its scope.
 * Every kind that declares the action takes this one rule, so the roles are written once.
 */
const documentEdit: Rule = {
  access: "write",
  grantedBy: "roles",
  relations: [],
  roles: documentEditors,
};

/**
 * One collaborative document: a question, a material, or an announcement that
 * several teachers edit together. Its scope is the tenant or one unit, and an
 * Owner, an Admin, or a Teacher whose grant covers the scope may view and edit it.
 * An archived unit locks the edits of its documents. A student and an integration
 * client reach neither action.
 */
export const documentKind = Kind.make("document", "editorDocuments", {
  actions: {
    "document.edit": documentEdit,
    "document.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: documentEditors,
    },
  },
  changes: [],
  published: [],
  relations: [],
});

/**
 * Creating a document is decided on the scope it covers, as a grant is: the
 * tenant for a tenant-wide document, the unit for a unit document. The tenant
 * and the unit each take the `document.edit` action of their own.
 */
const tenantDocuments = Kind.extend(tenant, {
  actions: { "document.edit": documentEdit },
  changes: [],
  published: [],
});

const unitDocuments = Kind.extend(unit, {
  actions: { "document.edit": documentEdit },
  changes: [],
  published: [],
});

/**
 * The editor module's kinds for the access catalog: the document, and its
 * extensions on the tenant and the unit.
 */
export const editor = {
  extensions: [tenantDocuments, unitDocuments],
  kinds: [documentKind],
};
