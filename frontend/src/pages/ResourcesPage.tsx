import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DEPARTMENTS, YEARS, type Permission } from "@scc/shared";
import { deleteResource, listResources } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import type { ResourceDTO } from "../api/types";
import { useAuth } from "../auth/auth-context";
import { ResourceRow } from "../components/cards";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast-context";
import { EmptyState, ErrorState } from "../components/ui";
import { PageBand } from "../components/PageBand";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

/** Semesters that belong to a year: Year 3 → Sem 5 and 6. */
const semestersFor = (year: number) => [year * 2 - 1, year * 2];

export function ResourcesPage() {
  useDocumentTitle("Resources");
  const { state, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const me = state.status === "authenticated" ? state.user : null;

  // dept → year → sem → subject live in the URL (shareable, back-button friendly).
  // First visit: start from the student's own department and year.
  const [params, setParams] = useSearchParams();
  const firstVisit = !params.has("department") && !params.has("all");
  const department = params.get("department") ?? (firstVisit && me ? me.department : "");
  const year = params.get("year") ?? (firstVisit && me?.year ? String(me.year) : "");
  const semester = params.get("semester") ?? "";
  const subject = params.get("subject") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const debouncedQ = useDebounced(q.trim(), 300);

  const setLevel = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!next.get("department")) next.set("all", "1");
    else next.delete("all");
    setParams(next, { replace: true });
  };

  const filters = { department: department || undefined, year: year ? Number(year) : undefined, semester: semester ? Number(semester) : undefined, q: debouncedQ || undefined };
  const query = useQuery({
    queryKey: [...keys.resources, "list", filters],
    queryFn: ({ signal }) => listResources({ ...filters, limit: 50 }, signal),
    enabled: Boolean(department),
  });

  // Subjects come from the resources at this level (the contract has no separate subject list)
  const rows = query.data?.items ?? [];
  const subjects = [...new Set(rows.map((r) => r.subject))].sort();
  const items = subject ? rows.filter((r) => r.subject.toLowerCase() === subject.toLowerCase()) : rows;

  const [toDelete, setToDelete] = useState<ResourceDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const mayDelete = (r: ResourceDTO) =>
    can("resource:delete:any" as Permission) || (can("resource:delete:own" as Permission) && r.uploadedBy.id === me?.id);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteResource(toDelete.id);
      await qc.invalidateQueries({ queryKey: keys.resources });
      toast.show("Resource deleted");
    } catch (e) {
      toast.show(isApiError(e) ? e.message : "Couldn't delete.", "error");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  const canUpload = can("resource:create") || can("resource:submit");

  return (
    <div className="page">
      <PageBand kind="resources"
        title="Resources"
        lead="Notes, slides and question banks, organised by department, year, semester and subject."
        actions={
          canUpload && (
            <Link to="/resources/upload" className="btn btn-primary">
              <Icon name="upload" size={18} /> {can("resource:create") ? "Upload resource" : "Submit for review"}
            </Link>
          )
        }
      />
      <div className="container">

      <section className="explorer" aria-label="Browse resources">
        <nav className="crumbs" aria-label="Current folder">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLevel({ department: "", year: "", semester: "", subject: "" })}>
            All
          </button>
          {department && (<><Icon name="arrowRight" size={14} /><span>{department}</span></>)}
          {year && (<><Icon name="arrowRight" size={14} /><span>Year {year}</span></>)}
          {semester && (<><Icon name="arrowRight" size={14} /><span>Semester {semester}</span></>)}
          {subject && (<><Icon name="arrowRight" size={14} /><span>{subject}</span></>)}
        </nav>
        <div className="explorer-steps">
          <div className="field">
            <label className="label" htmlFor="f-dept"><span className="step-num">1</span>Department</label>
            <select id="f-dept" className="select" value={department} onChange={(e) => setLevel({ department: e.target.value, year: "", semester: "", subject: "" })}>
              <option value="">Choose…</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-year"><span className="step-num">2</span>Year</label>
            <select id="f-year" className="select" value={year} disabled={!department} onChange={(e) => setLevel({ year: e.target.value, semester: "", subject: "" })}>
              <option value="">All years</option>
              {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-sem"><span className="step-num">3</span>Semester</label>
            <select id="f-sem" className="select" value={semester} disabled={!year} onChange={(e) => setLevel({ semester: e.target.value, subject: "" })}>
              <option value="">Both semesters</option>
              {year && semestersFor(Number(year)).map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-sub"><span className="step-num">4</span>Subject</label>
            <select id="f-sub" className="select" value={subject} disabled={!department || subjects.length === 0} onChange={(e) => setLevel({ subject: e.target.value })}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="input-wrap">
          <Icon name="search" className="lead-icon" />
          <label htmlFor="res-q" className="sr-only">Search within these resources</label>
          <input id="res-q" className="input has-icon" type="search" placeholder="Search by title or subject" value={q} disabled={!department} onChange={(e) => setQ(e.target.value)} />
        </div>
      </section>

      <div className="section" style={{ marginTop: "var(--space-8)" }}>
        <p className="sr-only" aria-live="polite">{query.isSuccess ? `${items.length} resources found` : ""}</p>
        {!department ? (
          <EmptyState icon="book" title="Start with a department" body="Choose a department, then narrow down by year, semester and subject." />
        ) : query.isPending ? (
          <div className="list" role="status" aria-label="Loading resources">
            {[0, 1, 2].map((i) => <div key={i} className="list-row"><div className="skeleton" style={{ height: 52 }} /><div className="skeleton" style={{ height: 20 }} /></div>)}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon="file" title="No resources here yet" body={debouncedQ ? `Nothing matches “${debouncedQ}”.` : "Try another semester or subject."} />
        ) : (
          <>
            <p className="small muted" style={{ marginBottom: "var(--space-3)" }}>{items.length} {items.length === 1 ? "resource" : "resources"}</p>
            <div className="list">
              {items.map((r) => <ResourceRow key={r.id} r={r} onDelete={mayDelete(r) ? setToDelete : undefined} />)}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this resource?"
        confirmLabel="Delete resource"
        danger
        pending={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      >
        <p>“{toDelete?.title}” will no longer be available to students.</p>
      </ConfirmDialog>
      </div>
    </div>
  );
}
