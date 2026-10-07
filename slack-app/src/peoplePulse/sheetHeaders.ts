export const DEPT_CHANNEL_MAP_SHEET = "Dept Channel Map";
export const INSIGHTS_RUNS_SHEET = "Insights Runs";

export const DEPT_CHANNEL_MAP_HEADERS = [
  "Department",
  "Channel ID",
  "Channel Name",
  "Mapping Source",
  "Include",
  "Approved By",
  "Approved Date"
] as const;

export const INSIGHTS_RUNS_HEADERS = [
  "Run ID",
  "Week Start",
  "Generated At",
  "Departments",
  "Channels Read",
  "Messages Read",
  "Task Observations",
  "Signals",
  "Model",
  "Tokens In/Out",
  "Cost Est",
  "Mode Flags",
  "Output Hash",
  "Status",
  "Error Code"
] as const;

export function appendMissingHeaders(existing: readonly string[], required: readonly string[]): string[] {
  const present = new Set(existing.map((header) => header.trim()).filter(Boolean));
  return [...existing, ...required.filter((header) => !present.has(header))];
}
