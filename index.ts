import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect, CamelCasePlugin } from "kysely";
import pg from "pg";
import { sendMail, verificationMail, resetPasswordMail } from "./mailer";
import { mcp } from "better-auth/plugins";

export { sendMail, inviteMail, mailDelivers, mailTransport } from "./mailer";
export { oAuthDiscoveryMetadata } from "better-auth/plugins";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://wren:wren@localhost:5432/wren",
});

const db = new Kysely({ dialect: new PostgresDialect({ pool }), plugins: [new CamelCasePlugin()] });

// Strip Windows \r and whitespace from env vars — .env files on Windows use CRLF
function cleanEnv(key: string): string | undefined {
  const v = process.env[key]?.replace(/\r/g, "").trim();
  return v || undefined;
}

const baseURL = cleanEnv("BETTER_AUTH_URL") || cleanEnv("WREN_URL");
export const requireVerification = cleanEnv("REQUIRE_EMAIL_VERIFICATION") === "true";

// Trusted origins callback — derives allowed origins from the request's Host
// header at runtime. This handles Cloudflare Tunnel (and any reverse proxy)
// without needing env vars: the browser sends Origin: https://host, and we
// trust both http:// and https:// variants of whatever Host the request came in on.
function trustedOriginsFromRequest(request: Request | undefined): string[] {
  if (!request) return ["http://localhost:4000"];
  const host = request.headers.get("host");
  if (!host) return [];
  return [`https://${host}`, `http://${host}`];
}

export const auth = betterAuth({
  database: kyselyAdapter(db, { type: "postgres" }),
  baseURL,
  trustedOrigins: trustedOriginsFromRequest,

  emailAndPassword: {
    enabled: true,
    // REQUIRE_EMAIL_VERIFICATION=true: email/password accounts must confirm before
    // signing in. Default (false): the confirmation is sent and recorded, nobody is blocked.
    requireEmailVerification: requireVerification,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(resetPasswordMail(user.email, user.name, url));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // When confirmation is required, a sign-in attempt by an unconfirmed user sends a
    // fresh link, so nobody is locked out for good if the first email was lost.
    sendOnSignIn: requireVerification,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(verificationMail(user.email, user.name, url));
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    } : {}),
    ...(process.env.APPLE_CLIENT_ID ? {
      apple: {
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
      },
    } : {}),
    ...(process.env.GITHUB_CLIENT_ID ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      },
    } : {}),
  },

  // "Sign in with WREN" for MCP clients (Claude, Cursor, …): OAuth 2.1 with dynamic
  // client registration and PKCE. Authorize/token/register live under /api/auth/mcp/*.
  // The server forces the consent page on every authorization (an auto-approved
  // dynamically registered client could otherwise obtain a user's token) and the
  // consent page is where the user picks the org the connection acts in.
  plugins: [
    mcp({
      loginPage: "/login",
      oidcConfig: {
        loginPage: "/login",
        consentPage: "/mcp/consent",
        requirePKCE: true,
        allowPlainCodeChallengeMethod: false,
        allowDynamicClientRegistration: true,
        accessTokenExpiresIn: 60 * 60,            // 1 hour
        refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30 days
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh if older than 1 day
  },

  user: {
    additionalFields: {
      orgId: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        defaultValue: "viewer",
      },
    },
  },
});

export type Auth = typeof auth;
