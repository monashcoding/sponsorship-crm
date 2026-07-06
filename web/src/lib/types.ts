export const STAGES = ["prospect", "contacted", "in-talks", "committed", "declined"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  "in-talks": "In Talks",
  committed: "Committed",
  declined: "Declined",
};

export const STATUSES = ["sent", "replied", "ghosted", "in-progress", "bounced"] as const;
export type TouchpointStatus = (typeof STATUSES)[number];

export interface Me {
  macUserId: string;
  email: string;
  name?: string;
  roles: string[];
  team?: string;
}

export interface Member {
  macUserId: string;
  email: string;
  name: string | null;
  lastSeenAt: string;
}

export interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  logoUrl: string | null;
  stage: Stage;
  owner: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  hasReply: boolean;
  overdue: boolean;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  role: string | null;
  linkedin: string | null;
  createdAt: string;
}

export interface Touchpoint {
  id: string;
  companyId: string;
  contactId: string | null;
  channel: string;
  subject: string | null;
  bodySnippet: string | null;
  sentAt: string;
  nextFollowUpAt: string | null;
  owner: string;
  createdBy: string;
  createdAt: string;
  currentStatus: TouchpointStatus | null;
  statusAt: string | null;
}

export interface StageHistoryEntry {
  id: string;
  companyId: string;
  fromStage: Stage | null;
  toStage: Stage;
  changedAt: string;
  changedBy: string;
}

export interface CompanyDetail {
  company: {
    id: string;
    name: string;
    nameNormalized: string;
    website: string | null;
    industry: string | null;
    notes: string | null;
    logoUrl: string | null;
    stage: Stage;
    createdBy: string;
    owner: string | null;
    createdAt: string;
    updatedAt: string;
  };
  contacts: Contact[];
  touchpoints: Touchpoint[];
  stageHistory: StageHistoryEntry[];
}

export interface DupeCandidate {
  id: string;
  name: string;
  stage: Stage;
}

export interface FollowUp {
  touchpointId: string;
  companyId: string;
  companyName: string;
  subject: string | null;
  channel: string;
  owner: string;
  nextFollowUpAt: string | null;
  currentStatus: TouchpointStatus | null;
}
