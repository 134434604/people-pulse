import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { createSafeLogger, type SafeLogger } from "./safeLog.js";
import type { IdentityProvider, PeoplePulseIdentity } from "./server.js";

const IAP_ISSUER = "https://cloud.google.com/iap";
const iapPayloadSchema = z.object({
  aud: z.string().min(1).max(500),
  email: z.string().email().max(320),
  hd: z.string().trim().min(1).max(253),
  iss: z.literal(IAP_ISSUER),
  sub: z.string().trim().min(1).max(300)
}).passthrough();

export type GoogleIapAssertionVerifier = (assertion: string, expectedAudience: string) => Promise<unknown>;

export interface GoogleIapIdentityProviderOptions {
  expectedAudience: string;
  workspaceDomain: string;
  verifyAssertion?: GoogleIapAssertionVerifier;
  logger?: SafeLogger;
}

export class GoogleIapIdentityProvider implements IdentityProvider {
  private readonly expectedAudience: string;
  private readonly workspaceDomain: string;
  private readonly verifyAssertion: GoogleIapAssertionVerifier;
  private readonly logger: SafeLogger;

  constructor(options: GoogleIapIdentityProviderOptions) {
    if (!/^\/projects\/\d+\/locations\/[a-z0-9-]+\/services\/[a-z][a-z0-9-]{0,62}$/u.test(options.expectedAudience)) {
      throw new Error("PP_IAP_AUDIENCE must be a Cloud Run IAP signed-header audience.");
    }
    const domain = options.workspaceDomain.trim().toLowerCase();
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(domain)) {
      throw new Error("PP_GOOGLE_WORKSPACE_DOMAIN must be a valid hosted domain.");
    }
    this.expectedAudience = options.expectedAudience;
    this.workspaceDomain = domain;
    this.verifyAssertion = options.verifyAssertion ?? createGoogleAssertionVerifier();
    this.logger = options.logger ?? createSafeLogger();
  }

  async authenticate(request: IncomingMessage): Promise<PeoplePulseIdentity | null> {
    const assertion = singleHeader(request.headers["x-goog-iap-jwt-assertion"]);
    if (!assertion || assertion.length > 16_384) return null;
    try {
      const payload = iapPayloadSchema.parse(await this.verifyAssertion(assertion, this.expectedAudience));
      const email = payload.email.toLowerCase();
      if (payload.aud !== this.expectedAudience || payload.hd.toLowerCase() !== this.workspaceDomain || !email.endsWith(`@${this.workspaceDomain}`)) {
        this.logger.warn("people_pulse_iap_identity_rejected", { failureCode: "claim_boundary" });
        return null;
      }
      return {
        subject: createHash("sha256").update(`people-pulse:${payload.sub}`, "utf8").digest("hex"),
        displayName: "Authorized HR leader",
        role: "executive",
        demo: false
      };
    } catch {
      this.logger.warn("people_pulse_iap_identity_rejected", { failureCode: "invalid_assertion" });
      return null;
    }
  }
}

function createGoogleAssertionVerifier(): GoogleIapAssertionVerifier {
  const client = new OAuth2Client();
  return async (assertion, expectedAudience) => {
    const { pubkeys } = await client.getIapPublicKeys();
    const ticket = await client.verifySignedJwtWithCertsAsync(assertion, pubkeys, expectedAudience, [IAP_ISSUER]);
    return ticket.getPayload();
  };
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
