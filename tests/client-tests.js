const assert = require("node:assert/strict");

class ClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) {
        this.values.delete(name);
        return false;
      }
      this.values.add(name);
      return true;
    }
    if (force) {
      this.values.add(name);
      return true;
    }
    this.values.delete(name);
    return false;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class Element {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.classList = new ClassList();
    this.listeners = {};
    this.value = "";
    this.disabled = false;
    this._text = "";
  }

  get className() {
    return [...this.classList.values].join(" ");
  }

  set className(value) {
    this.classList = new ClassList();
    String(value)
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => this.classList.add(name));
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  scrollIntoView() {}

  querySelectorAll(selector) {
    const matches = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (selector === "[data-copy-prompt]" && child.dataset.copyPrompt !== undefined) {
          matches.push(child);
        }
        walk(child);
      });
    };
    walk(this);
    return matches;
  }
}

const elements = new Map();
const getElementById = (id) => {
  if (!elements.has(id)) {
    const element = new Element("div");
    element.id = id;
    elements.set(id, element);
  }
  return elements.get(id);
};

const filterButtons = ["all", "high", "ugc", "image_upload", "ai_chat"].map((filter) => {
  const button = new Element("button");
  button.dataset.filter = filter;
  if (filter === "all") button.classList.add("active");
  return button;
});

global.window = {
  location: {
    protocol: "http:",
    origin: "http://127.0.0.1:4173"
  }
};
global.document = {
  body: new Element("body"),
  getElementById,
  createElement: (tag) => new Element(tag),
  querySelectorAll: (selector) => (selector === ".filter" ? filterButtons : [])
};

const client = require("../client.js");

function collectTags(node, tags = []) {
  node.children.forEach((child) => {
    tags.push(child.tagName);
    collectTags(child, tags);
  });
  return tags;
}

function finding(overrides) {
  return {
    id: "finding-id",
    category: "ugc",
    severity: "high",
    confidence: "likely",
    title: "标题",
    summary: "摘要",
    evidence: ["证据"],
    recommendation: "建议",
    prompt: "Prompt",
    ...overrides
  };
}

function findingArticles() {
  return getElementById("findingsList").children.filter((child) => child.className.split(" ").includes("finding"));
}

function testHostileReportIsRenderedAsText() {
  const hostileId = 'x" onmouseover="alert(1)';
  client.setActiveFilter("all");
  client.completeReport({
    targetUrl: "https://example.com",
    launchRecommendation: "公开发布前请先修复高风险问题",
    findings: [
      finding({
        id: hostileId,
        category: "</h3><script>alert(2)</script>",
        title: "<img src=x onerror=alert(3)>",
        summary: "<svg onload=alert(4)>",
        evidence: ["<script>alert(5)</script>"],
        recommendation: "<iframe src=javascript:alert(6)>",
        prompt: "<img src=x onerror=alert(7)>"
      })
    ]
  });

  const findingsList = getElementById("findingsList");
  const tags = collectTags(findingsList);
  assert(!tags.includes("IMG"), "report must not create an img element from finding data");
  assert(!tags.includes("SCRIPT"), "report must not create a script element from finding data");
  assert(!tags.includes("SVG"), "report must not create an svg element from finding data");
  assert(!tags.includes("IFRAME"), "report must not create an iframe element from finding data");
  assert(findingsList.textContent.includes("<img src=x onerror=alert(3)>"));

  const copyButton = findingsList.querySelectorAll("[data-copy-prompt]")[0];
  assert.equal(copyButton.dataset.copyPrompt, hostileId);
  assert.equal(getElementById("reportTitle").textContent, "公开发布前请先修复高风险问题");
}

function testActiveFilterIsKeptAfterRescan() {
  client.setActiveFilter("all");
  const report = {
    targetUrl: "https://example.com",
    launchRecommendation: "复核风险项后，可以先小范围分享",
    findings: [
      finding({ id: "high-finding", severity: "high" }),
      finding({ id: "low-finding", severity: "low" })
    ]
  };

  client.completeReport(report);
  assert.equal(findingArticles().length, 2);

  client.setActiveFilter("high");
  assert.equal(findingArticles().length, 1);

  client.completeReport(report);
  const articles = findingArticles();
  assert.equal(articles.length, 1, "rescan must keep the active filter");
  assert.equal(articles[0].dataset.severity, "high");
  assert.equal(getElementById("reportTitle").textContent, "复核风险项后，可以先小范围分享");
}

async function testPollScanTimesOut() {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ status: "queued" }) });
  try {
    await assert.rejects(client.pollScan("scan_1", { intervalMs: 1, maxAttempts: 3 }), /扫描超时/);
  } finally {
    global.fetch = originalFetch;
  }
}

async function testPollScanRejectsUnknownStatus() {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ status: "cancelled" }) });
  try {
    await assert.rejects(client.pollScan("scan_1", { intervalMs: 1, maxAttempts: 3 }), /扫描状态异常/);
  } finally {
    global.fetch = originalFetch;
  }
}

async function testPollScanReturnsCompleted() {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ status: "completed", report: {} }) });
  try {
    const body = await client.pollScan("scan_1", { intervalMs: 1, maxAttempts: 3 });
    assert.equal(body.status, "completed");
  } finally {
    global.fetch = originalFetch;
  }
}

Promise.resolve()
  .then(testHostileReportIsRenderedAsText)
  .then(testActiveFilterIsKeptAfterRescan)
  .then(testPollScanTimesOut)
  .then(testPollScanRejectsUnknownStatus)
  .then(testPollScanReturnsCompleted)
  .then(() => console.log("Client tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
