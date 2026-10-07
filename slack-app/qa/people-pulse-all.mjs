import { spawnSync } from "node:child_process";

const npmEntryPoint = process.env.npm_execpath;
if (!npmEntryPoint) throw new Error("npm_execpath is required to run the People Pulse QA suite.");
const commands = [
  ["run", "people-pulse:demo"],
  ["run", "check"],
  ["test", "--", "--run"],
  ["run", "qa:people-pulse:contract"],
  ["run", "qa:people-pulse:deployment"],
  ["run", "qa:people-pulse:api"],
  ["run", "qa:people-pulse:browser"]
];

for (const argumentsList of commands) {
  const result = spawnSync(process.execPath, [npmEntryPoint, ...argumentsList], { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("People Pulse complete local QA passed. Provider contacted: no. Live-provider proof: not attempted.");
