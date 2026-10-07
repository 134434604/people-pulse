import type { IncomingMessage } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { GoogleIapIdentityProvider } from "../../src/peoplePulse/googleIapIdentity.js";

const audience = "/projects/123456789/locations/us-east1/services/people-pulse";

describe("Google IAP identity boundary", () => {
  it("accepts a signed Workspace identity while returning no email to the application session", async () => {
    const verifyAssertion = vi.fn(async () => payload());
    const provider = new GoogleIapIdentityProvider({
      expectedAudience: audience,
      workspaceDomain: "example.com",
      verifyAssertion
    });

    const identity = await provider.authenticate(requestWithAssertion("signed-jwt"));

    expect(verifyAssertion).toHaveBeenCalledWith("signed-jwt", audience);
    expect(identity).toEqual({
      subject: expect.stringMatching(/^[a-f0-9]{64}$/),
      displayName: "Authorized HR leader",
      role: "executive",
      demo: false
    });
    expect(JSON.stringify(identity)).not.toContain("leader@example.com");
  });

  it.each([
    ["missing assertion", undefined, payload()],
    ["wrong audience", "signed-jwt", payload({ aud: "/projects/999/locations/us-east1/services/other" })],
    ["wrong hosted domain", "signed-jwt", payload({ email: "leader@outside.example", hd: "outside.example" })],
    ["unsigned or invalid assertion", "signed-jwt", new Error("signature failed")]
  ])("rejects %s", async (_label, assertion, result) => {
    const provider = new GoogleIapIdentityProvider({
      expectedAudience: audience,
      workspaceDomain: "example.com",
      verifyAssertion: async () => {
        if (result instanceof Error) throw result;
        return result;
      }
    });
    expect(await provider.authenticate(requestWithAssertion(assertion))).toBeNull();
  });

  it("fails closed on malformed deployment identity configuration", () => {
    expect(() => new GoogleIapIdentityProvider({
      expectedAudience: "https://service.run.app",
      workspaceDomain: "example.com"
    })).toThrow("PP_IAP_AUDIENCE");
    expect(() => new GoogleIapIdentityProvider({
      expectedAudience: audience,
      workspaceDomain: "not a domain"
    })).toThrow("PP_GOOGLE_WORKSPACE_DOMAIN");
  });
});

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aud: audience,
    email: "leader@example.com",
    hd: "example.com",
    iss: "https://cloud.google.com/iap",
    sub: "accounts.google.com:1234567890",
    ...overrides
  };
}

function requestWithAssertion(assertion: string | undefined): IncomingMessage {
  return { headers: assertion ? { "x-goog-iap-jwt-assertion": assertion } : {} } as IncomingMessage;
}
