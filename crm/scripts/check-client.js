import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter(Boolean);

for (const [index, source] of scripts.entries()) {
  new vm.Script(source, { filename: `index.html:inline-script-${index + 1}.js` });
}

console.log(`Client syntax is valid (${scripts.length} inline script${scripts.length === 1 ? "" : "s"}).`);

