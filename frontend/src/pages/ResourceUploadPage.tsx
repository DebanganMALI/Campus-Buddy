import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { DEPARTMENTS, LIMITS, YEARS } from "@scc/shared";
import { completeUpload, getResource, requestUploadUrl } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import type { ResourceDTO, Year } from "../api/types";
import { useAuth } from "../auth/auth-context";
import { Field, FormError } from "../components/Field";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/ui";
import { fileSize } from "../lib/format";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { putFile } from "../lib/upload";
import { useDocumentTitle } from "../lib/use-document-title";

const ALLOWED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
};

type Phase = { kind: "idle" } | { kind: "uploading"; pct: number } | { kind: "scanning" } | { kind: "done"; status: ResourceDTO["status"]; id: string };

export function ResourceUploadPage() {
  useDocumentTitle("Upload resource");
  const { state, can } = useAuth();
  const qc = useQueryClient();
  const me = state.status === "authenticated" ? state.user : null;
  const direct = can("resource:create"); // faculty publish; students submit for review

  const [f, setF] = useState({
    title: "", description: "", department: me?.department ?? "", year: me?.year ? String(me.year) : "", semester: "", subject: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit() {
    if (phase.kind === "uploading" || phase.kind === "scanning") return;
    const e: FieldErrors = {};
    if (f.title.trim().length < 3) e.title = "Title needs at least 3 characters.";
    if (!f.department) e.department = "Choose a department.";
    if (!f.year) e.year = "Choose a year.";
    if (!f.semester) e.semester = "Choose a semester.";
    if (f.subject.trim().length < 2) e.subject = "Add the subject name.";
    // Checked here for instant feedback; the server checks again
    if (!file) e.file = "Choose a file.";
    else if (!ALLOWED[file.type]) e.file = "Only PDF, DOCX and PPTX files are allowed.";
    else if (file.size > LIMITS.fileMaxBytes) e.file = `Files must be ${fileSize(LIMITS.fileMaxBytes)} or smaller.`;
    setErrors(e);
    if (Object.keys(e).length || !file) {
      setFormError("Some fields need attention.");
      return;
    }
    setFormError(null);
    try {
      setPhase({ kind: "uploading", pct: 0 });
      const slot = await requestUploadUrl({
        title: f.title.trim(), description: f.description.trim() || undefined, department: f.department,
        year: Number(f.year) as Year, semester: Number(f.semester), subject: f.subject.trim(),
        fileName: file.name, mimeType: file.type, size: file.size,
      });
      await putFile(slot.uploadUrl, file, slot.headers, (pct) => setPhase({ kind: "uploading", pct }));
      setPhase({ kind: "scanning" });
      await completeUpload(slot.resourceId);
      // Poll until the scan finishes: every 2 s, give up after 60 s
      let status: ResourceDTO["status"] = "pending_scan";
      for (let i = 0; i < 30 && status === "pending_scan"; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        status = (await getResource(slot.resourceId)).status;
      }
      await qc.invalidateQueries({ queryKey: keys.resources });
      setPhase({ kind: "done", status, id: slot.resourceId });
    } catch (err) {
      setPhase({ kind: "idle" });
      if (isApiError(err) && err.code === "VALIDATION_ERROR") setErrors(toFieldErrors(err.issues ?? []));
      setFormError(isApiError(err) ? err.message : err instanceof Error ? err.message : "Upload failed.");
    }
  }

  if (phase.kind === "done") {
    const published = phase.status === "published";
    return (
      <div className="page container">
        <div className="state-center">
          <div className="state-card">
            <span className={`state-icon${phase.status === "rejected" || phase.status === "infected" ? " danger" : ""}`}>
              <Icon name={published ? "check" : "clock"} size={28} />
            </span>
            <h1 className="serif" id="page-title" tabIndex={-1}>
              {published ? "Resource published" : phase.status === "pending_review" ? "Sent for review" : phase.status === "pending_scan" ? "Still checking your file" : "Upload not accepted"}
            </h1>
            <p className="muted">
              {published
                ? "Students in that department and year can now find and download it."
                : phase.status === "pending_review"
                  ? "Faculty will review it before students can see it."
                  : phase.status === "pending_scan"
                    ? "The safety check is taking longer than usual. It will appear once it passes."
                    : "The file didn't pass the safety check."}
            </p>
            <div className="row">
              <Link to={`/resources?department=${encodeURIComponent(f.department)}&year=${f.year}&semester=${f.semester}`} className="btn btn-primary">
                Go to resources
              </Link>
              <button type="button" className="btn" onClick={() => { setPhase({ kind: "idle" }); setFile(null); setF((x) => ({ ...x, title: "", description: "" })); }}>
                Upload another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const busy = phase.kind === "uploading" || phase.kind === "scanning";
  const yearNum = Number(f.year);

  return (
    <div className="page container">
      <PageHeader
        title={direct ? "Upload a resource" : "Submit a resource"}
        lead={direct ? "PDF, DOCX or PPTX, up to 10 MB. It's checked for safety before students can download it." : "Your file goes to faculty for review before anyone else can see it."}
      />
      <form className="card form-grid" style={{ maxWidth: 820 }} noValidate onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
        <FormError message={formError} />
        <Field label="Title" error={errors.title}>
          {(a) => <input {...a} className="input" maxLength={LIMITS.titleMax} value={f.title} onChange={set("title")} />}
        </Field>
        <Field label="Short description" optional error={errors.description}>
          {(a) => <input {...a} className="input" maxLength={2000} value={f.description} onChange={set("description")} />}
        </Field>
        <div className="form-grid form-grid-2">
          <Field label="Department" error={errors.department}>
            {(a) => (
              <select {...a} className="select" value={f.department} onChange={set("department")}>
                <option value="">Choose…</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </Field>
          <Field label="Year" error={errors.year}>
            {(a) => (
              <select {...a} className="select" value={f.year} onChange={(e) => setF((x) => ({ ...x, year: e.target.value, semester: "" }))}>
                <option value="">Choose…</option>
                {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            )}
          </Field>
          <Field label="Semester" error={errors.semester}>
            {(a) => (
              <select {...a} className="select" value={f.semester} disabled={!f.year} onChange={set("semester")}>
                <option value="">Choose…</option>
                {yearNum > 0 && [yearNum * 2 - 1, yearNum * 2].map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            )}
          </Field>
          <Field label="Subject" error={errors.subject}>
            {(a) => <input {...a} className="input" placeholder="e.g. Operating Systems" value={f.subject} onChange={set("subject")} />}
          </Field>
        </div>
        <Field label="File" hint="PDF, DOCX or PPTX, up to 10 MB" error={errors.file}>
          {(a) => (
            <input
              {...a}
              className="input"
              style={{ paddingTop: 10 }}
              type="file"
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
        {file && <p className="small muted">{file.name} ({ALLOWED[file.type] ?? "unsupported type"}, {fileSize(file.size)})</p>}

        {busy && (
          <div className="form-note" role="status" aria-live="polite">
            {phase.kind === "uploading" ? (
              <>
                Uploading… {phase.pct}%
                <progress max={100} value={phase.pct} style={{ width: "100%", accentColor: "var(--color-teal)" }} />
              </>
            ) : (
              "Checking the file for safety…"
            )}
          </div>
        )}

        <div className="form-actions">
          <Link to="/resources" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>
            <Icon name="upload" size={18} />
            {busy ? "Working…" : direct ? "Upload" : "Submit for review"}
          </button>
        </div>
      </form>
    </div>
  );
}
