import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LIMITS } from "@scc/shared";
import { createEvent, getEvent, updateEvent } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import type { AudienceDTO } from "../api/types";
import { useCanChange } from "../auth/use-can-change";
import { AudiencePicker } from "../components/AudiencePicker";
import { Field, FormError } from "../components/Field";
import { ForbiddenState } from "../components/states";
import { useToast } from "../components/toast-context";
import { ErrorState, PageHeader } from "../components/ui";
import { fromLocalInput, toLocalInput } from "../lib/format";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { useDocumentTitle } from "../lib/use-document-title";

export function EventFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? "Edit event" : "New event");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const existing = useQuery({
    queryKey: [...keys.events, "detail", id],
    queryFn: ({ signal }) => getEvent(id!, signal),
    enabled: editing,
  });
  const { canEdit } = useCanChange("event", existing.data?.author.id);

  const [f, setF] = useState({ title: "", description: "", venue: "", startsAt: "", endsAt: "", capacity: "" });
  const [audience, setAudience] = useState<AudienceDTO>({ departments: ["ALL"], years: ["ALL"] });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    setF({
      title: e.title, description: e.description, venue: e.venue,
      startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), capacity: e.capacity ? String(e.capacity) : "",
    });
    setAudience(e.audience);
  }, [existing.data]);

  async function submit() {
    if (pending) return;
    const e: FieldErrors = {};
    if (f.title.trim().length < 3) e.title = "Title needs at least 3 characters.";
    if (!f.description.trim()) e.description = "Describe the event.";
    if (f.venue.trim().length < 2) e.venue = "Add a venue.";
    if (!f.startsAt) e.startsAt = "Choose a start time.";
    if (!f.endsAt) e.endsAt = "Choose an end time.";
    else if (f.startsAt && Date.parse(f.endsAt) <= Date.parse(f.startsAt)) e.endsAt = "End time must be after the start time.";
    if (f.capacity && !(Number(f.capacity) > 0)) e.capacity = "Capacity must be a positive number.";
    if ((audience.departments as string[]).length === 0) e["audience.departments"] = "Choose at least one department.";
    if ((audience.years as unknown[]).length === 0) e["audience.years"] = "Choose at least one year.";
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Some fields need attention.");
      return;
    }
    setFormError(null);
    setPending(true);
    const payload = {
      title: f.title.trim(), description: f.description.trim(), venue: f.venue.trim(),
      startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt),
      capacity: f.capacity ? Number(f.capacity) : null, audience, status: "published" as const,
    };
    try {
      const saved = editing ? await updateEvent(id!, payload) : await createEvent(payload);
      await qc.invalidateQueries({ queryKey: keys.events });
      toast.show(editing ? "Event updated" : "Event published");
      navigate(`/events/${saved.id}`, { replace: true });
    } catch (err) {
      if (isApiError(err) && err.code === "VALIDATION_ERROR") setErrors(toFieldErrors(err.issues ?? []));
      setFormError(isApiError(err) ? err.message : "Couldn't save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (editing && existing.isPending) return <div className="container page"><div className="skeleton" style={{ height: 400, marginTop: 40 }} /></div>;
  if (editing && existing.isError) return <div className="container section"><ErrorState error={existing.error} /></div>;
  if (editing && existing.data && !canEdit) return <ForbiddenState />;

  return (
    <div className="page container">
      <PageHeader title={editing ? "Edit event" : "New event"} lead="Times are in your local time zone." />
      <form
        className="card form-grid"
        style={{ maxWidth: 820 }}
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
        <FormError message={formError} />
        <Field label="Title" error={errors.title}>
          {(a) => <input {...a} className="input" maxLength={LIMITS.titleMax} value={f.title} onChange={set("title")} />}
        </Field>
        <Field label="Description" error={errors.description}>
          {(a) => <textarea {...a} className="textarea" value={f.description} onChange={set("description")} />}
        </Field>
        <Field label="Venue" error={errors.venue}>
          {(a) => <input {...a} className="input" placeholder="e.g. Seminar Hall 2" value={f.venue} onChange={set("venue")} />}
        </Field>
        <div className="form-grid form-grid-2">
          <Field label="Starts" error={errors.startsAt}>
            {(a) => <input {...a} className="input" type="datetime-local" value={f.startsAt} onChange={set("startsAt")} />}
          </Field>
          <Field label="Ends" error={errors.endsAt}>
            {(a) => <input {...a} className="input" type="datetime-local" value={f.endsAt} onChange={set("endsAt")} />}
          </Field>
        </div>
        <Field label="Capacity" optional hint="Leave empty for no limit." error={errors.capacity}>
          {(a) => <input {...a} className="input" type="number" min={1} inputMode="numeric" value={f.capacity} onChange={set("capacity")} />}
        </Field>
        <AudiencePicker value={audience} onChange={setAudience} errors={{ departments: errors["audience.departments"], years: errors["audience.years"] }} />
        <div className="form-actions">
          <Link to={editing ? `/events/${id}` : "/events"} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Saving…" : editing ? "Save changes" : "Publish event"}
          </button>
        </div>
      </form>
    </div>
  );
}
