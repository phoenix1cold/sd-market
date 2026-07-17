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
  const res = await fetch(`https://api.github.com${path}`, {
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
  await comment(`\u274c ${msg}\n\n\u041e\u0442\u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0437\u0430\u044f\u0432\u043a\u0443 (Edit) \u2014 \u0431\u043e\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442 \u0435\u0451 \u0437\u0430\u043d\u043e\u0432\u043e.`);
  process.exit(0);
}

const name = field("\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435");
const id   = field("ID").toLowerCase();

if (!name) await fail("\u041d\u0435 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435.");
if (!/^[a-z0-9-]{2,64}$/.test(id)) await fail("ID \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043b\u0430\u0442\u0438\u043d\u0438\u0446\u0443, \u0446\u0438\u0444\u0440\u044b \u0438 \u0434\u0435\u0444\u0438\u0441\u044b (2\u201364 \u0441\u0438\u043c\u0432\u043e\u043b\u0430).");

const pkgField = field("\u0424\u0430\u0439\u043b \u043f\u0430\u043a\u0435\u0442\u0430");
const urlMatch = pkgField.match(/https?:\/\/[^\s)"'<>]+/);
if (!urlMatch) await fail("\u0412 \u043f\u043e\u043b\u0435 \u00ab\u0424\u0430\u0439\u043b \u043f\u0430\u043a\u0435\u0442\u0430\u00bb \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 \u0441\u0441\u044b\u043b\u043a\u0430. \u041f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0432 \u043f\u043e\u043b\u0435 \u0438\u043b\u0438 \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043f\u0440\u044f\u043c\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443.");

const res = await fetch(urlMatch[0]);
if (!res.ok) await fail(`\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0430\u0447\u0430\u0442\u044c \u043f\u0430\u043a\u0435\u0442 (HTTP ${res.status}).`);
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
catch { await fail("\u041f\u0430\u043a\u0435\u0442 \u043d\u0435 \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u043c JSON."); }
if (pkg?.sdMarket !== 1 || !pkg?.settings || typeof pkg.settings !== "object") {
  await fail("\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442 \u043f\u0430\u043a\u0435\u0442\u0430: \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0435\u0433\u043e \u0447\u0435\u0440\u0435\u0437 \u041c\u0430\u0440\u043a\u0435\u0442 \u2192 \u00ab\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u043c\u043e\u0435\u0439 \u0441\u0438\u0441\u0442\u0435\u043c\u044b\u00bb.");
}

fs.mkdirSync("packages", { recursive: true });
fs.writeFileSync(`packages/${id}.sd-system.json`, JSON.stringify(pkg, null, 2) + "\n");

const index = JSON.parse(fs.readFileSync("index.json", "utf8"));
index.systems = Array.isArray(index.systems) ? index.systems : [];

const entry = {
  id,
  name,
  author:      field("\u0410\u0432\u0442\u043e\u0440") || ghUser,
  version:     field("\u0412\u0435\u0440\u0441\u0438\u044f") || pkg.meta?.version || "1.0.0",
  description: field("\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"),
  package:     `https://raw.githubusercontent.com/${repo}/main/packages/${id}.sd-system.json`,
  rulebook:    field("\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0440\u0443\u043b\u0431\u0443\u043a (PDF)"),
  repo:        field("\u0420\u0435\u043f\u043e\u0437\u0438\u0442\u043e\u0440\u0438\u0439 \u0441\u0438\u0441\u0442\u0435\u043c\u044b (\u0434\u043b\u044f \u043b\u0430\u0439\u043a\u043e\u0432-\u0437\u0432\u0451\u0437\u0434)"),
  icon:        field("\u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0430 \u0438\u043a\u043e\u043d\u043a\u0443"),
  tags:        field("\u0422\u0435\u0433\u0438").split(",").map(s => s.trim()).filter(Boolean),
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

await comment(`\u2705 \u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u00ab${name}\u00bb \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430 \u0432 \u043c\u0430\u0440\u043a\u0435\u0442\u0435! \u041e\u043d\u0430 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0435 \u0447\u0435\u0440\u0435\u0437 \u043f\u0430\u0440\u0443 \u043c\u0438\u043d\u0443\u0442.`, true);
console.log(`published: ${id}`);
