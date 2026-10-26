const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
} = require("electron");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");
const net = require("node:net");
let child, win, base, bridgeToken, allowedOrigin;
if (process.env.AFFILIATE_USER_DATA)
  app.setPath("userData", path.resolve(process.env.AFFILIATE_USER_DATA));
const root = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, "..");
let remote;
async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}
async function deviceRequest(route, data) {
  const res = await fetch(base + "/api/" + route, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + bridgeToken,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json;
}
function checkSender(event) {
  if (new URL(event.senderFrame.url).origin !== allowedOrigin)
    throw new Error("IPC origin denied");
}
app.whenReady().then(async () => {
  try {
    const configPath = path.join(app.getPath("userData"), "config.json");
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    if (!fs.existsSync(configPath))
      fs.writeFileSync(configPath, JSON.stringify({ server_url: "" }, null, 2));
    remote =
      process.env.AFFILIATE_SERVER_URL ||
      JSON.parse(fs.readFileSync(configPath, "utf8")).server_url;
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Affiliate Desk",
          submenu: [
            {
              label: "Mở cấu hình server CRM",
              click: () => shell.openPath(configPath),
            },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Chỉnh sửa",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "Hiển thị",
          submenu: [
            { role: "reload" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { role: "togglefullscreen" },
          ],
        },
      ]),
    );
    if (remote) {
      const u = new URL(remote);
      if (
        u.protocol !== "https:" &&
        !(
          u.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(u.hostname)
        )
      )
        throw new Error(
          "AFFILIATE_SERVER_URL phải dùng HTTPS (trừ localhost).",
        );
    }
    win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      backgroundColor: "#f6f7f9",
      title: "Affiliate Desk",
      webPreferences: {
        preload: remote ? path.join(__dirname, "preload.cjs") : undefined,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    await win.loadFile(path.join(__dirname, "loading.html"));
    const port = await freePort();
    base = "http://127.0.0.1:" + port;
    bridgeToken = crypto.randomBytes(32).toString("hex");
    const bundledBackend = path.join(root, "backend", "affiliate-backend");
    const hasBundledBackend =
      app.isPackaged &&
      process.platform === "darwin" &&
      fs.existsSync(bundledBackend);
    const args = [
      ...(hasBundledBackend ? [] : [path.join(root, "app", "server.py")]),
      "--port",
      String(port),
    ];
    if (remote) args.push("--bridge");
    else
      args.push(
        "--devices",
        "--data",
        path.join(app.getPath("userData"), "workspace.sqlite3"),
      );
    const bundledPython = path.join(root, "python", "python.exe");
    const python = hasBundledBackend
      ? bundledBackend
      : process.env.AFFILIATE_PYTHON ||
        (app.isPackaged && fs.existsSync(bundledPython)
          ? bundledPython
          : process.platform === "win32"
            ? "python"
            : "python3");
    const tools = path.join(root, "tools");
    const bundledTools =
      app.isPackaged &&
      fs.existsSync(
        path.join(tools, process.platform === "win32" ? "adb.exe" : "adb"),
      );
    child = spawn(python, args, {
      env: {
        ...process.env,
        ...(bundledTools
          ? {
              ADB_PATH:
                process.env.ADB_PATH ||
                path.join(
                  tools,
                  process.platform === "win32" ? "adb.exe" : "adb",
                ),
              SCRCPY_PATH:
                process.env.SCRCPY_PATH ||
                path.join(
                  tools,
                  process.platform === "win32" ? "scrcpy.exe" : "scrcpy",
                ),
              SCRCPY_SERVER_PATH:
                process.env.SCRCPY_SERVER_PATH ||
                path.join(tools, "scrcpy-server"),
            }
          : {}),
        AFFILIATE_BRIDGE_TOKEN: bridgeToken,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let setupCode = "";
    let stdout = "";
    let stderr = "";
    let startError;
    child.on("error", (err) => {
      startError = err;
    });
    child.stderr.on("data", (buf) => {
      stderr = (stderr + buf.toString()).slice(-2000);
    });
    child.stdout.on("data", (buf) => {
      stdout = (stdout + buf.toString()).slice(-4000);
      const match = stdout.match(/Mã thiết lập quản trị viên: (\S+)/);
      if (match) setupCode = match[1];
    });
    let ready = false;
    const readyDeadline = Date.now() + 90000;
    while (Date.now() < readyDeadline) {
      if (startError) throw startError;
      if (child.exitCode !== null)
        throw new Error("Backend không khởi chạy. " + stderr);
      try {
        const res = await fetch(
          base + (remote ? "/api/devices" : "/api/health"),
          {
            headers: remote ? { Authorization: "Bearer " + bridgeToken } : {},
            signal: AbortSignal.timeout(1000),
          },
        );
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ready)
      throw new Error(
        "Workspace khởi động quá lâu. Hãy đóng ứng dụng và mở lại.",
      );
    const target = remote || base;
    allowedOrigin = new URL(target).origin;
    // Device IPC is exposed only in shared-server mode. Local mode uses its authenticated HTTP API.
    ipcMain.handle("devices:list", (e) => {
      checkSender(e);
      if (!remote) throw new Error("Dùng kết nối cục bộ.");
      return deviceRequest("devices");
    });
    ipcMain.handle("devices:open", (e, serial) => {
      checkSender(e);
      if (!remote || typeof serial !== "string" || serial.length > 300)
        throw new Error("Thiết bị không hợp lệ.");
      return deviceRequest("device/open", { serial });
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      const u = new URL(url);
      if (["https:", "http:"].includes(u.protocol)) shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== allowedOrigin) event.preventDefault();
    });
    win.webContents.session.setPermissionRequestHandler(
      (_wc, permission, callback) =>
        callback(["clipboard-sanitized-write"].includes(permission)),
    );
    win.webContents.session.setPermissionCheckHandler((_wc, permission) =>
      ["clipboard-sanitized-write"].includes(permission),
    );
    await win.loadURL(target);
    if (setupCode && !remote) {
      await win.webContents.executeJavaScript(
        `(() => { const input = document.querySelector('[name="setup_token"]'); input.value = ${JSON.stringify(setupCode)}; input.readOnly = true; })()`,
      );
    }
  } catch (err) {
    dialog.showErrorBox(
      "Không mở được Affiliate Desk",
      err.message +
        (app.isPackaged
          ? ""
          : "\n\nCài Python 3.9+ hoặc đặt AFFILIATE_PYTHON tới file Python thực thi."),
    );
    app.quit();
  }
});
app.on("window-all-closed", () => app.quit());
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting || !child) return;
  event.preventDefault();
  quitting = true;
  (async () => {
    try {
      await fetch(base + "/internal/shutdown", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + bridgeToken,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(3000),
      });
    } catch {}
    if (child.exitCode === null) child.kill();
    app.quit();
  })();
});
