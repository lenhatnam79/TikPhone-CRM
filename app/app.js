"use strict";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  v == null || v === ""
    ? "Chưa có"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(v);
const day = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
let token = sessionStorage.getItem("ad-token") || "",
  state = null,
  view = "overview",
  filter = "",
  stageFilter = "",
  editing = null,
  setup = false,
  draftMode = "template",
  toastTimer;
const titles = {
  overview: [
    "Tổng quan",
    "BỨC TRANH HÔM NAY",
    "Tập trung vào những cơ hội cần bạn hôm nay.",
  ],
  deals: [
    "Cơ hội hợp tác",
    "TỪ TRAO ĐỔI ĐẾN HỢP TÁC",
    "Theo dõi từng bước, từ lần liên hệ đầu tiên đến nội dung đã đăng.",
  ],
  brands: [
    "Nhãn hàng",
    "MỐI QUAN HỆ CỦA BẠN",
    "Thông tin và người phụ trách, luôn ở cùng một nơi.",
  ],
  products: [
    "Sản phẩm",
    "KHO SẢN PHẨM",
    "Lưu sản phẩm đáng chú ý cùng nguồn và thời điểm ghi nhận.",
  ],
  drafts: [
    "Trợ lý soạn nháp",
    "VIẾT NHANH, VẪN LÀ BẠN",
    "Chuẩn bị lời nhắn phù hợp trước khi trao đổi trên TikTok.",
  ],
  devices: [
    "Thiết bị Android",
    "KẾT NỐI KHÔNG GIAN LÀM VIỆC",
    "Điều khiển TikTok trên điện thoại thật bằng máy tính.",
  ],
  team: [
    "Đội ngũ",
    "CÙNG NHAU VẬN HÀNH",
    "Phân công rõ ràng, cập nhật trên một workspace.",
  ],
};
function toast(msg, error = false) {
  clearTimeout(toastTimer);
  $("#toast").textContent = msg;
  $("#toast").className = error ? "error" : "";
  $("#toast").style.display = "block";
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5000);
}
async function api(path, method = "GET", data) {
  const res = await fetch("/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("Không đọc được phản hồi server.");
  }
  if (!res.ok) {
    if (res.status === 401 && path !== "login") {
      token = "";
      sessionStorage.removeItem("ad-token");
      showAuth();
    }
    throw new Error(body.error || "Không thực hiện được yêu cầu.");
  }
  return body;
}
function brandName(id) {
  return state.brands.find((x) => x.id === id)?.name || "Chưa liên kết";
}
function productName(id) {
  return state.products.find((x) => x.id === id)?.name || "Chưa liên kết";
}
function ownerName(id) {
  return state.users.find((x) => x.id === id)?.name || "Chưa phân công";
}
function pill(text) {
  return `<span class="pill ${["Thương lượng", "Nhận mẫu"].includes(text) ? "amber" : text === "Tạm dừng" ? "gray" : ""}">${esc(text)}</span>`;
}
function empty(title, desc, kind) {
  return `<div class="empty"><div class="empty-icon">◇</div><h3>${esc(title)}</h3><p>${esc(desc)}</p>${kind ? `<button class="primary" data-new="${kind}">＋ Thêm đầu tiên</button>` : ""}</div>`;
}
function matches(x) {
  return (
    JSON.stringify(x)
      .toLocaleLowerCase("vi")
      .includes(filter.toLocaleLowerCase("vi")) ||
    brandName(x.brand_id)
      .toLocaleLowerCase("vi")
      .includes(filter.toLocaleLowerCase("vi"))
  );
}
function dueDeals() {
  return state.deals
    .filter(
      (d) =>
        d.follow_up &&
        d.follow_up <= day() &&
        !["Đã đăng", "Tạm dừng"].includes(d.stage),
    )
    .sort((a, b) => a.follow_up.localeCompare(b.follow_up));
}
async function load(render = true) {
  state = await api("workspace");
  $("#sync-status").textContent =
    "Đã cập nhật " +
    new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (render) renderView();
}
async function enter() {
  await load(false);
  $("#auth").hidden = true;
  $("#shell").hidden = false;
  $("#user-name").textContent = state.user.name;
  $("#avatar").textContent = state.user.name.slice(0, 1).toUpperCase();
  $("#user-role").textContent =
    state.user.role === "admin" ? "Quản trị viên" : "Thành viên";
  view = titles[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
  renderView();
}
async function showAuth() {
  state = null;
  $("#shell").hidden = true;
  $("#auth").hidden = false;
  try {
    setup = !(await api("status")).initialized;
  } catch (e) {
    $("#auth-error").textContent = e.message;
    return;
  }
  document.body.classList.toggle("is-setup", setup);
  $("#auth-title").textContent = setup
    ? "Tạo workspace đầu tiên"
    : "Chào bạn trở lại";
  $("#auth-desc").textContent = setup
    ? "Dùng mã được cung cấp khi mở workspace để tạo tài khoản quản trị."
    : "Đăng nhập để tiếp tục công việc.";
  $("#auth-submit").textContent = setup ? "Tạo workspace →" : "Đăng nhập →";
  $("#login-form [name=password]").autocomplete = setup
    ? "new-password"
    : "current-password";
}
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#auth-error").textContent = "";
  const data = Object.fromEntries(new FormData(e.target));
  $("#auth-submit").disabled = true;
  try {
    if (setup) await api("setup", "POST", data);
    const result = await api("login", "POST", data);
    token = result.token;
    sessionStorage.setItem("ad-token", token);
    e.target.reset();
    await enter();
  } catch (err) {
    $("#auth-error").textContent = err.message;
  } finally {
    $("#auth-submit").disabled = false;
  }
});
$("#logout").onclick = async () => {
  try {
    await api("logout", "POST", {});
  } catch {}
  token = "";
  sessionStorage.removeItem("ad-token");
  showAuth();
};
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => navigate(b.dataset.view)));
function navigate(next) {
  view = next;
  filter = "";
  stageFilter = "";
  location.hash = next;
  renderView();
}
window.addEventListener("hashchange", () => {
  if (
    state &&
    titles[location.hash.slice(1)] &&
    view !== location.hash.slice(1)
  ) {
    view = location.hash.slice(1);
    filter = "";
    stageFilter = "";
    renderView();
  }
});
$("#refresh").onclick = async () => {
  try {
    await load();
    toast("Đã tải dữ liệu mới nhất.");
  } catch (e) {
    toast(e.message, true);
  }
};
$("#add-main").onclick = () => {
  if (view === "devices") loadDevices();
  else if (view === "team") openEditor("users");
  else
    openEditor(["brands", "products", "deals"].includes(view) ? view : "deals");
};
function renderView() {
  const info = titles[view];
  $("#breadcrumb").textContent = info[0];
  $("#page-title").textContent = info[0];
  $("#page-eyebrow").textContent = info[1];
  $("#page-desc").textContent = info[2];
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const add = $("#add-main");
  add.hidden =
    view === "drafts" || (view === "team" && state.user.role !== "admin");
  add.textContent =
    {
      brands: "＋ Thêm nhãn hàng",
      products: "＋ Lưu sản phẩm",
      team: "＋ Thêm nhân sự",
      devices: "↻ Kiểm tra kết nối",
    }[view] || "＋ Tạo cơ hội";
  ({
    overview: renderOverview,
    deals: renderDeals,
    brands: renderBrands,
    products: renderProducts,
    drafts: renderDrafts,
    devices: renderDevices,
    team: renderTeam,
  })[view]();
}
function renderOverview() {
  const due = dueDeals(),
    active = state.deals.filter(
      (d) => !["Đã đăng", "Tạm dừng"].includes(d.stage),
    );
  $("#content").innerHTML =
    `<div class="metrics"><div class="metric"><span>Nhãn hàng đã lưu</span><strong>${state.brands.length}</strong><small>Mạng lưới hợp tác của đội ngũ</small></div><div class="metric"><span>Cơ hội đang xử lý</span><strong>${active.length}</strong><small>Đang liên hệ và triển khai</small></div><div class="metric highlight"><span>Cần follow-up</span><strong>${due.length}</strong><small>Đến hạn hôm nay hoặc quá hạn</small></div><div class="metric"><span>Sản phẩm theo dõi</span><strong>${state.products.length}</strong><small>Dữ liệu do đội ngũ ghi nhận</small></div></div><div class="columns"><div><section class="panel"><div class="panel-head"><h3>Ưu tiên hôm nay</h3><button data-go="deals">Xem cơ hội ↗</button></div>${
      due.length
        ? due
            .slice(0, 8)
            .map(
              (d) =>
                `<div class="task"><span>↗</span><div><strong>${esc(d.name)}</strong><small>${esc(brandName(d.brand_id))} · ${esc(ownerName(d.owner_id))} · ${esc(d.follow_up)}</small></div><button data-edit="deals" data-id="${d.id}">Cập nhật</button></div>`,
            )
            .join("")
        : empty(
            "Một ngày làm việc rõ ràng",
            "Tạo cơ hội và đặt ngày follow-up. Những việc đến hạn sẽ xuất hiện ở đây.",
            "deals",
          )
    }</section><section class="panel"><div class="panel-head"><h3>Hoạt động gần đây</h3><small>THEO THỜI ĐIỂM CẬP NHẬT</small></div>${
      state.deals.length
        ? state.deals
            .slice(0, 5)
            .map(
              (d) =>
                `<div class="task"><span>◎</span><div><strong>${esc(d.name)}</strong><small>${esc(brandName(d.brand_id))} · ${esc(d.creator || "Chưa chọn creator")}</small></div>${pill(d.stage)}</div>`,
            )
            .join("")
        : empty(
            "Chưa có hoạt động",
            "Mỗi cập nhật hợp tác sẽ được lưu trong workspace.",
          )
    }</section></div><div><section class="panel"><div class="panel-head"><h3>Pipeline hợp tác</h3><small>${state.deals.length} CƠ HỘI</small></div>${state.stages
      .map((s) => {
        const n = state.deals.filter((d) => d.stage === s).length;
        return `<div class="stage-row"><span>${esc(s)}</span><div class="track"><div class="bar" style="width:${state.deals.length ? (n / state.deals.length) * 100 : 0}%"></div></div><strong>${n}</strong></div>`;
      })
      .join(
        "",
      )}</section><section class="panel"><div class="panel-head"><h3>Góc làm việc</h3><span class="pill">MVP</span></div><div class="checklist"><div><b>01 · Kết nối Android</b><br>Mở TikTok và trao đổi bằng bàn phím máy tính.</div><div><b>02 · Lưu cơ hội</b><br>Gắn brand, sản phẩm và người phụ trách.</div><div><b>03 · Chuẩn bị lời nhắn</b><br>Soạn nháp, kiểm tra và gửi trên TikTok.</div></div></section></div></div>`;
  bindActions();
}
function toolbar(stages = false) {
  return `<div class="toolbar"><input id="search" type="search" placeholder="Tìm theo tên, ghi chú, brand…" value="${esc(filter)}" aria-label="Tìm kiếm">${stages ? `<select id="stage-filter" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${state.stages.map((s) => `<option ${stageFilter === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>` : ""}</div>`;
}
function bindSearch(render) {
  $("#search").oninput = (e) => {
    filter = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const next = $("#search");
    next.focus();
    next.setSelectionRange(pos, pos);
  };
  if ($("#stage-filter"))
    $("#stage-filter").onchange = (e) => {
      stageFilter = e.target.value;
      render();
    };
}
function renderDeals() {
  const rows = state.deals
    .filter(matches)
    .filter((d) => !stageFilter || d.stage === stageFilter);
  $("#content").innerHTML =
    toolbar(true) +
    (rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>CƠ HỘI / NHÃN HÀNG</th><th>CREATOR</th><th>TRẠNG THÁI</th><th>FOLLOW-UP</th><th>PHỤ TRÁCH</th><th></th></tr></thead><tbody>${rows.map((d) => `<tr><td><strong>${esc(d.name)}</strong><small>${esc(brandName(d.brand_id))} · ${esc(productName(d.product_id))}</small></td><td>${esc(d.creator || "—")}</td><td>${pill(d.stage)}</td><td>${d.follow_up ? `<span class="${d.follow_up <= day() && !["Đã đăng", "Tạm dừng"].includes(d.stage) ? "pill amber" : ""}">${esc(d.follow_up)}</span>` : "—"}</td><td>${esc(ownerName(d.owner_id))}</td><td><button data-edit="deals" data-id="${d.id}">Chi tiết ↗</button></td></tr>`).join("")}</tbody></table></div>`
      : empty(
          filter || stageFilter
            ? "Không tìm thấy cơ hội"
            : "Bắt đầu một cơ hội mới",
          "Gắn nhãn hàng, sản phẩm và ngày follow-up để đội ngũ cùng theo dõi.",
          "deals",
        ));
  bindSearch(renderDeals);
  bindActions();
}
function renderBrands() {
  const rows = state.brands.filter(matches);
  $("#content").innerHTML =
    toolbar() +
    (rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>NHÃN HÀNG</th><th>LIÊN HỆ</th><th>PHỤ TRÁCH</th><th>CƠ HỘI</th><th></th></tr></thead><tbody>${rows.map((b) => `<tr><td><strong>${esc(b.name)}</strong><small>${esc((b.notes || "").slice(0, 70))}</small></td><td>${esc(b.contact || "Chưa có")}</td><td>${esc(ownerName(b.owner_id))}</td><td>${state.deals.filter((d) => d.brand_id === b.id).length}</td><td><button data-edit="brands" data-id="${b.id}">Chi tiết ↗</button></td></tr>`).join("")}</tbody></table></div>`
      : empty(
          "Chưa có nhãn hàng phù hợp",
          "Lưu thông tin nhãn hàng để bắt đầu xây dựng mạng lưới hợp tác.",
          "brands",
        ));
  bindSearch(renderBrands);
  bindActions();
}
function renderProducts() {
  const rows = state.products.filter(matches);
  $("#content").innerHTML =
    `<div class="notice green">Kho dữ liệu do đội ngũ nhập và kiểm chứng. Chưa kết nối dữ liệu toàn sàn hoặc tự động xác định sản phẩm win.</div>` +
    toolbar() +
    (rows.length
      ? `<div class="cards">${rows.map((p) => `<article class="product"><div class="product-top"><span class="glyph">◇</span><span class="pill gray">${esc(p.category || "Chưa phân loại")}</span></div><h3>${esc(p.name)}</h3><p>${esc(brandName(p.brand_id))}</p><div class="product-details"><div><small>GIÁ GHI NHẬN</small><strong>${esc(money(p.price))}</strong></div><div><small>HOA HỒNG</small><strong>${p.commission == null ? "Chưa có" : esc(p.commission) + "%"}</strong></div></div><div class="product-bottom"><span>${esc(p.observed_at || "Chưa ghi ngày")} · ${esc((p.source || "Chưa có nguồn").slice(0, 25))}</span><button data-edit="products" data-id="${p.id}">Chi tiết ↗</button></div></article>`).join("")}</div>`
      : empty(
          "Lưu sản phẩm đáng chú ý",
          "Thêm link, giá, hoa hồng và nguồn dữ liệu. Các thông tin thiếu được giữ nguyên là chưa có.",
          "products",
        ));
  bindSearch(renderProducts);
  bindActions();
}
function options(items, value = "", label = "Chưa chọn") {
  return (
    `<option value="">${esc(label)}</option>` +
    items
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${x.id === value ? "selected" : ""}>${esc(x.name)}</option>`,
      )
      .join("")
  );
}
function renderDrafts() {
  $("#content").innerHTML =
    `<div class="columns"><section class="panel"><div class="panel-head"><h3>Ngữ cảnh lời nhắn</h3><span class="pill ${state.ai_ready ? "" : "gray"}">${state.ai_ready ? "AI sẵn sàng" : "Chưa cấu hình AI"}</span></div><form id="draft-form"><div class="form-grid"><label>Nhãn hàng<select name="brand_id">${options(state.brands)}</select></label><label>Sản phẩm<select name="product_id">${options(state.products)}</select></label><label>Creator / agency<input name="creator" placeholder="Tên đại diện của bạn" value="${esc(state.user.name)}"></label><label>Mục đích<select name="kind"><option>Xin mẫu</option><option>Thương lượng</option><option>Follow-up</option><option>Báo lịch đăng</option></select></label><label class="full">Thông tin thêm cho AI<textarea name="brief" placeholder="Điều muốn trao đổi, giọng văn, yêu cầu cụ thể…" maxlength="4000"></textarea><small>Khi dùng AI, tên brand, thông tin sản phẩm đã chọn, tên đại diện và nội dung này được gửi tới OpenAI để tạo bản nháp.</small></label></div><div class="draft-tools"><button type="submit" name="mode" value="template">Dùng mẫu có sẵn</button><button class="primary" type="submit" name="mode" value="ai" ${state.ai_ready ? "" : "disabled"}>✧ Soạn bằng AI</button></div></form></section><section class="panel"><div class="panel-head"><h3>Bản nháp của bạn</h3><span id="draft-mode" class="pill gray">Chưa tạo</span></div><label for="draft-output" class="muted">Kiểm tra và chỉnh sửa trước khi dùng</label><textarea id="draft-output" placeholder="Nội dung bản nháp sẽ xuất hiện tại đây…"></textarea><div class="draft-tools"><button id="copy-draft">Sao chép</button><button class="primary" id="save-draft">Lưu bản nháp →</button></div><p class="muted" style="font-size:11px;line-height:1.8;margin:20px 0 0">App không tự gửi tin. Mở Android để dán bản nháp vào đúng cuộc trò chuyện.</p></section></div><section class="panel"><div class="panel-head"><h3>Bản nháp đã lưu</h3><small>${state.drafts.length} BẢN NHÁP</small></div>${state.drafts.length ? state.drafts.map((d) => `<div class="task"><span>✎</span><div><strong>${esc(d.name)}</strong><small>${esc((d.body || "").slice(0, 110))}</small></div><span class="pill gray">${d.mode === "ai" ? "AI" : "Mẫu"}</span><button data-edit="drafts" data-id="${d.id}">Mở</button></div>`).join("") : empty("Chưa có bản nháp", "Lưu những lời nhắn hữu ích để đội ngũ dùng lại.")}</section>`;
  $("#draft-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.mode = e.submitter?.value || "template";
    const buttons = e.target.querySelectorAll("button");
    buttons.forEach((b) => (b.disabled = true));
    try {
      const result = await api("draft", "POST", data);
      $("#draft-output").value = result.body;
      draftMode = result.mode;
      $("#draft-mode").textContent =
        result.mode === "ai" ? "AI tạo" : "Mẫu có sẵn";
    } catch (err) {
      toast(err.message, true);
    } finally {
      buttons.forEach(
        (b) => (b.disabled = b.value === "ai" && !state.ai_ready),
      );
    }
  };
  $("#copy-draft").onclick = async () => {
    if (!$("#draft-output").value.trim())
      return toast("Hãy tạo bản nháp trước.", true);
    try {
      await navigator.clipboard.writeText($("#draft-output").value);
      toast("Đã sao chép. Kiểm tra đúng hội thoại trước khi dán.");
    } catch {
      toast(
        "Không truy cập được clipboard. Chọn nội dung và sao chép thủ công.",
        true,
      );
    }
  };
  $("#save-draft").onclick = async () => {
    const body = $("#draft-output").value.trim();
    if (!body) return toast("Chưa có nội dung để lưu.", true);
    const data = Object.fromEntries(new FormData($("#draft-form")));
    try {
      await api("drafts", "POST", {
        name: data.kind + " · " + brandName(data.brand_id),
        brand_id: data.brand_id,
        product_id: data.product_id,
        body,
        kind: data.kind,
        mode: draftMode,
      });
      await load(false);
      renderDrafts();
      toast("Đã lưu bản nháp.");
    } catch (e) {
      toast(e.message, true);
    }
  };
  bindActions();
}
function renderDevices() {
  $("#content").innerHTML =
    `<div class="columns"><section class="panel"><div class="panel-head"><h3>Thiết bị tại máy này</h3><span class="pill gray">USB / ANDROID</span></div><div id="device-list" aria-live="polite"><p class="muted">Đang kiểm tra kết nối…</p></div></section><section class="panel"><div class="panel-head"><h3>Kết nối lần đầu</h3></div><div class="checklist"><div><b>01 · Chuẩn bị công cụ</b><br>Cài Android Platform Tools và scrcpy từ nguồn chính thức; thêm vào PATH hoặc khai báo ADB_PATH, SCRCPY_PATH.</div><div><b>02 · Kết nối điện thoại</b><br>Bật Developer options → USB debugging. Cắm cáp có truyền dữ liệu và chấp nhận quyền trên điện thoại.</div><div><b>03 · Mở TikTok Shop</b><br>Bấm mở điều khiển, đăng nhập trên điện thoại và chọn hộp thư với brand.</div></div></section></div><div class="notice">Kết nối này mở cửa sổ điều khiển điện thoại thật. Tin nhắn vẫn ở TikTok; app chưa đồng bộ hộp thư và chưa tự gửi tin.</div>`;
  loadDevices();
}
async function loadDevices() {
  const el = $("#device-list");
  if (!el) return;
  el.textContent = "Đang kiểm tra kết nối…";
  try {
    const result = window.affiliateDesktop
      ? await window.affiliateDesktop.devices()
      : await api("devices");
    if (!el.isConnected) return;
    if (!result.adb || !result.scrcpy) {
      el.innerHTML = empty(
        "Cần cài công cụ kết nối",
        `ADB: ${result.adb ? "đã có" : "chưa có"} · scrcpy: ${result.scrcpy ? "đã có" : "chưa có"}. Cài công cụ rồi khởi động lại app.`,
      );
      return;
    }
    if (!result.devices.length) {
      el.innerHTML = empty(
        "Chưa thấy điện thoại",
        "Cắm Android qua USB, bật USB debugging và chấp nhận quyền trên điện thoại.",
      );
      return;
    }
    el.innerHTML = result.devices
      .map(
        (d) =>
          `<div class="device"><span>▯</span><div><strong>${esc(d.model.replaceAll("_", " "))}</strong><small>${esc(d.serial)} · ${esc(d.state === "device" ? "Sẵn sàng" : d.state === "unauthorized" ? "Chưa chấp nhận quyền USB" : d.state)}</small></div><button class="primary" data-device="${esc(d.serial)}" ${d.state === "device" ? "" : "disabled"}>${d.mirroring ? "Đã mở" : "Mở điều khiển ↗"}</button></div>`,
      )
      .join("");
    el.querySelectorAll("[data-device]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            if (window.affiliateDesktop)
              await window.affiliateDesktop.open(b.dataset.device);
            else await api("device/open", "POST", { serial: b.dataset.device });
            toast("Đã mở cửa sổ Android.");
            await loadDevices();
          } catch (e) {
            toast(e.message, true);
            b.disabled = false;
          }
        }),
    );
  } catch (e) {
    if (el.isConnected) el.innerHTML = empty("Chưa thể kết nối", e.message);
  }
}
function renderTeam() {
  $("#content").innerHTML =
    `<div class="notice green">Đây là workspace của một agency. Quản trị viên thêm nhân sự; thành viên có thể xem và cập nhật CRM chung. Mỗi người đăng nhập bằng tài khoản riêng.</div><div class="panel-head"><h3>Thành viên workspace</h3><button id="change-password">Đổi mật khẩu của tôi</button></div><div class="table-wrap"><table><thead><tr><th>THÀNH VIÊN</th><th>EMAIL</th><th>QUYỀN</th><th>CƠ HỘI PHỤ TRÁCH</th></tr></thead><tbody>${state.users.map((u) => `<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${pill(u.role === "admin" ? "Quản trị viên" : "Thành viên")}</td><td>${state.deals.filter((d) => d.owner_id === u.id).length}</td></tr>`).join("")}</tbody></table></div>${state.user.role === "admin" ? '<section class="panel" style="margin-top:24px"><div class="panel-head"><h3>Nhật ký thay đổi</h3><button id="load-audit">Xem 100 hoạt động gần nhất ↗</button></div><div id="audit-list" class="muted">Các thao tác tạo, sửa và xoá được ghi nhận theo tài khoản.</div></section>' : ""}`;
  $("#change-password").onclick = () => openEditor("password");
  if ($("#load-audit"))
    $("#load-audit").onclick = async () => {
      try {
        const rows = await api("audit");
        $("#audit-list").innerHTML =
          rows
            .map(
              (r) =>
                `<div class="task"><div><strong>${esc(ownerName(r.user_id))} · ${esc(r.action)}</strong><small>${esc(new Date(r.created_at).toLocaleString("vi-VN"))} · ${esc(r.record_id)}</small></div></div>`,
            )
            .join("") || "Chưa có hoạt động.";
      } catch (e) {
        toast(e.message, true);
      }
    };
}
const definitions = {
  brands: [
    ["name", "Tên nhãn hàng", "text", true],
    ["contact", "Thông tin liên hệ", "text"],
    ["url", "Link shop / website", "url"],
    ["owner_id", "Người phụ trách", "users"],
    ["notes", "Ghi chú", "textarea"],
  ],
  products: [
    ["name", "Tên sản phẩm", "text", true],
    ["brand_id", "Nhãn hàng", "brands"],
    ["url", "Link sản phẩm", "url"],
    ["category", "Ngành hàng", "text"],
    ["price", "Giá ghi nhận (VND)", "number"],
    ["commission", "Hoa hồng (%)", "number"],
    ["source", "Nguồn dữ liệu", "text"],
    ["observed_at", "Ngày ghi nhận", "date"],
    ["notes", "Ghi chú", "textarea"],
  ],
  deals: [
    ["name", "Tên cơ hội", "text", true],
    ["brand_id", "Nhãn hàng", "brands"],
    ["product_id", "Sản phẩm", "products"],
    ["owner_id", "Người phụ trách", "users"],
    ["creator", "Creator / tài khoản TikTok", "text"],
    ["stage", "Trạng thái", "stages", true],
    ["follow_up", "Ngày follow-up", "date"],
    ["notes", "Ghi chú trao đổi", "textarea"],
  ],
  drafts: [
    ["name", "Tên bản nháp", "text", true],
    ["brand_id", "Nhãn hàng", "brands"],
    ["product_id", "Sản phẩm", "products"],
    ["body", "Nội dung", "textarea", true],
  ],
  password: [
    ["current_password", "Mật khẩu hiện tại", "password", true],
    ["new_password", "Mật khẩu mới (ít nhất 12 ký tự)", "password", true],
  ],
  users: [
    ["name", "Họ tên", "text", true],
    ["email", "Email", "email", true],
    ["password", "Mật khẩu ban đầu (ít nhất 12 ký tự)", "password", true],
    ["role", "Quyền", "roles", true],
  ],
};
function bindActions() {
  document
    .querySelectorAll("[data-new]")
    .forEach((b) => (b.onclick = () => openEditor(b.dataset.new)));
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) => (b.onclick = () => openEditor(b.dataset.edit, b.dataset.id)),
    );
  document
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.go)));
}
function openEditor(kind, id) {
  const record = id ? state[kind].find((x) => x.id === id) : {};
  editing = { kind, id, record };
  $("#editor-title").textContent =
    (id ? "Cập nhật " : "Thêm ") +
    {
      brands: "nhãn hàng",
      products: "sản phẩm",
      deals: "cơ hội",
      drafts: "bản nháp",
      users: "nhân sự",
      password: "mật khẩu",
    }[kind];
  if (kind === "password") $("#editor-title").textContent = "Đổi mật khẩu";
  $("#edit-error").textContent = "";
  $("#delete-record").hidden = !id;
  $("#editor-fields").innerHTML = definitions[kind]
    .map(([key, label, type, required]) => {
      const value =
        record[key] ??
        (key === "stage"
          ? "Chưa liên hệ"
          : key === "role"
            ? "member"
            : key === "observed_at"
              ? day()
              : "");
      let control;
      if (["brands", "products", "users"].includes(type))
        control = `<select name="${key}">${options(state[type], value)}</select>`;
      else if (type === "stages" || type === "roles") {
        const choices = type === "stages" ? state.stages : ["member", "admin"];
        control = `<select name="${key}">${choices.map((s) => `<option value="${esc(s)}" ${s === value ? "selected" : ""}>${esc(s === "admin" ? "Quản trị viên" : s === "member" ? "Thành viên" : s)}</option>`).join("")}</select>`;
      } else if (type === "textarea")
        control = `<textarea name="${key}" ${required ? "required" : ""} maxlength="12000">${esc(value)}</textarea>`;
      else
        control = `<input name="${key}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? `min="0" step="any" ${key === "commission" ? 'max="100"' : ""}` : ""} ${type === "password" ? 'minlength="12" maxlength="256" autocomplete="new-password"' : ""} ${type === "text" ? 'maxlength="500"' : ""}>`;
      return `<label class="${type === "textarea" ? "full" : ""}">${esc(label)}${required ? " *" : ""}${control}</label>`;
    })
    .join("");
  if (kind === "brands" && record.url) {
    const a = document.createElement("a");
    a.href = record.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Mở link nhãn hàng ↗";
    if (["http:", "https:"].includes(a.protocol))
      $("#editor-fields").appendChild(a);
  }
  if (kind === "products" && record.url) {
    const a = document.createElement("a");
    a.href = record.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Mở sản phẩm ↗";
    if (["http:", "https:"].includes(a.protocol))
      $("#editor-fields").appendChild(a);
  }
  $("#editor").showModal();
}
$("#close-editor").onclick = () => $("#editor").close();
$("#edit-form").onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const { kind, id, record } = editing;
  if (id) data.version = record.version;
  if (kind === "password") {
    const submit = e.target.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      await api("password", "POST", data);
      $("#editor").close();
      token = "";
      sessionStorage.removeItem("ad-token");
      await showAuth();
      toast("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
    } catch (err) {
      $("#edit-error").textContent = err.message;
    } finally {
      submit.disabled = false;
    }
    return;
  }
  if (kind === "drafts") {
    data.mode = record.mode || "template";
    data.kind = record.kind || "Xin mẫu";
  }
  const submit = e.target.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    await api(kind + (id ? "/" + id : ""), id ? "PUT" : "POST", data);
    $("#editor").close();
    await load();
    toast("Đã lưu vào workspace.");
  } catch (err) {
    $("#edit-error").textContent = err.message;
  } finally {
    submit.disabled = false;
  }
};
$("#delete-record").onclick = async () => {
  const { kind, id, record } = editing;
  if (!confirm("Xoá bản ghi này khỏi workspace?")) return;
  try {
    await api(kind + "/" + id, "DELETE", { version: record.version });
    $("#editor").close();
    await load();
    toast("Đã xoá bản ghi.");
  } catch (e) {
    $("#edit-error").textContent = e.message;
  }
};
(async () => {
  if (token) {
    try {
      await enter();
      return;
    } catch {
      token = "";
      sessionStorage.removeItem("ad-token");
    }
  }
  await showAuth();
})();
