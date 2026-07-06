import type { NextFunction, Request, Response } from "express";
import { db } from "../db/client.js";
import { upsertMember } from "../services/members.js";
import { verifyMacToken } from "../verify.js";

export async function requireCommittee(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.replace("Bearer ", "");
  let claims;
  try {
    claims = await verifyMacToken(bearer); // checks iss/aud/exp against JWKS
  } catch {
    return res.status(401).json({ error: "unauthenticated" });
  }

  if (!claims.roles?.includes("committee")) {
    // Distinguish "not committee" from a transient roster blip so the UI can advise a re-login.
    return res.status(403).json({
      error: "not_committee",
      message:
        "Your session doesn't currently show committee access. If you are on the " +
        "committee, sign out and back in; if it persists, check the Notion roster.",
    });
  }

  req.claims = claims;
  await upsertMember(db, claims); // keep crm_member fresh (owner display + reassignment list)
  next();
}
