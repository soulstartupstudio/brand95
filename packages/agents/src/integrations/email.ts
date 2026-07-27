/**
 * Email adapter (spec §10). The core domain never talks to a vendor directly:
 * workflows send through this interface. The mock provider records the send
 * in the database only — useful for demos and tests. A real Gmail provider
 * plugs in here once OAuth credentials are configured (Milestone 5).
 */

export interface OutboundEmail {
  messageId: string;
  to: string | null;
  subject: string;
  body: string;
}

export interface SendReceipt {
  provider: string;
  externalId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutboundEmail): Promise<SendReceipt>;
}

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  async send(email: OutboundEmail): Promise<SendReceipt> {
    // No external side effect: the "send" exists only as database state.
    return { provider: "mock", externalId: `mock-${email.messageId}` };
  }
}

export class UnconfiguredGmailProvider implements EmailProvider {
  readonly name = "gmail";
  async send(): Promise<SendReceipt> {
    throw new Error(
      "Gmail is not configured. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and complete the OAuth setup (docs/integrations.md), or use EMAIL_PROVIDER=mock.",
    );
  }
}

export function getEmailProvider(): EmailProvider {
  const which = process.env.EMAIL_PROVIDER ?? "mock";
  if (which === "gmail") return new UnconfiguredGmailProvider();
  return new MockEmailProvider();
}
