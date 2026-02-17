import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { space, spaceMember } from "./db/schema.js";
import { sendEmail } from "./lib/email.js";

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

export async function sendInvitationEmail(data: {
  invitation: { id: string; email: string; expiresAt: Date };
  organization: { name?: string };
  role?: string;
}) {
  const appUrl = process.env.WEB_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${data.invitation.id}`;
  const orgName = data.organization.name ?? "an organization";
  const role = data.role ?? "member";
  const expiresAt = new Date(data.invitation.expiresAt);
  const expiresStr = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  await sendEmail({
    to: data.invitation.email,
    subject: `You've been invited to join ${orgName}`,
    text: [
      `You've been invited to join ${orgName} as a ${role}.`,
      "",
      `Accept your invitation: ${inviteUrl}`,
      "",
      `This invitation expires on ${expiresStr}.`,
    ].join("\n"),
    html: [
      `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">`,
      `<h2>You've been invited to join ${orgName}</h2>`,
      `<p>You've been invited as a <strong>${role}</strong>.</p>`,
      `<p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #E85D4A; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Accept Invitation</a></p>`,
      `<p style="color: #888; font-size: 14px;">This invitation expires on ${expiresStr}.</p>`,
      `</div>`,
    ].join("\n"),
  });
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

  plugins: [
    organization({
      sendInvitationEmail,
      organizationHooks: {
        async afterRemoveMember(data) {
          const orgId = data.organization.id;
          const userId = data.member.userId;

          // Get all spaces in this org
          const orgSpaces = await db
            .select({ id: space.id })
            .from(space)
            .where(eq(space.organizationId, orgId));

          if (orgSpaces.length === 0) return;

          const spaceIds = orgSpaces.map((s) => s.id);

          // Delete all space memberships for this user in this org's spaces
          await db
            .delete(spaceMember)
            .where(
              and(
                eq(spaceMember.userId, userId),
                inArray(spaceMember.spaceId, spaceIds),
              ),
            );
        },
      },
    }),
  ],

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
