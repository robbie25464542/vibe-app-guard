# Vibe App Guard Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable static MVP demo that shows the Vibe App Guard URL scanning flow from URL submission to risk report, fix prompts, and rescan.

**Architecture:** A dependency-free static web app with focused `index.html`, `styles.css`, `app.js`, and a small Node verification script. The scanner is simulated with deterministic demo data so the product story can be shown before backend scanning exists.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js for verification.

---

### Task 1: Static App Shell

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create the app shell**

Create `index.html` with the main scan form, progress panel, report panel, and prompt drawer containers.

- [ ] **Step 2: Create the visual system**

Create `styles.css` with a compact security-tool layout, risk severity styling, responsive grid, stable controls, and report cards.

### Task 2: Demo Scanner Logic

**Files:**
- Create: `app.js`

- [ ] **Step 1: Add deterministic demo data**

Create findings for UGC, image upload, AI chat, OTP abuse, source maps, CSP, and Supabase storage.

- [ ] **Step 2: Add interactions**

Wire URL submission, progress simulation, report rendering, fix prompt copy, finding filters, and rescan.

### Task 3: Local Verification

**Files:**
- Create: `verify-demo.js`

- [ ] **Step 1: Add static checks**

Verify required files exist and key DOM hooks/functions are present.

- [ ] **Step 2: Run verification**

Run `node verify-demo.js` and ensure it passes.
