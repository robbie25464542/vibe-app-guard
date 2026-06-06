const fs = require("fs");

const requiredFiles = ["index.html", "styles.css", "app.js"];
const requiredHtmlHooks = [
  'id="scanForm"',
  'id="progressPanel"',
  'id="findingsList"',
  'id="rescanButton"'
];
const requiredJsHooks = [
  "let findings =",
  "async function createScan",
  "async function pollScan",
  "async function startScan",
  "function renderFindings",
  "function calculateRiskScore",
  "fetch(\"/api/scans\""
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(file), `${file} is missing`);
}

const html = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("app.js", "utf8");

for (const hook of requiredHtmlHooks) {
  assert(html.includes(hook), `Missing HTML hook: ${hook}`);
}

for (const hook of requiredJsHooks) {
  assert(js.includes(hook), `Missing JS hook: ${hook}`);
}

const findingCount = (js.match(/category:/g) || []).length;
assert(findingCount >= 7, `Expected at least 7 demo findings, found ${findingCount}`);

console.log("Demo verification passed");
