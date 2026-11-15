import { UserRole } from '../types/solar';
import {
  AclPermissionDefinition,
  AclRoleMetadata,
  SystemAclConfig,
  AclDomain
} from '../types/acl';

export interface AclDomainMetadata {
  id: AclDomain;
  label: string;
  description: string;
  icon: string;
  badgeColor: string;
}

export const ACL_DOMAINS: AclDomainMetadata[] = [
  {
    id: 'dashboard',
    label: 'Dashboard, Control Center & Portal',
    description: 'Executive overview dashboards, central customer control hub, and client self-service portal',
    icon: 'LayoutDashboard',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  {
    id: 'crm',
    label: 'CRM & Sales Pipeline',
    description: 'Leads, prospective client follow-ups, quotation builder, and commercial negotiations',
    icon: 'Briefcase',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  {
    id: 'projects',
    label: 'Projects & Engineering',
    description: 'EPC project lifecycle, milestone workflow stages, checklists, and specialist assignments',
    icon: 'Layers',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  {
    id: 'survey',
    label: 'Site Survey & Feasibility',
    description: 'Roof dimensions, shadow obstruction analysis, GPS logging, and transformer specs',
    icon: 'Compass',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  {
    id: 'tracking',
    label: 'Live Field Workforce Tracking',
    description: 'Real-time GPS field workforce map, presence status, and telemetry monitoring',
    icon: 'Navigation',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200'
  },
  {
    id: 'inventory',
    label: 'Material, BOM & Inventory',
    description: 'Solar panels, inverters, cables, mounting structures, and project BOM customization',
    icon: 'Package',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200'
  },
  {
    id: 'finance',
    label: 'Finance, Invoicing & Tally',
    description: 'GST tax invoices, milestone draws, customer receipts, and Tally Prime XML synchronization',
    icon: 'DollarSign',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200'
  },
  {
    id: 'hrms',
    label: 'HRMS, Attendance & Payroll',
    description: 'Staff directory, field GPS attendance punch, leave requests, and monthly payroll disbursement',
    icon: 'Users',
    badgeColor: 'bg-pink-50 text-pink-800 border-pink-200'
  },
  {
    id: 'service',
    label: 'Service, AMC & Maintenance',
    description: 'Warranty tickets, breakdown technician dispatch, spare replacement, and AMC visits',
    icon: 'Wrench',
    badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200'
  },
  {
    id: 'reports',
    label: 'Analytics & Executive Reports',
    description: 'Operational analytics, cashflow reports, sales pipeline charts, and CSV/PDF data exports',
    icon: 'BarChart3',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  {
    id: 'settings',
    label: 'System Admin & Security',
    description: 'Company credentials, Tally/WhatsApp gateways, audit logs, and ACL access rules',
    icon: 'ShieldCheck',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
  },
  {
    id: 'users',
    label: 'User Management & Administration',
    description: 'System login accounts, employee credentials, password resets, and role allocations',
    icon: 'UserCog',
    badgeColor: 'bg-violet-50 text-violet-800 border-violet-200'
  }
];

export const ACL_ROLES_METADATA: AclRoleMetadata[] = [
  {
    role: 'Admin',
    department: 'Administration',
    hierarchyLevel: 1,
    hierarchyLabel: 'System Administrator (Root Authority)',
    description: 'Full system control, administrative oversight, user management, and security policy control',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    isSystemLocked: true
  },
  {
    role: 'Project Manager',
    department: 'Operations',
    hierarchyLevel: 2,
    hierarchyLabel: 'Operations Head',
    description: 'Full oversight of all EPC projects, stage sign-offs, milestone approvals, and team assignments',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300'
  },
  {
    role: 'Site Survey Engineer',
    department: 'Engineering',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Site feasibility assessments, shadow analysis, roof measurements, and pre-engineering survey',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  {
    role: 'Site Inspector',
    department: 'Engineering',
    hierarchyLevel: 3,
    hierarchyLabel: 'Quality & Field Auditor',
    description: 'Site quality inspections, installation audits, safety compliance, and stage validations',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300'
  },
  {
    role: 'Sales Manager',
    department: 'Sales',
    hierarchyLevel: 2,
    hierarchyLabel: 'Department Head',
    description: 'Leads CRM, quotation approvals, commercial discounts, and sales team target monitoring',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  {
    role: 'Sales Executive',
    department: 'Sales',
    hierarchyLevel: 3,
    hierarchyLabel: 'Commercial Officer',
    description: 'Inquiry logging, customer site coordination, proposal delivery, and pipeline tracking',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300'
  },
  {
    role: 'Civil Team',
    department: 'Civil',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Foundation pedestals, roof puncture waterproofing, anchor bolting, and concrete curing sign-off',
    badgeColor: 'bg-stone-100 text-stone-900 border-stone-300'
  },
  {
    role: 'Structure Team',
    department: 'Structure',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Mounting structure assembly, module tilt angle verification, and purlin torque checklists',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300'
  },
  {
    role: 'Installation Team',
    department: 'Installation',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Solar PV module clamping, string cabling, conduit routing, and safety compliance checks',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300'
  },
  {
    role: 'Electrical Team',
    department: 'Electrical',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Inverter synchronization, ACDB/DCDB, grid interconnection, earthing pits, and Discom net-metering',
    badgeColor: 'bg-violet-100 text-violet-900 border-violet-300'
  },
  {
    role: 'Technician',
    department: 'Service',
    hierarchyLevel: 3,
    hierarchyLabel: 'Field Specialist',
    description: 'Field breakdown diagnostics, inverter error code troubleshooting, and preventive maintenance',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300'
  },
  {
    role: 'Service Manager',
    department: 'Service',
    hierarchyLevel: 2,
    hierarchyLabel: 'Department Head',
    description: 'Service SLA monitoring, ticket assignments, AMC contract management, and spares allocation',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300'
  },
  {
    role: 'Accountant',
    department: 'Finance',
    hierarchyLevel: 2,
    hierarchyLabel: 'Finance Specialist',
    description: 'GST tax invoice generation, customer receipts, vendor payments, and Tally Prime sync',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300'
  },
  {
    role: 'HR Manager',
    department: 'HR',
    hierarchyLevel: 2,
    hierarchyLabel: 'Department Head',
    description: 'Staff directory, mobile GPS attendance verification, leave approvals, and payroll processing',
    badgeColor: 'bg-pink-100 text-pink-900 border-pink-300'
  },
  {
    role: 'Customer',
    department: 'Customer',
    hierarchyLevel: 4,
    hierarchyLabel: 'External Portal Client',
    description: 'View personal solar plant status, live generation, payment milestones, and raise support tickets',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  }
];

export const ACL_PERMISSIONS_CATALOG: AclPermissionDefinition[] = [
  // Dashboard, Control Center & Portal
  {
    id: 'dashboard.view',
    domain: 'dashboard',
    domainLabel: 'Dashboard, Control Center & Portal',
    name: 'View Operational Dashboard',
    description: 'Access the role-specific ERP overview dashboard, KPIs, and summary widgets',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'control_center.view',
    domain: 'dashboard',
    domainLabel: 'Dashboard, Control Center & Portal',
    name: 'Access Customer Control Center',
    description: 'Open the central 360-degree Customer Control Center tracking timeline, team, docs, and finances',
    actions: ['view'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'customer_portal.view',
    domain: 'dashboard',
    domainLabel: 'Dashboard, Control Center & Portal',
    name: 'Access Client Customer Portal',
    description: 'View the external customer self-service solar installation portal and project summary',
    actions: ['view'],
    riskLevel: 'LOW'
  },

  // CRM & Sales
  {
    id: 'crm.leads.view',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'View Inquiries & Leads',
    description: 'Browse prospective client inquiries, phone contacts, solar capacity requirements, and stage',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'crm.leads.manage',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Create & Edit Leads',
    description: 'Create new leads, edit client info, update lead pipeline status, and log call notes',
    actions: ['create', 'edit'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'crm.leads.delete',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Delete Inquiries & Leads',
    description: 'Permanently delete solar leads and inquiry records from the CRM pipeline',
    actions: ['delete'],
    riskLevel: 'HIGH'
  },
  {
    id: 'crm.customers.view',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'View Customer Directory',
    description: 'Browse onboarded EPC customers, site locations, sanctioned load, and project links',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'crm.customers.manage',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Manage Customers & Portal Access',
    description: 'Create new customer accounts, edit customer records, and update client portal passwords',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },
  {
    id: 'crm.quotations.view',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'View Quotations & Proposals',
    description: 'Inspect commercial solar proposals, BOM line items, subsidies, and PDF previews',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'crm.quotations.create',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Generate Quotations',
    description: 'Configure solar capacity, BOM pricing, generate downloadable proposals with payback estimates',
    actions: ['create', 'edit'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'crm.quotations.approve',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Approve Commercial Discounts',
    description: 'Authorize high-value price reductions, custom PPA terms, and contractual discount margins',
    actions: ['approve'],
    riskLevel: 'HIGH'
  },
  {
    id: 'crm.quotations.delete',
    domain: 'crm',
    domainLabel: 'CRM & Sales',
    name: 'Delete Quotations & Proposals',
    description: 'Permanently remove draft or issued commercial quotation proposals',
    actions: ['delete'],
    riskLevel: 'HIGH'
  },

  // Projects & EPC
  {
    id: 'projects.view',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'View EPC Projects',
    description: 'View project dashboard, kWp capacity, site address, timeline schedules, and stage progression',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'projects.create',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Create New Project Record',
    description: 'Initialize new project from won quotation, define target commissioning date, and scope',
    actions: ['create'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'projects.edit_specs',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Edit Technical Specs',
    description: 'Modify DC plant capacity, inverter makes, module wattage, and consumer number',
    actions: ['edit'],
    riskLevel: 'HIGH'
  },
  {
    id: 'projects.assign_team',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Assign Project Specialists',
    description: 'Allocate survey engineers, civil teams, electrical engineers, and service personnel to projects',
    actions: ['edit', 'approve'],
    riskLevel: 'HIGH'
  },
  {
    id: 'projects.stage_checklist',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Update Stage Checklists',
    description: 'Check off field tasks (e.g., pedestal waterproofing, torque checks, string continuity)',
    actions: ['edit'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'projects.stage_photos',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Upload Work Photos & Proofs',
    description: 'Upload live photos with GPS timestamps for structural mounting, inverter wiring, and panels',
    actions: ['create', 'edit'],
    riskLevel: 'LOW'
  },
  {
    id: 'projects.stage_approve',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'Approve & Close Workflow Stages',
    description: 'Officially sign-off completed milestones, unlock subsequent stages, and trigger payment drawdowns',
    actions: ['approve'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'projects.workflows_view',
    domain: 'projects',
    domainLabel: 'Projects & Engineering',
    name: 'View Stage Workflows & Checklists',
    description: 'Filter projects by operational stage workflows and view site engineering checklists',
    actions: ['view'],
    riskLevel: 'LOW'
  },

  // Site Survey & Feasibility
  {
    id: 'survey.view',
    domain: 'survey',
    domainLabel: 'Site Survey & Feasibility',
    name: 'View Site Feasibility Surveys',
    description: 'Inspect roof dimension drawings, obstruction azimuth angles, and satellite coordinates',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'survey.submit',
    domain: 'survey',
    domainLabel: 'Site Survey & Feasibility',
    name: 'Conduct & Submit Survey',
    description: 'Fill out on-site survey form, log roof photos, shadow obstacles, and electricity bills',
    actions: ['create', 'edit'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'survey.approve',
    domain: 'survey',
    domainLabel: 'Site Survey & Feasibility',
    name: 'Validate Technical Feasibility',
    description: 'Certify roof load capacity, shadow free area, and electrical interconnection feasibility',
    actions: ['approve'],
    riskLevel: 'HIGH'
  },

  // Live Field Workforce Tracking
  {
    id: 'live_tracking.view',
    domain: 'tracking',
    domainLabel: 'Live Field Workforce Tracking',
    name: 'View Live Field Tracking & Map',
    description: 'Access the live GPS field workforce tracking console, presence feed, and employee telemetry',
    actions: ['view'],
    riskLevel: 'HIGH'
  },

  // Material & Inventory
  {
    id: 'inventory.hub_view',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'View Sales & Purchase Hub',
    description: 'Open the Sales & Purchase ERP synchronization hub and overview workspace',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'inventory.view',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'View Warehouse Stock & Products',
    description: 'Check real-time inventory balances for PV modules, inverters, structure rails, and cables',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'inventory.manage',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Manage Stock & Adjustments',
    description: 'Add new inventory SKUs, update reorder levels, adjust physical counts, and record GRN receipts',
    actions: ['create', 'edit'],
    riskLevel: 'HIGH'
  },
  {
    id: 'inventory.products_manage',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Manage Purchased Products Catalog',
    description: 'Create, edit, and delete solar product catalog items, pricing, and HSN specifications',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },
  {
    id: 'inventory.bom_edit',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Customize Project BOM',
    description: 'Add or modify bill of materials components allocated to an active installation project',
    actions: ['edit'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'inventory.bom_manage',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Create & Delete Project BOMs',
    description: 'View Bill of Materials section, create new project BOMs, generate E-Way bills, and delete BOMs',
    actions: ['view', 'create', 'delete'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'inventory.vendors_view',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'View Vendor Management Directory',
    description: 'Browse solar equipment suppliers, GSTIN profiles, payment terms, and banking details',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'inventory.vendors_manage',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Manage Vendors & Suppliers',
    description: 'Create, edit, and delete vendor master records in the supply chain directory',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },
  {
    id: 'inventory.purchase_orders',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Issue Vendor Purchase Orders',
    description: 'Generate POs to solar module and inverter suppliers with payment terms and delivery dates',
    actions: ['create', 'approve'],
    riskLevel: 'HIGH'
  },
  {
    id: 'inventory.warehouses_manage',
    domain: 'inventory',
    domainLabel: 'Material & Inventory',
    name: 'Manage Multi-Warehouse Facilities',
    description: 'Create, edit, decommission warehouse facilities, manage storage capacity, and execute physical audits',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },

  // Finance & Accounting
  {
    id: 'finance.view',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'View Invoices & Project Ledgers',
    description: 'Examine customer billing schedules, overdue invoices, and milestone payment status',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'finance.invoices',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'Generate Tax Invoices',
    description: 'Draft, issue and cancel official GST tax invoices for solar EPC milestone payments',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },
  {
    id: 'finance.receipts',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'Record Customer Receipts',
    description: 'Acknowledge NEFT, RTGS, Cheque or Cash receipts and issue stamped money receipts',
    actions: ['create'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'finance.tally_sync',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'Push Vouchers to Tally Prime',
    description: 'Transmit XML receipts, sales invoices, and vendor debits directly into Tally Prime ODBC',
    actions: ['approve'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'finance.audit',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'Financial Ledger & Bank Audit',
    description: 'Review overall profit & loss, project gross margins, and bank reconciliation ledgers',
    actions: ['view', 'approve'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'finance.expenses',
    domain: 'finance',
    domainLabel: 'Finance, Invoicing & Tally',
    name: 'Manage Vendor & Project Expenses',
    description: 'View vendor expense vouchers, material purchase outflows, and Tally expense XML sync',
    actions: ['view', 'create', 'edit', 'delete'],
    riskLevel: 'HIGH'
  },

  // HRMS & Attendance
  {
    id: 'hrms.view',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'View Employee Directory',
    description: 'View internal staff contact details, designations, employee codes, and assigned teams',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'hrms.attendance_punch',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'Mark Daily GPS Attendance',
    description: 'Self-punch check-in and check-out with automatic GPS location capture',
    actions: ['create'],
    riskLevel: 'LOW'
  },
  {
    id: 'hrms.manage',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'Manage Staff & Leave Requests',
    description: 'Onboard new staff, adjust salary structures, approve leaves, and audit geofenced punches',
    actions: ['create', 'edit', 'approve'],
    riskLevel: 'HIGH'
  },
  {
    id: 'hrms.payroll',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'Calculate & Process Payroll',
    description: 'Generate monthly payroll register, deductions (PF/ESIC/PT), and salary slips',
    actions: ['approve'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'hrms.holidays',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'Manage Holiday Calendar & Rules',
    description: 'Add, edit, delete, and reset official company holiday schedules',
    actions: ['view', 'create', 'edit', 'delete'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'hrms.delete',
    domain: 'hrms',
    domainLabel: 'HRMS, Attendance & Payroll',
    name: 'Delete HRMS Staff, Attendance & Payslips',
    description: 'Permanently delete employee directory records, attendance logs, and generated payslip vouchers',
    actions: ['delete'],
    riskLevel: 'CRITICAL'
  },

  // Service & AMC
  {
    id: 'service.tickets_view',
    domain: 'service',
    domainLabel: 'Service, AMC & Maintenance',
    name: 'View Maintenance & Warranty Tickets',
    description: 'Monitor open customer breakdown requests, generation loss complaints, and inverter alerts',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'service.tickets_create',
    domain: 'service',
    domainLabel: 'Service, AMC & Maintenance',
    name: 'Log New Breakdown Call',
    description: 'Create service ticket with customer details, inverter fault codes, and priority SLA',
    actions: ['create'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'service.tickets_resolve',
    domain: 'service',
    domainLabel: 'Service, AMC & Maintenance',
    name: 'Perform Service & Resolve Tickets',
    description: 'Log on-site diagnosis, replace components, upload restoration photos, and obtain OTP sign-off',
    actions: ['edit', 'approve'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'service.amc_manage',
    domain: 'service',
    domainLabel: 'Service, AMC & Maintenance',
    name: 'Manage AMC Contracts & Schedules',
    description: 'Create annual maintenance contracts, schedule quarterly panel washing, and renew contracts',
    actions: ['create', 'edit', 'approve'],
    riskLevel: 'HIGH'
  },

  // Reports & Analytics
  {
    id: 'reports.view',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'View Operational Reports',
    description: 'Review lead conversions, kWp installed, project delays, and team attendance summaries',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.sales',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Sales Report',
    description: 'Access invoiced revenue, customer sales orders, GST breakdowns, and collection statuses',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.purchase',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Purchase Report',
    description: 'Access procurement orders, vendor commitments, input tax credits, and delivery fulfillment',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.product_stock',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Product Stock Report',
    description: 'Access solar equipment stock balances, valuation, threshold alerts, and movements',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.customer_ledger',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Customer Ledger Report',
    description: 'Access party-wise customer ledger with invoices billed, receipts credited, and dues',
    actions: ['view'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'reports.vendor_ledger',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Vendor Ledger Report',
    description: 'Access supplier payables ledger with procurement bills, disbursements, and pending dues',
    actions: ['view'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'reports.income_summary',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Income Summary Report',
    description: 'Access cash inflows, milestone payment receipts, modes, and Tally sync reconciliation',
    actions: ['view'],
    riskLevel: 'HIGH'
  },
  {
    id: 'reports.expense_summary',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Expense Summary Report',
    description: 'Access project material purchases, civil/electrical outflows, and vendor expense summaries',
    actions: ['view'],
    riskLevel: 'HIGH'
  },
  {
    id: 'reports.payroll',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Payroll Report',
    description: 'Access monthly employee compensation statements, overtime earnings, and statutory deductions',
    actions: ['view'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'reports.monthly_attendance',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Monthly Attendance Report',
    description: 'Access daily check-in/out logs, GPS field verifications, and shift attendance summaries',
    actions: ['view'],
    riskLevel: 'MEDIUM'
  },
  {
    id: 'reports.leads',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Leads Report',
    description: 'Access CRM inquiry velocity, acquisition sources, conversion rates, and pipeline capacity',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.projects',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Project Report',
    description: 'Access EPC solar installations, stage progression, completion timelines, and valuations',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'reports.export',
    domain: 'reports',
    domainLabel: 'Analytics & Executive Reports',
    name: 'Export Datasets (Excel / CSV)',
    description: 'Download bulk operational records, customer directories, and project execution ledgers',
    actions: ['approve'],
    riskLevel: 'MEDIUM'
  },

  // System Administration & Security
  {
    id: 'settings.view',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'View System Configuration',
    description: 'Check active company profile, GSTIN, Tally gateway status, and WhatsApp integration mode',
    actions: ['view'],
    riskLevel: 'LOW'
  },
  {
    id: 'settings.manage',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'Configure Company & Integrations',
    description: 'Update bank details, GST rates, Tally Prime server address, and WhatsApp Cloud credentials',
    actions: ['edit'],
    riskLevel: 'HIGH'
  },
  {
    id: 'settings.tally',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'Tally Prime Integration Settings',
    description: 'Configure Tally Prime company name, ODBC/XML endpoint, and gateway connection test',
    actions: ['view', 'edit'],
    riskLevel: 'HIGH'
  },
  {
    id: 'settings.whatsapp',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'WhatsApp Cloud API Settings',
    description: 'Configure WhatsApp Business phone ID and Meta Cloud API integration mode',
    actions: ['view', 'edit'],
    riskLevel: 'HIGH'
  },
  {
    id: 'settings.database',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'MySQL Database & APIs Console',
    description: 'Inspect production MySQL schema, run diagnostics, sync tools, and database controls',
    actions: ['view', 'edit', 'delete'],
    riskLevel: 'CRITICAL'
  },
  {
    id: 'settings.acl_manage',
    domain: 'settings',
    domainLabel: 'System Admin & Security',
    name: 'Modify Role-Based Access Control',
    description: 'Grant or revoke permissions, edit ACL matrices, reassign user roles, and enforce security policies',
    actions: ['edit', 'approve'],
    riskLevel: 'CRITICAL'
  },

  // User Management & Administration
  {
    id: 'users.view',
    domain: 'users',
    domainLabel: 'User Management & Administration',
    name: 'View User Management Directory',
    description: 'Browse ERP system login accounts, employee role allocations, and active session status',
    actions: ['view'],
    riskLevel: 'HIGH'
  },
  {
    id: 'users.manage',
    domain: 'users',
    domainLabel: 'User Management & Administration',
    name: 'Create, Edit & Delete System Users',
    description: 'Provision ERP accounts, modify user roles, reset passwords, suspend or delete system users',
    actions: ['create', 'edit', 'delete'],
    riskLevel: 'CRITICAL'
  }
];

// Helper to generate a full boolean map with all permissions
const createPermissions = (grantList: string[]): Record<string, boolean> => {
  const result: Record<string, boolean> = {};
  ACL_PERMISSIONS_CATALOG.forEach(p => {
    result[p.id] = grantList.includes(p.id);
  });
  return result;
};

// All permissions array for Admin (Root Authority)
const ALL_PERMISSION_IDS = ACL_PERMISSIONS_CATALOG.map(p => p.id);

const ALL_REPORT_PERMISSIONS = [
  'reports.view',
  'reports.sales',
  'reports.purchase',
  'reports.product_stock',
  'reports.customer_ledger',
  'reports.vendor_ledger',
  'reports.income_summary',
  'reports.expense_summary',
  'reports.payroll',
  'reports.monthly_attendance',
  'reports.leads',
  'reports.projects',
  'reports.export'
];

/**
 * Standard Production-Grade Solar EPC Default Access Control List (ACL)
 */
export const DEFAULT_SYSTEM_ACL_CONFIG: SystemAclConfig = {
  'Admin': createPermissions(ALL_PERMISSION_IDS),

  'Project Manager': createPermissions([
    'dashboard.view', 'control_center.view',
    'crm.leads.view', 'crm.customers.view', 'crm.quotations.view', 'crm.quotations.create',
    'projects.view', 'projects.create', 'projects.edit_specs', 'projects.assign_team',
    'projects.stage_checklist', 'projects.stage_photos', 'projects.stage_approve', 'projects.workflows_view',
    'survey.view', 'survey.approve',
    'inventory.hub_view', 'inventory.view', 'inventory.products_manage', 'inventory.bom_edit', 'inventory.bom_manage',
    'inventory.vendors_view', 'inventory.purchase_orders',
    'finance.view', 'finance.expenses',
    'hrms.view', 'hrms.attendance_punch',
    'service.tickets_view', 'service.tickets_create',
    ...ALL_REPORT_PERMISSIONS,
    'settings.view'
  ]),

  'Site Survey Engineer': createPermissions([
    'dashboard.view',
    'crm.leads.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'survey.view', 'survey.submit',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Site Inspector': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'survey.view', 'survey.submit',
    'service.tickets_view', 'service.tickets_resolve',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Sales Manager': createPermissions([
    'dashboard.view',
    'crm.leads.view', 'crm.leads.manage', 'crm.leads.delete',
    'crm.customers.view', 'crm.customers.manage',
    'crm.quotations.view', 'crm.quotations.create', 'crm.quotations.approve', 'crm.quotations.delete',
    'projects.view', 'projects.workflows_view',
    'survey.view',
    'inventory.hub_view', 'inventory.view', 'inventory.bom_manage', 'inventory.vendors_view',
    'finance.view',
    'hrms.view', 'hrms.attendance_punch',
    ...ALL_REPORT_PERMISSIONS,
    'settings.view'
  ]),

  'Sales Executive': createPermissions([
    'dashboard.view',
    'crm.leads.view', 'crm.leads.manage',
    'crm.customers.view', 'crm.customers.manage',
    'crm.quotations.view', 'crm.quotations.create',
    'projects.view', 'projects.workflows_view',
    'survey.view',
    'inventory.hub_view', 'inventory.view',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Civil Team': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'inventory.view',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Structure Team': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'inventory.view',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Installation Team': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'inventory.view',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Electrical Team': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'inventory.view',
    'hrms.attendance_punch',
    'settings.view'
  ]),

  'Technician': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.stage_checklist', 'projects.stage_photos', 'projects.workflows_view',
    'inventory.view',
    'hrms.attendance_punch',
    'service.tickets_view', 'service.tickets_resolve',
    'settings.view'
  ]),

  'Service Manager': createPermissions([
    'dashboard.view', 'control_center.view',
    'projects.view', 'projects.workflows_view',
    'inventory.hub_view', 'inventory.view',
    'hrms.view', 'hrms.attendance_punch',
    'service.tickets_view', 'service.tickets_create', 'service.tickets_resolve', 'service.amc_manage',
    ...ALL_REPORT_PERMISSIONS,
    'settings.view'
  ]),

  'Accountant': createPermissions([
    'dashboard.view',
    'crm.leads.view', 'crm.customers.view', 'crm.quotations.view',
    'projects.view', 'projects.workflows_view',
    'inventory.hub_view', 'inventory.view', 'inventory.vendors_view', 'inventory.vendors_manage', 'inventory.purchase_orders',
    'finance.view', 'finance.invoices', 'finance.receipts', 'finance.tally_sync', 'finance.audit', 'finance.expenses',
    'hrms.view', 'hrms.attendance_punch', 'hrms.payroll',
    ...ALL_REPORT_PERMISSIONS,
    'settings.view'
  ]),

  'HR Manager': createPermissions([
    'dashboard.view',
    'projects.view', 'projects.workflows_view',
    'hrms.view', 'hrms.attendance_punch', 'hrms.manage', 'hrms.payroll', 'hrms.holidays', 'hrms.delete',
    ...ALL_REPORT_PERMISSIONS,
    'settings.view'
  ]),

  'Customer': createPermissions([
    'customer_portal.view',
    'projects.view',
    'finance.view',
    'service.tickets_view', 'service.tickets_create'
  ])
};
