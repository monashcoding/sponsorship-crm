import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const stageEnum = pgEnum("stage", [
  "prospect",
  "contacted",
  "in-talks",
  "committed",
  "declined",
]);
export const statusEnum = pgEnum("touchpoint_status", [
  "sent",
  "replied",
  "ghosted",
  "in-progress",
  "bounced",
]);
export const sourceEnum = pgEnum("status_source", ["manual", "gmail"]); // reply-detection seam

// --- People cache (populated from JWT claims on every request) -------------
// The CRM's own DB can't join the auth roster, so it caches identity for display + pick-lists.
export const crmMember = pgTable("crm_member", {
  macUserId: text("mac_user_id").primaryKey(), // canonical id from the token
  email: text("email").notNull(),
  name: text("name"), // from the `name` claim
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Companies -------------------------------------------------------------
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(), // for fuzzy-dedupe (see §5)
    website: text("website"),
    industry: text("industry"),
    notes: text("notes"),
    logoUrl: text("logo_url"),
    stage: stageEnum("stage").notNull().default("prospect"), // current stage (log in stage_history)
    createdBy: text("created_by").notNull(), // macUserId — immutable attribution
    owner: text("owner"), // macUserId — current driver; reassignable (§7)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ normIdx: index("companies_name_norm_idx").on(t.nameNormalized) }),
);

// --- Contacts (nested under a company) -------------------------------------
export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  linkedin: text("linkedin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Touchpoints: immutable record of an interaction -----------------------
export const touchpoints = pgTable(
  "touchpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    channel: text("channel").notNull(), // "email" | "linkedin" | "call" | "other"
    subject: text("subject"),
    bodySnippet: text("body_snippet"), // snippet only — minimal retention, never full emails
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(), // immutable fact
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }), // forward planning
    owner: text("owner").notNull(), // macUserId — reassignable (§7)
    createdBy: text("created_by").notNull(), // macUserId — immutable attribution
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("touchpoints_company_idx").on(t.companyId) }),
);

// --- Touchpoint status: append-only log (current status = latest event) ----
export const touchpointEvents = pgTable(
  "touchpoint_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    touchpointId: uuid("touchpoint_id")
      .notNull()
      .references(() => touchpoints.id, { onDelete: "cascade" }),
    status: statusEnum("status").notNull(),
    note: text("note"), // e.g. "was an out-of-office auto-reply; reverting"
    source: sourceEnum("source").notNull().default("manual"), // manual now, gmail later
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    by: text("by"), // macUserId (null for automated sources)
  },
  (t) => ({ tpIdx: index("tp_events_touchpoint_idx").on(t.touchpointId, t.at) }),
);

// --- Stage history: append-only log ----------------------------------------
export const stageHistory = pgTable("stage_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  fromStage: stageEnum("from_stage"), // null on the very first entry
  toStage: stageEnum("to_stage").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: text("changed_by").notNull(), // macUserId
});

// --- Reassignment log (handover institutional record) ----------------------
export const reassignments = pgTable("reassignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromMacUserId: text("from_mac_user_id").notNull(),
  toMacUserId: text("to_mac_user_id").notNull(),
  companiesMoved: integer("companies_moved").notNull(),
  touchpointsMoved: integer("touchpoints_moved").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  by: text("by").notNull(), // macUserId who performed the reassignment
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Touchpoint = typeof touchpoints.$inferSelect;
export type Stage = (typeof stageEnum.enumValues)[number];
export type TouchpointStatus = (typeof statusEnum.enumValues)[number];
