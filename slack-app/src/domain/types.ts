export type SheetValue = string | number | boolean | null | undefined;

export interface Employee {
  employeeId: string;
  active: boolean;
  firstName: string;
  lastName: string;
  preferredName: string;
  displayName: string;
  hireDate: SheetValue;
  department: string;
  slackUserId: string;
  toneNotes: string;
}

export interface Anniversary {
  employee: Employee;
  occurrenceDate: string;
  year: number;
  yearsOfService: number;
  queueId: string;
}

export interface PriorMessage {
  found: boolean;
  text: string;
  url: string;
  timestamp: string;
}

export type VariantLabel = "Warm" | "Professional" | "Concise";

export interface DraftVariant {
  label: VariantLabel;
  message: string;
}

export interface DraftResult {
  variants: DraftVariant[];
  warnings: string[];
}

export type QueueStatus =
  | "Needs Review"
  | "Selected"
  | "Skipped"
  | "Dry Run Approved"
  | "Posted"
  | "Error";

export interface QueueRecord {
  queueId: string;
  employeeId: string;
  employeeName: string;
  slackUserId: string;
  eventDate: string;
  year: number;
  yearsOfService: number;
  department: string;
  priorMessage: string;
  priorMessageUrl: string;
  priorMessageTimestamp: string;
  variants: DraftVariant[];
  selectedVariant: VariantLabel | "";
  finalMessage: string;
  status: QueueStatus;
  reviewChannelId: string;
  reviewMessageTimestamp: string;
  postedChannelId: string;
  postedMessageTimestamp: string;
  postedMessageUrl: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
  error: string;
}

export interface QueueStore {
  ensureReady(): Promise<void>;
  listEmployees(): Promise<Employee[]>;
  getQueue(queueId: string): Promise<QueueRecord | null>;
  upsertQueue(record: QueueRecord): Promise<void>;
  appendHistory(record: QueueRecord): Promise<void>;
}
