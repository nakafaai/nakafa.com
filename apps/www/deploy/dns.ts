import { DNS, Ruleset, Zone } from "@alchemy.run/cloudflare";
import { adopt } from "alchemy/AdoptPolicy";
import { Effect } from "effect";
import { NAKAFA_ZONE } from "#www/deploy/stage";

/**
 * The address that a proxied record points at when a Worker answers before any
 * origin does. It is the documentation address that nakafa.id uses too.
 */
const EDGE_PLACEHOLDER_ADDRESS = "192.0.2.1";

/** The domain that redirects every request to nakafa.com, and its zone. */
const NAKAFA_ID_ZONE = "nakafa.id";

/**
 * The nakafa.com zone and its records, deployed from production only. The zone
 * is adopted, because Cloudflare keeps no ownership marker on a zone. Every
 * mail, verification and analytics record is DNS only, with the value that the
 * existing host already serves. The apex is the web Worker's custom domain, and
 * the API, MCP and CAS hosts are exact Worker routes. The proxied wildcard catches
 * every other host under the zone, School hosts included.
 */
export const deployNakafaDns = Effect.fn("deploy.nakafaDns")(function* () {
  const zone = yield* Zone.Zone("NakafaZone", {
    name: NAKAFA_ZONE,
  }).pipe(adopt(true));
  const zoneId = zone.zoneId;

  yield* DNS.Record("SchoolWildcard", {
    zoneId,
    name: "*",
    type: "A",
    content: EDGE_PLACEHOLDER_ADDRESS,
    proxied: true,
  });

  // Google Workspace mail.
  yield* DNS.Record("GoogleMailPrimary", {
    zoneId,
    name: "@",
    type: "MX",
    content: "aspmx.l.google.com",
    priority: 1,
  });
  yield* DNS.Record("GoogleMailAltOne", {
    zoneId,
    name: "@",
    type: "MX",
    content: "alt1.aspmx.l.google.com",
    priority: 5,
  });
  yield* DNS.Record("GoogleMailAltTwo", {
    zoneId,
    name: "@",
    type: "MX",
    content: "alt2.aspmx.l.google.com",
    priority: 5,
  });
  yield* DNS.Record("GoogleMailAltThree", {
    zoneId,
    name: "@",
    type: "MX",
    content: "alt3.aspmx.l.google.com",
    priority: 10,
  });
  yield* DNS.Record("GoogleMailAltFour", {
    zoneId,
    name: "@",
    type: "MX",
    content: "alt4.aspmx.l.google.com",
    priority: 10,
  });
  yield* DNS.Record("GoogleMailVerification", {
    zoneId,
    name: "@",
    type: "MX",
    content:
      "xhpp2vi5umegkto6hk7rgkgoxhhny4mmyuwfsrdaetuz3wah2hxq.mx-verification.google.com",
    priority: 15,
  });
  yield* DNS.Record("GoogleSiteVerificationOne", {
    zoneId,
    name: "@",
    type: "TXT",
    content:
      "google-site-verification=C1CqBTcq7ORt9Zc7PHmMV6PG8trxKIAPwGDMHcpklz4",
  });
  yield* DNS.Record("GoogleSiteVerificationTwo", {
    zoneId,
    name: "@",
    type: "TXT",
    content:
      "google-site-verification=Chr_x-rU4pUmClX0M3gXY5Vr28kfjGpgDKG-a2lV0sY",
  });
  yield* DNS.Record("DmarcPolicy", {
    zoneId,
    name: "_dmarc",
    type: "TXT",
    content: "v=DMARC1; p=none;",
  });
  yield* DNS.Record("GitHubOrganizationVerification", {
    zoneId,
    name: "_gh-nakafaai-o",
    type: "TXT",
    content: "012f01a57e",
    comment: "GitHub org verification",
  });

  // Resend sends the notification mail from its own subdomain.
  yield* DNS.Record("ResendBounceMail", {
    zoneId,
    name: "send.notifications",
    type: "MX",
    content: "feedback-smtp.eu-west-1.amazonses.com",
    priority: 10,
    comment: "Resend",
  });
  yield* DNS.Record("ResendSenderPolicy", {
    zoneId,
    name: "send.notifications",
    type: "TXT",
    content: "v=spf1 include:amazonses.com ~all",
    comment: "Resend",
  });
  yield* DNS.Record("ResendDkimKey", {
    zoneId,
    name: "resend._domainkey.notifications",
    type: "TXT",
    content:
      "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC8kswXoAa0CPPw12jDzNiKBSxXbSxbiQkWO7aC6dcuV97D9K2jIbWz0tLpb7aUnxkmBumOIKgkttxeYagCUSVmVj3KVfPDzb5sABhc19Wl1/On/kQztXBIFUVFw0OGATckp8fO0BKxaVLdjc8ickOEMPgImcxkdl8AU99sFJi7kwIDAQAB",
    comment: "Resend DKIM public key",
  });

  // Product analytics through the first-party PostHog EU proxy.
  yield* DNS.Record("PostHogProxy", {
    zoneId,
    name: "t",
    type: "CNAME",
    content: "d44e95c71acedc58ff7a.cf-prod-eu-proxy.europehog.com",
    comment: "PostHog EU proxy, DNS only",
  });
  yield* DNS.Record("StatusPage", {
    zoneId,
    name: "status",
    type: "CNAME",
    content: "statuspage.betteruptime.com",
  });

  // Checkout records of the Stripe era.
  yield* DNS.Record("CheckoutHost", {
    zoneId,
    name: "checkout",
    type: "CNAME",
    content: "hosted-checkout.stripecdn.com",
    comment: "Stripe era; check whether still used before keeping",
  });
  yield* DNS.Record("CheckoutAcmeChallenge", {
    zoneId,
    name: "_acme-challenge.checkout",
    type: "TXT",
    content: "xxGCdY1gLm-X9T2_EhxS94Uro-l_uS-uOG7nJ3bPw_0",
  });

  // SendGrid tracking and DKIM records.
  yield* DNS.Record("SendGridLinkTracking", {
    zoneId,
    name: "em5689",
    type: "CNAME",
    content: "u32110129.wl130.sendgrid.net",
    comment: "SendGrid; check whether still used",
  });
  yield* DNS.Record("SendGridDkimOne", {
    zoneId,
    name: "s1._domainkey",
    type: "CNAME",
    content: "s1.domainkey.u32110129.wl130.sendgrid.net",
  });
  yield* DNS.Record("SendGridDkimTwo", {
    zoneId,
    name: "s2._domainkey",
    type: "CNAME",
    content: "s2.domainkey.u32110129.wl130.sendgrid.net",
  });
  yield* DNS.Record("SendGridImageTracking", {
    zoneId,
    name: "url4496",
    type: "CNAME",
    content: "sendgrid.net",
  });
  yield* DNS.Record("SendGridVerification", {
    zoneId,
    name: "32110129",
    type: "CNAME",
    content: "sendgrid.net",
  });

  return zone;
});

/**
 * The nakafa.id zone, deployed from production and adopted, because it already
 * runs on Cloudflare. Its proxied placeholder records answer before any origin,
 * and its one dynamic redirect keeps the path and query on nakafa.com.
 */
export const deployNakafaIdZone = Effect.fn("deploy.nakafaIdZone")(
  function* () {
    const zone = yield* Zone.Zone("NakafaIdZone", {
      name: NAKAFA_ID_ZONE,
    }).pipe(adopt(true));
    const zoneId = zone.zoneId;

    // Both placeholder records were set up by hand before the stack owned the zone, so the stack adopts them.
    yield* DNS.Record("NakafaIdApex", {
      zoneId,
      name: "@",
      type: "A",
      content: EDGE_PLACEHOLDER_ADDRESS,
      proxied: true,
    }).pipe(adopt(true));
    yield* DNS.Record("NakafaIdWildcard", {
      zoneId,
      name: "*",
      type: "A",
      content: EDGE_PLACEHOLDER_ADDRESS,
      proxied: true,
    }).pipe(adopt(true));

    yield* Ruleset.Ruleset("NakafaIdRedirect", {
      zone,
      phase: "http_request_dynamic_redirect",
      rules: [
        {
          action: "redirect",
          actionParameters: {
            fromValue: {
              preserveQueryString: true,
              statusCode: 301,
              targetUrl: {
                expression:
                  'concat("https://nakafa.com", http.request.uri.path)',
              },
            },
          },
          description: "nakafa.id to nakafa.com",
          enabled: true,
          expression: "true",
        },
      ],
    }).pipe(adopt(true));

    return zone;
  }
);
