import { google, sheets_v4 } from "googleapis";
import type { AppConfig } from "../config.js";
import type { DraftVariant, Employee, QueueRecord, QueueStore, SheetValue, VariantLabel } from "../domain/types.js";
import {
  appendMissingHeaders,
  DEPT_CHANNEL_MAP_HEADERS,
  DEPT_CHANNEL_MAP_SHEET,
  INSIGHTS_RUNS_HEADERS,
  INSIGHTS_RUNS_SHEET
} from "../peoplePulse/sheetHeaders.js";

const EMPLOYEE_SHEET = "Employees";
const QUEUE_SHEET = "Slack Review Queue";
const HISTORY_SHEET = "Slack Message History";
const EMPLOYEE_HEADERS = [
  "Employee ID", "Active", "First Name", "Last Name", "Preferred Name", "Hire Date", "Department", "Slack User ID", "Notes for Tone"
];
const QUEUE_HEADERS = [
  "Queue ID", "Employee ID", "Employee Name", "Slack User ID", "Event Date", "Year", "Years of Service", "Department",
  "Prior Message", "Prior Message URL", "Prior Message Timestamp", "Draft Warm", "Draft Professional", "Draft Concise",
  "Selected Variant", "Final Message", "Status", "Review Channel ID", "Review Message Timestamp", "Posted Channel ID",
  "Posted Message Timestamp", "Posted Message URL", "Approved By", "Approved At", "Created At", "Updated At", "Error"
];

export class GoogleSheetsStore implements QueueStore {
  private readonly sheets: sheets_v4.Sheets;
  constructor(private readonly config: AppConfig) {
    const credentials = config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
      ? JSON.parse(Buffer.from(config.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"))
      : undefined;
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    this.sheets = google.sheets({ version: "v4", auth });
  }

  async ensureReady(): Promise<void> {
    const metadata = await this.sheets.spreadsheets.get({ spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID, fields: "sheets.properties" });
    const names = new Set((metadata.data.sheets ?? []).map((sheet) => sheet.properties?.title));
    const requests: sheets_v4.Schema$Request[] = [];
    if (!names.has(EMPLOYEE_SHEET)) requests.push({ addSheet: { properties: { title: EMPLOYEE_SHEET } } });
    if (!names.has(QUEUE_SHEET)) requests.push({ addSheet: { properties: { title: QUEUE_SHEET } } });
    if (!names.has(HISTORY_SHEET)) requests.push({ addSheet: { properties: { title: HISTORY_SHEET } } });
    if (!names.has(DEPT_CHANNEL_MAP_SHEET)) requests.push({ addSheet: { properties: { title: DEPT_CHANNEL_MAP_SHEET } } });
    if (!names.has(INSIGHTS_RUNS_SHEET)) requests.push({ addSheet: { properties: { title: INSIGHTS_RUNS_SHEET } } });
    if (requests.length) await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID, requestBody: { requests } });
    await this.ensureEmployeeHeaders();
    await this.ensureHeaders(QUEUE_SHEET);
    await this.ensureHeaders(HISTORY_SHEET);
    await this.ensureAppendOnlyHeaders(DEPT_CHANNEL_MAP_SHEET, DEPT_CHANNEL_MAP_HEADERS);
    await this.ensureAppendOnlyHeaders(INSIGHTS_RUNS_SHEET, INSIGHTS_RUNS_HEADERS);
  }

  private async ensureEmployeeHeaders(): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID, range: `${quote(EMPLOYEE_SHEET)}!1:1` });
    const existing = (response.data.values?.[0] ?? []).map(String);
    if (!existing.length) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
        range: `${quote(EMPLOYEE_SHEET)}!A1:I1`,
        valueInputOption: "RAW",
        requestBody: { values: [EMPLOYEE_HEADERS] }
      });
      return;
    }
    const missing = EMPLOYEE_HEADERS.filter((header) => !existing.includes(header));
    if (!missing.length) return;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quote(EMPLOYEE_SHEET)}!${columnName(existing.length + 1)}1:${columnName(existing.length + missing.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [missing] }
    });
  }

  async listEmployees(): Promise<Employee[]> {
    const rows = await this.getRows(EMPLOYEE_SHEET);
    return rows.map((row) => {
      const firstName = text(row["First Name"]);
      const lastName = text(row["Last Name"]);
      const preferredName = text(row["Preferred Name"]);
      return {
        employeeId: text(row["Employee ID"]),
        active: bool(row.Active),
        firstName,
        lastName,
        preferredName,
        displayName: [preferredName || firstName, lastName].filter(Boolean).join(" ").trim(),
        hireDate: row["Hire Date"],
        department: text(row.Department),
        slackUserId: text(row["Slack User ID"] || row["Slack ID"]),
        toneNotes: text(row["Notes for Tone"])
      };
    });
  }

  async getQueue(queueId: string): Promise<QueueRecord | null> {
    const rows = await this.getRows(QUEUE_SHEET);
    const row = rows.find((candidate) => text(candidate["Queue ID"]) === queueId);
    return row ? fromRow(row) : null;
  }

  async upsertQueue(record: QueueRecord): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID, range: quote(QUEUE_SHEET), valueRenderOption: "UNFORMATTED_VALUE" });
    const values = response.data.values ?? [];
    const headers = (values[0] ?? []).map(String);
    const rowIndex = values.slice(1).findIndex((row) => String(row[headers.indexOf("Queue ID")] ?? "") === record.queueId);
    const output = QUEUE_HEADERS.map((header) => toRow(record)[header] ?? "");
    if (rowIndex >= 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
        range: `${quote(QUEUE_SHEET)}!A${rowIndex + 2}:AA${rowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [output] }
      });
    } else {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
        range: `${quote(QUEUE_SHEET)}!A:AA`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [output] }
      });
    }
  }

  async appendHistory(record: QueueRecord): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quote(HISTORY_SHEET)}!A:AA`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [QUEUE_HEADERS.map((header) => toRow(record)[header] ?? "")] }
    });
  }

  private async ensureHeaders(sheetName: string): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID, range: `${quote(sheetName)}!1:1` });
    const existing = (response.data.values?.[0] ?? []).map(String);
    if (QUEUE_HEADERS.every((header, index) => existing[index] === header)) return;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quote(sheetName)}!A1:AA1`,
      valueInputOption: "RAW",
      requestBody: { values: [QUEUE_HEADERS] }
    });
  }

  private async ensureAppendOnlyHeaders(sheetName: string, required: readonly string[]): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quote(sheetName)}!1:1`
    });
    const existing = (response.data.values?.[0] ?? []).map(String);
    const merged = appendMissingHeaders(existing, required);
    if (merged.length === existing.length) return;
    const missing = merged.slice(existing.length);
    const start = existing.length + 1;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quote(sheetName)}!${columnName(start)}1:${columnName(start + missing.length - 1)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [missing] }
    });
  }

  private async getRows(sheetName: string): Promise<Array<Record<string, SheetValue>>> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: quote(sheetName),
      valueRenderOption: "UNFORMATTED_VALUE"
    });
    const values = response.data.values ?? [];
    const headers = (values[0] ?? []).map(String);
    return values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] as SheetValue])));
  }
}

function quote(name: string): string { return `'${name.replace(/'/g, "''")}'`; }
function columnName(index: number): string {
  let value = index;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
function bool(value: unknown): boolean { return value === true || ["true", "yes", "1", "active"].includes(text(value).toLowerCase()); }

function variant(record: QueueRecord, label: VariantLabel): string { return record.variants.find((item) => item.label === label)?.message || ""; }
function toRow(record: QueueRecord): Record<string, SheetValue> {
  return {
    "Queue ID": record.queueId, "Employee ID": record.employeeId, "Employee Name": record.employeeName, "Slack User ID": record.slackUserId,
    "Event Date": record.eventDate, Year: record.year, "Years of Service": record.yearsOfService, Department: record.department,
    "Prior Message": record.priorMessage, "Prior Message URL": record.priorMessageUrl, "Prior Message Timestamp": record.priorMessageTimestamp,
    "Draft Warm": variant(record, "Warm"), "Draft Professional": variant(record, "Professional"), "Draft Concise": variant(record, "Concise"),
    "Selected Variant": record.selectedVariant, "Final Message": record.finalMessage, Status: record.status,
    "Review Channel ID": record.reviewChannelId, "Review Message Timestamp": record.reviewMessageTimestamp,
    "Posted Channel ID": record.postedChannelId, "Posted Message Timestamp": record.postedMessageTimestamp, "Posted Message URL": record.postedMessageUrl,
    "Approved By": record.approvedBy, "Approved At": record.approvedAt, "Created At": record.createdAt, "Updated At": record.updatedAt, Error: record.error
  };
}

function fromRow(row: Record<string, SheetValue>): QueueRecord {
  const variants: DraftVariant[] = [
    { label: "Warm", message: text(row["Draft Warm"]) },
    { label: "Professional", message: text(row["Draft Professional"]) },
    { label: "Concise", message: text(row["Draft Concise"]) }
  ];
  return {
    queueId: text(row["Queue ID"]), employeeId: text(row["Employee ID"]), employeeName: text(row["Employee Name"]), slackUserId: text(row["Slack User ID"]),
    eventDate: text(row["Event Date"]), year: Number(row.Year || 0), yearsOfService: Number(row["Years of Service"] || 0), department: text(row.Department),
    priorMessage: text(row["Prior Message"]), priorMessageUrl: text(row["Prior Message URL"]), priorMessageTimestamp: text(row["Prior Message Timestamp"]),
    variants, selectedVariant: text(row["Selected Variant"]) as QueueRecord["selectedVariant"], finalMessage: text(row["Final Message"]),
    status: (text(row.Status) || "Needs Review") as QueueRecord["status"], reviewChannelId: text(row["Review Channel ID"]),
    reviewMessageTimestamp: text(row["Review Message Timestamp"]), postedChannelId: text(row["Posted Channel ID"]),
    postedMessageTimestamp: text(row["Posted Message Timestamp"]), postedMessageUrl: text(row["Posted Message URL"]), approvedBy: text(row["Approved By"]),
    approvedAt: text(row["Approved At"]), createdAt: text(row["Created At"]), updatedAt: text(row["Updated At"]), error: text(row.Error)
  };
}
