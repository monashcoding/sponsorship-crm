import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { companies, contacts, stageHistory, touchpoints } from "../db/schema.js";
import type { Stage } from "../db/schema.js";
import { normalizeName } from "../lib/normalize.js";

// --- Fuzzy-dedupe (§5) -----------------------------------------------------
export interface DupeCandidate {
  id: string;
  name: string;
  stage: Stage;
}

export async function findDuplicates(db: DB, candidateNormalized: string): Promise<DupeCandidate[]> {
  const rows = await db
    .select({ id: companies.id, name: companies.name, stage: companies.stage })
    .from(companies)
    .where(
      sql`${companies.nameNormalized} = ${candidateNormalized}
          OR similarity(${companies.nameNormalized}, ${candidateNormalized}) > 0.4`,
    )
    .orderBy(sql`similarity(${companies.nameNormalized}, ${candidateNormalized}) DESC`)
    .limit(10);
  return rows;
}

export interface CreateCompanyInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
  logoUrl?: string | null;
  stage?: Stage;
  owner?: string | null;
  confirm?: boolean;
  createdBy: string;
}

/** Returns { duplicates } if a soft dedupe warning fires, else { company }. */
export async function createCompany(
  db: DB,
  input: CreateCompanyInput,
): Promise<{ duplicates: DupeCandidate[] } | { company: typeof companies.$inferSelect }> {
  const nameNormalized = normalizeName(input.name);

  if (!input.confirm) {
    const duplicates = await findDuplicates(db, nameNormalized);
    if (duplicates.length > 0) return { duplicates };
  }

  const stage: Stage = input.stage ?? "prospect";

  return db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({
        name: input.name,
        nameNormalized,
        website: input.website ?? null,
        industry: input.industry ?? null,
        notes: input.notes ?? null,
        logoUrl: input.logoUrl ?? null,
        stage,
        owner: input.owner ?? input.createdBy,
        createdBy: input.createdBy,
      })
      .returning();
    if (!company) throw new Error("insert failed");

    // Writes the first stage_history entry (fromStage null on the very first entry).
    await tx.insert(stageHistory).values({
      companyId: company.id,
      fromStage: null,
      toStage: stage,
      changedBy: input.createdBy,
    });

    return { company };
  });
}

// --- List with derived rollups (§4) ----------------------------------------
export interface CompanyListFilters {
  stage?: Stage;
  owner?: string;
  q?: string;
}

export async function listCompanies(db: DB, filters: CompanyListFilters) {
  const conds = [];
  if (filters.stage) conds.push(eq(companies.stage, filters.stage));
  if (filters.owner) conds.push(eq(companies.owner, filters.owner));
  if (filters.q) conds.push(sql`${companies.name} ILIKE ${`%${filters.q}%`}`);
  const where = conds.length ? and(...conds) : undefined;

  return db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      industry: companies.industry,
      logoUrl: companies.logoUrl,
      stage: companies.stage,
      owner: companies.owner,
      createdBy: companies.createdBy,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
      // has-reply: any touchpoint whose LATEST event is 'replied'
      hasReply: sql<boolean>`EXISTS (
        SELECT 1 FROM ${touchpoints} tp
        WHERE tp.company_id = ${companies.id}
          AND (
            SELECT te.status FROM touchpoint_events te
            WHERE te.touchpoint_id = tp.id
            ORDER BY te.at DESC, te.id DESC LIMIT 1
          ) = 'replied'
      )`.as("has_reply"),
      // overdue: any touchpoint with a past follow-up date (§4 default: regardless of status)
      overdue: sql<boolean>`EXISTS (
        SELECT 1 FROM ${touchpoints} tp
        WHERE tp.company_id = ${companies.id}
          AND tp.next_follow_up_at IS NOT NULL
          AND tp.next_follow_up_at <= now()
      )`.as("overdue"),
    })
    .from(companies)
    .where(where)
    .orderBy(desc(companies.updatedAt));
}

// --- Detail ----------------------------------------------------------------
export async function getCompanyDetail(db: DB, id: string) {
  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) return null;

  const companyContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, id))
    .orderBy(contacts.createdAt);

  const tps = await listCompanyTouchpoints(db, id);

  const history = await db
    .select()
    .from(stageHistory)
    .where(eq(stageHistory.companyId, id))
    .orderBy(desc(stageHistory.changedAt));

  return { company, contacts: companyContacts, touchpoints: tps, stageHistory: history };
}

// --- Touchpoints with current status (DISTINCT ON latest event) ------------
export async function listCompanyTouchpoints(db: DB, companyId: string) {
  return db
    .select({
      id: touchpoints.id,
      companyId: touchpoints.companyId,
      contactId: touchpoints.contactId,
      channel: touchpoints.channel,
      subject: touchpoints.subject,
      bodySnippet: touchpoints.bodySnippet,
      sentAt: touchpoints.sentAt,
      nextFollowUpAt: touchpoints.nextFollowUpAt,
      owner: touchpoints.owner,
      createdBy: touchpoints.createdBy,
      createdAt: touchpoints.createdAt,
      currentStatus: sql<string>`(
        SELECT te.status FROM touchpoint_events te
        WHERE te.touchpoint_id = ${touchpoints.id}
        ORDER BY te.at DESC, te.id DESC LIMIT 1
      )`.as("current_status"),
      statusAt: sql<string>`(
        SELECT te.at FROM touchpoint_events te
        WHERE te.touchpoint_id = ${touchpoints.id}
        ORDER BY te.at DESC, te.id DESC LIMIT 1
      )`.as("status_at"),
    })
    .from(touchpoints)
    .where(eq(touchpoints.companyId, companyId))
    .orderBy(desc(touchpoints.sentAt));
}

// --- Stage move (writes stage_history) -------------------------------------
export async function moveStage(
  db: DB,
  companyId: string,
  toStage: Stage,
  changedBy: string,
): Promise<typeof companies.$inferSelect | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ stage: companies.stage })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!current) return null;

    if (current.stage === toStage) {
      const [unchanged] = await tx.select().from(companies).where(eq(companies.id, companyId));
      return unchanged ?? null;
    }

    const [updated] = await tx
      .update(companies)
      .set({ stage: toStage, updatedAt: new Date() })
      .where(eq(companies.id, companyId))
      .returning();
    if (!updated) return null;

    await tx.insert(stageHistory).values({
      companyId,
      fromStage: current.stage,
      toStage,
      changedBy,
    });
    return updated;
  });
}
