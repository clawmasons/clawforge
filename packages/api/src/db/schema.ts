import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
  ],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_organizationId_userId_uidx").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const space = pgTable(
  "space",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    spaceId: text("space_id").notNull().unique(),
    description: text("description"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("space_organizationId_idx").on(table.organizationId),
    uniqueIndex("space_name_organizationId_uidx").on(
      table.name,
      table.organizationId,
    ),
  ],
);

export const orgApiToken = pgTable(
  "org_api_token",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    index("org_api_token_organizationId_idx").on(table.organizationId),
    index("org_api_token_tokenHash_idx").on(table.tokenHash),
  ],
);

export const bot = pgTable(
  "bot",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentSpaceId: text("current_space_id").references(() => space.id, {
      onDelete: "set null",
    }),
    currentRole: text("current_role"),
    status: text("status").default("running").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bot_organizationId_idx").on(table.organizationId),
    index("bot_ownerId_idx").on(table.ownerId),
    uniqueIndex("bot_name_organizationId_uidx").on(
      table.name,
      table.organizationId,
    ),
  ],
);

export const spaceMember = pgTable(
  "space_member",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("space_member_spaceId_idx").on(table.spaceId),
    index("space_member_userId_idx").on(table.userId),
    uniqueIndex("space_member_spaceId_userId_uidx").on(
      table.spaceId,
      table.userId,
    ),
  ],
);

export const spaceTask = pgTable(
  "space_task",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    spaceId: text("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    botId: text("bot_id").references(() => bot.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    triggers: text("triggers").notNull(),
    schedule: text("schedule"),
    plan: text("plan").notNull(),
    state: text("state").default("idle").notNull(),
    triggeredAt: timestamp("triggered_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("space_task_spaceId_idx").on(table.spaceId),
    index("space_task_botId_idx").on(table.botId),
    uniqueIndex("space_task_name_spaceId_uidx").on(table.name, table.spaceId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
  bots: many(bot),
  spaceMemberships: many(spaceMember),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const spaceRelations = relations(space, ({ one, many }) => ({
  organization: one(organization, {
    fields: [space.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [space.createdBy],
    references: [user.id],
  }),
  members: many(spaceMember),
  bots: many(bot),
  tasks: many(spaceTask),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  spaces: many(space),
  apiTokens: many(orgApiToken),
  bots: many(bot),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const orgApiTokenRelations = relations(orgApiToken, ({ one }) => ({
  organization: one(organization, {
    fields: [orgApiToken.organizationId],
    references: [organization.id],
  }),
  creator: one(user, {
    fields: [orgApiToken.createdBy],
    references: [user.id],
  }),
}));

export const botRelations = relations(bot, ({ one }) => ({
  organization: one(organization, {
    fields: [bot.organizationId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [bot.ownerId],
    references: [user.id],
  }),
  currentSpace: one(space, {
    fields: [bot.currentSpaceId],
    references: [space.id],
  }),
}));

export const spaceMemberRelations = relations(spaceMember, ({ one }) => ({
  space: one(space, {
    fields: [spaceMember.spaceId],
    references: [space.id],
  }),
  user: one(user, {
    fields: [spaceMember.userId],
    references: [user.id],
  }),
}));

export const spaceTaskRelations = relations(spaceTask, ({ one }) => ({
  space: one(space, {
    fields: [spaceTask.spaceId],
    references: [space.id],
  }),
  bot: one(bot, {
    fields: [spaceTask.botId],
    references: [bot.id],
  }),
  creator: one(user, {
    fields: [spaceTask.createdBy],
    references: [user.id],
  }),
}));
