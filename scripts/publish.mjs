/**
 * Parses a "submission" issue, validates the attached *.sd-system.json package,
 * stores it in packages/ and adds/updates the entry in index.json.
 * Comments on the issue with the result and closes it on success.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const body   = process.env.ISSUE_BODY   ?? "";
const issue  = process.env.ISSUE_NUMBER ?? "";
const repo   = process.env.REPO         ?? "";
const token  = process.env.GITHUB_TOKEN ?? "";
const ghUser = process.env.ISSUE_USER   ?? "";

function field(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`###\\s*${escaped}\\s*\\r?\\n+([\\s\\S]*?)(?=\\r?\\n###\\s|$)`);
  const m = body.match(re);
  const v = m ? m[1].trim() : "";
  return v === "_No response_" ? "" : v;
}

async function api(path, method = "POST", payload = null) {
  const res = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json"
    },
    body: payload ? JSON.stringify(payload) : null
  });
  return res;
}

async function comment(msg, close = false) {
  await api(`/repos/${repo}/issues/${issue}/comments`, "POST", { body: msg });
  if (close) await api(`/repos/${repo}/issues/${issue}`, "PATCH", { state: "closed" });
}

async function fail(msg) {
  await comment(`\u274c ${msg}\n\nEdit the issue (Edit -> Update) and the bot will re-check it automatically.`);
  process.exit(0);
}

const name = field("Name");
const id   = field("ID").toLowerCase();

if (!name) await fail("The Name field is empty.");
if (!/^[a-z0-9-]{2,64}$/.test(id)) await fail("ID must contain only lowercase latin letters, digits and hyphens (2-64 characters).");

const pkgField = field("Package file");
const urlMatch = pkgField.match(/https?:\/\/[^\s)"'<>]+/);
if (!urlMatch) await fail('No link found in the "Package file" field. Drag the file into that field or paste a direct link.');

const res = await fetch(urlMatch[0]);
if (!res.ok) await fail(`Failed to download the package (HTTP ${res.status}).`);
const buf = Buffer.from(await res.arrayBuffer());

let text;
if (buf.subarray(0, 2).toString() === "PK") {
  fs.writeFileSync("/tmp/pkg.zip", buf);
  text = execSync("unzip -p /tmp/pkg.zip", { maxBuffer: 1024 * 1024 * 500 }).toString("utf8");
} else {
  text = buf.toString("utf8");
}

let pkg;
try { pkg = JSON.parse(text); }
catch { await fail("The package is not valid JSON."); }
if (pkg?.sdMarket !== 1 || !pkg?.settings || typeof pkg.settings !== "object") {
  await fail('Invalid package format: export it in Foundry via Market -> "Export my system".');
}

fs.mkdirSync("packages", { recursive: true });
fs.writeFileSync(`packages/${id}.sd-system.json`, JSON.stringify(pkg, null, 2) + "\n");

const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
index.systems = Array.isArray(index.systems) ? index.systems : [];

const entry = {
  id,
  name,
  author:      field("Author") || ghUser,
  version:     field("Version") || pkg.meta?.version || "1.0.0",
  description: field("Description"),
  package:     "https://raw.githubusercontent.com/" + repo + "/main/packages/" + id + ".sd-system.json",
  rulebook:    field("Rulebook link (PDF)"),
  repo:        field("System repository (for likes/stars)"),
  icon:        field("Icon link"),
  tags:        field("Tags").split(",").map(s => s.trim()).filter(Boolean),
  stars:       0,
  downloads:   0
};

const prev = index.systems.findIndex(s => s.id === id);
if (prev >= 0) {
  entry.stars     = index.systems[prev].stars     ?? 0;
  entry.downloads = index.systems[prev].downloads ?? 0;
  index.systems[prev] = entry;
} else {
  index.systems.push(entry);
}

fs.writeFileSync("index.json", JSON.stringify(index, null, 2) + "\n");

await comment(`\u2705 "${name}" has been published to the market! It will appear in the catalog within a couple of minutes.`, true);
console.log(`published: ${id}`);
