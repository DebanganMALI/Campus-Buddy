import { DEPARTMENTS, YEARS } from "@scc/shared";
import type { AudienceDTO, Year } from "../api/types";

/** Who can see a post. Uses the contract's ["ALL"] convention (AGENTS.md §5.7). */
export function AudiencePicker({
  value,
  onChange,
  errors,
}: {
  value: AudienceDTO;
  onChange: (v: AudienceDTO) => void;
  errors?: { departments?: string; years?: string };
}) {
  const allDepts = (value.departments as string[]).includes("ALL");
  const allYears = (value.years as Array<number | string>).includes("ALL");
  const depts = allDepts ? [] : (value.departments as string[]);
  const years = allYears ? [] : (value.years as Year[]);

  const toggleDept = (d: string) => {
    const next = depts.includes(d) ? depts.filter((x) => x !== d) : [...depts, d];
    onChange({ ...value, departments: next as AudienceDTO["departments"] });
  };
  const toggleYear = (y: Year) => {
    const next = years.includes(y) ? years.filter((x) => x !== y) : [...years, y].sort();
    onChange({ ...value, years: next });
  };

  const summary =
    (allDepts ? "All departments" : depts.length ? depts.join(", ") : "no department yet") +
    ", " +
    (allYears ? "all years" : years.length ? `Year ${years.join(", ")}` : "no year yet");

  return (
    <div className="stack">
      <fieldset className="stack-s">
        <legend className="label">Departments</legend>
        <div className="chip-row">
          <button type="button" className="pill" aria-pressed={allDepts} onClick={() => onChange({ ...value, departments: allDepts ? [] : ["ALL"] })}>
            All departments
          </button>
          {!allDepts &&
            DEPARTMENTS.map((d) => (
              <button key={d} type="button" className="pill" aria-pressed={depts.includes(d)} onClick={() => toggleDept(d)}>
                {d}
              </button>
            ))}
        </div>
        {errors?.departments && <p className="field-error">{errors.departments}</p>}
      </fieldset>
      <fieldset className="stack-s">
        <legend className="label">Years</legend>
        <div className="chip-row">
          <button type="button" className="pill" aria-pressed={allYears} onClick={() => onChange({ ...value, years: allYears ? [] : ["ALL"] })}>
            All years
          </button>
          {!allYears &&
            YEARS.map((y) => (
              <button key={y} type="button" className="pill" aria-pressed={years.includes(y)} onClick={() => toggleYear(y)}>
                Year {y}
              </button>
            ))}
        </div>
        {errors?.years && <p className="field-error">{errors.years}</p>}
      </fieldset>
      <p className="form-note small">
        <strong>Who can see this:</strong> {summary}
      </p>
    </div>
  );
}
