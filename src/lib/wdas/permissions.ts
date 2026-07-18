/** Mirrors backend PermissionCatalog keys. */

export const P = {
  nav: {
    dashboard: "nav.dashboard",
    deptDashboard: "nav.dept_dashboard",
    inbox: "nav.inbox",
    documents: "nav.documents",
    documentsNew: "nav.documents_new",
    repository: "nav.repository",
    reports: "nav.reports",
    config: "nav.config",
    settings: "nav.settings",
  },
  config: {
    departments: "config.departments",
    departmentsMake: "config.departments.make",
    departmentsCheck: "config.departments.check",
    users: "config.users",
    usersMake: "config.users.make",
    usersCheck: "config.users.check",
    roles: "config.roles",
    rolesMake: "config.roles.make",
    rolesCheck: "config.roles.check",
    ad: "config.ad",
    adMake: "config.ad.make",
    adCheck: "config.ad.check",
    workflows: "config.workflows",
    workflowsMake: "config.workflows.make",
    workflowsCheck: "config.workflows.check",
    documentTypes: "config.document_types",
    documentTypesMake: "config.document_types.make",
    documentTypesCheck: "config.document_types.check",
    approvalModes: "config.approval_modes",
    approvalModesMake: "config.approval_modes.make",
    approvalModesCheck: "config.approval_modes.check",
    externalApprovers: "config.external_approvers",
    externalApproversMake: "config.external_approvers.make",
    externalApproversCheck: "config.external_approvers.check",
    delegation: "config.delegation",
    delegationMake: "config.delegation.make",
    delegationCheck: "config.delegation.check",
  },
  actions: {
    usersCreate: "users.create",
    usersEditRoles: "users.edit_roles",
    workflowsCreate: "workflows.create",
    workflowsPublish: "workflows.publish",
    departmentsManage: "departments.manage",
    documentTypesManage: "document_types.manage",
    documentsCreate: "documents.create",
    documentsApprove: "documents.approve",
    documentsFinalize: "documents.finalize",
    documentsCancel: "documents.cancel",
    reportsView: "reports.view",
    delegationManage: "delegation.manage",
  },
} as const;

export type PermissionKey = string;

/** Config modules shown as Maker / Checker columns in the Roles UI. */
export const CONFIG_MODULES: { label: string; base: string; make: string; check: string }[] = [
  { label: "Departments", base: P.config.departments, make: P.config.departmentsMake, check: P.config.departmentsCheck },
  { label: "Users", base: P.config.users, make: P.config.usersMake, check: P.config.usersCheck },
  { label: "Roles", base: P.config.roles, make: P.config.rolesMake, check: P.config.rolesCheck },
  { label: "Active Directory", base: P.config.ad, make: P.config.adMake, check: P.config.adCheck },
  { label: "Workflows", base: P.config.workflows, make: P.config.workflowsMake, check: P.config.workflowsCheck },
  { label: "Document types", base: P.config.documentTypes, make: P.config.documentTypesMake, check: P.config.documentTypesCheck },
  { label: "Approval modes", base: P.config.approvalModes, make: P.config.approvalModesMake, check: P.config.approvalModesCheck },
  { label: "External approvers", base: P.config.externalApprovers, make: P.config.externalApproversMake, check: P.config.externalApproversCheck },
  { label: "Delegation (admin)", base: P.config.delegation, make: P.config.delegationMake, check: P.config.delegationCheck },
];

export const PERMISSION_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Navigation",
    items: [
      { key: P.nav.dashboard, label: "Dashboard" },
      { key: P.nav.deptDashboard, label: "Department dashboard" },
      { key: P.nav.inbox, label: "Approval inbox" },
      { key: P.nav.documents, label: "My documents" },
      { key: P.nav.documentsNew, label: "New document" },
      { key: P.nav.repository, label: "Repository" },
      { key: P.nav.reports, label: "Reports" },
      { key: P.nav.config, label: "Configuration menu" },
      { key: P.nav.settings, label: "Settings" },
    ],
  },
  {
    group: "Actions",
    items: [
      { key: P.actions.documentsCreate, label: "Create documents" },
      { key: P.actions.documentsApprove, label: "Approve / reject / return" },
      { key: P.actions.documentsFinalize, label: "Finalize documents" },
      { key: P.actions.documentsCancel, label: "Cancel documents" },
      { key: P.actions.reportsView, label: "View reports" },
    ],
  },
];

export const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/config/departments", permission: P.config.departments },
  { prefix: "/config/users", permission: P.config.users },
  { prefix: "/config/roles", permission: P.config.roles },
  { prefix: "/config/active-directory", permission: P.config.ad },
  { prefix: "/config/directory", permission: P.config.ad },
  { prefix: "/config/workflows", permission: P.config.workflows },
  { prefix: "/config/document-types", permission: P.config.documentTypes },
  { prefix: "/config/approval-modes", permission: P.config.approvalModes },
  { prefix: "/config/external-approvers", permission: P.config.externalApprovers },
  { prefix: "/config", permission: P.nav.config },
  { prefix: "/dashboard/department", permission: P.nav.deptDashboard },
  { prefix: "/inbox", permission: P.nav.inbox },
  { prefix: "/documents/new", permission: P.nav.documentsNew },
  { prefix: "/documents", permission: P.nav.documents },
  { prefix: "/repository", permission: P.nav.repository },
  { prefix: "/reports", permission: P.actions.reportsView },
  { prefix: "/audit-log", permission: P.actions.reportsView },
  { prefix: "/activity-log", permission: P.actions.reportsView },
  { prefix: "/settings/delegation", permission: P.config.delegation },
  { prefix: "/settings", permission: P.nav.settings },
];

/** Expand child permissions into required parent nav keys (mirrors backend). */
export function expandImpliedPermissions(keys: string[]): string[] {
  const set = new Set(keys);

  if (set.has(P.actions.departmentsManage)) {
    set.add(P.config.departmentsMake);
    set.add(P.config.departmentsCheck);
  }
  if (set.has(P.actions.usersCreate)) set.add(P.config.usersMake);
  if (set.has(P.actions.usersEditRoles)) set.add(P.config.usersCheck);
  if (set.has(P.actions.workflowsCreate)) set.add(P.config.workflowsMake);
  if (set.has(P.actions.workflowsPublish)) set.add(P.config.workflowsCheck);
  if (set.has(P.actions.documentTypesManage)) {
    set.add(P.config.documentTypesMake);
    set.add(P.config.documentTypesCheck);
  }
  if (set.has(P.actions.delegationManage)) {
    set.add(P.config.delegationMake);
    set.add(P.config.delegationCheck);
  }

  for (const m of CONFIG_MODULES) {
    const hasMake = set.has(m.make);
    const hasCheck = set.has(m.check);
    const hasBase = set.has(m.base);
    if (hasMake || hasCheck) {
      set.add(m.base);
    } else if (hasBase) {
      set.add(m.make);
      set.add(m.check);
    }

    if (m.base === P.config.departments && (set.has(m.make) || set.has(m.check))) {
      set.add(P.actions.departmentsManage);
    }
    if (m.base === P.config.users) {
      if (set.has(m.make)) set.add(P.actions.usersCreate);
      if (set.has(m.check)) set.add(P.actions.usersEditRoles);
    }
    if (m.base === P.config.workflows) {
      if (set.has(m.make)) set.add(P.actions.workflowsCreate);
      if (set.has(m.check)) set.add(P.actions.workflowsPublish);
    }
    if (m.base === P.config.documentTypes && (set.has(m.make) || set.has(m.check))) {
      set.add(P.actions.documentTypesManage);
    }
    if (m.base === P.config.delegation && (set.has(m.make) || set.has(m.check))) {
      set.add(P.actions.delegationManage);
    }
  }

  const hasConfig = [...set].some((k) => k.startsWith("config."));
  if (hasConfig) {
    set.add(P.nav.config);
    set.add(P.nav.dashboard);
    set.add(P.nav.settings);
  }
  if (set.has(P.actions.reportsView) || set.has(P.nav.reports)) {
    set.add(P.nav.reports);
    set.add(P.nav.dashboard);
  }
  if (set.has(P.actions.documentsCreate) || set.has(P.actions.documentsFinalize) || set.has(P.actions.documentsCancel)) {
    set.add(P.nav.documents);
    set.add(P.nav.documentsNew);
    set.add(P.nav.dashboard);
  }
  if (set.has(P.actions.documentsApprove)) {
    set.add(P.nav.inbox);
    set.add(P.nav.dashboard);
  }
  if (set.has(P.actions.delegationManage) || set.has(P.config.delegationMake) || set.has(P.config.delegationCheck)) {
    set.add(P.nav.settings);
    set.add(P.nav.dashboard);
  }
  if (
    set.has(P.nav.deptDashboard) ||
    set.has(P.nav.inbox) ||
    set.has(P.nav.documents) ||
    set.has(P.nav.documentsNew) ||
    set.has(P.nav.repository) ||
    set.has(P.nav.config) ||
    set.has(P.nav.settings)
  ) {
    set.add(P.nav.dashboard);
  }
  return [...set];
}
