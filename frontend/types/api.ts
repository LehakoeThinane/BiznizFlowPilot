export type UserRole = "owner" | "manager" | "staff" | string;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  business_name: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CurrentUser {
  user_id: string;
  business_id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface BusinessUser {
  id: string;
  business_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface BusinessUserListResponse {
  total: number;
  items: BusinessUser[];
}

export interface DashboardMetricsResponse {
  totalWorkflows: number;
  activeRuns: number;
  pendingTasks: number;
  totalLeads: number;
  refreshedAt: string;
}

export interface WorkflowAction {
  id: string;
  workflow_id: string | null;
  action_type: string;
  parameters: Record<string, unknown>;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  trigger_event_type: string;
  enabled: boolean;
  order: number;
  actions: WorkflowAction[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  total: number;
  workflows: Workflow[];
}

export interface WorkflowActionInput {
  action_type: string;
  parameters: Record<string, unknown>;
  order: number;
}

export interface WorkflowDefinitionInput {
  trigger_event_type: string;
  enabled: boolean;
  order: number;
  actions: WorkflowActionInput[];
}

export type WorkflowRunStatus = "queued" | "running" | "completed" | "failed";

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  workflow_definition_id: string | null;
  business_id: string;
  event_id: string | null;
  triggered_by_event_id: string | null;
  actor_id: string | null;
  status: WorkflowRunStatus;
  definition_snapshot: Record<string, unknown>;
  error_message: string | null;
  results: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface WorkflowRunListResponse {
  total: number;
  runs: WorkflowRun[];
}

export type LeadStatusBackend = "new" | "contacted" | "qualified" | "won" | "lost";

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string | null;
  assigned_to: string | null;
  status: LeadStatusBackend;
  source: string | null;
  value: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  skip: number;
  limit: number;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  skip: number;
  limit: number;
}

export type TaskStatusBackend = "pending" | "in_progress" | "completed" | "overdue";
export type TaskPriorityBackend = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  business_id: string;
  lead_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: TaskStatusBackend;
  priority: TaskPriorityBackend;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  skip: number;
  limit: number;
}

// ─── ERP: Products ────────────────────────────────────────────────────────────

export type ProductType = "physical" | "digital" | "service";

export interface Product {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  description: string | null;
  product_type: ProductType;
  category: string | null;
  unit_price: string;
  cost_price: string | null;
  tax_rate: string;
  is_active: boolean;
  track_inventory: boolean;
  barcode: string | null;
  weight: string | null;
  weight_unit: string;
  meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  skip: number;
  limit: number;
}

// ─── ERP: Suppliers ───────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  payment_terms: string | null;
  tax_id: string | null;
  is_active: boolean;
  rating: number | null;
  notes: string | null;
  meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SupplierListResponse {
  items: Supplier[];
  total: number;
  skip: number;
  limit: number;
}

// ─── ERP: Inventory ───────────────────────────────────────────────────────────

export interface InventoryLocation {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
  location_type: string;
  is_active: boolean;
  meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved: number;
  available: number;
  reorder_point: number;
  reorder_quantity: number;
  created_at: string;
  updated_at: string;
}

// ─── ERP: Sales Orders ────────────────────────────────────────────────────────

export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderLineItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOrder {
  id: string;
  business_id: string;
  order_number: string;
  customer_id: string | null;
  status: SalesOrderStatus;
  order_date: string | null;
  total_amount: string;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  line_items: OrderLineItem[];
}

export interface SalesOrderListResponse {
  items: SalesOrder[];
  total: number;
  skip: number;
  limit: number;
}

// ─── ERP: Purchase Orders ─────────────────────────────────────────────────────

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled";

export interface POLineItem {
  id: string;
  po_id: string;
  product_id: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: string;
  subtotal: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  business_id: string;
  po_number: string;
  supplier_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  total_cost: string;
  notes: string | null;
  receiving_location_id: string | null;
  meta_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  line_items: POLineItem[];
}

export interface PurchaseOrderListResponse {
  items: PurchaseOrder[];
  total: number;
  skip: number;
  limit: number;
}
