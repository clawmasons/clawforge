import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { db } from "./db/index.js";

export const ALLOW_PERSONAL_EMAIL = true;

export const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "zoho.com",
  "yandex.com",
]);

export function isPersonalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && PERSONAL_DOMAINS.has(domain);
}

export function buildOrgDetails(email: string, name: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) throw new Error("Invalid email");

  const personal = PERSONAL_DOMAINS.has(domain);
  return {
    name: personal ? `${name} Forge` : domain,
    slug: personal
      ? `${name.toLowerCase().replace(/\s+/g, "-")}-forge`
      : domain.replace(/\./g, "-"),
  };
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: [process.env.WEB_URL ?? "http://localhost:3000"],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },

  onAPIError: {
    errorURL: `${process.env.WEB_URL ?? "http://localhost:3000"}/auth/error`,
  },

  plugins: [organization()],

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email;
          if (!email) {
            throw new APIError("BAD_REQUEST", {
              message: "Email is required.",
            });
          }
          const domain = email.split("@")[1]?.toLowerCase();
          if (
            !domain ||
            (!ALLOW_PERSONAL_EMAIL && isPersonalEmail(email))
          ) {
            throw new APIError("FORBIDDEN", {
              message:
                "Only corporate email accounts are allowed. Consumer email providers (Gmail, Yahoo, etc.) are not supported.",
            });
          }
          return { data: user };
        },
        after: async (user) => {
          const domain = user.email.split("@")[1]?.toLowerCase();
          if (!domain) return;

          const org = buildOrgDetails(user.email, user.name);

          try {
            await auth.api.createOrganization({
              body: {
                name: org.name,
                slug: org.slug,
                userId: user.id,
              },
            });
          } catch {
            // Organization may already exist (another user with same domain)
          }
        },
      },
    },
  },
});
