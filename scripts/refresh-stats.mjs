/**
 * Refreshes stars (likes) and release download counts for every catalog entry
 * that has a GitHub repo link.
 */
import fs from "node:fs";

const token   = process.env.GITHUB_TOKEN ?? "";
const headers = token
  ? { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
  : { Accept: "application/vnd.github+json" };

const index = JSON.parse(fs.readFileSync("index.json", "utf8"));

for (const s of index.systems ?? []) {
  const m = String(s.repo ?? "").match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (!m) continue;
  const base = `https://api.github.com/repos/${m[1]}/${m[2]}`;
  try {
    const r = await fetch(base, { headers });
    if (r.ok) {
      const d = await r.json();
      s.stars = d.stargazers_count ?? s.stars ?? 0;
    }
    const rel = await fetch(`${base}/releases?per_page=100`, { headers });
    if (rel.ok) {
      const rels = await rel.json();
      const dl = rels.flatMap(x => x.assets ?? [])
        .reduce((sum, a) => sum + (a.download_count ?? 0), 0);
      if (dl > (s.downloads ?? 0)) s.downloads = dl;
    }
  } catch (err) {
    console.warn(`stats failed for ${s.id}:`, err.message);
  }
}

fs.writeFileSync("index.json", JSON.stringify(index, null, 2) + "\n");
console.log("stats refreshed");
