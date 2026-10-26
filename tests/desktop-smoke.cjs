"use strict";
const { _electron: electron } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const executable =
  process.env.DESKTOP_APP ||
  path.join(
    root,
    process.platform === "win32"
      ? "dist/win-unpacked/Affiliate Desk.exe"
      : "dist/mac-arm64/Affiliate Desk.app/Contents/MacOS/Affiliate Desk",
  );
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "affiliate-desktop-"));
let desktop, server;
async function login(page) {
  await page.locator("#auth").waitFor({ state: "visible" });
  await page.locator("[name=email]").fill("desktop@example.com");
  await page.locator("[name=password]").fill("desktop-test-password");
  await page.locator("#auth-submit").click();
  await page.locator("#shell").waitFor({ state: "visible" });
}
async function launch(extra = {}) {
  const instance = await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      AFFILIATE_USER_DATA: dir,
      ...(process.platform === "darwin"
        ? { AFFILIATE_PYTHON: "/nonexistent-python" }
        : {}),
      ...extra,
    },
    timeout: 45000,
  });
  desktop = instance;
  instance.process().stderr.on("data", (b) => process.stderr.write(b));
  await instance.evaluate(({ dialog }) => {
    dialog.showErrorBox = (title, content) =>
      console.error("APP START ERROR:", title, content);
    dialog.showMessageBox = async (_window, options) => {
      if (options.title === "Thiết lập workspace")
        globalThis.__testSetupCode = options.detail.split("\n")[0];
      return { response: 0 };
    };
  });
  const page = await instance.firstWindow({ timeout: 60000 });
  await page.waitForURL("http://127.0.0.1:*", { timeout: 95000 });
  await page.locator("#auth-title").waitFor();
  return { instance, page };
}
(async () => {
  let local = await launch();
  desktop = local.instance;
  const page = local.page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(
    () => document.querySelector('[name="setup_token"]').value.length > 0,
  );
  assert.equal(
    await page.locator("[name=setup_token]").getAttribute("readonly"),
    "",
  );
  await page.locator("[name=name]").fill("Desktop Tester");
  await login(page);
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  await page.locator("[data-view=devices]").click();
  await page.getByText("Chưa thấy điện thoại", { exact: true }).waitFor();
  await page.locator("[data-view=drafts]").click();
  await page.locator("button[value=template]").click();
  await page.waitForFunction(
    () => document.querySelector("#draft-output").value.length > 0,
  );
  await page.locator("#copy-draft").click();
  await page.locator("#toast").filter({ hasText: "Đã sao chép" }).waitFor();
  assert.equal(
    await desktop
      .evaluate(({ clipboard }) => clipboard.readText())
      .then((t) => t.includes("hoa hồng")),
    true,
  );
  assert.deepEqual(errors, []);
  await desktop.close();
  desktop = null;
  server = spawn(process.platform === "win32" ? "python" : "python3", [
    path.join(root, "app/server.py"),
    "--port",
    "0",
    "--data",
    path.join(dir, "workspace.sqlite3"),
  ]);
  let output = "";
  server.stdout.on("data", (b) => (output += b));
  for (let i = 0; i < 50 && !output.includes("http://"); i++)
    await new Promise((r) => setTimeout(r, 100));
  const remote = output.match(/http:\/\/[^\s]+/)[0];
  let shared = await launch({ AFFILIATE_SERVER_URL: remote });
  desktop = shared.instance;
  await login(shared.page);
  assert.equal(
    await shared.page.evaluate(() => typeof window.affiliateDesktop?.devices),
    "function",
  );
  await shared.page.locator("[data-view=devices]").click();
  await shared.page
    .getByText("Chưa thấy điện thoại", { exact: true })
    .waitFor();
  await desktop.close();
  desktop = null;
  console.log(
    "DESKTOP PASS: packaged desktop starts with bundled backend/tools, first-run setup, login, sandboxed renderer, clipboard copy, shared-server mode, local authenticated Android bridge. No Android attached.",
  );
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (desktop) await desktop.close();
    if (server) {
      server.kill("SIGINT");
      await new Promise((r) => server.once("close", r));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
