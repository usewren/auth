import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect, CamelCasePlugin } from "kysely";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://wren:wren@localhost:5432/wren",
});

const db = new Kysely({ dialect: new PostgresDialect({ pool }), plugins: [new CamelCasePlugin()] });

export const auth = betterAuth({
  database: kyselyAdapter(db, { type: "postgres" }),

  emailAndPassword: {
    enabled: true,
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
