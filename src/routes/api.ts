import { Router } from "express";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  companies,
  contacts,
  stageEnum,
  statusEnum,
  touchpoints,
} from "../db/schema.js";
import { asyncHandler, claimsOf, HttpError, param } from "../http.js";
import { normalizeName } from "../lib/normalize.js";
import {
  createCompany,
  getCompanyDetail,
  listCompanies,
  listCompanyTouchpoints,
  moveStage,
} from "../services/companies.js";
import { listMembers } from "../services/members.js";
import { reassign } from "../services/reassign.js";
import { recordTouchpointStatus } from "../services/touchpointStatus.js";

const stageSchema = z.enum(stageEnum.enumValues);
const statusSchema = z.enum(statusEnum.enumValues);

export const api = Router();

// --- Identity --------------------------------------------------------------
api.get("/me", (req, res) => {
  const c = claimsOf(req);
  res.json({ macUserId: c.macUserId, email: c.email, name: c.name, roles: c.roles, team: c.team });
});

api.get(
  "/members",
  asyncHandler(async (_req, res) => {
    res.json(await listMembers(db));
  }),
);

// --- Companies -------------------------------------------------------------
api.get(
  "/companies",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        stage: stageSchema.optional(),
        owner: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(req.query);
    res.json(await listCompanies(db, q));
  }),
);

const createCompanySchema = z.object({
  name: z.string().min(1),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  stage: stageSchema.optional(),
  owner: z.string().optional().nullable(),
  confirm: z.boolean().optional(),
});

api.post(
  "/companies",
  asyncHandler(async (req, res) => {
    const body = createCompanySchema.parse(req.body);
    const result = await createCompany(db, { ...body, createdBy: claimsOf(req).macUserId });
    if ("duplicates" in result) {
      // Soft warning — the client resubmits with confirm:true to override.
      return res.status(409).json({ error: "possible_duplicate", duplicates: result.duplicates });
    }
    res.status(201).json(result.company);
  }),
);

api.get(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    const detail = await getCompanyDetail(db, param(req, "id"));
    if (!detail) throw new HttpError(404, "company not found");
    res.json(detail);
  }),
);

const patchCompanySchema = z.object({
  name: z.string().min(1).optional(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  stage: stageSchema.optional(),
});

api.patch(
  "/companies/:id",
  asyncHandler(async (req, res) => {
    const body = patchCompanySchema.parse(req.body);
    const by = claimsOf(req).macUserId;

    // A stage change goes through moveStage so stage_history is always written.
    if (body.stage) {
      const moved = await moveStage(db, param(req, "id"), body.stage, by);
      if (!moved) throw new HttpError(404, "company not found");
    }

    const fields: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      fields.name = body.name;
      fields.nameNormalized = normalizeName(body.name);
    }
    if (body.website !== undefined) fields.website = body.website;
    if (body.industry !== undefined) fields.industry = body.industry;
    if (body.notes !== undefined) fields.notes = body.notes;
    if (body.logoUrl !== undefined) fields.logoUrl = body.logoUrl;

    const [updated] = await db
      .update(companies)
      .set(fields)
      .where(eq(companies.id, param(req, "id")))
      .returning();
    if (!updated) throw new HttpError(404, "company not found");
    res.json(updated);
  }),
);

// Explicit stage move endpoint (used by the Kanban drag).
api.post(
  "/companies/:id/stage",
  asyncHandler(async (req, res) => {
    const { stage } = z.object({ stage: stageSchema }).parse(req.body);
    const moved = await moveStage(db, param(req, "id"), stage, claimsOf(req).macUserId);
    if (!moved) throw new HttpError(404, "company not found");
    res.json(moved);
  }),
);

// --- Contacts --------------------------------------------------------------
api.get(
  "/companies/:id/contacts",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, param(req, "id")))
      .orderBy(contacts.createdAt);
    res.json(rows);
  }),
);

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
});

api.post(
  "/companies/:id/contacts",
  asyncHandler(async (req, res) => {
    const body = contactSchema.parse(req.body);
    const [created] = await db
      .insert(contacts)
      .values({ ...body, companyId: param(req, "id") })
      .returning();
    res.status(201).json(created);
  }),
);

api.patch(
  "/contacts/:id",
  asyncHandler(async (req, res) => {
    const body = contactSchema.partial().parse(req.body);
    const [updated] = await db
      .update(contacts)
      .set(body)
      .where(eq(contacts.id, param(req, "id")))
      .returning();
    if (!updated) throw new HttpError(404, "contact not found");
    res.json(updated);
  }),
);

api.delete(
  "/contacts/:id",
  asyncHandler(async (req, res) => {
    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, param(req, "id")))
      .returning({ id: contacts.id });
    if (!deleted) throw new HttpError(404, "contact not found");
    res.status(204).end();
  }),
);

// --- Touchpoints -----------------------------------------------------------
api.get(
  "/companies/:id/touchpoints",
  asyncHandler(async (req, res) => {
    res.json(await listCompanyTouchpoints(db, param(req, "id")));
  }),
);

const touchpointSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  channel: z.enum(["email", "linkedin", "call", "other"]),
  subject: z.string().optional().nullable(),
  bodySnippet: z.string().optional().nullable(),
  sentAt: z.string().datetime(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

api.post(
  "/companies/:id/touchpoints",
  asyncHandler(async (req, res) => {
    const body = touchpointSchema.parse(req.body);
    const macUserId = claimsOf(req).macUserId;

    const created = await db.transaction(async (tx) => {
      const [tp] = await tx
        .insert(touchpoints)
        .values({
          companyId: param(req, "id"),
          contactId: body.contactId ?? null,
          channel: body.channel,
          subject: body.subject ?? null,
          bodySnippet: body.bodySnippet ?? null,
          sentAt: new Date(body.sentAt),
          nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
          owner: macUserId,
          createdBy: macUserId,
        })
        .returning();
      if (!tp) throw new Error("touchpoint insert failed");
      // Initial "sent" event through the single status writer.
      await recordTouchpointStatus(tx, {
        touchpointId: tp.id,
        status: "sent",
        source: "manual",
        by: macUserId,
      });
      return tp;
    });
    res.status(201).json(created);
  }),
);

// Manual reply-seam path (§6): append a status event.
api.post(
  "/touchpoints/:id/status",
  asyncHandler(async (req, res) => {
    const { status, note } = z
      .object({ status: statusSchema, note: z.string().optional() })
      .parse(req.body);
    await recordTouchpointStatus(db, {
      touchpointId: param(req, "id"),
      status,
      source: "manual",
      note,
      by: claimsOf(req).macUserId,
    });
    res.status(201).json({ ok: true });
  }),
);

api.patch(
  "/touchpoints/:id/follow-up",
  asyncHandler(async (req, res) => {
    const { nextFollowUpAt } = z
      .object({ nextFollowUpAt: z.string().datetime().nullable() })
      .parse(req.body);
    const [updated] = await db
      .update(touchpoints)
      .set({ nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null })
      .where(eq(touchpoints.id, param(req, "id")))
      .returning();
    if (!updated) throw new HttpError(404, "touchpoint not found");
    res.json(updated);
  }),
);

// --- Pipeline board --------------------------------------------------------
api.get(
  "/pipeline",
  asyncHandler(async (_req, res) => {
    const rows = await listCompanies(db, {});
    const board: Record<string, typeof rows> = {};
    for (const stage of stageEnum.enumValues) board[stage] = [];
    for (const row of rows) board[row.stage]?.push(row);
    res.json(board);
  }),
);

// --- Follow-ups ------------------------------------------------------------
api.get(
  "/follow-ups",
  asyncHandler(async (req, res) => {
    const overdueOnly = req.query.overdue === "1";
    const conds = [isNotNull(touchpoints.nextFollowUpAt)];
    if (overdueOnly) conds.push(lte(touchpoints.nextFollowUpAt, new Date()));

    const rows = await db
      .select({
        touchpointId: touchpoints.id,
        companyId: touchpoints.companyId,
        companyName: companies.name,
        subject: touchpoints.subject,
        channel: touchpoints.channel,
        owner: touchpoints.owner,
        nextFollowUpAt: touchpoints.nextFollowUpAt,
        currentStatus: sql<string>`(
          SELECT te.status FROM touchpoint_events te
          WHERE te.touchpoint_id = ${touchpoints.id}
          ORDER BY te.at DESC, te.id DESC LIMIT 1
        )`.as("current_status"),
      })
      .from(touchpoints)
      .innerJoin(companies, eq(companies.id, touchpoints.companyId))
      .where(and(...conds))
      .orderBy(touchpoints.nextFollowUpAt); // oldest-first
    res.json(rows);
  }),
);

// --- Reassignment (§7) -----------------------------------------------------
api.post(
  "/reassign",
  asyncHandler(async (req, res) => {
    const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.body);
    if (from === to) throw new HttpError(400, "from and to must differ");
    const result = await reassign(db, { from, to, by: claimsOf(req).macUserId });
    res.json(result);
  }),
);

// --- CSV export ------------------------------------------------------------
api.get(
  "/export/companies.csv",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        name: companies.name,
        stage: companies.stage,
        ownerName: sql<string | null>`(
          SELECT coalesce(m.name, m.email) FROM crm_member m
          WHERE m.mac_user_id = ${companies.owner}
        )`.as("owner_name"),
        hasReply: sql<boolean>`EXISTS (
          SELECT 1 FROM ${touchpoints} tp
          WHERE tp.company_id = ${companies.id}
            AND (
              SELECT te.status FROM touchpoint_events te
              WHERE te.touchpoint_id = tp.id
              ORDER BY te.at DESC, te.id DESC LIMIT 1
            ) = 'replied'
        )`.as("has_reply"),
        lastTouch: sql<string | null>`(
          SELECT max(tp.sent_at) FROM ${touchpoints} tp WHERE tp.company_id = ${companies.id}
        )`.as("last_touch"),
      })
      .from(companies)
      .orderBy(desc(companies.updatedAt));

    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["company", "stage", "has_reply", "owner", "last_touch"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.name, r.stage, r.hasReply ? "yes" : "no", r.ownerName ?? "", r.lastTouch ?? ""]
          .map(esc)
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="companies.csv"');
    res.send(lines.join("\n"));
  }),
);
