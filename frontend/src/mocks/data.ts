// Sample data only. Everything here is fictional: no real students, staff, companies or roll numbers.
// Dates are relative to "now" so the demo always has upcoming events and open deadlines.
import type { UserDTO } from "@scc/shared";
import type { AnnouncementDTO, AuthorRef, EventDTO, OpeningDTO, ResourceDTO } from "../api/types";

export const MOCK_PASSWORD = "demo-password-123";
export const MOCK_LOCKED_EMAIL = "locked@iem.edu.in";

export type MockUser = UserDTO & { phone?: string; bio?: string };

const created = "2026-08-18T04:30:00.000Z";

export const seedUsers: MockUser[] = [
  {
    id: "64b000000000000000000001", name: "Student A", email: "student.a@iem.edu.in", rollNo: "TEST01",
    role: "student", department: "CSE", year: 3, status: "active", emailVerified: true, mfaEnabled: false, createdAt: created,
    bio: "Third-year CSE. Interested in systems and open source.",
  },
  {
    id: "64b000000000000000000002", name: "Faculty B", email: "faculty.b@iem.edu.in",
    role: "faculty", department: "CSE", status: "active", emailVerified: true, mfaEnabled: false, createdAt: created,
  },
  {
    id: "64b000000000000000000003", name: "Admin C", email: "admin.c@iem.edu.in",
    role: "admin", department: "CSE", status: "active", emailVerified: true, mfaEnabled: false, createdAt: created,
  },
  {
    id: "64b000000000000000000004", name: "Student D", email: "student.d@iem.edu.in", rollNo: "TEST02",
    role: "student", department: "ECE", year: 2, status: "active", emailVerified: true, mfaEnabled: false, createdAt: created,
  },
  {
    id: "64b000000000000000000005", name: "Student E", email: "student.e@iem.edu.in", rollNo: "TEST03",
    role: "student", department: "IT", year: 4, status: "suspended", emailVerified: true, mfaEnabled: false, createdAt: created,
  },
];

const facultyB: AuthorRef = { id: "64b000000000000000000002", name: "Faculty B", role: "faculty" };
const adminC: AuthorRef = { id: "64b000000000000000000003", name: "Admin C", role: "admin" };
const placementCell: AuthorRef = { id: "64b000000000000000000009", name: "Training & Placement Cell", role: "placement_officer" };

const DAY = 86_400_000;
function at(days: number, hour = 10, minute = 0): string {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
const oid = (n: number, prefix: string) => `${prefix}${String(n).padStart(24 - prefix.length, "0")}`;

type Stored<T> = Omit<T, "bookmarked">;

export function seedAnnouncements(): Stored<AnnouncementDTO>[] {
  const rows: Array<[string, string, AnnouncementDTO["audience"], number, boolean, AuthorRef]> = [
    [
      "Semester V mid-term schedule published",
      "The mid-term examination schedule for Semester V is now available.\n\nPlease check the date and room for each paper. Carry your college ID card to every exam.\n\nReport any clash to your department office by Friday.",
      { departments: ["ALL"], years: [3] }, -1, true, adminC,
    ],
    [
      "Software Engineering lab: submission window extended",
      "The deadline for the SRS and UML lab submissions is extended by one week.\n\nUpload your files on the course page and get your lab copy signed in your next lab slot.",
      { departments: ["CSE"], years: [3] }, -2, false, facultyB,
    ],
    [
      "Library hours during exam weeks",
      "The central library stays open until 9 pm on weekdays during the exam weeks.\n\nReading rooms on the second floor are reserved for final-year students after 5 pm.",
      { departments: ["ALL"], years: ["ALL"] }, -3, false, adminC,
    ],
    [
      "Guest lecture notes: Distributed Systems",
      "Slides and reading list from last week's guest lecture are now in the resource library under CSE → Year 3 → Semester 5 → Operating Systems.",
      { departments: ["CSE", "IT"], years: [3, 4] }, -4, false, facultyB,
    ],
    [
      "ECE project review dates",
      "Second-year ECE mini-project reviews will run over two days. Your guide will share your team's slot.",
      { departments: ["ECE"], years: [2] }, -5, false, adminC,
    ],
    [
      "Campus Wi-Fi maintenance on Saturday",
      "Wi-Fi in academic blocks will be unavailable from 8 am to 12 noon on Saturday for planned maintenance.\n\nLabs will use wired connections during this window.",
      { departments: ["ALL"], years: ["ALL"] }, -6, false, adminC,
    ],
    [
      "Placement readiness workshop registrations",
      "Final-year students can register for the two-day placement readiness workshop. Topics include resume reviews, aptitude practice and mock interviews.",
      { departments: ["ALL"], years: [4] }, -7, false, adminC,
    ],
    [
      "Coding club: weekly problem-solving sessions",
      "The coding club meets every Wednesday in Lab 3. All years are welcome; bring your laptop.",
      { departments: ["CSE", "IT", "CSE-AIML"], years: ["ALL"] }, -9, false, facultyB,
    ],
  ];
  return rows.map(([title, body, audience, days, pinned, author], i) => ({
    id: oid(i + 1, "a1"), title, body, audience, status: "published", publishAt: at(days, 9), expiresAt: null,
    pinned, author, createdAt: at(days, 9), updatedAt: at(days, 9),
  }));
}

export function seedEvents(): Stored<EventDTO>[] {
  const rows: Array<[string, string, string, number, number, number | null, EventDTO["audience"]]> = [
    ["Inter-department coding sprint", "A three-hour team coding sprint. Teams of up to three. Problems range from beginner to advanced.\n\nRegistration closes one day before the event.", "Lab 3, CSE block", 3, 14, 90, { departments: ["ALL"], years: ["ALL"] }],
    ["Guest lecture: Building reliable web systems", "An industry speaker talks about designing web systems that stay up under load, with a Q&A at the end.", "Seminar Hall 2", 5, 11, 200, { departments: ["CSE", "IT", "CSE-AIML"], years: [3, 4] }],
    ["Annual sports meet: track events", "Heats for the 100 m, 400 m and relay events. Report to the sports office 30 minutes before your heat.", "College ground", 9, 8, null, { departments: ["ALL"], years: ["ALL"] }],
    ["Research poster session", "Final-year students present their project posters. Faculty and juniors are welcome to visit.", "Main foyer", 14, 15, null, { departments: ["ALL"], years: ["ALL"] }],
    ["Electronics hardware lab open day", "See the new embedded systems kits and try a guided demo.", "ECE hardware lab", 6, 12, 40, { departments: ["ECE", "EE"], years: ["ALL"] }],
    ["Orientation for lateral-entry students", "Welcome session covering academic rules, timetable and campus facilities.", "Auditorium", -12, 10, null, { departments: ["ALL"], years: [2] }],
    ["Alumni talk: First year in industry", "Recent graduates share what they wish they had known in college.", "Seminar Hall 1", -20, 16, 150, { departments: ["ALL"], years: [3, 4] }],
  ];
  return rows.map(([title, description, venue, days, hour, capacity, audience], i) => ({
    id: oid(i + 1, "e1"), title, description, venue, startsAt: at(days, hour), endsAt: at(days, hour + 2),
    capacity, rsvpCount: capacity ? Math.floor(capacity * 0.6) : 0, audience, status: "published",
    author: i % 2 ? adminC : facultyB, createdAt: at(Math.min(days, 0) - 5), updatedAt: at(Math.min(days, 0) - 5),
  }));
}

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function seedResources(): Stored<ResourceDTO>[] {
  const rows: Array<[string, ResourceDTO["department"], ResourceDTO["year"], number, string, ResourceDTO["file"]["mimeType"], number]> = [
    ["Unit 1 notes: software process models", "CSE", 3, 5, "Software Engineering", PDF, 1_240_000],
    ["SRS template (IEEE style)", "CSE", 3, 5, "Software Engineering", DOCX, 86_000],
    ["UML diagrams: worked examples", "CSE", 3, 5, "Software Engineering", PPTX, 3_400_000],
    ["Process scheduling: lecture slides", "CSE", 3, 5, "Operating Systems", PPTX, 2_100_000],
    ["Deadlocks: practice problems", "CSE", 3, 5, "Operating Systems", PDF, 420_000],
    ["Distributed systems reading list", "CSE", 3, 5, "Operating Systems", PDF, 180_000],
    ["Transport layer notes", "CSE", 3, 5, "Computer Networks", PDF, 960_000],
    ["Normalization exercises", "CSE", 3, 5, "Database Management Systems", PDF, 510_000],
    ["Data structures question bank", "CSE", 2, 3, "Data Structures", PDF, 730_000],
    ["Signals and systems formula sheet", "ECE", 2, 3, "Signals and Systems", PDF, 210_000],
    ["Analog circuits lab manual", "ECE", 2, 4, "Analog Circuits", DOCX, 1_050_000],
    ["Machine learning: unit 2 slides", "CSE-AIML", 3, 5, "Machine Learning", PPTX, 4_200_000],
  ];
  return rows.map(([title, department, year, semester, subject, mimeType, size], i) => {
    const ext = mimeType === PDF ? "pdf" : mimeType === DOCX ? "docx" : "pptx";
    return {
      id: oid(i + 1, "c1"), title, description: undefined, department, year, semester, subject,
      file: { name: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.${ext}`, mimeType, size },
      status: "published", version: 1, uploadedBy: facultyB,
      createdAt: at(-2 - i, 11), updatedAt: at(-2 - i, 11),
    };
  });
}

export function seedOpenings(): Stored<OpeningDTO>[] {
  const rows: Array<[string, string, OpeningDTO["type"], string, string, string, number, OpeningDTO["eligibility"]]> = [
    ["Software engineering intern", "Northwind Analytics", "internship", "Six-month internship on internal data tools. You will work with a small team on a web dashboard used by analysts.", "Kolkata (hybrid)", "₹25,000 / month", 2, { departments: ["CSE", "IT", "CSE-AIML"], years: [3, 4], minCgpa: 7 }],
    ["Graduate engineer trainee", "Contoso Infrastructure", "job", "Trainee role across design and site teams. Rotations in the first year.", "Pan-India", "As per company norms", 6, { departments: ["CE", "ME", "EE"], years: [4], minCgpa: 6.5 }],
    ["Embedded systems intern", "Fabrikam Devices", "internship", "Work on firmware for low-power sensor boards.", "Bengaluru", "₹20,000 / month", 10, { departments: ["ECE", "EE"], years: [3, 4], minCgpa: null }],
    ["Associate business analyst", "Tailspin Consulting", "job", "Entry-level analyst role supporting client projects.", "Kolkata", "₹5.5 LPA", 1, { departments: ["ALL"], years: [4], minCgpa: 6 }],
    ["Summer research internship", "Adventure Works Research Lab", "internship", "Eight-week research internship in applied machine learning.", "Remote", "Stipend provided", 18, { departments: ["CSE", "CSE-AIML"], years: [2, 3], minCgpa: 8 }],
  ];
  return rows.map(([title, company, type, description, location, compensation, days, eligibility], i) => ({
    id: oid(i + 1, "d1"), title, company, type, description, location, compensation, eligibility,
    closesAt: at(days, 23, 59),
    applyUrl: `https://careers.example.com/${company.toLowerCase().replace(/[^a-z]+/g, "-")}/${type}`,
    postedBy: placementCell, createdAt: at(-3 - i), updatedAt: at(-3 - i),
  }));
}
