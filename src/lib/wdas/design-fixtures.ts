/**
 * Realistic WDAS sample data for design previews and demos.
 * PKR amounts, Finance approval chain, corporate departments.
 */
import type { ApprovalStep, Attachment, Document, DocStatus, SlaState } from "./types";

export const FIXTURE_USERS = {
  owner: { id: "u-owner", name: "Ayesha Khan", designation: "Senior Procurement Officer", department: "Procurement" as const },
  deptHead: { id: "u-dh", name: "Imran Malik", designation: "Department Head", department: "Procurement" as const },
  financeMgr: { id: "u-fm", name: "Sara Ahmed", designation: "Finance Manager", department: "Finance" as const },
  financeDir: { id: "u-fd", name: "Hassan Raza", designation: "Finance Director", department: "Finance" as const },
  cfo: { id: "u-cfo", name: "Fatima Noor", designation: "Chief Financial Officer", department: "Finance" as const },
};

export const FIXTURE_DOC_ID = "WDAS-2026-00482";

export const FIXTURE_STEPS: ApprovalStep[] = [
  {
    id: "s1",
    approverId: FIXTURE_USERS.deptHead.id,
    order: 1,
    status: "approved",
    actedAt: "2026-07-07T10:22:00+05:00",
    comment: "Budget line verified against FY26 procurement plan. Proceeding to Finance.",
  },
  {
    id: "s2",
    approverId: FIXTURE_USERS.financeMgr.id,
    order: 2,
    status: "pending",
  },
  {
    id: "s3",
    approverId: FIXTURE_USERS.financeDir.id,
    order: 3,
    status: "pending",
  },
  {
    id: "s4",
    approverId: FIXTURE_USERS.cfo.id,
    order: 4,
    status: "pending",
  },
];

export const FIXTURE_ATTACHMENTS: Attachment[] = [
  { id: "a1", name: "Vendor_Quotation_ACME_2026.pdf", type: "pdf", size: "1.2 MB", scanStatus: "Clean" },
  { id: "a2", name: "Budget_Allocation_Q3.xlsx", type: "excel", size: "340 KB", scanStatus: "Clean" },
  { id: "a3", name: "Equipment_Specs.docx", type: "word", size: "890 KB", scanStatus: "Pending" },
];

export const FIXTURE_DOCUMENT: Document = {
  id: "doc-482",
  refId: FIXTURE_DOC_ID,
  subject: "Capital Expenditure Request — ERP Server Infrastructure Upgrade",
  body: `<p>This memorandum requests approval for the procurement and installation of redundant ERP application servers to support Q4 2026 capacity requirements.</p>
<p><strong>Business justification:</strong> Current infrastructure operates at 87% utilization during month-end close. The proposed upgrade eliminates single-point-of-failure risk and supports audit requirements for financial system availability.</p>
<p><strong>Vendor:</strong> ACME Systems Ltd. · <strong>Delivery:</strong> 45 business days from PO issuance.</p>`,
  ownerId: FIXTURE_USERS.owner.id,
  ownerName: FIXTURE_USERS.owner.name,
  workflowId: "wf-finance-capex",
  workflowName: "Financial — Capital Expenditure",
  amount: 4_750_000,
  priority: "Urgent",
  status: "pending",
  sla: "at_risk" as SlaState,
  daysPending: 3,
  createdAt: "2026-07-06T09:15:00+05:00",
  updatedAt: "2026-07-07T10:22:00+05:00",
  currentStepId: "s2",
  steps: FIXTURE_STEPS,
  attachments: FIXTURE_ATTACHMENTS,
  toIds: [],
};

export const FIXTURE_DASHBOARD_ROWS = [
  {
    refId: "WDAS-2026-00482",
    subject: "Capital Expenditure Request — ERP Server Infrastructure Upgrade",
    workflow: "Financial — Capital Expenditure",
    amount: 4_750_000,
    currentStep: "Finance Manager",
    status: "pending" as DocStatus,
    sla: "at_risk" as SlaState,
    lastAction: "2026-07-07T10:22:00+05:00",
  },
  {
    refId: "WDAS-2026-00471",
    subject: "Travel Advance — Regional Sales Conference, Lahore",
    workflow: "Financial — Travel & Expense",
    amount: 185_000,
    currentStep: "Department Head",
    status: "pending" as DocStatus,
    sla: "on_time" as SlaState,
    lastAction: "2026-07-08T14:05:00+05:00",
  },
  {
    refId: "WDAS-2026-00455",
    subject: "NDA Amendment — Cloud Hosting Provider",
    workflow: "Non-Financial — Legal",
    amount: null,
    currentStep: "Legal Counsel",
    status: "pending" as DocStatus,
    sla: "overdue" as SlaState,
    lastAction: "2026-07-03T11:30:00+05:00",
  },
  {
    refId: "WDAS-2026-00438",
    subject: "Q2 Vendor Payment Run — Batch #VP-2026-18",
    workflow: "Financial — Payment Authorization",
    amount: 12_400_000,
    currentStep: "CFO",
    status: "pending" as DocStatus,
    sla: "on_time" as SlaState,
    lastAction: "2026-07-08T08:00:00+05:00",
  },
];

export const FIXTURE_COMMENTS = [
  {
    id: "c1",
    author: FIXTURE_USERS.deptHead.name,
    role: "Department Head · Procurement",
    timestamp: "2026-07-07T10:22:00+05:00",
    body: "Budget line verified against FY26 procurement plan. Proceeding to Finance.",
    action: "approved" as const,
  },
  {
    id: "c2",
    author: FIXTURE_USERS.owner.name,
    role: "Owner · Procurement",
    timestamp: "2026-07-06T09:15:00+05:00",
    body: "Submitted for approval. Vendor quotation and budget allocation attached.",
    action: "submitted" as const,
  },
];

export const FIXTURE_MATRIX_BANDS = [
  { tier: "Tier 1", range: "PKR 0 – 500,000", groups: ["Department Head"] },
  { tier: "Tier 2", range: "PKR 500,001 – 2,000,000", groups: ["Department Head", "Finance Manager"] },
  { tier: "Tier 3", range: "PKR 2,000,001 – 10,000,000", groups: ["Department Head", "Finance Manager", "Finance Director"] },
  { tier: "Tier 4", range: "PKR 10,000,001 and above", groups: ["Department Head", "Finance Manager", "Finance Director", "CFO"] },
];

export const FIXTURE_REPORTS = {
  cycleTimeByDept: [
    { dept: "Finance", days: 2.4 },
    { dept: "Procurement", days: 3.1 },
    { dept: "HR", days: 1.8 },
    { dept: "Legal", days: 4.2 },
    { dept: "Operations", days: 2.9 },
  ],
  volumeTrend: [
    { month: "Feb", submitted: 142, approved: 128 },
    { month: "Mar", submitted: 156, approved: 149 },
    { month: "Apr", submitted: 168, approved: 159 },
    { month: "May", submitted: 175, approved: 167 },
    { month: "Jun", submitted: 189, approved: 178 },
    { month: "Jul", submitted: 94, approved: 71 },
  ],
  rejectionRate: 4.2,
  bottleneck: "Finance Director review (avg. 1.8 days delay)",
};
