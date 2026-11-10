// Audience / eligibility flattening.
//
// A compound index can't cover two array fields at once, so we flatten
// { departments, years } into one array of "DEPT:YEAR" keys (with "ALL"
// wildcards). Content stores these as `audienceKeys`; a viewer matches content
// when any of their `viewerKeys` is in that array.

export interface AudienceLike {
  departments: (string | "ALL")[];
  years: (number | "ALL")[];
}

/** Flatten an audience into index-friendly keys, e.g. ["CSE:3", "CSE:ALL", ...]. */
export function audienceToKeys(a: AudienceLike): string[] {
  const depts = a.departments.includes("ALL") ? ["ALL"] : a.departments;
  const years = a.years.includes("ALL") ? ["ALL"] : a.years.map(String);
  const keys: string[] = [];
  for (const d of depts) for (const y of years) keys.push(`${String(d)}:${String(y)}`);
  return keys;
}

/** The keys a viewer matches: their exact dept/year plus every wildcard. */
export function viewerKeys(department: string, year?: number): string[] {
  const y = year ? String(year) : "ALL";
  return Array.from(new Set([`${department}:${y}`, `${department}:ALL`, `ALL:${y}`, "ALL:ALL"]));
}
