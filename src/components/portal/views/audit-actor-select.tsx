"use client";

import { useState } from "react";
import type { AuditActorGroup } from "@/lib/owner";

// Pilihan "Oleh" di Audit Log: semua akun per role, dengan kotak cari nama atau email.
export function AuditActorSelect({ groups, value }: { groups: AuditActorGroup[]; value: string }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (p: { id: string; name: string; email: string }) => !needle || p.id === value || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle);
  const total = groups.reduce((n, g) => n + g.people.filter(match).length, 0);
  return (
    <div className="space-y-2">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email" aria-label="Cari akun" className="field mt-2 py-2 text-xs" />
      <select name="oleh" defaultValue={value} className="field" aria-label="Oleh">
        <option value="">{needle ? `Semua orang · ${total} cocok` : "Semua orang"}</option>
        {groups.map((g) => {
          const people = g.people.filter(match);
          return people.length ? (
            <optgroup key={g.role} label={`${g.label} (${people.length})`}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}
