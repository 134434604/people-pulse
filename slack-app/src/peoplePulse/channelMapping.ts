import type { ChannelScope } from "./schemas.js";

export interface SlackChannelCandidate {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
}

export interface DepartmentRecord {
  name: string;
}

export function proposeDepartmentChannelMappings(
  departments: readonly DepartmentRecord[],
  channels: readonly SlackChannelCandidate[]
): ChannelScope[] {
  const activePublicChannels = channels.filter((channel) => !channel.isPrivate && !channel.isArchived);
  const proposals: ChannelScope[] = [];

  for (const department of departments) {
    const departmentKey = normalize(department.name);
    for (const channel of activePublicChannels) {
      if (!isConventionMatch(departmentKey, normalize(channel.name))) continue;
      proposals.push({
        department: department.name.trim(),
        channelId: channel.id,
        channelName: `#${channel.name}`,
        conversationType: "public_channel",
        mappingSource: "auto-convention",
        include: false,
        approvedBy: "",
        approvedDate: ""
      });
    }
  }

  return proposals.sort((left, right) =>
    `${left.department}:${left.channelName}`.localeCompare(`${right.department}:${right.channelName}`)
  );
}

function isConventionMatch(department: string, channel: string): boolean {
  if (!department || !channel) return false;
  const acceptedPrefixes = [department, `dept-${department}`, `team-${department}`, `${department}-team`];
  return acceptedPrefixes.some((prefix) => channel === prefix || channel.startsWith(`${prefix}-`));
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
