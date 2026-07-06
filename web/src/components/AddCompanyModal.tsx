import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { ApiError } from "../lib/apiFetch.js";
import type { DupeCandidate } from "../lib/types.js";
import { Modal } from "./Modal.js";

export function AddCompanyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [dupes, setDupes] = useState<DupeCandidate[] | null>(null);

  const create = useMutation({
    mutationFn: (confirm: boolean) =>
      api.createCompany({
        name,
        website: website || null,
        industry: industry || null,
        notes: notes || null,
        confirm,
      }),
    onSuccess: (company) => {
      void qc.invalidateQueries({ queryKey: ["pipeline"] });
      void qc.invalidateQueries({ queryKey: ["companies"] });
      onClose();
      navigate(`/companies/${company.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setDupes((err.body as { duplicates: DupeCandidate[] }).duplicates);
      }
    },
  });

  return (
    <Modal title="Add company" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setDupes(null);
          create.mutate(false);
        }}
      >
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label>
          Website
          <input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <label>
          Industry
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        {dupes && dupes.length > 0 && (
          <div className="dupe-warn">
            <strong>Possible duplicate:</strong>
            <ul>
              {dupes.map((d) => (
                <li key={d.id}>
                  {d.name} <span className="muted">({d.stage})</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-warn"
              onClick={() => create.mutate(true)}
              disabled={create.isPending}
            >
              Create anyway
            </button>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={create.isPending || !name}>
            {create.isPending ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
