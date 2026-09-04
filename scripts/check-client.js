import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter(Boolean);

for (const [index, source] of scripts.entries()) {
  new vm.Script(source, { filename: `index.html:inline-script-${index + 1}.js` });
}

const staticMarkup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
const ids = [...staticMarkup.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) throw new Error(`Duplicate HTML ids: ${duplicates.join(", ")}`);
for (const required of ["/api/bootstrap.js?v=4", "/styles/audit-polish.css", "/scripts/report-files.js", "/scripts/import-export.js", "/scripts/regional-settings.js", "id=\"signIn\"", "id=\"forgotPasswordLink\"", "function ensureProposalNumber(", "Generated at Proposal sent", "aria-keyshortcuts=\"Meta+K Control+K\"", "placeholder=\"SmartFind\"", "lead-product-field", "Select after first contact", "id='leadTempQuickFilter'", "temperature-choice", "contact-choice", "function defaultNewLeadFollowAt("]) {
  if (!html.includes(required)) throw new Error(`Missing required client contract: ${required}`);
}
if (html.includes("Prototype OTP") || html.includes("Prototype verification code")) {
  throw new Error("Prototype authentication text must not ship to production.");
}

console.log(`Client syntax is valid (${scripts.length} inline script${scripts.length === 1 ? "" : "s"}).`);
