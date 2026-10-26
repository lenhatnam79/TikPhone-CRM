const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
let server, browser, dir;
const resultsDir = path.resolve(__dirname, "../test-results");
fs.mkdirSync(resultsDir, { recursive: true });
(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "affiliate-e2e-"));
  server = spawn(
    process.env.AFFILIATE_PYTHON ||
      (process.platform === "win32" ? "python" : "python3"),
    [
      path.join(__dirname, "../app/server.py"),
      "--devices",
      "--port",
      "0",
      "--data",
      path.join(dir, "test.sqlite3"),
    ],
  );
  let output = "";
  server.stdout.on("data", (b) => (output += b));
  server.stderr.on("data", (b) => process.stderr.write(b));
  for (let i = 0; i < 100 && !output.includes("Mã thiết lập"); i++)
    await new Promise((r) => setTimeout(r, 100));
  const base = output.match(/Affiliate Desk: (http:\/\/[^\s]+)/)?.[1];
  const setupToken = output.match(/Mã thiết lập quản trị viên: (\S+)/)?.[1];
  if (!base || !setupToken)
    throw new Error("Test backend failed to start: " + output);
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : process.env.PLAYWRIGHT_CHROMIUM
        ? {}
        : { channel: "chrome" }),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("409 (Conflict)"))
      errors.push(m.text());
  });
  await page.goto(base);
  await page
    .locator("#auth-title")
    .filter({ hasText: "Tạo workspace" })
    .waitFor();
  await page.locator("[name=name]").fill("Agency Demo");
  await page.locator("[name=setup_token]").fill(setupToken);
  await page.locator("[name=email]").fill("demo@example.com");
  await page.locator("[name=password]").fill("demo-test-password");
  await page.locator("#auth-submit").click();
  await page.locator("#shell").waitFor({ state: "visible" });
  async function nav(view) {
    await page.locator(`[data-view=${view}]`).click();
  }
  async function add(fields) {
    await page.locator("#add-main").click();
    for (const [key, value] of Object.entries(fields)) {
      const input = page.locator(`#editor [name=${key}]`);
      if ((await input.evaluate((e) => e.tagName)) === "SELECT")
        await input.selectOption({ label: value });
      else await input.fill(value);
    }
    await page.locator("#editor button[type=submit]").click();
    await page.locator("#editor").waitFor({ state: "hidden" });
  }
  await nav("brands");
  await add({
    name: "Lá Mộc Studio",
    contact: "Brand Partnership",
    notes: "Dữ liệu minh hoạ dùng trong kiểm thử.",
    owner_id: "Agency Demo",
  });
  await page.getByText("Lá Mộc Studio", { exact: true }).first().waitFor();
  await nav("products");
  await add({
    name: "Bình giữ nhiệt Everyday",
    brand_id: "Lá Mộc Studio",
    category: "Đời sống",
    price: "299000",
    commission: "15",
    source: "Dữ liệu minh hoạ",
    url: "https://example.com/product",
  });
  await nav("deals");
  await add({
    name: "Everyday · Video trải nghiệm",
    brand_id: "Lá Mộc Studio",
    product_id: "Bình giữ nhiệt Everyday",
    owner_id: "Agency Demo",
    creator: "@creator_demo",
    stage: "Thương lượng",
    follow_up: "2026-01-01",
    notes: "Trao đổi chính sách nhận mẫu.",
  });
  await page.locator("[data-edit=deals]").click();
  await page
    .locator("#editor [name=notes]")
    .fill("Đã trao đổi. Chờ xác nhận mẫu.");
  await page.locator("#editor button[type=submit]").click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await page.locator("#search").fill("không có sản phẩm này");
  await page.getByText("Không tìm thấy cơ hội", { exact: true }).waitFor();
  await page.locator("#search").fill("Everyday");
  await page.locator("[data-edit=deals]").waitFor();
  await nav("drafts");
  await page
    .locator("#draft-form [name=brand_id]")
    .selectOption({ label: "Lá Mộc Studio" });
  await page
    .locator("#draft-form [name=product_id]")
    .selectOption({ label: "Bình giữ nhiệt Everyday" });
  await page.locator("button[value=template]").click();
  await page.waitForFunction(() =>
    document.querySelector("#draft-output").value.includes("Lá Mộc Studio"),
  );
  await page.locator("#save-draft").click();
  await page.locator("[data-edit=drafts]").waitFor();
  await nav("team");
  await add({
    name: "Linh Creator",
    email: "linh@example.com",
    password: "test-member-password",
    role: "Thành viên",
  });
  await page.getByText("Linh Creator", { exact: true }).waitFor();
  await nav("devices");
  await page
    .getByText(/^(Cần cài công cụ kết nối|Chưa thấy điện thoại)$/)
    .waitFor();
  await nav("overview");
  await page.locator("#toast").waitFor({ state: "hidden" });
  await page.screenshot({
    path: path.join(resultsDir, "preview.png"),
    fullPage: true,
  });
  await page.reload();
  await page.locator("#shell").waitFor({ state: "visible" });
  assert.equal(await page.locator(".metric strong").nth(0).textContent(), "1");
  await nav("products");
  await page.locator("[data-edit=products]").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("#delete-record").click();
  await page
    .locator("#edit-error")
    .filter({ hasText: "còn được liên kết" })
    .waitFor();
  await page.locator("#close-editor").click();
  await page.locator("#logout").click();
  await page.locator("#auth").waitFor({ state: "visible" });
  await page.locator("[name=email]").fill("linh@example.com");
  await page.locator("[name=password]").fill("test-member-password");
  await page.locator("#auth-submit").click();
  await page.locator("#shell").waitFor({ state: "visible" });
  await nav("team");
  assert.equal(await page.locator("#add-main").isVisible(), false);
  await page.setViewportSize({ width: 700, height: 950 });
  await nav("overview");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await browser.close();
  browser = null;
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "UI PASS: setup, login, brand/product/deal create+edit, search, templates, drafts, team, device missing state, persistence, delete protection, member permissions, responsive layout.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) {
      server.kill("SIGINT");
      await new Promise((r) => server.once("close", r));
    }
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });
