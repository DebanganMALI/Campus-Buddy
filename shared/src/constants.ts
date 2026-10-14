// Edit to match the college's departments before launch
export const DEPARTMENTS = [
  "CSE",
  "CSE-AIML",
  "CSE-IOTCSBT",
  "IT",
  "ECE",
  "EE",
  "ME",
  "CE",
  "BBA",
  "BCA",
  "MCA",
  "MBA",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const YEARS = [1, 2, 3, 4, 5] as const;
export type Year = (typeof YEARS)[number];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  passwordMin: 12,
  passwordMax: 128,
  titleMax: 140,
  bodyMax: 10_000,
  pageSizeDefault: 20,
  pageSizeMax: 50,
  fileMaxBytes: 10 * 1024 * 1024,
} as const;

export const HEADERS = {
  csrf: "x-csrf-token",
  requestId: "x-request-id",
} as const;
