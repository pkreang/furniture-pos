// ===== DAILY REPORT GENERATOR =====
function generateDailyReportContent() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dateLabel = today.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // Today's data
  const todayReceipts = AppData.receipts.filter(r => r.date.startsWith(todayStr) && r.status === "active");
  const todayRefunds = AppData.receipts.filter(r => r.date.startsWith(todayStr) && r.status === "refunded");
  const totalRevenue = todayReceipts.reduce((s, r) => s + r.depositPaid, 0);
  const totalItems = todayReceipts.reduce((s, r) => s + r.items.reduce((s2, i) => s2 + i.qty, 0), 0);

  // By branch
  const branchData = AppData.branches.filter(b => !b.isWarehouse).map(b => {
    const recs = todayReceipts.filter(r => r.branchId === b.id);
    return {
      ...b,
      sales: recs.length,
      revenue: recs.reduce((s, r) => s + r.depositPaid, 0),
      items: recs.reduce((s, r) => s + r.items.reduce((s2, i) => s2 + i.qty, 0), 0),
      pct: b.target > 0 ? Math.round(recs.reduce((s, r) => s + r.depositPaid, 0) / b.target * 100) : 0,
    };
  });

  // Top products
  const productSales = {};
  todayReceipts.forEach(r => r.items.forEach(it => {
    if (!productSales[it.productId]) productSales[it.productId] = { name: it.name, qty: 0, revenue: 0 };
    productSales[it.productId].qty += it.qty;
    productSales[it.productId].revenue += it.price * it.qty;
  }));
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Stock alerts
  const lowStockItems = [];
  AppData.products.forEach(p => {
    AppData.branches.filter(b => !b.isWarehouse).forEach(b => {
      const s = p.stock[b.id] || 0;
      if (s <= p.minStock) lowStockItems.push({ product: p.name, branch: b.name, stock: s, min: p.minStock });
    });
  });

  // AI insight
  const insights = [];
  const platinumSales = todayReceipts.filter(r => {
    const c = r.customerId ? AppData.customers.find(c => c.id === r.customerId) : null;
    return c && getTierKey(c.totalSpent) === "platinum";
  });
  if (totalRevenue > 0) {
    insights.push(`ยอดขายวันนี้ ฿${formatCurrency(totalRevenue)} จาก ${todayReceipts.length} บิล (เฉลี่ย ฿${formatCurrency(Math.round(totalRevenue / Math.max(todayReceipts.length, 1)))}/บิล)`);
    if (branchData.length > 0) {
      const top = branchData.sort((a, b) => b.revenue - a.revenue)[0];
      insights.push(`สาขาที่ทำยอดสูงสุด: <b>${top.name}</b> ฿${formatCurrency(top.revenue)} (${top.pct}% ของเป้า)`);
    }
    if (platinumSales.length > 0) insights.push(`ลูกค้า Platinum ซื้อวันนี้ ${platinumSales.length} บิล — ดูแลเป็นพิเศษ`);
    if (lowStockItems.length > 5) insights.push(`⚠️ มีสินค้า <b>${lowStockItems.length} รายการ</b> สต็อกต่ำกว่าเกณฑ์ — ควรเติม`);
    if (todayRefunds.length > 0) insights.push(`มีการคืนสินค้า ${todayRefunds.length} ครั้ง รวม ฿${formatCurrency(todayRefunds.reduce((s, r) => s + r.total, 0))}`);
  } else {
    insights.push("ยังไม่มียอดขายวันนี้");
  }

  return { dateLabel, todayStr, todayReceipts, todayRefunds, totalRevenue, totalItems, branchData, topProducts, lowStockItems, insights };
}

function buildEmailHTML(report) {
  const branchRows = report.branchData.map(b => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px">
        <div style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${b.color};margin-right:6px"></div>
        ${b.name}
      </td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">฿${formatCurrency(b.revenue)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${b.sales}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${b.items}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">
        <div style="background:#f1f5f9;border-radius:4px;height:8px;width:80px"><div style="background:${b.color};height:100%;width:${Math.min(b.pct, 100)}%;border-radius:4px"></div></div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px">${b.pct}%</div>
      </td>
    </tr>`).join("");

  const topProductRows = report.topProducts.map((p, i) => `
    <tr>
      <td style="padding:6px 8px;font-size:13px"><b>${i+1}.</b> ${p.name}</td>
      <td style="padding:6px 8px;text-align:center;font-size:12px;color:#6b7280">${p.qty} ชิ้น</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700">฿${formatCurrency(p.revenue)}</td>
    </tr>`).join("");

  const stockRows = report.lowStockItems.slice(0, 10).map(s =>
    `<tr><td style="padding:6px 8px;font-size:12px">⚠️ ${s.product}</td><td style="padding:6px 8px;font-size:12px">${s.branch}</td><td style="padding:6px 8px;font-size:12px;color:#dc2626;font-weight:700">${s.stock} ชิ้น</td></tr>`
  ).join("");

  return `
    <div style="max-width:640px;margin:0 auto;font-family:sans-serif;background:#f8fafc">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;color:#fff;border-radius:12px 12px 0 0">
        <div style="font-size:22px;font-weight:800;margin-bottom:4px">🛋️ Furniture House POS</div>
        <div style="font-size:14px;opacity:0.9">รายงานสรุปยอดประจำวัน</div>
        <div style="font-size:13px;opacity:0.8;margin-top:4px">${report.dateLabel}</div>
      </div>

      <div style="background:#fff;padding:24px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
          <div style="background:#eef2ff;padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:11px;color:#6b7280">ยอดขายรวม</div>
            <div style="font-size:20px;font-weight:800;color:#6366f1;margin-top:4px">฿${formatCurrency(report.totalRevenue)}</div>
          </div>
          <div style="background:#f0fdf4;padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:11px;color:#6b7280">จำนวนบิล</div>
            <div style="font-size:20px;font-weight:800;color:#16a34a;margin-top:4px">${report.todayReceipts.length}</div>
          </div>
          <div style="background:#fef3c7;padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:11px;color:#6b7280">สินค้าขาย</div>
            <div style="font-size:20px;font-weight:800;color:#ca8a04;margin-top:4px">${report.totalItems}</div>
          </div>
        </div>

        <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:8px">📊 ยอดขายแยกตามสาขา</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280">สาขา</th>
            <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280">ยอดขาย</th>
            <th style="padding:8px;text-align:center;font-size:11px;color:#6b7280">บิล</th>
            <th style="padding:8px;text-align:center;font-size:11px;color:#6b7280">ชิ้น</th>
            <th style="padding:8px;font-size:11px;color:#6b7280">% เป้า</th>
          </tr></thead>
          <tbody>${branchRows || `<tr><td colspan="5" style="padding:14px;text-align:center;color:#9ca3af">— ยังไม่มียอดขายวันนี้ —</td></tr>`}</tbody>
        </table>

        ${report.topProducts.length > 0 ? `
        <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:8px">🏆 สินค้าขายดี Top 5</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;background:#f8fafc;border-radius:8px;overflow:hidden">
          <tbody>${topProductRows}</tbody>
        </table>` : ""}

        ${stockRows ? `
        <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:8px">⚠️ แจ้งเตือน Stock ต่ำ (Top 10)</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;background:#fef2f2;border-radius:8px;overflow:hidden">
          <thead><tr><th style="padding:6px 8px;text-align:left;font-size:10px;color:#dc2626">สินค้า</th><th style="padding:6px 8px;text-align:left;font-size:10px;color:#dc2626">สาขา</th><th style="padding:6px 8px;text-align:left;font-size:10px;color:#dc2626">คงเหลือ</th></tr></thead>
          <tbody>${stockRows}</tbody>
        </table>` : ""}

        <div style="background:#f0fdf4;border-radius:8px;padding:14px">
          <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:8px">🤖 AI วิเคราะห์</div>
          ${report.insights.map(i => `<div style="font-size:12px;color:#166534;margin-bottom:4px;line-height:1.6">• ${i}</div>`).join("")}
        </div>

        <div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:20px">
          รายงานนี้ส่งโดยอัตโนมัติทุกวันเวลา ${AppData.dailyReport.time} น.<br>
          ${new Date().toLocaleString("th-TH")}
        </div>
      </div>
    </div>`;
}

function buildLineMessage(report) {
  const lines = [];
  lines.push("🛋️ Furniture House POS");
  lines.push(`📅 ${report.dateLabel}`);
  lines.push("");
  lines.push("💰 ยอดขายรวม ฿" + formatCurrency(report.totalRevenue));
  lines.push("📋 จำนวนบิล " + report.todayReceipts.length);
  lines.push("📦 สินค้าขาย " + report.totalItems + " ชิ้น");
  if (report.todayRefunds.length > 0) lines.push("↩️ คืนสินค้า " + report.todayRefunds.length + " บิล");
  lines.push("");
  lines.push("🏢 แยกสาขา (Top 5):");
  report.branchData.sort((a, b) => b.revenue - a.revenue).slice(0, 5).forEach((b, i) => {
    lines.push(`${i+1}. ${b.name}: ฿${formatCurrency(b.revenue)} (${b.pct}%)`);
  });
  if (report.topProducts.length > 0) {
    lines.push("");
    lines.push("🏆 สินค้าขายดี:");
    report.topProducts.slice(0, 3).forEach((p, i) => {
      lines.push(`${i+1}. ${p.name} ${p.qty} ชิ้น`);
    });
  }
  if (report.lowStockItems.length > 0) {
    lines.push("");
    lines.push(`⚠️ Stock ต่ำ ${report.lowStockItems.length} รายการ`);
  }
  if (report.insights.length > 0) {
    lines.push("");
    lines.push("💡 " + report.insights[0].replace(/<[^>]+>/g, ""));
  }
  return lines.join("\n");
}

function sendDailyReport(isManual = false) {
  const report = generateDailyReportContent();
  const cfg = AppData.dailyReport;

  const emailHTML = buildEmailHTML(report);
  const lineMsg = buildLineMessage(report);

  const channels = [];
  const recipients = [];

  if (cfg.channels.includes("email")) {
    cfg.emailRecipients.filter(r => r.enabled).forEach(r => {
      channels.push("email");
      recipients.push({ type: "email", to: r.email, name: r.name });
    });
  }
  if (cfg.channels.includes("line")) {
    cfg.lineGroups.filter(g => g.enabled).forEach(g => {
      channels.push("line");
      recipients.push({ type: "line", to: g.name });
    });
  }

  const historyEntry = {
    id: Date.now() + Math.random(),
    date: new Date().toISOString(),
    isManual,
    revenue: report.totalRevenue,
    bills: report.todayReceipts.length,
    recipients: recipients.length,
    channels: [...new Set(channels)],
    success: true,
    emailHTML,
    lineMsg,
    recipientsList: recipients,
  };
  AppData.dailyReportHistory.unshift(historyEntry);
  AppData.dailyReport.lastSentAt = new Date().toISOString();

  logAction("daily_report.sent", {
    isManual,
    revenue: report.totalRevenue,
    bills: report.todayReceipts.length,
    recipients: recipients.length,
    channels: [...new Set(channels)],
  });

  // Browser notification (desktop)
  try {
    if (Notification.permission === "granted") {
      new Notification("📊 รายงานยอดขายส่งแล้ว", {
        body: `ยอดขายวันนี้ ฿${formatCurrency(report.totalRevenue)} (${report.todayReceipts.length} บิล) ส่งให้ ${recipients.length} ผู้รับ`,
        icon: "🛋️",
      });
    }
  } catch(e) {}

  return historyEntry;
}

// === DAILY REPORT TIMER ===
let _dailyReportTimer = null;
function startDailyReportTimer() {
  if (_dailyReportTimer) clearInterval(_dailyReportTimer);
  _dailyReportTimer = setInterval(() => {
    if (!AppData.dailyReport.enabled) return;
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (!AppData.dailyReport.days.includes(dayOfWeek)) return;
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    if (`${hh}:${mm}` !== AppData.dailyReport.time) return;
    // Avoid double-send within same minute
    const lastSent = AppData.dailyReport.lastSentAt;
    if (lastSent && (Date.now() - new Date(lastSent).getTime()) < 60000) return;
    sendDailyReport(false);
  }, 30000); // Check every 30 seconds
}

// ===== REAL-TIME SYNC (BroadcastChannel) =====
let _bc = null;
try { _bc = new BroadcastChannel("furniture-pos-sync"); } catch(e) { _bc = null; }

function broadcastEvent(type, payload = {}) {
  if (!_bc || !AppData?.appSettings?.enableRealtimeSync) return;
  try {
    _bc.postMessage({ type, payload, sender: State.currentUser?.id, time: Date.now() });
  } catch(e) {}
}

if (_bc) {
  _bc.onmessage = (ev) => {
    if (!AppData?.appSettings?.enableRealtimeSync) return;
    const { type, payload, sender } = ev.data || {};
    if (sender === State.currentUser?.id) return; // Ignore own events
    if (type === "sale.completed") {
      showSyncToast(`🔄 มีบิลใหม่สาขา ${AppData.branches.find(b => b.id === payload.branchId)?.code} · ฿${formatCurrency(payload.total)}`);
      // Re-render if on relevant page
      if (["dashboard", "stock", "receipts", "zreport", "outstanding"].includes(State.currentPage)) renderMain();
    } else if (type === "stock.changed") {
      showSyncToast(`🔄 Stock อัปเดต: ${payload.product} @ ${payload.branch}`);
      if (["stock", "pos"].includes(State.currentPage)) renderMain();
    }
  };
}

function showSyncToast(msg) {
  const t = document.createElement("div");
  t.className = "sync-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ===== DARK MODE =====
function applyDarkMode(on) {
  document.body.classList.toggle("dark", !!on);
  AppData.appSettings.darkMode = !!on;
  try { localStorage.setItem("fh_dark", on ? "1" : "0"); } catch(e) {}
}

// ===== LANGUAGE =====
function setLanguage(lang) {
  if (!AppData.i18n[lang]) return;
  State.language = lang;
  try { localStorage.setItem("fh_lang", lang); } catch(e) {}

  // Update static elements
  const langBtn = document.getElementById("btn-language");
  if (langBtn) langBtn.textContent = lang.toUpperCase();
  const langBtn2 = document.getElementById("btn-language-login");
  if (langBtn2) langBtn2.textContent = lang === "th" ? "🌐 EN" : "🌐 TH";

  // Login page elements
  const loginSubtitle = document.getElementById("login-subtitle");
  if (loginSubtitle) loginSubtitle.textContent = t("app.subtitle");
  const lblLogin = document.getElementById("lbl-login-btn");
  if (lblLogin) lblLogin.textContent = t("auth.login");
  const lblErr = document.getElementById("lbl-login-error");
  if (lblErr) lblErr.textContent = t("auth.invalid");
  const lblUser = document.getElementById("lbl-username");
  if (lblUser) lblUser.textContent = t("auth.username");
  const lblPwd = document.getElementById("lbl-password");
  if (lblPwd) lblPwd.textContent = t("auth.password");
  const lblDemo = document.getElementById("lbl-demo-title");
  if (lblDemo) lblDemo.innerHTML = t("auth.demoTitle") + ' (password: <b>1234</b>)';

  // Sidebar
  const logoSub = document.getElementById("logo-subtitle");
  if (logoSub) logoSub.textContent = t("app.subtitle");
  const lblBranch = document.getElementById("lbl-branch-current");
  if (lblBranch) lblBranch.innerHTML = t("branch.current") + " ▾";

  // Re-render to update dynamic content
  if (State.currentUser) render();
}

// ===== AUTH =====
function login(username, password) {
  const hashedInput = hashPassword(password);
  const user = AppData.users.find(u => u.username === username && u.password === hashedInput && u.active);
  if (!user) {
    logAction("login.failed", { username, reason: "invalid credentials" });
    return false;
  }
  State.currentUser = user;
  if (isBranchScoped() && user.branchId) {
    State.currentBranch = user.branchId;
  }
  try { localStorage.setItem("fh_user", JSON.stringify({ id: user.id })); } catch(e) {}
  logAction("login.success", { username });
  showApp();
  return true;
}

function logout() {
  if (State.currentUser) logAction("logout", { username: State.currentUser.username });
  State.currentUser = null;
  State.cart = [];
  State.discount = { type: "percent", value: 0, reason: "" };
  try { localStorage.removeItem("fh_user"); } catch(e) {}
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("app-container").style.display = "none";
}

function showApp() {
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app-container").style.display = "flex";
  // Set first allowed page
  const allowedPages = getAllowedPages();
  if (!allowedPages.find(p => p.id === State.currentPage)) {
    State.currentPage = allowedPages[0]?.id || "dashboard";
  }
  render();
}

function getAllowedPages() {
  const all = [
    { id: "dashboard",   name: t("nav.dashboard"),   icon: "📊", perm: "dashboard.view" },
    { id: "pos",         name: t("nav.pos"),          icon: "🛒", perm: "pos.use" },
    { id: "quotations",  name: t("nav.quotations"),   icon: "📝", perm: "pos.use" },
    { id: "customers",   name: t("nav.customers"),    icon: "👥", perm: "customers.view", section: t("nav.section.customers") },
    { id: "stock",       name: t("nav.stock"),        icon: "📦", perm: "stock.view",     section: t("nav.section.manage") },
    { id: "products",    name: t("nav.products"),     icon: "🛋️", perm: "products.view" },
    { id: "receipts",    name: t("nav.receipts"),     icon: "🧾", perm: "pos.use" },
    { id: "delivery",    name: t("nav.delivery"),     icon: "🚚", perm: "delivery.view" },
    { id: "outstanding", name: t("nav.outstanding"),  icon: "💰", perm: "pos.use" },
    { id: "reports",     name: t("nav.reports"),      icon: "📈", perm: "reports.view" },
    { id: "zreport",     name: t("nav.zreport"),      icon: "🕘", perm: "reports.view" },
    { id: "settings",    name: t("nav.settings"),     icon: "⚙️", perm: "settings.view",  section: t("nav.section.system") },
  ];
  return all.filter(p => hasPermission(p.perm));
}

// ===== RENDER FUNCTIONS =====

function render() {
  if (!State.currentUser) return;
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  const branch = getCurrentBranch();
  document.getElementById("branch-name").textContent = branch.name;
  document.getElementById("branch-code").textContent = branch.code;

  // Branch dropdown — show only accessible branches; warehouses tagged differently
  const dropdown = document.getElementById("branch-dropdown");
  const accessibleBranches = isBranchScoped()
    ? AppData.branches.filter(b => b.id === State.currentUser.branchId)
    : AppData.branches;
  if (dropdown) {
    dropdown.innerHTML = accessibleBranches.map(b => `
      <div class="branch-option ${b.id === State.currentBranch ? "active" : ""} ${b.isWarehouse ? "warehouse-option" : ""}" data-bid="${b.id}">
        <div class="branch-dot" style="background:${b.color}"></div>
        ${b.isWarehouse ? "🏭 " : ""}${b.name} (${b.code})${b.isWarehouse ? ` <span style="font-size:9px;color:#a78bfa;margin-left:4px">[${t("branch.cantSell")}]</span>` : ''}
      </div>`).join("");
  }

  // Render nav items based on permissions
  const allowed = getAllowedPages();
  const lowStockCount = getLowStockProducts(State.currentBranch).length;
  let html = "";
  let lastSection = null;
  allowed.forEach(p => {
    const section = p.section || t("nav.section.main");
    if (section !== lastSection) {
      html += `<div class="nav-section">${section}</div>`;
      lastSection = section;
    }
    let badge = "";
    if (p.id === "stock" && lowStockCount > 0) {
      badge = `<span class="nav-badge">${lowStockCount}</span>`;
    }
    html += `<div class="nav-item ${p.id === State.currentPage ? "active" : ""}" data-page="${p.id}">
      <span class="nav-icon">${p.icon}</span> <span>${p.name}</span>${badge}
    </div>`;
  });
  document.getElementById("nav-container").innerHTML = html;

  // User card
  if (State.currentUser) {
    const u = State.currentUser;
    const role = AppData.roles[u.role];
    const initials = u.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("");
    document.getElementById("user-avatar").textContent = initials;
    document.getElementById("user-avatar").style.background = `linear-gradient(135deg, ${role.color}, #ec4899)`;
    document.getElementById("user-name").textContent = u.name;
    const branchTxt = u.branchId ? ` · ${AppData.branches.find(b=>b.id===u.branchId)?.code || ""}` : "";
    // Use translated role name when available
    const roleName = t(`role.${u.role}`, role.name);
    document.getElementById("user-role").textContent = roleName + branchTxt;
  }
}

function renderMain() {
  const main = document.getElementById("main-content");
  const pages = {
    dashboard:   { fn: renderDashboard,   title: t("nav.dashboard"),    perm: "dashboard.view" },
    pos:         { fn: renderPOS,         title: t("nav.pos"),          perm: "pos.use" },
    customers:   { fn: renderCustomers,   title: t("nav.customers"),    perm: "customers.view" },
    stock:       { fn: renderStock,       title: t("nav.stock"),        perm: "stock.view" },
    products:    { fn: renderProducts,    title: t("nav.products"),     perm: "products.view" },
    receipts:    { fn: renderReceipts,    title: t("nav.receipts"),     perm: "pos.use" },
    quotations:  { fn: renderQuotations,  title: t("nav.quotations"),   perm: "pos.use" },
    outstanding: { fn: renderOutstanding, title: t("nav.outstanding"),  perm: "pos.use" },
    zreport:     { fn: renderZReport,     title: t("nav.zreport"),      perm: "reports.view" },
    delivery:    { fn: renderDelivery,    title: t("nav.delivery"),     perm: "delivery.view" },
    reports:     { fn: renderReports,     title: t("nav.reports"),      perm: "reports.view" },
    settings:    { fn: renderSettings,    title: t("nav.settings"),     perm: "settings.view" },
  };

  const page = pages[State.currentPage] || pages.dashboard;

  // Permission check
  if (!hasPermission(page.perm)) {
    document.getElementById("topbar-title").textContent = t("perm.denied.title");
    document.getElementById("topbar-sub").textContent = "";
    main.innerHTML = `
      <div class="permission-denied">
        <div class="icon">🔒</div>
        <h2>${t("perm.denied.title")}</h2>
        <p>${t("perm.denied.subtitle")} (${AppData.roles[State.currentUser.role]?.name})</p>
        <p style="margin-top:8px">${t("perm.denied.contact")}</p>
      </div>`;
    return;
  }

  document.getElementById("topbar-title").textContent = page.title;
  document.getElementById("topbar-sub").textContent =
    State.currentPage === "pos" ? `สาขา: ${getCurrentBranch().name}` : `อัปเดต: ${new Date().toLocaleTimeString("th-TH")}`;

  main.innerHTML = page.fn();
  attachEvents();
}

// ===== DASHBOARD =====
function renderDashboard() {
  const totalSales = Object.values(AppData.todaySales).reduce((s, v) => s + v.amount, 0);
  const totalOrders = Object.values(AppData.todaySales).reduce((s, v) => s + v.count, 0);
  const totalCustomers = Object.values(AppData.todaySales).reduce((s, v) => s + v.customers, 0);
  const avgTicket = totalOrders ? Math.round(totalSales / totalOrders) : 0;
  const lowStock = getLowStockProducts(State.currentBranch);

  // Dashboard shows only sales branches (warehouses excluded)
  const branchRows = AppData.branches.filter(b => !b.isWarehouse).map(b => {
    const s = AppData.todaySales[b.id];
    const pct = b.target > 0 ? Math.min(100, Math.round((s.amount / b.target) * 100)) : 0;
    return `
      <div class="branch-row">
        <div class="branch-dot-lg" style="background:${b.color}"></div>
        <div class="branch-info">
          <div class="branch-sales-name">${b.name}</div>
          <div class="branch-sales-sub">${s.count} ออเดอร์ · ${s.customers} คน</div>
        </div>
        <div class="branch-bar-wrap">
          <div class="branch-bar-bg">
            <div class="branch-bar-fill" style="background:${b.color}; width:${pct}%"></div>
          </div>
          <div style="font-size:10px;color:#9ca3af;margin-top:2px">${pct}% ของเป้า</div>
        </div>
        <div class="branch-sales-amount">฿${formatCurrency(s.amount)}</div>
      </div>`;
  }).join("");

  // Warehouse summary card (separate)
  const whBranches = AppData.branches.filter(b => b.isWarehouse);
  const warehouseRow = whBranches.map(wh => {
    const totalStock = AppData.products.reduce((s, p) => s + (p.stock[wh.id] || 0), 0);
    const stockValue = AppData.products.reduce((s, p) => s + p.cost * (p.stock[wh.id] || 0), 0);
    return `
      <div class="branch-row" style="background:#f8fafc;border-radius:8px;margin:4px 0;padding:10px">
        <div class="branch-dot-lg" style="background:${wh.color}"></div>
        <div class="branch-info">
          <div class="branch-sales-name">🏭 ${wh.name}</div>
          <div class="branch-sales-sub">Stock รวม ${totalStock.toLocaleString()} ชิ้น · มูลค่า ฿${formatCurrency(stockValue)}</div>
        </div>
        <span class="badge badge-purple">คลัง</span>
      </div>`;
  }).join("");

  const alertRows = lowStock.slice(0, 5).map(p => {
    const branchStock = p.stock[State.currentBranch] || 0;
    const isOut = branchStock === 0;
    return `
      <div class="alert-item">
        <div class="alert-icon">${isOut ? "❌" : "⚠️"}</div>
        <div class="alert-text">
          <b>${p.name}</b>
          <span>${getCurrentBranch().name} · เหลือ ${branchStock} ชิ้น (เกณฑ์ ${p.minStock})</span>
        </div>
        <span class="badge ${isOut ? "badge-red" : "badge-yellow"}">${isOut ? "หมด" : "ต่ำ"}</span>
      </div>`;
  }).join("") || `<div class="alert-item"><div class="alert-icon">✅</div><div class="alert-text"><b>ไม่มีสินค้าสต็อกต่ำ</b><span>ทุกสินค้าใน${getCurrentBranch().name}อยู่ในระดับปกติ</span></div></div>`;

  // Monthly chart (current branch)
  const branch = getCurrentBranch();
  const history = AppData.salesHistory[branch.id];
  const maxSales = Math.max(...history);
  const chartBars = AppData.months.map((m, i) => {
    const val = history[i];
    const h = Math.round((val / maxSales) * 100);
    const isCurrent = i === AppData.months.length - 1;
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar-val">${Math.round(val/1000)}K</div>
        <div style="flex:1;display:flex;align-items:flex-end;width:100%">
          <div class="chart-bar-fill" style="background:${isCurrent ? branch.color : branch.color + "80"};height:${h}%;width:100%"></div>
        </div>
        <div class="chart-bar-label">${m}${isCurrent ? " (วันนี้)" : ""}</div>
      </div>`;
  }).join("");

  // Top products
  const topProducts = [
    { name: "โซฟา Luxe Nordic", sales: 14, revenue: 544600 },
    { name: "เตียง Luxe Upholstered", sales: 11, revenue: 462000 },
    { name: "โซฟา Modular Pro", sales: 8, revenue: 520000 },
    { name: "เตียง Scandic Oak", sales: 18, revenue: 520200 },
    { name: "โต๊ะ Walnut", sales: 22, revenue: 407000 },
  ];

  const topRows = topProducts.map((p, i) => {
    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    return `
      <div class="top-product-item">
        <div class="top-product-rank ${rankClass}">${i + 1}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:#374151">${p.name}</div>
          <div style="font-size:11px;color:#9ca3af">ขายได้ ${p.sales} ชิ้น</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:#6366f1">฿${formatCurrency(p.revenue)}</div>
      </div>`;
  }).join("");

  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${t("dash.todaySales")}</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalSales)}</span></div>
        <div class="kpi-trend up">↑ +12.4%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t("dash.orders")}</div>
        <div class="kpi-value">${totalOrders}</div>
        <div class="kpi-trend up">↑ +5</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t("dash.customers")}</div>
        <div class="kpi-value">${totalCustomers}</div>
        <div class="kpi-trend up">↑ +8</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${t("dash.avgTicket")}</div>
        <div class="kpi-value">฿<span>${formatCurrency(avgTicket)}</span></div>
        <div class="kpi-trend down">↓ -3.2%</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-title">${t("dash.salesByBranch")}</div>
        ${branchRows}
        ${warehouseRow}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-title">${t("dash.lowStockAlert")}</div>
          ${alertRows}
        </div>
      </div>
    </div>

    <div class="report-grid" style="margin-top:16px">
      <div class="card">
        <div class="card-title">${t("dash.monthlySales")} — ${branch.name} (฿)</div>
        <div class="chart-bars">${chartBars}</div>
      </div>
      <div class="card">
        <div class="card-title">${t("dash.topProducts")}</div>
        ${topRows}
      </div>
    </div>`;
}

// ===== POS =====
function renderPOS() {
  const branch = getCurrentBranch();

  // Block POS at warehouses
  if (branch?.isWarehouse) {
    return `
      <div class="permission-denied">
        <div class="icon">🏭</div>
        <h2>ไม่สามารถขายของที่คลังกลาง</h2>
        <p>${branch.name} เป็นคลังจัดเก็บ — ไม่ใช่หน้าร้าน</p>
        <p style="margin-top:8px">กรุณาสลับสาขาที่ left sidebar เพื่อเริ่มขายของ</p>
      </div>`;
  }

  const selectedCat = State.posCategory || "all";

  const catTabs = `
    <button class="cat-tab ${selectedCat === "all" ? "active" : ""}" data-cat="all">🛍️ ทั้งหมด</button>
    ${AppData.categories.map(c => `
      <button class="cat-tab ${selectedCat === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon} ${c.name}</button>
    `).join("")}`;

  let prods = AppData.products;
  if (selectedCat !== "all") prods = prods.filter(p => p.categoryId === selectedCat);

  const productCards = prods.map(p => {
    const stock = p.stock[State.currentBranch] || 0;
    const isOut = stock === 0;
    const cat = AppData.categories.find(c => c.id === p.categoryId);
    return `
      <div class="product-card-pos ${isOut ? "out-of-stock" : ""}" data-pid="${p.id}" ${isOut ? "" : "data-clickable"}>
        <div style="position:relative">
          <img class="product-card-img" src="${p.images[0]}" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23f1f5f9%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 font-size=%2230%22>🛋️</text></svg>'">
          ${p.itemCode ? `<div style="position:absolute;top:4px;left:4px;background:${cat?.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;font-family:monospace">${p.itemCode}</div>` : ''}
        </div>
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price">฿${formatCurrency(p.price)}</div>
        <div class="product-card-stock ${stock <= p.minStock ? "low" : ""}">
          ${isOut ? "❌ หมด" : stock <= p.minStock ? `⚠️ เหลือ ${stock} ชิ้น` : `✓ ${stock} ชิ้น`}
        </div>
      </div>`;
  }).join("");

  const cartItems = State.cart.map((item, idx) => {
    const matInfo = item.materialType ? `${AppData.sofaMaterials[item.materialType]?.icon} ${AppData.sofaMaterials[item.materialType]?.name}` : "";
    const orientInfo = item.orientation ? (item.orientation === "left" ? "↙ ซ้าย" : "↘ ขวา") : "";
    const unitPrice = item.unitPrice || item.product.price;
    return `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.product.images[0]}" alt="${item.product.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect fill=%22%23f1f5f9%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 font-size=%2218%22>🛋️</text></svg>'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product.name}${orientInfo ? ` <span style="font-size:10px;background:#fef3c7;color:#854d0e;padding:1px 5px;border-radius:3px">${orientInfo}</span>` : ""}</div>
        <div class="cart-item-sub">${item.size?.label || ""} ${matInfo ? `· ${matInfo}` : ""} ${item.color?.name ? `· ${item.color.name}` : ""}</div>
        <div class="cart-item-price">฿${formatCurrency(unitPrice * item.qty)}</div>
        <div class="cart-item-qty">
          <div class="qty-btn" data-action="dec" data-idx="${idx}">−</div>
          <div class="qty-num">${item.qty}</div>
          <div class="qty-btn" data-action="inc" data-idx="${idx}">+</div>
        </div>
      </div>
      <div class="cart-remove" data-remove="${idx}">✕</div>
    </div>`;
  }).join("");

  const subtotal = State.cart.reduce((s, i) => s + (i.unitPrice || i.product.price) * i.qty, 0);

  // Customer panel
  const cust = State.selectedCustomer ? AppData.customers.find(c => c.id === State.selectedCustomer) : null;
  const tier = cust ? AppData.tiers[getTierKey(cust.totalSpent)] : null;
  const customerPanel = cust ? `
    <div style="background:linear-gradient(135deg,${tier.color}15,${tier.color}05);border:1px solid ${tier.color}40;border-radius:8px;padding:8px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="user-avatar" style="background:${tier.color};width:30px;height:30px;font-size:11px">${cust.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cust.name}</div>
          <div style="font-size:10px;color:#6b7280">${tier.icon} ${tier.name} · ${cust.points.toLocaleString()} pts</div>
        </div>
        <button class="btn-remove-customer" id="btn-remove-customer" style="background:none;color:#ef4444;cursor:pointer;font-size:14px;padding:4px">✕</button>
      </div>
      ${cust.points >= 100 ? `
        <div style="margin-top:6px;display:flex;gap:4px;align-items:center">
          <span style="font-size:10px;color:#6b7280">ใช้แต้ม:</span>
          <input type="number" id="redeem-points" value="${State.redeemPoints||0}" max="${Math.min(cust.points, Math.floor(subtotal/100)*100)}" min="0" step="100" class="form-input" style="padding:3px 6px;font-size:11px;flex:1" placeholder="0">
          <span style="font-size:10px;color:#6b7280">= ฿${(State.redeemPoints||0).toLocaleString()}</span>
        </div>` : ""}
    </div>` : `
    <button class="btn btn-secondary" id="btn-attach-customer" style="width:100%;margin-bottom:8px;font-size:12px">👤 เพิ่มลูกค้าให้บิลนี้ (เก็บประวัติ + แต้ม)</button>`;

  // Discount calculation
  const maxDiscPct = getMaxDiscountPercent();
  const canDiscount = maxDiscPct > 0;
  let discAmount = 0;
  if (State.discount.value > 0) {
    if (State.discount.type === "percent") {
      const pct = Math.min(State.discount.value, maxDiscPct);
      discAmount = Math.round(subtotal * pct / 100);
    } else {
      // Amount: cap at maxDiscPct of subtotal
      const cap = Math.round(subtotal * maxDiscPct / 100);
      discAmount = Math.min(State.discount.value, cap);
    }
  }

  // Tier-based auto discount (gold 5%, platinum 10%)
  let tierDiscPct = 0;
  if (cust) {
    const tk = getTierKey(cust.totalSpent);
    if (tk === "gold") tierDiscPct = 5;
    else if (tk === "platinum") tierDiscPct = 10;
  }
  const tierDiscAmount = Math.round(subtotal * tierDiscPct / 100);

  // Points redemption (1 point = ฿1, in steps of 100)
  const redeemPts = Math.min(State.redeemPoints || 0, cust?.points || 0);
  const redeemValue = redeemPts;

  // Delivery zone & fee
  const zone = AppData.deliveryZones.find(z => z.id === State.delivery.zoneId) || AppData.deliveryZones[0];
  const canCustomPrice = hasPermission("delivery.custom_price");
  const isCustomZone = zone.id === "custom";

  let deliveryFee = isCustomZone ? (parseInt(State.delivery.customFee) || 0) : zone.fee;
  // Free delivery for Platinum tier (except custom — custom is always custom)
  if (cust && getTierKey(cust.totalSpent) === "platinum" && zone.id !== "pickup" && !isCustomZone) deliveryFee = 0;

  const afterDiscount = Math.max(0, subtotal - discAmount - tierDiscAmount - redeemValue);
  const vat = Math.round(afterDiscount * 0.07);
  const total = afterDiscount + vat + deliveryFee;

  const needsAddress = zone.id !== "pickup";

  const availableZones = AppData.deliveryZones.filter(z => !z.requiresPerm || hasPermission(z.requiresPerm));
  const zoneOpts = availableZones.map(z => {
    const free = cust && getTierKey(cust.totalSpent) === "platinum" && z.id !== "pickup" && z.id !== "custom";
    let priceTxt = "";
    if (z.id === "pickup") priceTxt = "";
    else if (z.id === "custom") priceTxt = "· ระบุราคา";
    else priceTxt = `· ฿${z.fee}${free ? " (ฟรี)" : ""}`;
    return `<option value="${z.id}" ${zone.id === z.id ? "selected" : ""}>${z.name} ${priceTxt}</option>`;
  }).join("");

  // Calculate slot availability for current selected date (for in-house teams)
  const useInhouse = (State.delivery.channelId || "inhouse") === "inhouse";
  const slotUsage = useInhouse && State.delivery.date ? getSlotUsageForDate(State.delivery.date) : null;
  const timeSlotOpts = AppData.deliveryTimeSlots.map(t => {
    let label = t.name;
    if (slotUsage && slotUsage[t.id]) {
      const u = slotUsage[t.id];
      const cap = u.capacity;
      const used = u.used;
      const remaining = Math.max(0, cap - used);
      const isFull = remaining === 0;
      label = `${t.name} ${isFull ? "🔴 เต็ม" : `· เหลือ ${remaining}/${cap}`}`;
    }
    return `<option value="${t.id}" ${State.delivery.timeSlot === t.id ? "selected" : ""}>${label}</option>`;
  }).join("");
  const todayPlusLead = new Date(Date.now() + zone.leadDays * 86400000).toISOString().split("T")[0];

  // Delivery channel
  const channelOpts = AppData.deliveryChannels.filter(c => c.active).map(c =>
    `<option value="${c.id}" ${(State.delivery.channelId || 'inhouse') === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
  ).join("");
  const selectedChannel = AppData.deliveryChannels.find(c => c.id === (State.delivery.channelId || 'inhouse'));

  // Team picker (only if channel needs team)
  const teamsForBranch = AppData.deliveryTeams.filter(t => t.active && (!t.branchId || t.branchId === State.currentBranch));
  const teamOpts = teamsForBranch.map(t => `<option value="${t.id}" ${State.delivery.teamId == t.id ? 'selected' : ''}>${t.name} · ${t.driverIds.length} คนขับ</option>`).join("");

  const deliveryUI = `
    <div class="delivery-section">
      <div style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:4px">🚚 การจัดส่ง</div>
      <select id="dl-zone" class="form-input" style="font-size:12px;padding:6px;margin-bottom:6px">${zoneOpts}</select>
      ${needsAddress ? `
      <div style="font-size:10px;color:#6b7280;font-weight:600;margin-bottom:3px">ช่องทางจัดส่ง</div>
      <select id="dl-channel" class="form-input" style="font-size:12px;padding:6px;margin-bottom:6px">${channelOpts}</select>
      ${selectedChannel?.needsTeam ? `
        <div style="font-size:10px;color:#6b7280;font-weight:600;margin-bottom:3px">👥 ทีมจัดส่ง</div>
        <select id="dl-team" class="form-input team-selector" style="font-size:12px;padding:6px;margin-bottom:6px">
          <option value="">— เลือกทีมจัดส่ง —</option>
          ${teamOpts}
        </select>` : ''}
      ${selectedChannel?.websiteTrackUrl ? `<div style="font-size:10px;color:#0ea5e9;margin-bottom:6px">📦 ${selectedChannel.description}</div>` : ''}
      ` : ''}
      ${isCustomZone ? `
        <div style="background:#fef9c3;border:1px dashed #ca8a04;border-radius:6px;padding:6px;margin-bottom:6px">
          <div style="font-size:10px;color:#854d0e;font-weight:700;margin-bottom:4px">💰 ใส่ราคาค่าจัดส่งเอง</div>
          <div style="display:flex;gap:4px;align-items:center">
            <span style="font-size:12px;color:#6b7280">฿</span>
            <input type="number" id="dl-custom-fee" class="form-input" placeholder="0" value="${State.delivery.customFee || ''}" min="0" step="50" style="font-size:12px;padding:5px;flex:1">
          </div>
          <input type="text" id="dl-custom-reason" class="form-input" placeholder="เหตุผล (เช่น ขึ้นชั้น 5, นอกเขต, ขนของพิเศษ)" value="${State.delivery.customReason || ''}" style="font-size:11px;padding:5px;margin-top:4px">
        </div>` : ""}
      ${needsAddress ? `
        <input type="text" id="dl-recipient" class="form-input" placeholder="ชื่อผู้รับ" value="${State.delivery.recipientName || cust?.name || ''}" style="font-size:11px;padding:5px;margin-bottom:4px">
        <input type="text" id="dl-phone" class="form-input" placeholder="เบอร์ผู้รับ" value="${State.delivery.recipientPhone || cust?.phone || ''}" style="font-size:11px;padding:5px;margin-bottom:4px">
        <textarea id="dl-address" class="form-input" placeholder="ที่อยู่จัดส่ง" rows="2" style="font-size:11px;padding:5px;margin-bottom:4px;resize:none">${State.delivery.address || cust?.address || ''}</textarea>
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <button type="button" id="dl-date-btn" class="form-input" style="font-size:11px;padding:5px;flex:1.4;text-align:left;cursor:pointer;background:linear-gradient(135deg,#eef2ff,#fff);border:1px solid #c7d2fe;color:#1e293b;font-weight:600">
            📅 ${State.delivery.date ? new Date(State.delivery.date).toLocaleDateString("th-TH",{weekday:"short",day:"2-digit",month:"short"}) : "เลือกวันส่ง"}
          </button>
          <select id="dl-time" class="form-input" style="font-size:11px;padding:5px;flex:1">${timeSlotOpts}</select>
        </div>
        <input type="text" id="dl-note" class="form-input" placeholder="หมายเหตุ (ถ้ามี)" value="${State.delivery.note || ''}" style="font-size:11px;padding:5px">
      ` : ""}
    </div>`;

  const payMethods = AppData.paymentMethods.map(m => `
    <div class="pay-method ${State.payMethod === m.id ? "selected" : ""}" data-pay="${m.id}">
      <span class="pay-method-icon">${m.icon}</span>${m.name}
    </div>`).join("");

  const discountUI = canDiscount ? `
    <div class="discount-row">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:#6b7280;font-weight:600">💰 ส่วนลด ${maxDiscPct < 100 ? `(สูงสุด ${maxDiscPct}%)` : ""}</span>
      </div>
      <div style="display:flex;gap:4px">
        <select id="disc-type" class="form-input" style="flex:0 0 65px;padding:6px;font-size:12px">
          <option value="percent" ${State.discount.type === "percent" ? "selected" : ""}>%</option>
          <option value="amount" ${State.discount.type === "amount" ? "selected" : ""}>฿</option>
        </select>
        <input type="number" id="disc-value" class="form-input" style="padding:6px;font-size:12px" placeholder="0" value="${State.discount.value || ""}" min="0" max="${State.discount.type === "percent" ? maxDiscPct : 999999}">
        <input type="text" id="disc-reason" class="form-input" style="flex:1.2;padding:6px;font-size:12px" placeholder="เหตุผล (เช่น ลูกค้าประจำ)" value="${State.discount.reason || ""}">
      </div>
    </div>` : `
    <div style="font-size:11px;color:#9ca3af;padding:6px 0">🔒 บทบาทนี้ไม่สามารถลดราคาได้</div>`;

  return `
    <div class="pos-layout">
      <div class="pos-left">
        <div class="cat-tabs">${catTabs}</div>
        <div class="product-grid" id="product-grid">
          ${productCards || `<div class="empty-state"><div class="empty-state-icon">📦</div><p>ไม่มีสินค้าในหมวดนี้</p></div>`}
        </div>
      </div>

      <div class="cart-panel">
        <div class="cart-header">
          <div class="cart-title">🛒 บิลปัจจุบัน</div>
          <span class="badge badge-purple">${State.cart.length} รายการ</span>
          ${State.cart.length ? `<button class="btn btn-danger" id="clear-cart" style="font-size:11px;padding:4px 10px">ล้าง</button>` : ""}
        </div>
        <div class="cart-items">
          ${cartItems || `<div class="empty-state" style="padding:30px"><div class="empty-state-icon">🛒</div><p>ยังไม่มีสินค้า</p></div>`}
        </div>
        <div class="cart-summary">
          ${customerPanel}
          <div class="cart-summary-row"><span>ยอดรวม</span><span>฿${formatCurrency(subtotal)}</span></div>
          ${discountUI}
          ${discAmount > 0 ? `<div class="cart-summary-row" style="color:#10b981"><span>ส่วนลด ${State.discount.type === "percent" ? `${Math.min(State.discount.value, maxDiscPct)}%` : ""}</span><span>−฿${formatCurrency(discAmount)}</span></div>` : ""}
          ${tierDiscAmount > 0 ? `<div class="cart-summary-row" style="color:${tier.color}"><span>${tier.icon} ส่วนลด ${tier.name} ${tierDiscPct}%</span><span>−฿${formatCurrency(tierDiscAmount)}</span></div>` : ""}
          ${redeemValue > 0 ? `<div class="cart-summary-row" style="color:#7c3aed"><span>🎁 ใช้แต้ม ${redeemPts} pts</span><span>−฿${formatCurrency(redeemValue)}</span></div>` : ""}
          ${deliveryUI}
          <div class="cart-summary-row"><span>VAT 7%</span><span>฿${formatCurrency(vat)}</span></div>
          ${deliveryFee > 0 ? `<div class="cart-summary-row" style="color:#0ea5e9"><span>🚚 ค่าจัดส่ง${isCustomZone ? ' (กำหนดเอง)' : ''}</span><span>+฿${formatCurrency(deliveryFee)}</span></div>` : zone.id !== "pickup" && !isCustomZone && cust && getTierKey(cust.totalSpent) === "platinum" ? `<div class="cart-summary-row" style="color:#7c3aed"><span>💎 ค่าจัดส่งฟรี (Platinum)</span><span>฿0</span></div>` : ""}
          ${(() => {
            // Deposit UI
            if (!State.cart.length) return "";
            const dep = State.deposit;
            return `
            <div style="background:#dcfce7;border:1px dashed #16a34a;border-radius:8px;padding:8px;margin:6px 0">
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#15803d;cursor:pointer">
                <input type="checkbox" id="dep-toggle" ${dep.enabled ? "checked" : ""} style="accent-color:#16a34a">
                💵 รับเงินมัดจำเท่านั้น (จ่ายส่วนที่เหลือทีหลัง)
              </label>
              ${dep.enabled ? `
                <div style="display:flex;gap:4px;margin-top:6px">
                  <select id="dep-type" class="form-input" style="flex:0 0 70px;padding:5px;font-size:11px">
                    <option value="percent" ${dep.type === "percent" ? "selected" : ""}>%</option>
                    <option value="amount" ${dep.type === "amount" ? "selected" : ""}>฿</option>
                  </select>
                  <input type="number" id="dep-value" class="form-input" placeholder="${dep.type === 'percent' ? '30' : '10000'}" value="${dep.value || ''}" style="padding:5px;font-size:11px;flex:1" min="1">
                </div>
              ` : ""}
            </div>`;
          })()}
          <div class="cart-total-row"><span>ยอดสุทธิ</span><span>฿${formatCurrency(total)}</span></div>
          ${cust ? `<div style="font-size:11px;color:#7c3aed;text-align:right;margin-top:4px">+${calcPointsEarned(afterDiscount, getTierKey(cust.totalSpent))} แต้มสะสม</div>` : ""}
          <div style="margin-top:10px">
            <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">วิธีชำระเงิน</div>
            <div class="pay-methods">${payMethods}</div>
          </div>
          ${(() => {
            // Compute deposit values for display
            if (!State.deposit.enabled || !State.cart.length) return "";
            let depAmount = State.deposit.type === "percent"
              ? Math.round(total * Math.min(State.deposit.value || 0, 100) / 100)
              : Math.min(State.deposit.value || 0, total);
            const balance = total - depAmount;
            return `
            <div class="cart-summary-row" style="color:#16a34a;font-weight:700"><span>💵 มัดจำที่จ่ายวันนี้</span><span>฿${formatCurrency(depAmount)}</span></div>
            <div class="cart-summary-row" style="color:#dc2626"><span>คงค้างชำระ</span><span>฿${formatCurrency(balance)}</span></div>`;
          })()}
          <div style="display:flex;gap:6px">
            <button class="btn-pay" id="btn-checkout" ${!State.cart.length || !State.payMethod ? "disabled" : ""} style="flex:2">
              ${State.deposit.enabled ? "💵 รับมัดจำ" : "💳 ชำระเงิน"} ฿${formatCurrency(State.deposit.enabled ? (State.deposit.type === "percent" ? Math.round(total * Math.min(State.deposit.value || 0, 100) / 100) : Math.min(State.deposit.value || 0, total)) : total)}
            </button>
            <button class="btn btn-secondary" id="btn-save-quote" ${!State.cart.length ? "disabled" : ""} style="flex:1;font-size:11px;padding:8px 4px" title="บันทึกเป็นใบเสนอราคา">📝 Quote</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ===== STOCK =====
function renderStock() {
  const catFilter = State.stockCategoryFilter || "all";
  const search = State.stockSearch || "";

  const branchTabs = AppData.branches.map(b => `
    <button class="filter-btn ${State.stockViewBranch === b.id ? "active" : ""}" data-branch="${b.id}">${b.name}</button>
  `).join("");

  const catBtns = `
    <button class="filter-btn ${catFilter === "all" ? "active" : ""}" data-cat="all">ทั้งหมด</button>
    ${AppData.categories.map(c => `
      <button class="filter-btn ${catFilter === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon} ${c.name}</button>
    `).join("")}`;

  let prods = AppData.products;
  if (catFilter !== "all") prods = prods.filter(p => p.categoryId === catFilter);
  if (search) prods = prods.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  // Compute stats for current view branch
  const viewBranchId = State.stockViewBranch;
  const allProdsForBranch = AppData.products;
  const totalItems = allProdsForBranch.reduce((s, p) => s + (p.stock[viewBranchId] || 0), 0);
  const lowCount = allProdsForBranch.filter(p => (p.stock[viewBranchId] || 0) <= p.minStock && (p.stock[viewBranchId] || 0) > 0).length;
  const outCount = allProdsForBranch.filter(p => (p.stock[viewBranchId] || 0) === 0).length;
  const totalValue = allProdsForBranch.reduce((s, p) => s + p.price * (p.stock[viewBranchId] || 0), 0);

  const rows = prods.map(p => {
    const allBranchStocks = AppData.branches.map(b => {
      const s = p.stock[b.id] || 0;
      const cls = s === 0 ? "stock-zero" : s <= p.minStock ? "stock-critical" : s <= p.minStock * 2 ? "stock-low" : "stock-ok";
      return `<td style="text-align:center"><span class="stock-num ${cls}">${s}</span></td>`;
    }).join("");

    const viewBranchStock = p.stock[State.stockViewBranch] || 0;
    const statusCls = viewBranchStock === 0 ? "badge-red" : viewBranchStock <= p.minStock ? "badge-yellow" : "badge-green";
    const statusTxt = viewBranchStock === 0 ? "หมด" : viewBranchStock <= p.minStock ? "ต่ำ" : "ปกติ";

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <img src="${p.images[0]}" style="width:36px;height:36px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'">
            <div>
              <div style="font-weight:700;font-size:13px">${p.name}</div>
              <div style="font-size:11px;color:#9ca3af">${p.sku}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${categoryBadgeColor(p.categoryId)}">${AppData.categories.find(c=>c.id===p.categoryId)?.icon} ${AppData.categories.find(c=>c.id===p.categoryId)?.name}</span></td>
        <td style="text-align:right;font-weight:700;color:#1e293b">฿${formatCurrency(p.price)}</td>
        ${allBranchStocks}
        <td><span class="badge ${statusCls}">${statusTxt}</span></td>
        <td>
          <button class="btn btn-secondary btn-transfer" data-pid="${p.id}" style="font-size:11px;padding:5px 10px">⇄ โอน</button>
        </td>
      </tr>`;
  }).join("");

  const branchHeaders = AppData.branches.map(b =>
    `<th style="text-align:center;min-width:80px"><div style="display:flex;align-items:center;justify-content:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>${b.code}</div></th>`
  ).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card">
        <div class="kpi-label">จำนวนสินค้าใน${getCurrentBranch().name}</div>
        <div class="kpi-value">${totalItems} <small>ชิ้น</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">มูลค่า Stock</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalValue)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">สินค้าสต็อกต่ำ</div>
        <div class="kpi-value" style="color:#ca8a04">${lowCount} <small>รายการ</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">สินค้าหมด</div>
        <div class="kpi-value" style="color:#dc2626">${outCount} <small>รายการ</small></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap">
        <div class="card-title" style="margin:0">จัดการ Stock ทุกสาขา</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="btn-export-stock">📥 Export CSV</button>
          <button class="btn btn-primary" id="btn-add-stock">+ เพิ่ม Stock</button>
        </div>
      </div>

      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="stock-search" placeholder="ค้นหาสินค้า / SKU..." value="${search}">
      </div>

      <div class="stock-filters">
        <span style="font-size:12px;font-weight:600;color:#6b7280;align-self:center">มุมมองสาขา:</span>
        ${branchTabs}
      </div>
      <div class="stock-filters" style="margin-top:6px">
        <span style="font-size:12px;font-weight:600;color:#6b7280;align-self:center">หมวดหมู่:</span>
        ${catBtns}
      </div>

      <div style="overflow-x:auto;margin-top:12px">
        <table class="stock-table">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>หมวดหมู่</th>
              <th style="text-align:right">ราคา</th>
              ${branchHeaders}
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${6 + AppData.branches.length}" style="text-align:center;padding:32px;color:#9ca3af">ไม่พบสินค้า</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function categoryBadgeColor(catId) {
  const map = { sofa: "badge-purple", bed: "badge-blue", table: "badge-green", chair: "badge-yellow", cabinet: "badge-red", lighting: "badge-purple", deco: "badge-blue" };
  return map[catId] || "badge-blue";
}

// ===== PRODUCTS =====
function renderProducts() {
  if (State.selectedProduct) return renderProductDetail();

  const catFilter = State.productCategoryFilter || "all";
  const search = State.productSearch || "";

  let prods = AppData.products;
  if (catFilter !== "all") prods = prods.filter(p => p.categoryId === catFilter);
  if (search) prods = prods.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.itemCode || "").toLowerCase().includes(search.toLowerCase())
  );

  // Sort by itemCode
  prods = [...prods].sort((a, b) => (a.itemCode || "").localeCompare(b.itemCode || ""));

  const catBtns = `
    <button class="cat-tab ${catFilter === "all" ? "active" : ""}" data-pcat="all">🛍️ ทั้งหมด (${AppData.products.length})</button>
    ${AppData.categories.map(c => {
      const count = AppData.products.filter(p => p.categoryId === c.id).length;
      return `<button class="cat-tab ${catFilter === c.id ? "active" : ""}" data-pcat="${c.id}">${c.icon} ${c.name} <code style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;font-size:10px;margin-left:3px">${c.code}</code> (${count})</button>`;
    }).join("")}`;

  const productCards = prods.map(p => {
    const cat = AppData.categories.find(c => c.id === p.categoryId);
    return `
    <div class="product-card-main" data-view-product="${p.id}">
      <div style="position:relative">
        <img src="${p.images[0]}" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23f1f5f9%22 width=%22400%22 height=%22300%22/><text x=%22200%22 y=%22160%22 text-anchor=%22middle%22 font-size=%2260%22>🛋️</text></svg>'">
        <div style="position:absolute;top:8px;left:8px;background:${cat?.color};color:#fff;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;font-family:monospace">${p.itemCode || p.sku}</div>
      </div>
      <div class="product-card-main-body">
        <div class="product-card-main-name">${p.name}</div>
        <div class="product-card-main-desc">${p.description}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="product-card-main-price">฿${formatCurrency(p.price)}</div>
          <span class="badge ${categoryBadgeColor(p.categoryId)}">${cat?.icon} ${cat?.name}</span>
        </div>
        <div class="product-card-main-sku">${p.sku}</div>
      </div>
    </div>`;
  }).join("");

  return `
    <div class="search-bar">
      <span>🔍</span>
      <input type="text" placeholder="ค้นหาสินค้า หรือ SKU..." id="product-search" value="${search}">
    </div>
    <div class="cat-tabs" style="margin-bottom:16px">${catBtns}</div>
    <div class="product-grid-main">
      ${productCards || `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><p>ไม่พบสินค้าที่ค้นหา</p></div>`}
    </div>`;
}

function renderProductDetail() {
  const p = State.selectedProduct;
  const imgIdx = State.selectedImageIdx || 0;
  const tab = State.productTab || "detail";

  const thumbs = p.images.map((img, i) => `
    <img class="gallery-thumb ${i === imgIdx ? "active" : ""}" src="${img}" data-imgidx="${i}" onerror="this.style.display='none'">`
  ).join("");

  const selectedSize = State.selectedSize || p.sizes[0];
  const hasMaterials = Array.isArray(p.materialTypes) && p.materialTypes.length > 0;
  const matType = hasMaterials ? (p.materialTypes.includes(State.selectedMaterialType) ? State.selectedMaterialType : p.materialTypes[0]) : null;
  const colorList = hasMaterials ? getSofaColors(matType) : p.colors;
  const selectedColor = (State.selectedColor && colorList.find(c => c.code === State.selectedColor.code)) ? State.selectedColor : colorList[0];

  const sizeOpts = p.sizes.map(s => `
    <div class="size-opt ${s.code === selectedSize?.code ? "selected" : ""}" data-size="${s.code}">
      <div style="font-weight:700">${s.label}</div>
    </div>`).join("");

  const materialTabs = hasMaterials ? `
    <div style="margin-top:12px">
      <label class="form-label">ชนิดวัสดุ</label>
      <div style="display:grid;grid-template-columns:repeat(${p.materialTypes.length},1fr);gap:8px">
        ${p.materialTypes.map(mt => {
          const m = AppData.sofaMaterials[mt];
          const isSel = mt === matType;
          return `<div class="size-opt ${isSel ? "selected" : ""}" data-material="${mt}" style="text-align:center;padding:10px 6px">
            <div style="font-size:18px">${m.icon}</div>
            <div style="font-weight:700;font-size:12px;line-height:1.2">${m.name}</div>
            <div style="font-size:10px;color:${isSel?'#fff':'#9ca3af'};margin-top:2px">${m.surcharge}</div>
          </div>`;
        }).join("")}
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:6px;background:#f8fafc;padding:8px;border-radius:6px">
        ${AppData.sofaMaterials[matType]?.icon} <b>${AppData.sofaMaterials[matType]?.name}</b> — ${AppData.sofaMaterials[matType]?.desc}
      </div>
    </div>` : "";

  const colorOpts = colorList.map(c => `
    <div class="color-opt ${c.code === selectedColor?.code ? "selected" : ""}" data-color="${c.code}"
         style="background:${c.hex}" title="${c.name}"></div>`).join("");

  const addColorBtn = hasMaterials && hasPermission("sofa.add_color") ? `
    <button class="color-add-btn" id="btn-add-color" data-mat="${matType}" title="เพิ่มสีใหม่">+</button>` : "";

  const dimInfo = selectedSize ? `
    <div class="size-dim">
      <b>ขนาด:</b> ${selectedSize.w} × ${selectedSize.d} × ${selectedSize.h} ซม.
      ${selectedSize.seat_h ? `· <b>ความสูงที่นั่ง:</b> ${selectedSize.seat_h} ซม.` : ""}
      ${selectedSize.room_min ? `<br><b>ขนาดห้องแนะนำ:</b> ${selectedSize.room_min}` : ""}
    </div>` : "";

  // L-shape orientation selector
  const needsOrient = sizeNeedsOrientation(selectedSize);
  const orient = State.selectedOrientation || "left";
  const orientUI = needsOrient ? `
    <label class="form-label" style="margin-top:12px">ทิศทาง L-Shape</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="size-opt ${orient === 'left' ? 'selected' : ''}" data-detail-orient="left" style="text-align:center;padding:12px">
        <div style="font-size:28px">⬛<span style="display:inline-block;transform:scaleX(-1)">L</span></div>
        <div style="font-weight:700;font-size:13px">หันซ้าย</div>
        <div style="font-size:10px;color:${orient==='left'?'#fff':'#9ca3af'}">เก้าอี้ยาวฝั่งซ้าย</div>
      </div>
      <div class="size-opt ${orient === 'right' ? 'selected' : ''}" data-detail-orient="right" style="text-align:center;padding:12px">
        <div style="font-size:28px">L⬛</div>
        <div style="font-weight:700;font-size:13px">หันขวา</div>
        <div style="font-size:10px;color:${orient==='right'?'#fff':'#9ca3af'}">เก้าอี้ยาวฝั่งขวา</div>
      </div>
    </div>
    <div style="font-size:11px;color:#6b7280;margin-top:6px;background:#f0f9ff;padding:6px 10px;border-radius:6px">
      💡 ยืนหันหน้าเข้าโซฟา → ดูว่าเก้าอี้ยาวอยู่ฝั่งไหน
    </div>` : "";

  const matGrid = Object.entries(p.materials).map(([key, mat]) => {
    if (!mat.name || mat.name === "—") return "";
    const keyNames = { fabric: "ผ้า/วัสดุพื้นผิว", frame: "โครงสร้าง", foam: "ฟองน้ำ/เบาะ", legs: "ขา/ฐาน" };
    return `
      <div class="material-item">
        <div class="material-type">${keyNames[key] || key}</div>
        <div class="material-name">${mat.name}</div>
        <div class="material-grade">${mat.grade}</div>
        <div class="material-origin">🌍 ${mat.origin}</div>
        <div class="material-props">
          ${mat.properties.map(prop => `<span class="material-prop">${prop}</span>`).join("")}
        </div>
      </div>`;
  }).filter(Boolean).join("");

  const stockBranches = AppData.branches.map(b => {
    const s = p.stock[b.id] || 0;
    const cls = s === 0 ? "" : s <= p.minStock ? "low" : "ok";
    return `
      <div class="stock-branch-item">
        <div class="stock-branch-name" style="display:flex;align-items:center;gap:6px">
          <div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>${b.name}
        </div>
        <div class="stock-branch-num ${cls}">${s}</div>
        <div style="font-size:10px;color:#9ca3af">ชิ้น</div>
      </div>`;
  }).join("");

  let tabContent = "";
  if (tab === "detail") {
    tabContent = `
      <div>
        <label class="form-label">ไซส์</label>
        <div class="size-options">${sizeOpts}</div>
        ${dimInfo}
        ${orientUI}
        ${materialTabs}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
          <label class="form-label" style="margin:0">${hasMaterials ? `สี ${AppData.sofaMaterials[matType]?.icon} ${AppData.sofaMaterials[matType]?.name} (${colorList.length} สี)` : "สีที่มี"}</label>
          ${hasMaterials && hasPermission("sofa.add_color") ? `<button class="btn btn-secondary" id="btn-add-color-detail" data-mat="${matType}" style="font-size:11px;padding:4px 10px">+ เพิ่มสี</button>` : ""}
        </div>
        <div class="color-options">${colorOpts}</div>
        ${selectedColor ? `<div class="color-label">สี: ${selectedColor.name} <code style="font-size:10px;background:#f1f5f9;padding:1px 5px;border-radius:3px;margin-left:4px">${selectedColor.code}</code></div>` : ""}
      </div>`;
  } else if (tab === "materials") {
    tabContent = `<div class="material-grid">${matGrid || "<p style='color:#9ca3af'>ไม่มีข้อมูลวัตถุดิบ</p>"}</div>`;
  } else if (tab === "stock") {
    tabContent = `<div class="stock-by-branch">${stockBranches}</div>`;
  }

  const currentBranchStock = p.stock[State.currentBranch] || 0;

  return `
    <div style="margin-bottom:12px">
      <button class="btn btn-secondary" id="back-to-products">← กลับ</button>
    </div>
    <div class="product-detail">
      <div>
        <img class="gallery-main" id="gallery-main-img" src="${p.images[imgIdx]}" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22450%22><rect fill=%22%23f1f5f9%22 width=%22600%22 height=%22450%22/><text x=%22300%22 y=%22240%22 text-anchor=%22middle%22 font-size=%22100%22>🛋️</text></svg>'">
        <div class="gallery-thumbs">${thumbs}</div>
      </div>

      <div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
              ${p.itemCode ? `<code style="background:${AppData.categories.find(c=>c.id===p.categoryId)?.color};color:#fff;padding:3px 10px;border-radius:6px;font-size:14px;font-weight:800">${p.itemCode}</code>` : ''}
              <span style="font-size:11px;color:#6b7280">SKU: ${p.sku}</span>
            </div>
            <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin:4px 0">${p.name}</h2>
            <p style="font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:8px">${p.description}</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          ${(() => {
            const mult = hasMaterials ? (AppData.sofaMaterials[matType]?.priceMultiplier || 1) : 1;
            const effPrice = Math.round(p.price * mult);
            return `<div style="font-size:28px;font-weight:800;color:#6366f1">฿${formatCurrency(effPrice)}</div>
            ${mult !== 1 ? `<div style="font-size:12px;color:#9ca3af"><s>฿${formatCurrency(p.price)}</s> ฐาน · ${AppData.sofaMaterials[matType]?.surcharge}</div>` : `<div style="font-size:13px;color:#9ca3af">/ ชิ้น (ยังไม่รวม VAT)</div>`}`;
          })()}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge ${currentBranchStock === 0 ? "badge-red" : currentBranchStock <= p.minStock ? "badge-yellow" : "badge-green"}">
            ${currentBranchStock === 0 ? "❌ หมด" : currentBranchStock <= p.minStock ? `⚠️ เหลือ ${currentBranchStock} ชิ้น` : `✓ มีสินค้า ${currentBranchStock} ชิ้น`} — ${getCurrentBranch().name}
          </span>
          <span class="badge badge-purple">${AppData.categories.find(c=>c.id===p.categoryId)?.name}</span>
        </div>

        <div class="detail-tabs">
          <div class="detail-tab ${tab === "detail" ? "active" : ""}" data-tab="detail">รายละเอียด</div>
          <div class="detail-tab ${tab === "materials" ? "active" : ""}" data-tab="materials">วัตถุดิบ</div>
          <div class="detail-tab ${tab === "stock" ? "active" : ""}" data-tab="stock">Stock สาขา</div>
        </div>
        ${tabContent}

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" id="add-to-pos" data-pid="${p.id}" style="flex:1">
            🛒 เพิ่มในบิล POS
          </button>
          <button class="btn btn-secondary btn-transfer" data-pid="${p.id}">⇄ โอน Stock</button>
        </div>
      </div>
    </div>`;
}

// ===== CUSTOMERS =====
function renderCustomers() {
  if (State.selectedCustomerView) return renderCustomerDetail();

  const search = State.customerSearch || "";
  const tierFilter = State.customerTierFilter || "all";

  let list = AppData.customers;
  if (tierFilter !== "all") list = list.filter(c => getTierKey(c.totalSpent) === tierFilter);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }

  // Stats
  const totalCust = AppData.customers.length;
  const totalRevenue = AppData.customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalPoints = AppData.customers.reduce((s, c) => s + c.points, 0);
  const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  AppData.customers.forEach(c => tierCounts[getTierKey(c.totalSpent)]++);

  const tierTabs = `
    <button class="filter-btn ${tierFilter === "all" ? "active" : ""}" data-tier="all">ทั้งหมด ${totalCust}</button>
    ${Object.entries(AppData.tiers).map(([k, t]) => `
      <button class="filter-btn ${tierFilter === k ? "active" : ""}" data-tier="${k}" style="border-color:${tierFilter===k?t.color:""};color:${tierFilter===k?'#fff':''};background:${tierFilter===k?t.color:''}">${t.icon} ${t.name} ${tierCounts[k]}</button>
    `).join("")}`;

  const rows = list.map(c => {
    const tierKey = getTierKey(c.totalSpent);
    const tier = AppData.tiers[tierKey];
    const nextTier = Object.entries(AppData.tiers).find(([k, t]) => t.threshold > c.totalSpent);
    const progressPct = nextTier ? Math.min(100, Math.round((c.totalSpent - tier.threshold) / (nextTier[1].threshold - tier.threshold) * 100)) : 100;
    return `
    <tr data-view-customer="${c.id}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar" style="background:linear-gradient(135deg,${tier.color},#ec4899);width:36px;height:36px;font-size:13px">${c.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
          <div>
            <div style="font-weight:700">${c.name}</div>
            <div style="font-size:11px;color:#9ca3af">${c.code} · ตั้งแต่ ${new Date(c.joinDate).toLocaleDateString("th-TH",{year:"numeric",month:"short"})}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12px">${c.phone}<br><span style="color:#9ca3af">${c.email}</span></td>
      <td><span class="role-pill" style="background:${tier.color}">${tier.icon} ${tier.name}</span></td>
      <td style="text-align:right;font-weight:700">฿${formatCurrency(c.totalSpent)}<br><span style="font-size:11px;font-weight:400;color:#9ca3af">${c.totalOrders} ออเดอร์</span></td>
      <td style="text-align:center;font-weight:700;color:#7c3aed">${c.points.toLocaleString()}<br><span style="font-size:10px;font-weight:400;color:#9ca3af">แต้ม</span></td>
      <td>
        <div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;width:80px">
          <div style="background:${tier.color};height:100%;width:${progressPct}%"></div>
        </div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">${nextTier ? `อีก ฿${formatCurrency(nextTier[1].threshold - c.totalSpent)} ขึ้น ${nextTier[1].name}` : "Top tier"}</div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card">
        <div class="kpi-label">ลูกค้าทั้งหมด</div>
        <div class="kpi-value">${totalCust} <small>คน</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ยอดซื้อสะสมรวม</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalRevenue)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">แต้มสะสมรวม</div>
        <div class="kpi-value" style="color:#7c3aed">${totalPoints.toLocaleString()} <small>แต้ม</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">CLV เฉลี่ย</div>
        <div class="kpi-value">฿<span>${formatCurrency(Math.round(totalRevenue/totalCust))}</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
        <div>
          <div class="card-title" style="margin-bottom:2px">ฐานข้อมูลลูกค้า</div>
          <div class="card-subtitle">คลิกที่แถวเพื่อดูรายละเอียด · 1 pt / ฿100 (×ตามระดับ)</div>
        </div>
        <button class="btn btn-primary" id="btn-add-customer">+ เพิ่มลูกค้าใหม่</button>
      </div>

      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="customer-search" placeholder="ค้นหาชื่อ / เบอร์ / Email / รหัส..." value="${search}">
      </div>

      <div class="stock-filters">${tierTabs}</div>

      <div style="overflow-x:auto;margin-top:12px">
        <table class="data-table">
          <thead>
            <tr>
              <th>ลูกค้า</th><th>ติดต่อ</th><th>ระดับสมาชิก</th><th style="text-align:right">ยอดซื้อ</th><th style="text-align:center">แต้ม</th><th>Progress</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:32px;color:#9ca3af">ไม่พบลูกค้า</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function renderCustomerDetail() {
  const c = State.selectedCustomerView;
  const tierKey = getTierKey(c.totalSpent);
  const tier = AppData.tiers[tierKey];

  // Get this customer's purchase history
  const history = AppData.receipts.filter(r => r.customerId === c.id).sort((a, b) => b.date.localeCompare(a.date));

  const histRows = history.length ? history.map(r => {
    const branch = AppData.branches.find(b => b.id === r.branchId);
    return `
    <tr>
      <td style="font-size:11px">${new Date(r.date).toLocaleString("th-TH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
      <td><code style="font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:4px">${r.receiptNo}</code></td>
      <td>${branch?.name}</td>
      <td>${r.items.length} รายการ · ${r.items.reduce((s, i) => s + i.qty, 0)} ชิ้น</td>
      <td style="text-align:right;font-weight:700">฿${formatCurrency(r.total)}</td>
      <td style="text-align:center;color:#7c3aed">+${r.pointsEarned || 0}</td>
      <td><span class="badge ${r.status==='active'?'badge-green':'badge-red'}">${r.status==='active'?'สำเร็จ':'คืนแล้ว'}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7" style="text-align:center;padding:24px;color:#9ca3af">ยังไม่มีประวัติการซื้อ</td></tr>`;

  return `
    <div style="margin-bottom:12px">
      <button class="btn btn-secondary" id="back-to-customers">← กลับ</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div class="user-avatar" style="background:linear-gradient(135deg,${tier.color},#ec4899);width:56px;height:56px;font-size:20px">${c.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:800">${c.name}</div>
            <div style="font-size:11px;color:#9ca3af">${c.code} · สมาชิกตั้งแต่ ${new Date(c.joinDate).toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</div>
            <div style="margin-top:6px"><span class="role-pill" style="background:${tier.color};font-size:12px">${tier.icon} ${tier.name} Member</span></div>
          </div>
          <button class="btn btn-secondary" id="btn-edit-customer" data-cid="${c.id}">✏️ แก้ไข</button>
        </div>
        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          <div><b>📞 โทร:</b> ${c.phone}</div>
          <div><b>📧 Email:</b> ${c.email}</div>
          <div style="grid-column:1/-1"><b>📍 ที่อยู่:</b> ${c.address}</div>
          ${c.notes ? `<div style="grid-column:1/-1"><b>📝 หมายเหตุ:</b> ${c.notes}</div>` : ""}
        </div>
      </div>

      <div class="card">
        <div class="card-title">ระดับสมาชิก & แต้ม</div>
        <div style="background:linear-gradient(135deg,${tier.color}20,${tier.color}05);border-radius:12px;padding:16px;border:2px solid ${tier.color}40">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:14px;color:#6b7280">ยอดซื้อสะสม</div>
            <div style="font-size:20px;font-weight:800">฿${formatCurrency(c.totalSpent)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:14px;color:#6b7280">แต้มคงเหลือ</div>
            <div style="font-size:20px;font-weight:800;color:#7c3aed">${c.points.toLocaleString()} pts</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:14px;color:#6b7280">จำนวนออเดอร์</div>
            <div style="font-size:20px;font-weight:800">${c.totalOrders}</div>
          </div>
        </div>
        <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;color:#374151">
          <b>${tier.icon} ${tier.name} Perks:</b><br>${tier.perks}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📋 ประวัติการซื้อ (${history.length} ครั้ง)</div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>เลขที่</th><th>สาขา</th><th>รายการ</th><th style="text-align:right">ยอด</th><th style="text-align:center">แต้ม</th><th>สถานะ</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>
    </div>`;
}

function openCustomerModal(customerId = null) {
  const c = customerId ? AppData.customers.find(cu => cu.id === customerId) : { id: null, code: "", name: "", phone: "", email: "", address: "", notes: "" };
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">${customerId ? "✏️ แก้ไขข้อมูลลูกค้า" : "👤 เพิ่มลูกค้าใหม่"}</div>
      <div class="form-group"><label class="form-label">ชื่อ-สกุล</label><input class="form-input" id="c-name" value="${c.name}" placeholder="เช่น คุณสมชาย ใจดี"></div>
      <div class="form-group"><label class="form-label">เบอร์โทร</label><input class="form-input" id="c-phone" value="${c.phone}" placeholder="081-xxx-xxxx"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="c-email" value="${c.email}"></div>
      <div class="form-group"><label class="form-label">ที่อยู่</label><textarea class="form-input" id="c-address" rows="2">${c.address}</textarea></div>
      <div class="form-group"><label class="form-label">หมายเหตุ / Preference</label><textarea class="form-input" id="c-notes" rows="2">${c.notes}</textarea></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="c-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="c-save" style="flex:2">💾 บันทึก</button>
      </div>
    </div>`;
  modal.querySelector("#c-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#c-save").addEventListener("click", () => {
    const data = {
      name: modal.querySelector("#c-name").value.trim(),
      phone: modal.querySelector("#c-phone").value.trim(),
      email: modal.querySelector("#c-email").value.trim(),
      address: modal.querySelector("#c-address").value.trim(),
      notes: modal.querySelector("#c-notes").value.trim(),
    };
    if (!data.name || !data.phone) { showToast("⚠️ กรอกชื่อและเบอร์โทร", "error"); return; }
    if (customerId) {
      Object.assign(c, data);
      logAction("customer.updated", { id: c.id, name: c.name });
      showToast("✅ แก้ไขลูกค้าสำเร็จ", "success");
    } else {
      const newId = (AppData.customers.length ? Math.max(...AppData.customers.map(x => x.id)) : 0) + 1;
      const code = "CUST" + String(newId).padStart(3, "0");
      AppData.customers.push({ id: newId, code, ...data, joinDate: new Date().toISOString().split("T")[0], totalSpent: 0, totalOrders: 0, points: 0 });
      logAction("customer.created", { id: newId, name: data.name });
      showToast("✅ เพิ่มลูกค้าสำเร็จ", "success");
    }
    modal.remove();
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== RECEIPTS / REFUND =====
function renderReceipts() {
  const search = State.receiptSearch || "";
  const dateFilter = State.receiptDate || "today";
  const branchFilter = State.receiptBranchFilter || (isBranchScoped() ? State.currentBranch : "all");

  const today = new Date().toISOString().split("T")[0];
  let list = AppData.receipts.slice();

  if (dateFilter === "today") list = list.filter(r => r.date.startsWith(today));
  else if (dateFilter === "week") {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    list = list.filter(r => r.date >= weekAgo);
  }

  if (branchFilter !== "all") list = list.filter(r => r.branchId === parseInt(branchFilter));
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(r =>
      r.receiptNo.toLowerCase().includes(q) ||
      (r.customerName || "").toLowerCase().includes(q) ||
      (r.cashierName || "").toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => b.date.localeCompare(a.date));
  const display = list.slice(0, 100);

  const totalAmt = list.reduce((s, r) => s + (r.status === "active" ? r.total : 0), 0);
  const refundedAmt = list.reduce((s, r) => s + (r.status === "refunded" ? r.refundAmount || r.total : 0), 0);

  const branchOpts = `<option value="${isBranchScoped() ? State.currentBranch : 'all'}">${isBranchScoped() ? getCurrentBranch().name : 'ทุกสาขา'}</option>` +
    (isBranchScoped() ? "" : AppData.branches.map(b => `<option value="${b.id}" ${branchFilter == b.id ? "selected" : ""}>${b.name}</option>`).join(""));

  const canRefund = hasPermission("sales.refund");

  const rows = display.map(r => {
    const branch = AppData.branches.find(b => b.id === r.branchId);
    const isRefunded = r.status === "refunded";
    return `
    <tr style="${isRefunded ? "background:#fef2f2" : ""}">
      <td style="font-size:11px;color:#6b7280;white-space:nowrap">${new Date(r.date).toLocaleString("th-TH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
      <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px">${r.receiptNo}</code></td>
      <td>${branch?.code || "-"}</td>
      <td>${r.cashierName || "-"}</td>
      <td>${r.customerName ? `<b>${r.customerName}</b>` : `<span style="color:#9ca3af">walk-in</span>`}</td>
      <td>${r.items.length} รายการ · ${r.items.reduce((s, i) => s + i.qty, 0)} ชิ้น</td>
      <td style="text-align:right;font-weight:700">฿${formatCurrency(r.total)}</td>
      <td><span class="badge ${isRefunded ? 'badge-red' : 'badge-green'}">${isRefunded ? '↩️ คืน' : '✓ สำเร็จ'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-view-receipt="${r.id}">👁️</button>
          ${!isRefunded && canRefund ? `<button class="btn btn-danger" data-refund-receipt="${r.id}">↩️ คืน</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card">
        <div class="kpi-label">ใบเสร็จที่แสดง</div>
        <div class="kpi-value">${list.length} <small>ใบ</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ยอดขายสุทธิ</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalAmt)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ยอดคืนสินค้า</div>
        <div class="kpi-value" style="color:#dc2626">฿<span>${formatCurrency(refundedAmt)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ยอดสุทธิหลังคืน</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalAmt - refundedAmt)}</span></div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <div class="card-title" style="margin-bottom:2px">ใบเสร็จย้อนหลัง</div>
          <div class="card-subtitle">${canRefund ? "คุณสามารถยกเลิก/คืนสินค้าได้" : "ไม่มีสิทธิ์ในการคืนสินค้า"}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <select class="form-input" id="receipt-date" style="width:120px">
            <option value="today" ${dateFilter==='today'?'selected':''}>วันนี้</option>
            <option value="week" ${dateFilter==='week'?'selected':''}>7 วัน</option>
            <option value="all" ${dateFilter==='all'?'selected':''}>ทั้งหมด</option>
          </select>
          <select class="form-input" id="receipt-branch" style="width:140px">${branchOpts}</select>
        </div>
      </div>
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="receipt-search" placeholder="ค้นหา receipt no / ลูกค้า / cashier..." value="${search}">
      </div>
      <div style="overflow-x:auto;max-height:600px">
        <table class="data-table">
          <thead style="position:sticky;top:0;background:#fff;z-index:1">
            <tr><th>เวลา</th><th>เลขที่</th><th>สาขา</th><th>Cashier</th><th>ลูกค้า</th><th>รายการ</th><th style="text-align:right">ยอด</th><th>สถานะ</th><th>จัดการ</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="9" style="text-align:center;padding:40px;color:#9ca3af">ไม่มีใบเสร็จ</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function openReceiptDetail(receiptId) {
  const r = AppData.receipts.find(x => x.id === receiptId);
  if (!r) return;
  const branch = AppData.branches.find(b => b.id === r.branchId);
  const itemsList = r.items.map(i => `${i.name.padEnd(24)} ${String(i.qty).padStart(2)} × ฿${formatCurrency(i.price)} = ฿${formatCurrency(i.price * i.qty)}`).join("\n");
  const refundInfo = r.status === "refunded" ? `\n    -----------------------------------\n    ❌ ยกเลิก/คืนสินค้า\n    คืนเมื่อ: ${new Date(r.refundDate).toLocaleString("th-TH")}\n    โดย: ${r.refundedBy}\n    เหตุผล: ${r.refundReason || "-"}\n    คืนเงิน: ฿${formatCurrency(r.refundAmount || r.total)}` : "";

  const text = `
    ===================================
          🛋️ FURNITURE HOUSE POS
    ===================================
    สาขา: ${branch?.name}
    แคชเชียร์: ${r.cashierName}
    ${r.customerName ? `ลูกค้า: ${r.customerName} (${r.customerCode})` : ""}
    วันที่: ${new Date(r.date).toLocaleString("th-TH")}
    เลขที่: ${r.receiptNo}
    -----------------------------------
    ${itemsList}
    -----------------------------------
    ยอดรวม          ฿${formatCurrency(r.subtotal)}
    ${r.discAmount > 0 ? `ส่วนลด ${r.discPct||0}%      −฿${formatCurrency(r.discAmount)}\n    ${r.discReason ? `เหตุผล: ${r.discReason}\n    ` : ""}` : ""}
    ${r.pointsRedeemed > 0 ? `แต้มที่ใช้      −฿${formatCurrency(r.pointsRedeemed)}\n    ` : ""}VAT 7%           ฿${formatCurrency(r.vat)}
    ยอดสุทธิ         ฿${formatCurrency(r.total)}
    -----------------------------------
    ชำระโดย: ${AppData.paymentMethods.find(m => m.id === r.payment)?.name}
    ${r.pointsEarned ? `แต้มที่ได้รับ: +${r.pointsEarned} pts` : ""}${refundInfo}
    ===================================`;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-title">📄 ใบเสร็จ ${r.receiptNo}</div>
      <div class="receipt"><pre style="white-space:pre-wrap;font-size:12px">${text}</pre></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="r-close" style="flex:1">ปิด</button>
        ${r.status === "active" && hasPermission("sales.refund") ? `<button class="btn btn-danger" id="r-refund" style="flex:2">↩️ ยกเลิก / คืนสินค้า</button>` : ""}
      </div>
    </div>`;
  modal.querySelector("#r-close").addEventListener("click", () => modal.remove());
  modal.querySelector("#r-refund")?.addEventListener("click", () => { modal.remove(); openRefundModal(receiptId); });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function openRefundModal(receiptId) {
  const r = AppData.receipts.find(x => x.id === receiptId);
  if (!r || r.status !== "active") return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const itemRows = r.items.map((it, idx) => `
    <tr>
      <td><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-item-idx="${idx}" checked style="accent-color:#6366f1"> ${it.name}</label></td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">฿${formatCurrency(it.price * it.qty)}</td>
    </tr>`).join("");

  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-title">↩️ ยกเลิก / คืนสินค้า — ${r.receiptNo}</div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#991b1b">
        ⚠️ การคืนสินค้าจะ:<br>
        • คืนสินค้าเข้า stock สาขา<br>
        • หักยอดขายวันนี้<br>
        • คืนแต้มที่ลูกค้าได้รับ<br>
        • บันทึก audit log ไม่สามารถย้อนกลับได้
      </div>

      <div style="font-size:13px;margin-bottom:8px"><b>รายการในบิล</b> (เลือกที่ต้องการคืน):</div>
      <table class="data-table" style="margin-bottom:12px">
        <thead><tr><th>สินค้า</th><th style="text-align:center">จำนวน</th><th style="text-align:right">ยอด</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="form-group">
        <label class="form-label">เหตุผลในการคืน <span style="color:#dc2626">*</span></label>
        <select class="form-input" id="rf-reason-type">
          <option value="">— เลือกเหตุผล —</option>
          <option value="defect">สินค้ามีตำหนิ / เสียหาย</option>
          <option value="wrong">ลูกค้าได้รับสินค้าผิด</option>
          <option value="cancel">ลูกค้ายกเลิกการสั่งซื้อ</option>
          <option value="size">ขนาดไม่พอดี / ไม่ตรงตามต้องการ</option>
          <option value="other">อื่นๆ</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">รายละเอียดเพิ่มเติม</label>
        <textarea class="form-input" id="rf-detail" rows="2" placeholder="บันทึกรายละเอียด..."></textarea>
      </div>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px;margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700">
          <span>คืนเงินให้ลูกค้า:</span>
          <span style="color:#16a34a;font-size:18px" id="rf-amount">฿${formatCurrency(r.total)}</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="rf-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-danger" id="rf-confirm" style="flex:2">↩️ ยืนยันการคืน</button>
      </div>
    </div>`;

  // Update refund amount when checkboxes change
  function updateAmount() {
    let amt = 0;
    let checkedQty = 0;
    let totalQty = 0;
    modal.querySelectorAll("[data-item-idx]").forEach(cb => {
      const idx = parseInt(cb.dataset.itemIdx);
      const it = r.items[idx];
      totalQty += it.qty;
      if (cb.checked) {
        amt += it.price * it.qty;
        checkedQty += it.qty;
      }
    });
    // Apply same discount/vat ratio
    const ratio = r.subtotal > 0 ? amt / r.subtotal : 0;
    const refundTotal = Math.round(r.total * ratio);
    modal.querySelector("#rf-amount").textContent = `฿${formatCurrency(refundTotal)}`;
    modal.dataset.refundAmount = refundTotal;
    modal.dataset.refundRatio = ratio;
  }
  modal.querySelectorAll("[data-item-idx]").forEach(cb => cb.addEventListener("change", updateAmount));
  updateAmount();

  modal.querySelector("#rf-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#rf-confirm").addEventListener("click", () => {
    const reasonType = modal.querySelector("#rf-reason-type").value;
    if (!reasonType) { showToast("⚠️ กรุณาเลือกเหตุผล", "error"); return; }
    const detail = modal.querySelector("#rf-detail").value;
    const reason = reasonType + (detail ? ` — ${detail}` : "");
    const refundAmount = parseInt(modal.dataset.refundAmount) || r.total;
    const ratio = parseFloat(modal.dataset.refundRatio) || 1;

    // Get selected items
    const selectedIdxs = Array.from(modal.querySelectorAll("[data-item-idx]:checked")).map(cb => parseInt(cb.dataset.itemIdx));
    const isFullRefund = selectedIdxs.length === r.items.length;

    if (selectedIdxs.length === 0) { showToast("⚠️ เลือกอย่างน้อย 1 รายการ", "error"); return; }

    if (!confirm(`ยืนยันคืน ${selectedIdxs.length} รายการ มูลค่า ฿${formatCurrency(refundAmount)}?`)) return;

    // 1. Return stock to branch
    selectedIdxs.forEach(idx => {
      const it = r.items[idx];
      const product = AppData.products.find(p => p.id === it.productId);
      if (product) {
        product.stock[r.branchId] = (product.stock[r.branchId] || 0) + it.qty;
      }
    });

    // 2. Deduct from today's sales (if today)
    const today = new Date().toISOString().split("T")[0];
    if (r.date.startsWith(today)) {
      AppData.todaySales[r.branchId].amount -= refundAmount;
      if (isFullRefund) AppData.todaySales[r.branchId].count -= 1;
    }

    // 3. Reverse customer points if applicable
    if (r.customerId) {
      const cust = AppData.customers.find(c => c.id === r.customerId);
      if (cust) {
        const pointsToReverse = Math.round((r.pointsEarned || 0) * ratio);
        cust.points = Math.max(0, cust.points - pointsToReverse);
        cust.totalSpent = Math.max(0, cust.totalSpent - refundAmount);
        if (isFullRefund) cust.totalOrders = Math.max(0, cust.totalOrders - 1);
        // Refund redeemed points
        if (isFullRefund && r.pointsRedeemed > 0) {
          cust.points += r.pointsRedeemed / 1; // points back
        }
      }
    }

    // 4. Mark receipt as refunded
    r.status = "refunded";
    r.refundDate = new Date().toISOString();
    r.refundedBy = State.currentUser.name;
    r.refundReason = reason;
    r.refundAmount = refundAmount;
    r.refundedItems = selectedIdxs.map(idx => ({ idx, ...r.items[idx] }));

    // 5. Audit
    logAction("sale.refunded", {
      receiptNo: r.receiptNo,
      reason,
      amount: refundAmount,
      items: selectedIdxs.length,
      branchId: r.branchId,
    });

    modal.remove();
    showToast(`✅ คืนสินค้าสำเร็จ ฿${formatCurrency(refundAmount)}`, "success");
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== QUOTATION =====
function renderQuotations() {
  const filterStatus = State.quoteFilter || "all";
  const search = State.quoteSearch || "";
  let list = AppData.quotations.slice();

  if (filterStatus !== "all") list = list.filter(q => q.status === filterStatus);
  if (search) {
    const qq = search.toLowerCase();
    list = list.filter(q => q.quoteNo.toLowerCase().includes(qq) || (q.customerName || "").toLowerCase().includes(qq));
  }
  list.sort((a, b) => b.date.localeCompare(a.date));

  const counts = { draft: 0, sent: 0, accepted: 0, expired: 0, cancelled: 0 };
  AppData.quotations.forEach(q => { counts[q.status] = (counts[q.status] || 0) + 1; });
  const totalValue = AppData.quotations.filter(q => q.status === "sent" || q.status === "accepted").reduce((s, q) => s + q.total, 0);
  const acceptedValue = AppData.quotations.filter(q => q.status === "accepted").reduce((s, q) => s + q.total, 0);

  const statusBadges = {
    draft: { name: "ฉบับร่าง", color: "#9ca3af" },
    sent: { name: "ส่งให้ลูกค้าแล้ว", color: "#0ea5e9" },
    accepted: { name: "ลูกค้าตกลง", color: "#16a34a" },
    expired: { name: "หมดอายุ", color: "#dc2626" },
    cancelled: { name: "ยกเลิก", color: "#64748b" },
  };

  const filterBtns = `
    <button class="filter-btn ${filterStatus === "all" ? "active" : ""}" data-qfilter="all">ทั้งหมด ${AppData.quotations.length}</button>
    ${Object.entries(statusBadges).map(([k, s]) => `<button class="filter-btn ${filterStatus === k ? "active" : ""}" data-qfilter="${k}" style="${filterStatus===k?`background:${s.color};color:#fff;border-color:${s.color}`:''}">${s.name} ${counts[k] || 0}</button>`).join("")}`;

  const rows = list.map(q => {
    const s = statusBadges[q.status];
    const isExpired = q.validUntil && new Date(q.validUntil) < new Date() && q.status !== "accepted" && q.status !== "cancelled";
    if (isExpired && q.status !== "expired") q.status = "expired";
    const branch = AppData.branches.find(b => b.id === q.branchId);
    return `
    <tr>
      <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px">${q.quoteNo}</code><div style="font-size:10px;color:#9ca3af;margin-top:2px">${new Date(q.date).toLocaleDateString("th-TH",{day:"2-digit",month:"short",year:"numeric"})}</div></td>
      <td>${branch?.code || "-"}</td>
      <td><b>${q.customerName || "-"}</b><div style="font-size:11px;color:#9ca3af">${q.customerPhone || ""}</div></td>
      <td>${q.items.length} รายการ · ${q.items.reduce((s,i) => s+i.qty,0)} ชิ้น</td>
      <td style="text-align:right;font-weight:700">฿${formatCurrency(q.total)}</td>
      <td>${q.validUntil ? `<div style="font-size:11px">ถึง ${new Date(q.validUntil).toLocaleDateString("th-TH",{day:"2-digit",month:"short"})}</div>` : ""}</td>
      <td><span class="role-pill" style="background:${statusBadges[q.status].color}">${statusBadges[q.status].name}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-view-quote="${q.id}">👁️</button>
          ${q.status !== "accepted" && q.status !== "cancelled" ? `<button class="btn btn-primary" data-convert-quote="${q.id}" style="font-size:11px">→ ขาย</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card"><div class="kpi-label">ใบเสนอราคาทั้งหมด</div><div class="kpi-value">${AppData.quotations.length} <small>ใบ</small></div></div>
      <div class="kpi-card"><div class="kpi-label">ที่ active (sent + accepted)</div><div class="kpi-value" style="color:#0ea5e9">${counts.sent + counts.accepted}</div></div>
      <div class="kpi-card"><div class="kpi-label">มูลค่ารวม (sent+accepted)</div><div class="kpi-value">฿<span>${formatCurrency(totalValue)}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">มูลค่าที่ลูกค้าตกลงแล้ว</div><div class="kpi-value" style="color:#16a34a">฿<span>${formatCurrency(acceptedValue)}</span></div></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div><div class="card-title" style="margin:0">📝 ใบเสนอราคา</div><div class="card-subtitle">บันทึกตะกร้าเป็นใบเสนอราคา · แปลงเป็นบิลขายได้ทันทีเมื่อลูกค้าตกลง</div></div>
      </div>
      <div class="search-bar"><span>🔍</span><input type="text" id="quote-search" placeholder="ค้นหา quote no / ลูกค้า..." value="${search}"></div>
      <div class="stock-filters">${filterBtns}</div>
      <div style="overflow-x:auto;margin-top:12px">
        <table class="data-table">
          <thead><tr><th>เลขที่ Quote</th><th>สาขา</th><th>ลูกค้า</th><th>รายการ</th><th style="text-align:right">ยอด</th><th>หมดอายุ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8" style="text-align:center;padding:32px;color:#9ca3af">ยังไม่มีใบเสนอราคา</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function openSaveQuoteModal() {
  if (!State.cart.length) return;
  const cust = State.selectedCustomer ? AppData.customers.find(c => c.id === State.selectedCustomer) : null;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  // Compute totals same as POS
  const subtotal = State.cart.reduce((s, i) => s + (i.unitPrice || i.product.price) * i.qty, 0);
  const validDays = AppData.appSettings.quotationValidDays;
  const validUntil = new Date(Date.now() + validDays * 86400000).toISOString().split("T")[0];

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">📝 บันทึกเป็นใบเสนอราคา</div>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#0c4a6e">
        💡 ใบเสนอราคาจะ <b>ไม่หัก stock</b> และ <b>ไม่บันทึกยอดขาย</b> — เก็บไว้ส่งให้ลูกค้าพิจารณา · เมื่อลูกค้าตกลงให้กดปุ่ม "→ ขาย" ในหน้าใบเสนอราคา
      </div>
      <div class="form-group"><label class="form-label">ลูกค้า</label><div style="background:#f8fafc;padding:10px;border-radius:8px;font-size:13px">${cust ? `<b>${cust.name}</b><br>📞 ${cust.phone}` : `<span style="color:#dc2626">⚠️ ยังไม่มีลูกค้า — แนะนำให้ผูกลูกค้าก่อนบันทึก</span>`}</div></div>

      <div class="form-group"><label class="form-label">หมดอายุภายใน</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="q-validDays" value="${validDays}" min="1" max="180" style="width:80px;padding:6px" class="form-input">
          <span style="font-size:13px;color:#6b7280">วัน · ถึงวันที่</span>
          <input type="date" id="q-validUntil" value="${validUntil}" class="form-input" style="flex:1;padding:6px">
        </div>
      </div>

      <div class="form-group"><label class="form-label">หมายเหตุ</label><textarea id="q-note" class="form-input" rows="2" placeholder="เช่น ค่าจัดส่งคิดต่างหาก / กรุณาตอบกลับภายในสัปดาห์"></textarea></div>

      <div style="background:#f8fafc;padding:10px;border-radius:8px;font-size:13px;font-weight:700;display:flex;justify-content:space-between">
        <span>ยอดรวม (ไม่รวม VAT):</span>
        <span style="color:#6366f1;font-size:16px">฿${formatCurrency(subtotal)}</span>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="q-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="q-save" style="flex:2">💾 บันทึกใบเสนอราคา</button>
      </div>
    </div>`;

  // Sync valid days <-> date
  modal.querySelector("#q-validDays").addEventListener("input", e => {
    const d = parseInt(e.target.value) || 1;
    modal.querySelector("#q-validUntil").value = new Date(Date.now() + d * 86400000).toISOString().split("T")[0];
  });

  modal.querySelector("#q-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#q-save").addEventListener("click", () => {
    const validUntil = modal.querySelector("#q-validUntil").value;
    const note = modal.querySelector("#q-note").value;

    const counter = AppData.quotations.length + 1;
    const quoteNo = `QT-${new Date().getFullYear()}-${String(counter).padStart(4, "0")}`;
    const items = State.cart.map(i => ({
      productId: i.product.id,
      sku: i.product.sku,
      name: i.product.name,
      qty: i.qty,
      price: i.unitPrice || i.product.price,
      basePrice: i.product.price,
      size: i.size?.code, sizeLabel: i.size?.label,
      color: i.color?.code, colorName: i.color?.name,
      materialType: i.materialType,
      materialName: i.materialType ? AppData.sofaMaterials[i.materialType]?.name : null,
    }));

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);

    AppData.quotations.unshift({
      id: Date.now() + Math.random(),
      quoteNo,
      date: new Date().toISOString(),
      branchId: State.currentBranch,
      cashierId: State.currentUser.id,
      cashierName: State.currentUser.name,
      customerId: cust?.id || null,
      customerName: cust?.name || null,
      customerPhone: cust?.phone || null,
      customerCode: cust?.code || null,
      items,
      subtotal: total,
      total,
      validUntil,
      note,
      status: "draft",
    });

    logAction("quotation.created", { quoteNo, total, validUntil, customerName: cust?.name });
    modal.remove();
    showToast(`✅ สร้าง ${quoteNo} สำเร็จ`, "success");
    State.cart = [];
    State.selectedCustomer = null;
    State.deposit = { enabled: false, type: "percent", value: 30 };
    State.discount = { type: "percent", value: 0, reason: "" };
    State.delivery = { zoneId: "pickup", address: "", recipientName: "", recipientPhone: "", date: "", timeSlot: "anytime", note: "", customFee: 0, customReason: "" };
    State.payMethod = null;
    State.currentPage = "quotations";
    render();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function openQuoteDetail(quoteId) {
  const q = AppData.quotations.find(x => x.id === quoteId);
  if (!q) return;
  const branch = AppData.branches.find(b => b.id === q.branchId);
  const itemsList = q.items.map(i => `${i.name}${i.materialName ? ` [${i.materialName}]` : ""}${i.colorName ? ` (${i.colorName})` : ""} × ${i.qty} × ฿${formatCurrency(i.price)} = ฿${formatCurrency(i.price * i.qty)}`).join("\n");

  const text = `
    ===================================
          🛋️ FURNITURE HOUSE
            ใบเสนอราคา QUOTATION
    ===================================
    เลขที่: ${q.quoteNo}
    วันที่: ${new Date(q.date).toLocaleDateString("th-TH")}
    หมดอายุ: ${q.validUntil}
    สาขา: ${branch?.name}
    -----------------------------------
    ลูกค้า: ${q.customerName || "-"}
    โทร: ${q.customerPhone || "-"}
    -----------------------------------
    ${itemsList}
    -----------------------------------
    ยอดรวม          ฿${formatCurrency(q.total)}
    (ไม่รวม VAT, ค่าจัดส่ง)
    ${q.note ? `\n    หมายเหตุ: ${q.note}` : ""}
    ===================================`;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-title">📝 ${q.quoteNo}</div>
      <div class="receipt"><pre style="white-space:pre-wrap;font-size:12px">${text}</pre></div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="qd-close" style="flex:1">ปิด</button>
        ${q.status === "draft" ? `<button class="btn btn-secondary" id="qd-send">📨 บันทึกว่าส่งแล้ว</button>` : ""}
        ${q.status !== "accepted" && q.status !== "cancelled" ? `<button class="btn btn-primary" id="qd-convert" style="flex:2">→ แปลงเป็นบิลขาย</button>` : ""}
      </div>
    </div>`;

  modal.querySelector("#qd-close").addEventListener("click", () => modal.remove());
  modal.querySelector("#qd-send")?.addEventListener("click", () => {
    q.status = "sent";
    logAction("quotation.sent", { quoteNo: q.quoteNo });
    modal.remove();
    showToast(`✅ ${q.quoteNo} ส่งให้ลูกค้าแล้ว`, "success");
    renderMain();
  });
  modal.querySelector("#qd-convert")?.addEventListener("click", () => {
    convertQuoteToSale(q.id);
    modal.remove();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function convertQuoteToSale(quoteId) {
  const q = AppData.quotations.find(x => x.id === quoteId);
  if (!q) return;
  // Load quote items into cart
  State.cart = q.items.map(it => {
    const product = AppData.products.find(p => p.id === it.productId);
    if (!product) return null;
    return {
      product,
      size: product.sizes.find(s => s.code === it.size) || product.sizes[0],
      color: { code: it.color, name: it.colorName, hex: "#888" },
      materialType: it.materialType,
      unitPrice: it.price,
      qty: it.qty,
    };
  }).filter(Boolean);

  if (q.customerId) State.selectedCustomer = q.customerId;
  State.currentBranch = q.branchId;
  State.currentPage = "pos";
  q.status = "accepted";
  logAction("quotation.accepted", { quoteNo: q.quoteNo, total: q.total });
  showToast(`✅ Quote → ขาย: ${q.quoteNo} โหลดสินค้าเข้าตะกร้าแล้ว · กดชำระเงินได้เลย`, "success");
  render();
}

// ===== OUTSTANDING BALANCES =====
function renderOutstanding() {
  const search = State.outstandingSearch || "";
  let list = AppData.receipts.filter(r => r.status === "active" && r.outstandingBalance > 0);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(r => r.receiptNo.toLowerCase().includes(q) || (r.customerName || "").toLowerCase().includes(q));
  }
  list.sort((a, b) => b.date.localeCompare(a.date));

  const totalOutstanding = list.reduce((s, r) => s + r.outstandingBalance, 0);
  const totalDeposit = list.reduce((s, r) => s + (r.depositPaid || 0), 0);

  const rows = list.map(r => {
    const branch = AppData.branches.find(b => b.id === r.branchId);
    const cust = r.customerId ? AppData.customers.find(c => c.id === r.customerId) : null;
    const daysOld = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
    return `
    <tr>
      <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px">${r.receiptNo}</code><div style="font-size:10px;color:#9ca3af;margin-top:2px">${new Date(r.date).toLocaleDateString("th-TH",{day:"2-digit",month:"short"})} (${daysOld} วันก่อน)</div></td>
      <td>${branch?.code || "-"}</td>
      <td>${cust ? `<b>${cust.name}</b><div style="font-size:11px;color:#9ca3af">📞 ${cust.phone}</div>` : "<span style='color:#dc2626'>⚠️ Walk-in (ไม่มีข้อมูลติดต่อ)</span>"}</td>
      <td style="text-align:right">฿${formatCurrency(r.total)}</td>
      <td style="text-align:right;color:#16a34a;font-weight:700">฿${formatCurrency(r.depositPaid || 0)}</td>
      <td style="text-align:right;color:#dc2626;font-weight:800">฿${formatCurrency(r.outstandingBalance)}</td>
      <td><div style="background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;width:80px"><div style="background:#16a34a;height:100%;width:${Math.round((r.depositPaid || 0)/r.total*100)}%"></div></div><div style="font-size:10px;color:#6b7280;text-align:center;margin-top:2px">${Math.round((r.depositPaid || 0)/r.total*100)}%</div></td>
      <td><div class="row-actions"><button class="btn btn-primary" data-settle="${r.id}" style="font-size:11px">💵 รับเงินส่วนที่เหลือ</button></div></td>
    </tr>`;
  }).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card"><div class="kpi-label">บิลที่ยังค้างชำระ</div><div class="kpi-value">${list.length} <small>บิล</small></div></div>
      <div class="kpi-card"><div class="kpi-label">มัดจำที่รับมาแล้ว</div><div class="kpi-value" style="color:#16a34a">฿<span>${formatCurrency(totalDeposit)}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">ยอดค้างชำระรวม</div><div class="kpi-value" style="color:#dc2626">฿<span>${formatCurrency(totalOutstanding)}</span></div></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><div class="card-title" style="margin:0">💰 ยอดค้างชำระ</div><div class="card-subtitle">บิลที่รับมัดจำ — ยังต้องเก็บเงินส่วนที่เหลือ</div></div></div>
      <div class="search-bar"><span>🔍</span><input type="text" id="outstanding-search" placeholder="ค้นหา receipt / ลูกค้า..." value="${search}"></div>
      <div style="overflow-x:auto;margin-top:12px"><table class="data-table">
        <thead><tr><th>เลขที่</th><th>สาขา</th><th>ลูกค้า</th><th style="text-align:right">ยอดรวม</th><th style="text-align:right">มัดจำ</th><th style="text-align:right">ค้าง</th><th>Progress</th><th>จัดการ</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" style="text-align:center;padding:32px;color:#9ca3af">✅ ไม่มียอดค้างชำระ</td></tr>`}</tbody>
      </table></div>
    </div>`;
}

function openSettleBalanceModal(receiptId) {
  const r = AppData.receipts.find(x => x.id === receiptId);
  if (!r) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  const payOpts = AppData.paymentMethods.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join("");

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">💵 รับเงินส่วนที่เหลือ — ${r.receiptNo}</div>
      <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;font-size:13px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>ยอดรวม:</span><b>฿${formatCurrency(r.total)}</b></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>มัดจำที่รับแล้ว:</span><b style="color:#16a34a">฿${formatCurrency(r.depositPaid || 0)}</b></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:6px"><span style="font-weight:700">ค้างชำระ:</span><b style="color:#dc2626;font-size:16px">฿${formatCurrency(r.outstandingBalance)}</b></div>
      </div>
      <div class="form-group"><label class="form-label">วิธีชำระ</label><select class="form-input" id="set-method">${payOpts}</select></div>
      <div class="form-group"><label class="form-label">หมายเหตุ</label><input type="text" class="form-input" id="set-note" placeholder="เช่น ลูกค้ารับสินค้าวันนี้"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="set-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="set-confirm" style="flex:2">✅ ยืนยันรับเงิน ฿${formatCurrency(r.outstandingBalance)}</button>
      </div>
    </div>`;
  modal.querySelector("#set-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#set-confirm").addEventListener("click", () => {
    const method = modal.querySelector("#set-method").value;
    const note = modal.querySelector("#set-note").value;
    if (!r.payments) r.payments = [{ method: r.payment, amount: r.depositPaid || 0, date: r.date }];
    r.payments.push({ method, amount: r.outstandingBalance, date: new Date().toISOString(), note });
    r.depositPaid = r.total;
    r.outstandingBalance = 0;
    r.fullyPaidDate = new Date().toISOString();
    AppData.todaySales[r.branchId].amount += r.outstandingBalance; // already 0 so no add
    logAction("payment.balance_settled", { receiptNo: r.receiptNo, method, note });
    modal.remove();
    showToast(`✅ รับเงินส่วนที่เหลือ ${r.receiptNo} สำเร็จ`, "success");
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== Z-REPORT (END OF DAY) =====
function renderZReport() {
  const today = new Date().toISOString().split("T")[0];
  const branchFilter = State.zreportBranch || (isBranchScoped() ? State.currentBranch : "all");

  // Today's receipts (active only)
  let todayReceipts = AppData.receipts.filter(r => r.date.startsWith(today) && r.status === "active");
  if (branchFilter !== "all") todayReceipts = todayReceipts.filter(r => r.branchId === parseInt(branchFilter));

  const stats = {
    revenue: 0, items: 0, customers: 0,
    byPayment: {},
    byCashier: {},
    byCategory: {},
    refunded: 0,
    deposits: 0,
    outstanding: 0,
  };
  AppData.paymentMethods.forEach(m => stats.byPayment[m.id] = 0);

  todayReceipts.forEach(r => {
    stats.revenue += r.total;
    stats.customers++;
    stats.items += r.items.reduce((s, i) => s + i.qty, 0);
    stats.byPayment[r.payment] = (stats.byPayment[r.payment] || 0) + r.total;
    stats.byCashier[r.cashierName] = (stats.byCashier[r.cashierName] || 0) + r.total;
    if (r.outstandingBalance > 0) {
      stats.deposits += r.depositPaid || 0;
      stats.outstanding += r.outstandingBalance;
    }
    r.items.forEach(it => {
      const p = AppData.products.find(pp => pp.id === it.productId);
      const cat = p ? AppData.categories.find(c => c.id === p.categoryId) : null;
      const k = cat?.name || "อื่นๆ";
      stats.byCategory[k] = (stats.byCategory[k] || 0) + it.price * it.qty;
    });
  });

  const refundedToday = AppData.receipts.filter(r => r.date.startsWith(today) && r.status === "refunded");
  stats.refunded = refundedToday.reduce((s, r) => s + r.total, 0);

  const branchOpts = isBranchScoped()
    ? `<option value="${State.currentBranch}">${getCurrentBranch().name}</option>`
    : `<option value="all">ทุกสาขา</option>` + AppData.branches.filter(b => !b.isWarehouse).map(b => `<option value="${b.id}" ${branchFilter == b.id ? "selected" : ""}>${b.name}</option>`).join("");

  const paymentRows = AppData.paymentMethods.map(m => {
    const amt = stats.byPayment[m.id] || 0;
    return `<tr><td>${m.icon} ${m.name}</td><td style="text-align:right;font-weight:700">฿${formatCurrency(amt)}</td><td style="text-align:right">${stats.revenue > 0 ? Math.round(amt/stats.revenue*100) : 0}%</td></tr>`;
  }).join("");

  const cashierRows = Object.entries(stats.byCashier).sort((a,b) => b[1]-a[1]).map(([name, amt]) => `
    <tr><td>${name}</td><td style="text-align:right;font-weight:700">฿${formatCurrency(amt)}</td></tr>`).join("");

  const catRows = Object.entries(stats.byCategory).sort((a,b) => b[1]-a[1]).map(([name, amt]) => `
    <tr><td>${name}</td><td style="text-align:right;font-weight:700">฿${formatCurrency(amt)}</td></tr>`).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card"><div class="kpi-label">ยอดขายวันนี้</div><div class="kpi-value">฿<span>${formatCurrency(stats.revenue)}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">จำนวนบิล</div><div class="kpi-value">${stats.customers}</div></div>
      <div class="kpi-card"><div class="kpi-label">ยอดคืนสินค้า</div><div class="kpi-value" style="color:#dc2626">฿<span>${formatCurrency(stats.refunded)}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">ค้างชำระ (มัดจำ)</div><div class="kpi-value" style="color:#ca8a04">฿<span>${formatCurrency(stats.outstanding)}</span></div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;color:#6b7280">รายงาน Z-Report ณ <b>${new Date().toLocaleString("th-TH")}</b></div>
      <select class="form-input" id="zr-branch" style="width:160px">${branchOpts}</select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-title">💳 แยกตามวิธีชำระ</div>
        <table class="data-table">
          <thead><tr><th>วิธี</th><th style="text-align:right">ยอด</th><th style="text-align:right">%</th></tr></thead>
          <tbody>${paymentRows}</tbody>
          <tfoot><tr style="border-top:2px solid #e2e8f0"><td style="padding-top:10px;font-weight:700">รวม</td><td style="padding-top:10px;text-align:right;font-weight:800;color:#6366f1">฿${formatCurrency(stats.revenue)}</td><td></td></tr></tfoot>
        </table>
      </div>

      <div class="card">
        <div class="card-title">👤 แยกตามแคชเชียร์</div>
        <table class="data-table">
          <thead><tr><th>ชื่อ</th><th style="text-align:right">ยอด</th></tr></thead>
          <tbody>${cashierRows || `<tr><td colspan="2" style="text-align:center;color:#9ca3af;padding:20px">ยังไม่มียอดวันนี้</td></tr>`}</tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">📂 แยกตามหมวดสินค้า</div>
        <table class="data-table">
          <thead><tr><th>หมวด</th><th style="text-align:right">ยอด</th></tr></thead>
          <tbody>${catRows || `<tr><td colspan="2" style="text-align:center;color:#9ca3af;padding:20px">—</td></tr>`}</tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">💵 นับเงินสด Drawer</div>
        <div class="form-group"><label class="form-label">เงินสดต้นกะ (Opening)</label><input type="number" class="form-input" id="zr-opening" value="0" placeholder="ใส่ยอดเปิดร้าน"></div>
        <div class="form-group"><label class="form-label">ยอดขายเงินสดวันนี้ (จากระบบ)</label><input type="number" class="form-input" value="${stats.byPayment.cash || 0}" disabled style="background:#f8fafc"></div>
        <div class="form-group"><label class="form-label">เงินสดที่นับได้จริง (Closing)</label><input type="number" class="form-input" id="zr-closing" placeholder="นับเงินใน drawer ปลายกะ"></div>
        <div id="zr-variance" style="background:#f8fafc;padding:10px;border-radius:8px;font-size:13px;font-weight:700;text-align:center">ส่วนต่าง: ฿0</div>
        <button class="btn btn-primary" id="btn-close-day" style="width:100%;margin-top:10px" ${stats.revenue === 0 ? "disabled" : ""}>🔒 ปิดบัญชีประจำวัน</button>
      </div>
    </div>

    ${AppData.zReports.length > 0 ? `
    <div class="card" style="margin-top:16px">
      <div class="card-title">📋 ประวัติการปิดบัญชี (${AppData.zReports.length} รายการ)</div>
      <table class="data-table">
        <thead><tr><th>วันที่</th><th>สาขา</th><th>ปิดโดย</th><th style="text-align:right">ยอดขาย</th><th style="text-align:right">เงินสด ระบบ</th><th style="text-align:right">เงินสด นับได้</th><th style="text-align:right">ส่วนต่าง</th></tr></thead>
        <tbody>${AppData.zReports.slice(0, 20).map(z => {
          const b = AppData.branches.find(br => br.id === z.branchId);
          const variance = z.cashCounted - z.cashSystem;
          return `<tr><td>${new Date(z.date).toLocaleDateString("th-TH",{day:"2-digit",month:"short",year:"numeric"})}</td><td>${b?.code || "-"}</td><td>${z.closedBy}</td><td style="text-align:right">฿${formatCurrency(z.totalRevenue)}</td><td style="text-align:right">฿${formatCurrency(z.cashSystem)}</td><td style="text-align:right">฿${formatCurrency(z.cashCounted)}</td><td style="text-align:right;color:${variance < 0 ? '#dc2626' : variance > 0 ? '#16a34a' : '#6b7280'};font-weight:700">${variance >= 0 ? '+' : ''}฿${formatCurrency(variance)}</td></tr>`;
        }).join("")}</tbody>
      </table>
    </div>` : ""}`;
}

// ===== DELIVERY =====
function renderDelivery() {
  const view = State.deliveryView || "list";
  const statusFilter = State.deliveryStatusFilter || "all";
  const search = State.deliverySearch || "";
  const branchFilter = State.deliveryBranchFilter || (isBranchScoped() ? State.currentBranch : "all");

  // Get all receipts that have delivery (not pickup)
  let deliveries = AppData.receipts.filter(r => r.delivery && r.delivery.zoneId !== "pickup");
  if (branchFilter !== "all") deliveries = deliveries.filter(d => d.branchId === parseInt(branchFilter));
  if (statusFilter !== "all") deliveries = deliveries.filter(d => d.delivery.status === statusFilter);
  if (search) {
    const q = search.toLowerCase();
    deliveries = deliveries.filter(d =>
      d.receiptNo.toLowerCase().includes(q) ||
      (d.customerName || "").toLowerCase().includes(q) ||
      (d.delivery.recipientName || "").toLowerCase().includes(q) ||
      (d.delivery.recipientPhone || "").includes(q) ||
      (d.delivery.trackingNo || "").toLowerCase().includes(q)
    );
  }

  deliveries.sort((a, b) => (a.delivery.date || "9999").localeCompare(b.delivery.date || "9999"));

  // Stats
  const counts = {};
  Object.keys(AppData.deliveryStatuses).forEach(k => counts[k] = 0);
  AppData.receipts.filter(r => r.delivery && r.delivery.zoneId !== "pickup").forEach(d => {
    counts[d.delivery.status] = (counts[d.delivery.status] || 0) + 1;
  });

  const totalActive = counts.scheduled + counts.preparing + counts.in_transit;
  const totalCompleted = counts.delivered;
  const totalFailed = counts.failed + counts.cancelled;
  const totalFee = deliveries.reduce((s, d) => s + (d.delivery.fee || 0), 0);

  const statusFilterBtns = `
    <button class="filter-btn ${statusFilter === "all" ? "active" : ""}" data-dstatus="all">ทั้งหมด ${deliveries.length}</button>
    ${Object.entries(AppData.deliveryStatuses).map(([k, s]) => `
      <button class="filter-btn ${statusFilter === k ? "active" : ""}" data-dstatus="${k}" style="${statusFilter===k?`background:${s.color};color:#fff;border-color:${s.color}`:''}">${s.icon} ${s.name} ${counts[k]}</button>
    `).join("")}`;

  const branchOpts = isBranchScoped()
    ? `<option value="${State.currentBranch}">${getCurrentBranch().name}</option>`
    : `<option value="all">ทุกสาขา</option>` + AppData.branches.map(b => `<option value="${b.id}" ${branchFilter == b.id ? "selected" : ""}>${b.name}</option>`).join("");

  const canUpdate = hasPermission("delivery.update");

  const rows = deliveries.map(d => {
    const status = AppData.deliveryStatuses[d.delivery.status];
    const zone = AppData.deliveryZones.find(z => z.id === d.delivery.zoneId);
    const branch = AppData.branches.find(b => b.id === d.branchId);
    const driver = d.delivery.driverId ? AppData.drivers.find(dr => dr.id === d.delivery.driverId) : null;
    const isOverdue = d.delivery.date && d.delivery.date < new Date().toISOString().split("T")[0] && !["delivered", "cancelled"].includes(d.delivery.status);
    return `
    <tr style="${isOverdue ? "background:#fef2f2" : ""}">
      <td>
        <div style="font-size:12px;font-weight:700">${d.delivery.date || "—"}${isOverdue ? ' ⚠️' : ''}</div>
        <div style="font-size:10px;color:#9ca3af">${AppData.deliveryTimeSlots.find(t => t.id === d.delivery.timeSlot)?.name || ""}</div>
      </td>
      <td>
        <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px">${d.delivery.trackingNo}</code>
        <div style="font-size:10px;color:#9ca3af">${d.receiptNo}</div>
      </td>
      <td>
        <span class="badge" style="background:${zone?.color}20;color:${zone?.color};border:1px solid ${zone?.color}40">${zone?.name}</span>
        ${d.delivery.channelId ? (() => {
          const ch = AppData.deliveryChannels.find(c => c.id === d.delivery.channelId);
          return ch ? `<div style="font-size:10px;color:${ch.color};margin-top:3px"><b>${ch.icon} ${ch.name}</b></div>` : '';
        })() : ''}
        ${d.delivery.teamId ? (() => {
          const tm = AppData.deliveryTeams.find(t => t.id === d.delivery.teamId);
          return tm ? `<div style="font-size:10px;color:${tm.color};margin-top:2px">👥 ${tm.name}</div>` : '';
        })() : ''}
        ${d.delivery.isCustomPrice ? `<div style="font-size:9px;color:#ca8a04;margin-top:2px" title="${d.delivery.customReason}">💰 ราคากำหนดเอง</div>` : ''}
      </td>
      <td>${branch?.code || "—"}</td>
      <td>
        <div style="font-weight:700">${d.delivery.recipientName || d.customerName || "-"}</div>
        <div style="font-size:11px;color:#9ca3af">${d.delivery.recipientPhone || "-"}</div>
      </td>
      <td style="font-size:11px;max-width:200px">${d.delivery.address || "-"}</td>
      <td style="text-align:right;font-weight:700">฿${formatCurrency(d.total)}<br><span style="font-size:10px;color:#0ea5e9">+ค่าส่ง ฿${formatCurrency(d.delivery.fee || 0)}</span></td>
      <td>${driver ? `<div style="font-size:11px"><b>${driver.name}</b><br><span style="color:#9ca3af">${driver.vehicle}</span></div>` : `<span style="color:#9ca3af;font-size:11px">— ยังไม่มอบหมาย —</span>`}</td>
      <td><span class="role-pill" style="background:${status.color}">${status.icon} ${status.name}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-view-delivery="${d.id}">👁️</button>
          ${canUpdate && !["delivered","cancelled"].includes(d.delivery.status) ? `<button class="btn btn-primary" data-update-delivery="${d.id}" style="font-size:11px">📝 อัปเดต</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");

  const viewSwitcher = `
    <div style="display:flex;gap:6px;background:#f1f5f9;padding:4px;border-radius:10px">
      <button class="view-btn ${view === 'list' ? 'active' : ''}" data-dview="list">📋 List</button>
      <button class="view-btn ${view === 'month' ? 'active' : ''}" data-dview="month">📅 รายเดือน</button>
      <button class="view-btn ${view === 'week' ? 'active' : ''}" data-dview="week">📆 รายสัปดาห์</button>
      <button class="view-btn ${view === 'day' ? 'active' : ''}" data-dview="day">📍 รายวัน</button>
    </div>`;

  let viewBody = "";
  if (view === "list") {
    viewBody = `
      <div class="search-bar">
        <span>🔍</span>
        <input type="text" id="delivery-search" placeholder="Tracking / Receipt / ผู้รับ / เบอร์..." value="${search}">
      </div>
      <div class="stock-filters">${statusFilterBtns}</div>
      <div style="overflow-x:auto;max-height:600px;margin-top:12px">
        <table class="data-table" style="min-width:1200px">
          <thead style="position:sticky;top:0;background:#fff;z-index:1">
            <tr>
              <th>วันที่ส่ง</th><th>Tracking</th><th>เขต</th><th>สาขา</th><th>ผู้รับ</th><th>ที่อยู่</th>
              <th style="text-align:right">ยอด</th><th>คนขับ</th><th>สถานะ</th><th>จัดการ</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="10" style="text-align:center;padding:40px;color:#9ca3af">ไม่มีรายการจัดส่ง</td></tr>`}</tbody>
        </table>
      </div>`;
  } else if (view === "month") {
    viewBody = renderDeliveryMonthCalendar(deliveries);
  } else if (view === "week") {
    viewBody = renderDeliveryWeekCalendar(deliveries);
  } else if (view === "day") {
    viewBody = renderDeliveryDayCalendar(deliveries);
  }

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card">
        <div class="kpi-label">กำลังดำเนินการ</div>
        <div class="kpi-value" style="color:#f59e0b">${totalActive} <small>รายการ</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ส่งสำเร็จ</div>
        <div class="kpi-value" style="color:#16a34a">${totalCompleted} <small>รายการ</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ส่งไม่สำเร็จ / ยกเลิก</div>
        <div class="kpi-value" style="color:#dc2626">${totalFailed} <small>รายการ</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">รายได้ค่าจัดส่ง</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalFee)}</span></div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div>
          <div class="card-title" style="margin-bottom:2px">🚚 รายการจัดส่ง</div>
          <div class="card-subtitle">${canUpdate ? "อัปเดตสถานะ + จัดการคนขับ" : "ดูได้อย่างเดียว"}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${viewSwitcher}
          <select class="form-input" id="delivery-branch" style="width:140px">${branchOpts}</select>
        </div>
      </div>
      ${viewBody}
    </div>`;
}

// ===== DELIVERY CALENDARS =====
function buildDeliveryByDate(deliveries) {
  const byDate = {};
  deliveries.forEach(d => {
    const date = d.delivery.date;
    if (!date) return;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(d);
  });
  return byDate;
}

function statusColorBlock(d) {
  const s = AppData.deliveryStatuses[d.delivery.status];
  return `<div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s?.color || '#94a3b8'};margin-right:3px;vertical-align:middle"></div>`;
}

function renderDeliveryMonthCalendar(deliveries) {
  const anchor = new Date(State.deliveryAnchorDate || new Date().toISOString().split("T")[0]);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthLabel = anchor.toLocaleDateString("th-TH", { year: "numeric", month: "long" });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const byDate = buildDeliveryByDate(deliveries);

  // Build cells (6 weeks × 7 days = 42 cells)
  const dayCells = [];
  for (let i = 0; i < startWeekday; i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    dayCells.push({ d, dateStr, deliveries: byDate[dateStr] || [] });
  }
  while (dayCells.length % 7 !== 0) dayCells.push(null);

  const dayHeaders = ["อา","จ","อ","พ","พฤ","ศ","ส"].map(d => `<div class="cal-day-header">${d}</div>`).join("");

  const cells = dayCells.map(c => {
    if (!c) return `<div class="cal-cell cal-empty"></div>`;
    const isToday = c.dateStr === todayStr;
    const count = c.deliveries.length;
    const fee = c.deliveries.reduce((s, dd) => s + (dd.delivery.fee || 0), 0);
    // Status counts
    const statusCounts = {};
    c.deliveries.forEach(dd => { statusCounts[dd.delivery.status] = (statusCounts[dd.delivery.status] || 0) + 1; });
    const statusDots = Object.entries(statusCounts).slice(0, 4).map(([s, n]) => {
      const stat = AppData.deliveryStatuses[s];
      return `<span class="cal-dot" style="background:${stat?.color}" title="${stat?.name} ${n}"></span>`;
    }).join("");

    return `
      <div class="cal-cell ${isToday ? 'cal-today' : ''} ${count > 0 ? 'cal-has-deliv' : ''}" data-cal-date="${c.dateStr}">
        <div class="cal-cell-head">
          <span class="cal-cell-day">${c.d}</span>
          ${count > 0 ? `<span class="cal-cell-count">${count}</span>` : ''}
        </div>
        ${count > 0 ? `
          <div class="cal-cell-body">
            <div class="cal-cell-dots">${statusDots}</div>
            ${fee > 0 ? `<div class="cal-cell-fee">฿${formatCurrency(fee)}</div>` : ''}
          </div>` : ''}
      </div>`;
  }).join("");

  return `
    <div class="cal-nav">
      <button class="btn btn-secondary" data-cal-nav="prev">‹ เดือนก่อนหน้า</button>
      <div class="cal-title">📅 ${monthLabel}</div>
      <button class="btn btn-secondary" data-cal-nav="today">วันนี้</button>
      <button class="btn btn-secondary" data-cal-nav="next">เดือนถัดไป ›</button>
    </div>
    <div class="cal-month">
      <div class="cal-day-headers">${dayHeaders}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:#6b7280;justify-content:center">
      ${Object.entries(AppData.deliveryStatuses).map(([k, s]) => `<div style="display:flex;align-items:center;gap:4px"><span class="cal-dot" style="background:${s.color}"></span>${s.name}</div>`).join("")}
    </div>`;
}

function renderDeliveryWeekCalendar(deliveries) {
  const anchor = new Date(State.deliveryAnchorDate || new Date().toISOString().split("T")[0]);
  const dayOfWeek = anchor.getDay();
  const weekStart = new Date(anchor);
  weekStart.setDate(anchor.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const todayStr = new Date().toISOString().split("T")[0];
  const byDate = buildDeliveryByDate(deliveries);

  const dayLabels = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: d, dateStr, list: byDate[dateStr] || [], label: dayLabels[i] });
  }

  const totalDeliveries = days.reduce((s, d) => s + d.list.length, 0);
  const totalFee = days.reduce((s, d) => s + d.list.reduce((s2, dd) => s2 + (dd.delivery.fee || 0), 0), 0);

  const dayCols = days.map(day => {
    const isToday = day.dateStr === todayStr;
    const items = day.list.sort((a, b) => (a.delivery.timeSlot || "").localeCompare(b.delivery.timeSlot || "")).slice(0, 8).map(d => {
      const s = AppData.deliveryStatuses[d.delivery.status];
      const zone = AppData.deliveryZones.find(z => z.id === d.delivery.zoneId);
      return `
        <div class="week-event" style="border-left:4px solid ${s?.color}" data-view-delivery="${d.id}">
          <div style="font-size:11px;font-weight:700;color:#1e293b">${s?.icon} ${d.delivery.recipientName || d.customerName || "-"}</div>
          <div style="font-size:10px;color:#6b7280">${zone?.name?.slice(0, 16) || ""}</div>
          <div style="font-size:10px;color:${s?.color}">${s?.name}</div>
        </div>`;
    }).join("");

    return `
      <div class="week-col ${isToday ? 'week-today' : ''}">
        <div class="week-header">
          <div style="font-size:11px;color:#6b7280">${day.label}</div>
          <div style="font-size:18px;font-weight:800;${isToday ? 'color:#6366f1' : ''}">${day.date.getDate()}</div>
          <div style="font-size:10px;color:#9ca3af">${day.list.length} ส่ง</div>
        </div>
        <div class="week-body">${items || `<div style="text-align:center;color:#cbd5e1;padding:14px;font-size:11px">—</div>`}</div>
      </div>`;
  }).join("");

  return `
    <div class="cal-nav">
      <button class="btn btn-secondary" data-cal-nav="prev-week">‹ สัปดาห์ก่อน</button>
      <div class="cal-title">📆 ${weekStart.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })} - ${weekEnd.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })} <span style="font-size:12px;color:#6b7280;font-weight:400">· ${totalDeliveries} ส่ง · ฿${formatCurrency(totalFee)}</span></div>
      <button class="btn btn-secondary" data-cal-nav="today">วันนี้</button>
      <button class="btn btn-secondary" data-cal-nav="next-week">สัปดาห์ถัดไป ›</button>
    </div>
    <div class="week-grid">${dayCols}</div>`;
}

function renderDeliveryDayCalendar(deliveries) {
  const anchor = new Date(State.deliveryAnchorDate || new Date().toISOString().split("T")[0]);
  const dateStr = anchor.toISOString().split("T")[0];
  const list = deliveries.filter(d => d.delivery.date === dateStr);
  list.sort((a, b) => (a.delivery.timeSlot || "anytime").localeCompare(b.delivery.timeSlot || "anytime"));

  const totalFee = list.reduce((s, d) => s + (d.delivery.fee || 0), 0);
  const totalRev = list.reduce((s, d) => s + d.total, 0);

  // Group by time slot
  const slots = { morning: [], afternoon: [], evening: [], anytime: [] };
  list.forEach(d => {
    const ts = d.delivery.timeSlot || "anytime";
    if (slots[ts]) slots[ts].push(d);
  });

  const slotLabels = {
    morning:   { label: "🌅 ช่วงที่ 1 (09:00-11:00)", color: "#fbbf24" },
    afternoon: { label: "☀️ ช่วงที่ 2 (11:00-14:00)", color: "#f59e0b" },
    evening:   { label: "🌆 ช่วงที่ 3 (15:00-18:00)", color: "#a855f7" },
    anytime:   { label: "🕐 ไม่ระบุเวลา",             color: "#6b7280" },
  };

  const slotSections = Object.entries(slots).map(([k, items]) => {
    if (!items.length) return "";
    const sl = slotLabels[k];
    const itemRows = items.map(d => {
      const s = AppData.deliveryStatuses[d.delivery.status];
      const zone = AppData.deliveryZones.find(z => z.id === d.delivery.zoneId);
      const driver = d.delivery.driverId ? AppData.drivers.find(dr => dr.id === d.delivery.driverId) : null;
      const branch = AppData.branches.find(b => b.id === d.branchId);
      return `
        <div class="day-event" style="border-left:5px solid ${s?.color}" data-view-delivery="${d.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700">${d.delivery.recipientName || d.customerName || "-"}</div>
              <div style="font-size:11px;color:#6b7280">📞 ${d.delivery.recipientPhone || "-"} · ${d.delivery.address || "-"}</div>
              <div style="font-size:11px;margin-top:4px">${zone?.name} · สาขา ${branch?.code} · ฿${formatCurrency(d.total)}</div>
              ${driver ? `<div style="font-size:11px;color:#0ea5e9;margin-top:2px">🚛 ${driver.name} · ${driver.vehicle}</div>` : `<div style="font-size:11px;color:#dc2626;margin-top:2px">⚠️ ยังไม่มอบหมายคนขับ</div>`}
            </div>
            <span class="role-pill" style="background:${s?.color};font-size:11px">${s?.icon} ${s?.name}</span>
          </div>
        </div>`;
    }).join("");
    return `
      <div class="day-slot">
        <div class="day-slot-head" style="background:${sl.color}20;border-left:4px solid ${sl.color}">
          <span style="font-weight:700">${sl.label}</span>
          <span class="badge badge-purple" style="margin-left:8px">${items.length}</span>
        </div>
        <div class="day-slot-body">${itemRows}</div>
      </div>`;
  }).join("");

  return `
    <div class="cal-nav">
      <button class="btn btn-secondary" data-cal-nav="prev-day">‹ วันก่อน</button>
      <div class="cal-title">📍 ${anchor.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} <span style="font-size:12px;color:#6b7280;font-weight:400">· ${list.length} ส่ง · ฿${formatCurrency(totalRev)} · ค่าส่ง ฿${formatCurrency(totalFee)}</span></div>
      <button class="btn btn-secondary" data-cal-nav="today">วันนี้</button>
      <button class="btn btn-secondary" data-cal-nav="next-day">วันถัดไป ›</button>
    </div>
    <div style="margin-top:12px">
      ${list.length === 0 ? `<div style="text-align:center;padding:60px;color:#9ca3af"><div style="font-size:48px">📭</div><div style="margin-top:12px">ไม่มีการจัดส่งในวันนี้</div></div>` : slotSections}
    </div>`;
}

function openDeliveryDetail(receiptId) {
  const r = AppData.receipts.find(x => x.id === receiptId);
  if (!r || !r.delivery) return;
  const d = r.delivery;
  const status = AppData.deliveryStatuses[d.status];
  const zone = AppData.deliveryZones.find(z => z.id === d.zoneId);
  const branch = AppData.branches.find(b => b.id === r.branchId);
  const driver = d.driverId ? AppData.drivers.find(dr => dr.id === d.driverId) : null;

  // Timeline
  const timelineSteps = [
    { id: "scheduled",  label: "นัดส่ง" },
    { id: "preparing",  label: "เตรียมของ" },
    { id: "in_transit", label: "ออกจัดส่ง" },
    { id: "delivered",  label: "ส่งสำเร็จ" },
  ];
  const currentIdx = timelineSteps.findIndex(s => s.id === d.status);
  const isFailed = ["failed", "cancelled"].includes(d.status);

  const timelineHtml = timelineSteps.map((s, i) => {
    const done = i <= currentIdx && !isFailed;
    const active = i === currentIdx && !isFailed;
    const stat = AppData.deliveryStatuses[s.id];
    return `
      <div class="timeline-step ${done ? 'done' : ''} ${active ? 'active' : ''}">
        <div class="timeline-dot" style="background:${done ? stat.color : '#e2e8f0'};color:${done ? '#fff' : '#9ca3af'}">${done ? '✓' : i+1}</div>
        <div class="timeline-label" style="color:${done ? '#1e293b' : '#9ca3af'}">${s.label}</div>
      </div>${i < timelineSteps.length - 1 ? `<div class="timeline-line" style="background:${i < currentIdx && !isFailed ? '#16a34a' : '#e2e8f0'}"></div>` : ''}`;
  }).join("");

  // History
  const historyHtml = (d.statusHistory || []).map(h => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:14px">${AppData.deliveryStatuses[h.status]?.icon || '•'}</span>
      <div style="flex:1;font-size:12px">
        <div><b>${AppData.deliveryStatuses[h.status]?.name}</b> ${h.note ? `· ${h.note}` : ""}</div>
        <div style="color:#9ca3af;font-size:10px">${new Date(h.date).toLocaleString("th-TH")} · ${h.by}</div>
      </div>
    </div>`).join("");

  const itemsList = r.items.map(i => `${i.name} × ${i.qty}`).join(", ");

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-title">🚚 รายละเอียดการจัดส่ง — ${d.trackingNo}</div>

      ${!isFailed ? `<div class="timeline-container">${timelineHtml}</div>` : `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:14px;text-align:center">
        <div style="font-size:24px">${status.icon}</div>
        <div style="font-size:14px;font-weight:700;color:${status.color}">${status.name}</div>
      </div>`}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
        <div>
          <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:4px">📍 ที่อยู่จัดส่ง</div>
          <div style="font-size:13px;background:#f8fafc;padding:10px;border-radius:8px">
            <div style="font-weight:700">${d.recipientName || "-"}</div>
            <div style="font-size:12px;color:#6b7280">📞 ${d.recipientPhone || "-"}</div>
            <div style="font-size:12px;margin-top:4px">${d.address || "-"}</div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:4px">📦 ข้อมูลจัดส่ง</div>
          <div style="font-size:13px;background:#f8fafc;padding:10px;border-radius:8px">
            <div><b>เขต:</b> ${zone?.name}</div>
            <div><b>วันส่ง:</b> ${d.date || "-"} · ${AppData.deliveryTimeSlots.find(t=>t.id===d.timeSlot)?.name || ""}</div>
            <div><b>ค่าจัดส่ง:</b> ฿${formatCurrency(d.fee || 0)} ${d.isCustomPrice ? `<span style="color:#ca8a04;font-size:11px">💰 (ราคากำหนดเอง)</span>` : ""}</div>
            ${d.isCustomPrice ? `<div style="background:#fef9c3;padding:6px 8px;border-radius:6px;margin-top:4px;font-size:11px;color:#854d0e"><b>เหตุผล:</b> ${d.customReason}<br><b>อนุมัติโดย:</b> ${d.authorizedBy}</div>` : ""}
            ${driver ? `<div><b>คนขับ:</b> ${driver.name} (${driver.vehicle})</div>` : `<div style="color:#9ca3af">ยังไม่มอบหมายคนขับ</div>`}
          </div>
        </div>
      </div>

      <div style="margin-top:12px">
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:4px">📋 รายการ</div>
        <div style="font-size:12px;background:#f8fafc;padding:10px;border-radius:8px">${itemsList} <span style="color:#9ca3af">· จากสาขา ${branch?.name}</span></div>
      </div>

      ${d.note ? `<div style="margin-top:12px"><div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:4px">📝 หมายเหตุ</div><div style="background:#fefce8;padding:10px;border-radius:8px;font-size:12px">${d.note}</div></div>` : ""}

      ${historyHtml ? `
      <div style="margin-top:12px">
        <div style="font-size:11px;color:#6b7280;font-weight:700;margin-bottom:4px">📜 ประวัติ</div>
        <div style="background:#f8fafc;padding:8px 12px;border-radius:8px;max-height:140px;overflow-y:auto">${historyHtml}</div>
      </div>` : ""}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="dl-close" style="flex:1">ปิด</button>
        ${hasPermission("delivery.update") && !["delivered","cancelled"].includes(d.status) ? `<button class="btn btn-primary" id="dl-update" style="flex:2">📝 อัปเดตสถานะ</button>` : ""}
      </div>
    </div>`;

  modal.querySelector("#dl-close").addEventListener("click", () => modal.remove());
  modal.querySelector("#dl-update")?.addEventListener("click", () => { modal.remove(); openDeliveryUpdateModal(receiptId); });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function openDeliveryUpdateModal(receiptId) {
  const r = AppData.receipts.find(x => x.id === receiptId);
  if (!r || !r.delivery) return;
  const d = r.delivery;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const flow = ["scheduled", "preparing", "in_transit", "delivered"];
  const currentIdx = flow.indexOf(d.status);
  const next = flow[currentIdx + 1];

  const driverOpts = `<option value="">— เลือก —</option>` +
    AppData.drivers.map(dr => `<option value="${dr.id}" ${d.driverId === dr.id ? "selected" : ""}>${dr.name} · ${dr.vehicle}</option>`).join("");

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">📝 อัปเดตสถานะการจัดส่ง</div>
      <div style="background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:14px;font-size:12px">
        <div><b>Tracking:</b> ${d.trackingNo}</div>
        <div><b>ปัจจุบัน:</b> <span class="role-pill" style="background:${AppData.deliveryStatuses[d.status]?.color}">${AppData.deliveryStatuses[d.status]?.icon} ${AppData.deliveryStatuses[d.status]?.name}</span></div>
      </div>

      <div class="form-group">
        <label class="form-label">เปลี่ยนเป็นสถานะ</label>
        <select class="form-input" id="du-status">
          ${next ? `<option value="${next}">→ ${AppData.deliveryStatuses[next]?.icon} ${AppData.deliveryStatuses[next]?.name}</option>` : ""}
          ${Object.entries(AppData.deliveryStatuses).filter(([k]) => k !== d.status && k !== next).map(([k, s]) => `<option value="${k}">${s.icon} ${s.name}</option>`).join("")}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">มอบหมายคนขับ</label>
        <select class="form-input" id="du-driver">${driverOpts}</select>
      </div>

      <div class="form-group">
        <label class="form-label">หมายเหตุ / สาเหตุ (ถ้ามี)</label>
        <textarea class="form-input" id="du-note" rows="2" placeholder="เช่น ส่งไม่ได้ ลูกค้าไม่อยู่ / ส่งล่าช้าเพราะรถติด"></textarea>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="du-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="du-save" style="flex:2">💾 บันทึก</button>
      </div>
    </div>`;

  modal.querySelector("#du-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#du-save").addEventListener("click", () => {
    const newStatus = modal.querySelector("#du-status").value;
    const driverId = modal.querySelector("#du-driver").value ? parseInt(modal.querySelector("#du-driver").value) : null;
    const note = modal.querySelector("#du-note").value;

    if (!d.statusHistory) d.statusHistory = [];
    d.statusHistory.push({ status: newStatus, date: new Date().toISOString(), by: State.currentUser.name, note });
    d.status = newStatus;
    if (driverId !== null) d.driverId = driverId;
    if (newStatus === "delivered") d.deliveredDate = new Date().toISOString();

    logAction("delivery.updated", { trackingNo: d.trackingNo, receiptNo: r.receiptNo, status: newStatus, driverId, note });
    modal.remove();
    showToast(`✅ อัปเดตเป็น "${AppData.deliveryStatuses[newStatus]?.name}"`, "success");
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== REPORTS =====
function renderReports() {
  const tab = State.reportTab || "settings";

  const tabNav = `
    <div class="report-tab-nav">
      <div class="report-tab-btn ${tab === "settings" ? "active" : ""}" data-rtab="settings">⚙️ ตั้งค่าการส่ง</div>
      <div class="report-tab-btn ${tab === "preview" ? "active" : ""}" data-rtab="preview">👁️ ตัวอย่างรายงาน</div>
      <div class="report-tab-btn ${tab === "history" ? "active" : ""}" data-rtab="history">📋 ประวัติการส่ง</div>
    </div>`;

  if (tab === "settings") return tabNav + renderReportSettings();
  if (tab === "preview") return tabNav + renderReportPreview();
  if (tab === "history") return tabNav + renderReportHistory();
  return tabNav;
}

function renderReportSettings() {
  const sched = AppData.dailyReport;
  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const lastSentLabel = sched.lastSentAt ? new Date(sched.lastSentAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "ยังไม่เคยส่ง";

  // Show next scheduled send
  const now = new Date();
  let nextSend = null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (sched.days.includes(d.getDay())) {
      const [h, m] = sched.time.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      if (d > now) { nextSend = d; break; }
    }
  }
  const nextLabel = nextSend ? nextSend.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const dayToggles = dayLabels.map((d, i) =>
    `<div class="day-toggle ${sched.days.includes(i) ? "active" : ""}" data-day="${i}">${d}</div>`
  ).join("");

  const emailChips = sched.emailRecipients.map(e => `
    <div class="email-chip">
      <input type="checkbox" ${e.enabled?'checked':''} data-toggle-email="${e.id}" style="width:12px;height:12px;accent-color:#7c3aed">
      ${e.name}
      <span class="email-chip-remove" data-rid="${e.id}">×</span>
    </div>
  `).join("");

  const lineGroups = sched.lineGroups.map(g => `
    <div class="email-chip" style="background:#dcfce7;color:#15803d">
      <input type="checkbox" ${g.enabled?'checked':''} data-toggle-line="${g.id}" style="width:12px;height:12px;accent-color:#15803d">
      💬 ${g.name}
      <span class="email-chip-remove" style="color:#15803d" data-line-rm="${g.id}">×</span>
    </div>
  `).join("");

  const sectionChecks = [
    { id: "summary", label: "📊 สรุปยอดรายสาขา" },
    { id: "stock_alert", label: "⚠️ แจ้งเตือน Stock ต่ำ" },
    { id: "top_products", label: "🏆 สินค้าขายดี Top 5" },
    { id: "ai_insight", label: "🤖 AI วิเคราะห์แนวโน้ม" },
  ].map(s => `
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:4px 0">
      <input type="checkbox" ${sched.sections.includes(s.id) ? "checked" : ""} data-section="${s.id}" style="width:16px;height:16px;accent-color:#6366f1">
      ${s.label}
    </label>`).join("");

  const channels = [
    { id: "email", label: "📧 Email" },
    { id: "line", label: "💬 LINE Notify" },
  ].map(c => `
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:4px 0">
      <input type="checkbox" ${sched.channels.includes(c.id) ? "checked" : ""} style="width:16px;height:16px;accent-color:#6366f1">
      ${c.label}
    </label>`).join("");

  return `
    <div style="background:linear-gradient(135deg, ${sched.enabled ? '#dcfce7,#bbf7d0' : '#fee2e2,#fecaca'});border:2px solid ${sched.enabled ? '#16a34a' : '#dc2626'};border-radius:12px;padding:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:16px;font-weight:800;color:${sched.enabled ? '#15803d' : '#991b1b'};margin-bottom:4px">
          ${sched.enabled ? '✅ Scheduler ทำงานอยู่' : '⚠️ Scheduler ปิดอยู่'}
        </div>
        <div style="font-size:12px;color:${sched.enabled ? '#166534' : '#7f1d1d'}">
          ${sched.enabled ? `ส่งทุกวัน · เวลา ${sched.time} น. · ครั้งล่าสุด: ${lastSentLabel} · ครั้งถัดไป: ${nextLabel}` : 'รายงานจะไม่ถูกส่งจนกว่าจะเปิด'}
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="dr-enabled" ${sched.enabled?'checked':''} style="width:20px;height:20px;accent-color:#16a34a">
        <span style="font-size:13px;font-weight:700">เปิด/ปิด Scheduler</span>
      </label>
    </div>

    <div class="report-grid">
      <div class="card">
        <div class="card-title">📅 กำหนดการส่งรายงาน</div>

        <div class="form-group">
          <div class="form-label">วันที่ส่ง (เลือกได้หลายวัน)</div>
          <div style="display:flex;gap:6px">${dayToggles}</div>
        </div>

        <div class="form-group">
          <div class="form-label">เวลาส่ง (24 ชั่วโมง)</div>
          <input type="time" class="form-input" value="${sched.time}" id="report-time">
          <div style="font-size:11px;color:#6b7280;margin-top:4px">💡 เวลาแนะนำ: 21:00 น. (หลังปิดร้าน)</div>
        </div>

        <div class="form-group">
          <div class="form-label">เนื้อหารายงาน</div>
          ${sectionChecks}
        </div>

        <div class="form-group">
          <div class="form-label">ช่องทางส่ง</div>
          ${channels}
        </div>

        <button class="btn btn-primary" id="btn-save-schedule" style="width:100%;margin-top:8px">💾 บันทึกการตั้งค่า</button>
        <button class="btn btn-secondary" id="btn-send-now" style="width:100%;margin-top:6px">📤 ส่งทันที (ทดสอบ)</button>
        <button class="btn btn-secondary" id="btn-preview-now" style="width:100%;margin-top:6px">👁️ ดูตัวอย่างรายงาน</button>
      </div>

      <div>
        <div class="card" style="margin-bottom:12px">
          <div class="card-title">📧 ผู้รับ Email</div>
          <div id="email-chips" style="margin-bottom:12px">${emailChips || '<div style="color:#9ca3af;font-size:12px">ยังไม่มีผู้รับ</div>'}</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <input type="text" class="form-input" id="new-email-name" placeholder="ชื่อ-สกุล" style="font-size:12px;padding:6px">
            <input type="email" class="form-input" id="new-email-addr" placeholder="email@..." style="font-size:12px;padding:6px">
          </div>
          <button class="btn btn-secondary" id="btn-add-email" style="width:100%;margin-top:6px;font-size:12px">+ เพิ่ม Email</button>
        </div>

        <div class="card">
          <div class="card-title">💬 LINE Notify Groups</div>
          <div id="line-chips" style="margin-bottom:12px">${lineGroups || '<div style="color:#9ca3af;font-size:12px">ยังไม่มีกลุ่ม LINE</div>'}</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <input type="text" class="form-input" id="new-line-name" placeholder="ชื่อกลุ่ม" style="font-size:12px;padding:6px">
            <input type="text" class="form-input" id="new-line-token" placeholder="LINE Notify Token" style="font-size:12px;padding:6px">
          </div>
          <button class="btn btn-secondary" id="btn-add-line" style="width:100%;margin-top:6px;font-size:12px">+ เพิ่มกลุ่ม LINE</button>

          <div style="margin-top:10px;font-size:11px;color:#6b7280;background:#f8fafc;padding:8px;border-radius:6px;line-height:1.6">
            🔑 <b>วิธีใช้ LINE Notify:</b><br>
            1. เข้า <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">notify-bot.line.me</code><br>
            2. Generate token จากกลุ่ม LINE ที่ต้องการ<br>
            3. นำ token มาวางที่ช่องด้านบน
          </div>
        </div>
      </div>
    </div>`;
}

function renderReportPreview() {
  const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const totalSales = Object.values(AppData.todaySales).reduce((s, v) => s + v.amount, 0);

  const branchTable = AppData.branches.map(b => {
    const s = AppData.todaySales[b.id];
    const pct = Math.round((s.amount / b.target) * 100);
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:8px;font-size:13px"><b>${b.name}</b></td>
        <td style="padding:8px;font-size:13px;text-align:right">฿${formatCurrency(s.amount)}</td>
        <td style="padding:8px;font-size:13px;text-align:center">${s.count}</td>
        <td style="padding:8px;font-size:13px;text-align:center">${s.customers}</td>
        <td style="padding:8px">
          <div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
            <div style="background:${b.color};height:100%;width:${pct}%"></div>
          </div>
          <div style="font-size:10px;color:#6b7280;text-align:center">${pct}%</div>
        </td>
      </tr>`;
  }).join("");

  const lowStock = getLowStockProducts().slice(0, 3);
  const alertRows = lowStock.map(p => {
    const total = Object.values(p.stock).reduce((a, b) => a + b, 0);
    return `<tr style="border-bottom:1px solid #fee2e2"><td style="padding:6px;font-size:12px">⚠️ ${p.name}</td><td style="padding:6px;font-size:12px;color:#dc2626;font-weight:700">เหลือ ${total} ชิ้น</td><td style="padding:6px;font-size:12px">ต่ำกว่า ${p.minStock*2} ชิ้น</td></tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-title">ตัวอย่างรายงานประจำวัน (Email HTML)</div>
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">

        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;color:#fff">
          <div style="font-size:20px;font-weight:800;margin-bottom:4px">🛋️ Furniture House POS</div>
          <div style="font-size:14px;opacity:0.85">รายงานสรุปยอดประจำวัน — ${today}</div>
        </div>

        <div style="padding:20px">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
            <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
              <div style="font-size:11px;color:#6b7280">ยอดขายรวม</div>
              <div style="font-size:18px;font-weight:800;color:#6366f1">฿${formatCurrency(totalSales)}</div>
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
              <div style="font-size:11px;color:#6b7280">จำนวนออเดอร์</div>
              <div style="font-size:18px;font-weight:800;color:#10b981">${Object.values(AppData.todaySales).reduce((s,v)=>s+v.count,0)}</div>
            </div>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
              <div style="font-size:11px;color:#6b7280">ลูกค้าทั้งหมด</div>
              <div style="font-size:18px;font-weight:800;color:#f59e0b">${Object.values(AppData.todaySales).reduce((s,v)=>s+v.customers,0)}</div>
            </div>
          </div>

          <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:8px">📊 ยอดขายแยกสาขา</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280">สาขา</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280">ยอดขาย</th>
                <th style="padding:8px;text-align:center;font-size:11px;color:#6b7280">ออเดอร์</th>
                <th style="padding:8px;text-align:center;font-size:11px;color:#6b7280">ลูกค้า</th>
                <th style="padding:8px;font-size:11px;color:#6b7280">% เป้า</th>
              </tr>
            </thead>
            <tbody>${branchTable}</tbody>
          </table>

          ${lowStock.length ? `
          <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:8px">⚠️ แจ้งเตือน Stock ต่ำ</div>
          <div style="background:#fef2f2;border-radius:8px;overflow:hidden;margin-bottom:16px">
            <table style="width:100%;border-collapse:collapse">
              <tbody>${alertRows}</tbody>
            </table>
          </div>` : ""}

          <div style="background:#f0fdf4;border-radius:8px;padding:12px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:6px">🤖 AI วิเคราะห์แนวโน้ม</div>
            <p style="font-size:12px;color:#166534;line-height:1.6;margin:0">
              วันนี้ยอดขายรวมสูงกว่าค่าเฉลี่ย 7 วัน +12.4% โดยเฉพาะสาขาสยามที่มียอดสูงสุด
              สินค้าที่ขายดีที่สุดคือกลุ่มโซฟา คิดเป็น 38% ของยอดรวม
              แนะนำเพิ่มสต็อก โซฟา Luxe Nordic ที่สาขาเชียงใหม่ก่อนสัปดาห์หน้า
            </p>
          </div>

          <div style="text-align:center;font-size:11px;color:#9ca3af">
            รายงานนี้ส่งอัตโนมัติโดย Furniture House POS System<br>
            ${new Date().toLocaleString("th-TH")}
          </div>
        </div>
      </div>
    </div>`;
}

function renderReportHistory() {
  const history = AppData.dailyReportHistory.slice(0, 50);

  const rows = history.length ? history.map(h => {
    const dt = new Date(h.date);
    return `
    <div class="history-item">
      <div style="font-size:18px">${h.success ? (h.isManual ? "📤" : "✅") : "❌"}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#374151">${dt.toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })} ${h.isManual ? '<span class="badge badge-purple" style="font-size:9px;margin-left:4px">manual</span>' : ''}</div>
        <div style="font-size:11px;color:#9ca3af">
          ${h.channels.map(c => c === "email" ? "📧 Email" : "💬 LINE").join(" + ")} · ${h.recipients} ผู้รับ ·
          ยอด ฿${formatCurrency(h.revenue)} (${h.bills} บิล)
        </div>
      </div>
      <span class="badge ${h.success ? "badge-green" : "badge-red"}">${h.success ? "สำเร็จ" : "ล้มเหลว"}</span>
      <button class="btn btn-secondary" data-view-report="${h.id}" style="font-size:11px;padding:4px 10px">ดูรายงาน</button>
    </div>`;
  }).join("") : `<div style="text-align:center;padding:32px;color:#9ca3af"><div style="font-size:36px">📭</div><div style="margin-top:8px">ยังไม่มีประวัติการส่ง</div></div>`;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div><div class="card-title" style="margin:0">ประวัติการส่งรายงาน (${AppData.dailyReportHistory.length})</div><div class="card-subtitle">📤 = ส่งด้วยมือ · ✅ = ส่งอัตโนมัติ</div></div>
        ${AppData.dailyReportHistory.length > 0 ? `<button class="btn btn-danger" id="btn-clear-rh">🗑️ ล้างประวัติ</button>` : ''}
      </div>
      ${rows}
    </div>`;
}

function openSentReportModal(historyId) {
  const h = AppData.dailyReportHistory.find(x => x.id === historyId);
  if (!h) return;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  let activeTab = "email";

  function build() {
    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-title">📤 รายงานที่ส่ง — ${new Date(h.date).toLocaleString("th-TH")}</div>
        <div style="background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px;font-size:12px">
          ส่งให้ <b>${h.recipients} ผู้รับ</b> · ${h.channels.join(" + ")} · ยอด ฿${formatCurrency(h.revenue)} (${h.bills} บิล)
        </div>

        <div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:12px">
          <div class="settings-tab ${activeTab === 'email' ? 'active' : ''}" data-vt="email">📧 Email HTML</div>
          <div class="settings-tab ${activeTab === 'line' ? 'active' : ''}" data-vt="line">💬 LINE Message</div>
          <div class="settings-tab ${activeTab === 'recipients' ? 'active' : ''}" data-vt="recipients">👥 ผู้รับ</div>
        </div>

        <div style="max-height:60vh;overflow-y:auto">
          ${activeTab === 'email' ? `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">${h.emailHTML}</div>` : ''}
          ${activeTab === 'line' ? `<pre style="background:#06c755;color:#fff;padding:14px;border-radius:8px;font-size:12px;line-height:1.6;font-family:monospace;white-space:pre-wrap">${h.lineMsg}</pre>
            <div style="font-size:11px;color:#6b7280;margin-top:8px">💡 ข้อความนี้จะถูกส่งผ่าน LINE Notify API เข้ากลุ่มที่กำหนด</div>` : ''}
          ${activeTab === 'recipients' ? `<table class="data-table"><thead><tr><th>ประเภท</th><th>ชื่อ</th><th>ปลายทาง</th></tr></thead><tbody>${h.recipientsList.map(r => `<tr><td>${r.type === 'email' ? '📧' : '💬'} ${r.type}</td><td>${r.name || '-'}</td><td><code>${r.to}</code></td></tr>`).join("")}</tbody></table>` : ''}
        </div>

        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-secondary" id="vr-close" style="flex:1">ปิด</button>
          ${activeTab === 'email' ? `<button class="btn btn-secondary" id="vr-copy-html">📋 Copy HTML</button>` : ''}
          ${activeTab === 'line' ? `<button class="btn btn-secondary" id="vr-copy-line">📋 Copy ข้อความ</button>` : ''}
          <a class="btn btn-primary" id="vr-mailto" href="mailto:${h.recipientsList.filter(r=>r.type==='email').map(r=>r.to).join(',')}?subject=${encodeURIComponent('รายงานยอด ' + new Date(h.date).toLocaleDateString('th-TH'))}&body=${encodeURIComponent(h.lineMsg)}" style="flex:1;text-decoration:none;text-align:center">📨 เปิดใน Mail Client</a>
        </div>
      </div>`;

    modal.querySelectorAll("[data-vt]").forEach(el => {
      el.addEventListener("click", () => { activeTab = el.dataset.vt; build(); });
    });
    modal.querySelector("#vr-close").addEventListener("click", () => modal.remove());
    modal.querySelector("#vr-copy-html")?.addEventListener("click", () => {
      navigator.clipboard.writeText(h.emailHTML);
      showToast("✅ คัดลอก HTML แล้ว", "success");
    });
    modal.querySelector("#vr-copy-line")?.addEventListener("click", () => {
      navigator.clipboard.writeText(h.lineMsg);
      showToast("✅ คัดลอกข้อความแล้ว", "success");
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

// ===== SETTINGS PAGE =====
function renderSettings() {
  const tab = State.settingsTab || "branches";

  const tabs = [
    { id: "branches", name: "🏢 จัดการสาขา", perm: "settings.branches" },
    { id: "users", name: "👥 จัดการผู้ใช้", perm: "*" },
    { id: "categories", name: "📂 หมวดหมู่สินค้า", perm: "settings.categories" },
    { id: "products", name: "🛍️ จัดการสินค้า", perm: "products.edit" },
    { id: "zones", name: "🚚 ค่าจัดส่ง", perm: "delivery.manage_zones" },
    { id: "channels", name: "📦 ช่องทางจัดส่ง", perm: "delivery.manage_zones" },
    { id: "teams", name: "👥 ทีมจัดส่ง", perm: "delivery.manage_zones" },
    { id: "io", name: "📊 Import / Export", perm: "data.export" },
    { id: "roles", name: "🔐 บทบาท & สิทธิ์", perm: "*" },
    { id: "audit", name: "📋 ประวัติการใช้งาน", perm: "audit.view" },
  ].filter(t => t.perm === "*" ? hasPermission("*") : hasPermission(t.perm));

  const tabBar = `
    <div class="settings-tabs">
      ${tabs.map(t => `<div class="settings-tab ${tab === t.id ? "active" : ""}" data-stab="${t.id}">${t.name}</div>`).join("")}
    </div>`;

  let body = "";
  if (tab === "branches") body = renderSettingsBranches();
  else if (tab === "users") body = renderSettingsUsers();
  else if (tab === "categories") body = renderSettingsCategories();
  else if (tab === "products") body = renderSettingsProducts();
  else if (tab === "zones") body = renderSettingsZones();
  else if (tab === "channels") body = renderSettingsChannels();
  else if (tab === "teams") body = renderSettingsTeams();
  else if (tab === "io") body = renderSettingsImportExport();
  else if (tab === "roles") body = renderSettingsRoles();
  else if (tab === "audit") body = renderSettingsAudit();

  return tabBar + body;
}

function renderSettingsBranches() {
  const rows = AppData.branches.map(b => {
    const todaySales = AppData.todaySales[b.id]?.amount || 0;
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:12px;height:12px;border-radius:50%;background:${b.color}"></div>
          <div>
            <div style="font-weight:700">${b.name}</div>
            <div style="font-size:11px;color:#9ca3af">${b.code}</div>
          </div>
        </div>
      </td>
      <td>฿${formatCurrency(b.target)}</td>
      <td>฿${formatCurrency(todaySales)}</td>
      <td>${AppData.users.filter(u => u.branchId === b.id).length} คน</td>
      <td>${AppData.products.reduce((s, p) => s + (p.stock[b.id] || 0), 0)} ชิ้น</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-branch="${b.id}">✏️ แก้ไข</button>
          <button class="btn btn-danger" data-del-branch="${b.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div class="card-title" style="margin-bottom:2px">จัดการสาขา</div>
          <div class="card-subtitle">เพิ่ม / แก้ไข / ลบสาขา และตั้งเป้ายอดขาย</div>
        </div>
        <button class="btn btn-primary" id="btn-add-branch">+ เพิ่มสาขาใหม่</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>ชื่อสาขา</th>
            <th>เป้ายอดขาย/เดือน</th>
            <th>ยอดวันนี้</th>
            <th>พนักงาน</th>
            <th>Stock รวม</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderSettingsUsers() {
  const rows = AppData.users.map(u => {
    const role = AppData.roles[u.role];
    const branch = u.branchId ? AppData.branches.find(b => b.id === u.branchId) : null;
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar" style="background:linear-gradient(135deg,${role?.color},#ec4899);width:32px;height:32px;font-size:11px">
            ${u.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("")}
          </div>
          <div>
            <div style="font-weight:700">${u.name}</div>
            <div style="font-size:11px;color:#9ca3af">@${u.username}</div>
          </div>
        </div>
      </td>
      <td><span class="role-pill" style="background:${role?.color}">${role?.name}</span></td>
      <td>${branch ? branch.name : "ทุกสาขา"}</td>
      <td>${u.email}<br><span style="font-size:11px;color:#9ca3af">${u.phone}</span></td>
      <td><span class="badge ${u.active ? "badge-green" : "badge-red"}">${u.active ? "ใช้งาน" : "ปิด"}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-user="${u.id}">✏️</button>
          <button class="btn ${u.active ? "btn-danger" : "btn-secondary"}" data-toggle-user="${u.id}">${u.active ? "🚫 ปิด" : "✓ เปิด"}</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div class="card-title" style="margin-bottom:2px">จัดการผู้ใช้งาน</div>
          <div class="card-subtitle">${AppData.users.length} ผู้ใช้ทั้งหมด · ${AppData.users.filter(u=>u.active).length} ใช้งานอยู่</div>
        </div>
        <button class="btn btn-primary" id="btn-add-user">+ เพิ่มผู้ใช้ใหม่</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>ชื่อ</th><th>บทบาท</th><th>สาขา</th><th>ติดต่อ</th><th>สถานะ</th><th>จัดการ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderSettingsCategories() {
  const rows = AppData.categories.map(c => {
    const productCount = AppData.products.filter(p => p.categoryId === c.id).length;
    return `
    <tr>
      <td><span style="font-size:24px">${c.icon}</span></td>
      <td><b>${c.name}</b><div style="font-size:11px;color:#9ca3af">id: ${c.id}</div></td>
      <td>
        <div style="display:inline-flex;align-items:center;gap:6px">
          <div style="width:16px;height:16px;border-radius:4px;background:${c.color}"></div>
          ${c.color}
        </div>
      </td>
      <td>${productCount} รายการ</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-cat="${c.id}">✏️ แก้ไข</button>
          <button class="btn btn-danger" data-del-cat="${c.id}" ${productCount > 0 ? "disabled style='opacity:0.5;cursor:not-allowed'" : ""}>🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div class="card-title" style="margin-bottom:2px">หมวดหมู่สินค้า</div>
          <div class="card-subtitle">${AppData.categories.length} หมวดหมู่</div>
        </div>
        <button class="btn btn-primary" id="btn-add-cat">+ เพิ่มหมวดหมู่</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Icon</th><th>ชื่อหมวด</th><th>สี</th><th>สินค้า</th><th>จัดการ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderSettingsProducts() {
  const grouped = getProductsByCategory();
  const totalProducts = AppData.products.length;

  // Build category-grouped sections
  const categorySections = Object.values(grouped).map(g => {
    if (g.items.length === 0) return "";
    const c = g.category;
    const rows = g.items.map(p => {
      const totalStock = AppData.branches.reduce((s, b) => s + (p.stock[b.id] || 0), 0);
      return `
      <tr>
        <td style="width:60px;text-align:center">
          <code style="background:${c.color};color:#fff;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:800">${p.itemCode || p.sku}</code>
        </td>
        <td><img src="${p.images[0]}" style="width:40px;height:40px;border-radius:6px;object-fit:cover" onerror="this.style.display='none'"></td>
        <td>
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:11px;color:#9ca3af">SKU: ${p.sku}</div>
        </td>
        <td>฿${formatCurrency(p.price)}</td>
        <td>฿${formatCurrency(p.cost || 0)}</td>
        <td><span style="font-weight:700;color:#16a34a">${p.price && p.cost ? Math.round((p.price - p.cost)/p.price*100) : 0}%</span></td>
        <td>${totalStock} ชิ้น</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-secondary" data-edit-prod="${p.id}">✏️</button>
            <button class="btn btn-danger" data-del-prod="${p.id}">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join("");

    return `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:24px">${c.icon}</div>
          <div>
            <div style="font-size:16px;font-weight:800">${c.name}</div>
            <div style="font-size:11px;color:#9ca3af">id: <code>${c.id}</code> · prefix: <code style="background:${c.color}30;padding:1px 6px;border-radius:3px;color:${c.color};font-weight:800">${c.code}-</code> · ${g.items.length} รายการ</div>
          </div>
        </div>
        <button class="btn btn-secondary" data-add-to-cat="${c.id}" style="font-size:12px">+ เพิ่มใน ${c.code}</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align:center">รหัส</th>
            <th>รูป</th>
            <th>สินค้า</th>
            <th>ราคาขาย</th>
            <th>ต้นทุน</th>
            <th>Margin</th>
            <th>Stock รวม</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).filter(Boolean).join("");

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi-card">
        <div class="kpi-label">สินค้าทั้งหมด</div>
        <div class="kpi-value">${totalProducts} <small>SKU</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">หมวดที่มีสินค้า</div>
        <div class="kpi-value">${Object.values(grouped).filter(g => g.items.length > 0).length}/${AppData.categories.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">มูลค่ารวม (ราคาขาย)</div>
        <div class="kpi-value">฿<span>${formatCurrency(AppData.products.reduce((s, p) => s + p.price * AppData.branches.reduce((s2, b) => s2 + (p.stock[b.id]||0), 0), 0))}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">มูลค่ารวม (ต้นทุน)</div>
        <div class="kpi-value">฿<span>${formatCurrency(AppData.products.reduce((s, p) => s + (p.cost||0) * AppData.branches.reduce((s2, b) => s2 + (p.stock[b.id]||0), 0), 0))}</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="card-title" style="margin-bottom:2px">📋 จัดการสินค้า — แบ่งตามหมวด</div>
          <div class="card-subtitle">รหัสสินค้าใช้ format: <code style="background:#f1f5f9;padding:2px 6px;border-radius:3px">{หมวด}-{ลำดับ}</code> · auto-generate ตามหมวดเช่น SF-001, BD-002</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" id="btn-add-sofa">🛋️ เพิ่มรูปแบบโซฟา</button>
          <button class="btn btn-primary" id="btn-add-prod">+ เพิ่มสินค้าใหม่</button>
        </div>
      </div>
    </div>

    ${categorySections}`;
}

function renderSettingsRoles() {
  const rows = Object.entries(AppData.roles).map(([key, r]) => {
    const userCount = AppData.users.filter(u => u.role === key).length;
    const permList = r.permissions.includes("*") ? "ทุกสิทธิ์ในระบบ" : r.permissions.length + " สิทธิ์";
    return `
    <tr>
      <td><span class="role-pill" style="background:${r.color}">${r.name}</span></td>
      <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:11px">${key}</code></td>
      <td>${permList}</td>
      <td>${r.scopedToBranch ? "ใช่ (สาขาตัวเองเท่านั้น)" : "ไม่ (ทุกสาขา)"}</td>
      <td>${userCount} คน</td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-title">บทบาทและสิทธิ์ในระบบ</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px">
        ระบบมีบทบาท ${Object.keys(AppData.roles).length} ระดับ — แต่ละบทบาทมีสิทธิ์เข้าถึงเมนูและการแก้ไขข้อมูลต่างกัน
      </p>
      <table class="data-table">
        <thead><tr><th>บทบาท</th><th>Role ID</th><th>สิทธิ์</th><th>จำกัดสาขา</th><th>ผู้ใช้</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:20px;padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px">
        <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:8px">📋 รายละเอียดสิทธิ์</div>
        <div style="font-size:12px;color:#166534;line-height:1.8">
          <b>👑 เจ้าของ:</b> ทุกอย่าง รวมถึงเพิ่ม/ลบสาขา จัดการผู้ใช้ และเข้าถึงทุกสาขา<br>
          <b>⭐ ผจก.ใหญ่:</b> เข้าถึงทุกสาขา · จัดการสาขา/หมวดหมู่/สินค้า · ส่งรายงาน <i>(ไม่สามารถจัดการผู้ใช้)</i><br>
          <b>🏢 ผจก.สาขา:</b> เข้าถึงเฉพาะสาขาตัวเอง · ขายของ · ดู/แก้ stock · โอนสินค้า · ดูรายงานสาขา<br>
          <b>💰 แคชเชียร์:</b> POS ขายของ · ดู stock เท่านั้น · ดูสินค้า <i>(แก้ไขไม่ได้)</i><br>
          <b>📊 บัญชี:</b> Dashboard · รายงาน · ดู Stock <i>(ไม่สามารถขายของ)</i>
        </div>
      </div>
    </div>`;
}

function renderSettingsZones() {
  // Stats: how many deliveries used each zone
  const zoneUsage = {};
  AppData.deliveryZones.forEach(z => zoneUsage[z.id] = 0);
  AppData.receipts.forEach(r => {
    if (r.delivery && r.delivery.zoneId) zoneUsage[r.delivery.zoneId] = (zoneUsage[r.delivery.zoneId] || 0) + 1;
  });

  // Total revenue by zone
  const zoneRevenue = {};
  AppData.deliveryZones.forEach(z => zoneRevenue[z.id] = 0);
  AppData.receipts.forEach(r => {
    if (r.delivery && r.delivery.fee) zoneRevenue[r.delivery.zoneId] = (zoneRevenue[r.delivery.zoneId] || 0) + r.delivery.fee;
  });

  const rows = AppData.deliveryZones.map(z => {
    const isProtected = z.id === "pickup" || z.id === "custom";
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:12px;height:12px;border-radius:50%;background:${z.color}"></div>
          <div>
            <div style="font-weight:700">${z.name}</div>
            <div style="font-size:11px;color:#9ca3af">id: <code style="background:#f1f5f9;padding:1px 5px;border-radius:3px">${z.id}</code> ${isProtected ? `<span class="badge badge-yellow" style="font-size:9px">เริ่มต้น</span>` : ""} ${z.requiresPerm ? `<span class="badge badge-purple" style="font-size:9px">🔐 ${z.requiresPerm}</span>` : ""}</div>
          </div>
        </div>
      </td>
      <td style="text-align:right;font-weight:700;font-size:15px">${z.id === "custom" ? '<span style="color:#ca8a04">ระบุราคา</span>' : `฿${formatCurrency(z.fee)}`}</td>
      <td style="text-align:center">${z.leadDays} วัน</td>
      <td style="text-align:center">${zoneUsage[z.id] || 0} <span style="font-size:11px;color:#9ca3af">ครั้ง</span></td>
      <td style="text-align:right;font-weight:700;color:#0ea5e9">฿${formatCurrency(zoneRevenue[z.id] || 0)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-zone="${z.id}" ${z.id === "pickup" || z.id === "custom" ? "" : ""}>✏️ แก้ไข</button>
          ${!isProtected ? `<button class="btn btn-danger" data-del-zone="${z.id}">🗑️</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");

  const totalDeliveries = Object.values(zoneUsage).reduce((s, v) => s + v, 0);
  const totalRevenue = Object.values(zoneRevenue).reduce((s, v) => s + v, 0);

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="kpi-card">
        <div class="kpi-label">เขตจัดส่งทั้งหมด</div>
        <div class="kpi-value">${AppData.deliveryZones.length} <small>เขต</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">การจัดส่งสะสม</div>
        <div class="kpi-value">${totalDeliveries.toLocaleString()} <small>ครั้ง</small></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">รายได้ค่าจัดส่งรวม</div>
        <div class="kpi-value">฿<span>${formatCurrency(totalRevenue)}</span></div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:12px">
        <div>
          <div class="card-title" style="margin-bottom:2px">🚚 ค่าจัดส่งและเขตการจัดส่ง</div>
          <div class="card-subtitle">ตั้งค่าราคา · lead time · เพิ่ม/ลบเขตจัดส่งใหม่</div>
        </div>
        <button class="btn btn-primary" id="btn-add-zone">+ เพิ่มเขตจัดส่ง</button>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>เขต / ID</th>
            <th style="text-align:right">ค่าจัดส่ง</th>
            <th style="text-align:center">Lead Time</th>
            <th style="text-align:center">ถูกใช้</th>
            <th style="text-align:right">รายได้สะสม</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:16px;padding:12px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:12px;color:#854d0e">
        💡 <b>หมายเหตุ:</b><br>
        • <b>"ลูกค้ารับเอง"</b> และ <b>"กำหนดราคาเอง"</b> เป็นเขตเริ่มต้น แก้ไขชื่อ/lead time ได้แต่ลบไม่ได้<br>
        • <b>Platinum tier</b> ได้ส่งฟรีทุกเขต (ยกเว้น "กำหนดราคาเอง")<br>
        • การเปลี่ยนแปลงจะมีผลกับการขายใหม่ทันที — ใบเสร็จเก่าใช้ราคาตอนทำรายการ
      </div>
    </div>`;
}

function renderSettingsChannels() {
  // Usage stats
  const usage = {};
  AppData.deliveryChannels.forEach(c => usage[c.id] = 0);
  AppData.receipts.forEach(r => {
    if (r.delivery && r.delivery.channelId) usage[r.delivery.channelId] = (usage[r.delivery.channelId] || 0) + 1;
  });

  const rows = AppData.deliveryChannels.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:8px;background:${c.color}20;display:flex;align-items:center;justify-content:center;font-size:20px">${c.icon}</div>
          <div>
            <div style="font-weight:700">${c.name}</div>
            <div style="font-size:11px;color:#9ca3af">id: ${c.id} · prefix: <code style="background:#f1f5f9;padding:1px 5px;border-radius:3px">${c.trackingPrefix}</code></div>
          </div>
        </div>
      </td>
      <td><span class="badge ${c.type === 'inhouse' ? 'badge-purple' : c.type === 'postal' ? 'badge-red' : 'badge-yellow'}">${c.type === 'inhouse' ? '🚛 In-house' : c.type === 'postal' ? '📮 Postal' : '📦 Courier'}</span></td>
      <td style="text-align:center">${c.supportsCOD ? '✅' : '❌'}</td>
      <td style="text-align:center">${c.supportsScheduledDate ? '✅' : '❌'}</td>
      <td style="text-align:center">${c.needsTeam ? '✅' : '—'}</td>
      <td style="text-align:center">${usage[c.id] || 0}</td>
      <td><span class="badge ${c.active ? 'badge-green' : 'badge-red'}">${c.active ? 'เปิดใช้งาน' : 'ปิด'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-channel="${c.id}">✏️</button>
          ${c.id !== 'inhouse' ? `<button class="btn btn-danger" data-del-channel="${c.id}">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="card-title" style="margin-bottom:2px">📦 ช่องทางการจัดส่ง</div>
          <div class="card-subtitle">ทีมในบริษัท + ขนส่งภายนอก (ไปรษณีย์ / Kerry / Flash / J&T / Lalamove)</div>
        </div>
        <button class="btn btn-primary" id="btn-add-channel">+ เพิ่มช่องทางจัดส่ง</button>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>ช่องทาง</th><th>ประเภท</th><th>COD</th><th>นัดเวลาได้</th><th>ใช้ทีม</th><th>ใช้แล้ว</th><th>สถานะ</th><th>จัดการ</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:14px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;color:#0c4a6e;line-height:1.7">
        💡 <b>คำอธิบาย:</b><br>
        • <b>In-house</b> = ทีมบริษัทเอง · ปรับเวลาได้ · ใช้ทีมจัดส่ง · COD ได้<br>
        • <b>Postal</b> = ไปรษณีย์ไทย · ส่งทั่วประเทศ · ติดตามผ่านเว็บไปรษณีย์<br>
        • <b>Courier</b> = บริษัทขนส่งเอกชน (Kerry, Flash, J&T) · ส่งเร็ว · COD ได้<br>
        • <b>Tracking prefix</b> = กำหนดรูปแบบเลขพัสดุ (เช่น TRK-, EMS-, KER-)
      </div>
    </div>`;
}

function renderSettingsTeams() {
  const rows = AppData.deliveryTeams.map(t => {
    const driverNames = t.driverIds.map(did => AppData.drivers.find(d => d.id === did)?.name || "?").join(", ");
    const branch = AppData.branches.find(b => b.id === t.branchId);
    // Active deliveries assigned to this team
    const activeJobs = AppData.receipts.filter(r => r.delivery?.teamId === t.id && !["delivered", "cancelled"].includes(r.delivery.status)).length;
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:12px;height:12px;border-radius:50%;background:${t.color}"></div>
          <div>
            <div style="font-weight:700">${t.name}</div>
            <div style="font-size:11px;color:#9ca3af">${t.notes || "—"}</div>
          </div>
        </div>
      </td>
      <td>${t.vehicle}</td>
      <td><div style="font-size:12px"><b>${t.driverIds.length} คนขับ</b> · ${t.helpers.length} ผู้ช่วย</div><div style="font-size:11px;color:#9ca3af">${driverNames}</div></td>
      <td>${branch?.name || "ทุกสาขา"}</td>
      <td>
        <div style="font-size:13px;font-weight:700">${t.slotCapacity || 2} งาน/ช่วง × 3 = ${t.capacityPerDay || (t.slotCapacity || 2) * 3} งาน/วัน</div>
        <div style="font-size:11px;color:#9ca3af">วันนี้: ${activeJobs}/${t.capacityPerDay || 6}</div>
      </td>
      <td><span class="badge ${t.active ? 'badge-green' : 'badge-red'}">${t.active ? 'พร้อมใช้งาน' : 'ปิด'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" data-edit-team="${t.id}">✏️</button>
          <button class="btn btn-danger" data-del-team="${t.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="card-title" style="margin-bottom:2px">👥 ทีมจัดส่ง (In-house)</div>
          <div class="card-subtitle">${AppData.deliveryTeams.length} ทีม · จัดทีมจัดส่งสำหรับการส่งของบริษัทเอง · มอบหมายงานให้ทีมแทนคนเดียว</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" id="btn-add-driver">+ เพิ่มคนขับ</button>
          <button class="btn btn-primary" id="btn-add-team">+ เพิ่มทีม</button>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>ทีม</th><th>ยานพาหนะ</th><th>สมาชิก</th><th>สาขาประจำ</th><th>capacity</th><th>สถานะ</th><th>จัดการ</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af">ยังไม่มีทีม</td></tr>`}</tbody>
      </table>

      <div style="margin-top:16px">
        <div class="card-title" style="font-size:13px">🚛 รายชื่อคนขับทั้งหมด (${AppData.drivers.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:8px">
          ${AppData.drivers.map(d => {
            const teamId = AppData.deliveryTeams.find(t => t.driverIds.includes(d.id))?.id;
            const team = teamId ? AppData.deliveryTeams.find(t => t.id === teamId) : null;
            return `
            <div style="background:#f8fafc;border-radius:8px;padding:10px;border:1px solid #e2e8f0">
              <div style="font-weight:700;font-size:13px">${d.name}</div>
              <div style="font-size:11px;color:#6b7280">📞 ${d.phone}</div>
              <div style="font-size:11px;color:#6b7280">🚛 ${d.vehicle}${d.license ? ` · ${d.license}` : ''}</div>
              ${team ? `<div style="margin-top:4px"><span class="role-pill" style="background:${team.color};font-size:10px">${team.name}</span></div>` : `<div style="font-size:10px;color:#9ca3af;margin-top:4px">ยังไม่อยู่ในทีม</div>`}
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>`;
}

function openChannelModal(channelId = null) {
  const ch = channelId ? AppData.deliveryChannels.find(c => c.id === channelId) : { id: "", name: "", icon: "📦", type: "courier", trackingPrefix: "", color: "#6366f1", supportsCOD: true, supportsScheduledDate: false, needsTeam: false, description: "", websiteTrackUrl: "", active: true };
  const isProtected = channelId === "inhouse";
  const colors = ["#6366f1","#0ea5e9","#10b981","#f97316","#dc2626","#a855f7","#ec4899","#eab308"];
  const icons = ["🚛","📮","📦","🟧","⚡","🟥","🛵","✈️","🚂","🚁","💼","📨"];
  let selColor = ch.color, selIcon = ch.icon;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build() {
    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-title">${channelId ? '✏️ แก้ไข' : '+ เพิ่ม'}ช่องทางการจัดส่ง</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">Channel ID *</label><input class="form-input" id="ch-id" value="${ch.id}" ${channelId ? 'disabled' : ''} placeholder="เช่น dhl"></div>
          <div class="form-group"><label class="form-label">ชื่อช่องทาง *</label><input class="form-input" id="ch-name" value="${ch.name}" placeholder="เช่น DHL Express"></div>
        </div>

        <div class="form-group">
          <label class="form-label">ประเภท</label>
          <select class="form-input" id="ch-type" ${isProtected ? 'disabled' : ''}>
            <option value="inhouse" ${ch.type === 'inhouse' ? 'selected' : ''}>🚛 In-house (ทีมบริษัท)</option>
            <option value="postal" ${ch.type === 'postal' ? 'selected' : ''}>📮 Postal (ไปรษณีย์)</option>
            <option value="courier" ${ch.type === 'courier' ? 'selected' : ''}>📦 Courier (บริษัทขนส่ง)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Icon</label>
          <div class="icon-picker">${icons.map(i => `<div class="icon-pick ${i === selIcon ? 'selected' : ''}" data-ch-icon="${i}">${i}</div>`).join("")}</div>
        </div>

        <div class="form-group">
          <label class="form-label">สี</label>
          <div class="color-picker">${colors.map(c => `<div class="color-pick ${c === selColor ? 'selected' : ''}" data-ch-color="${c}" style="background:${c}"></div>`).join("")}</div>
        </div>

        <div class="form-group"><label class="form-label">Tracking Prefix</label><input class="form-input" id="ch-prefix" value="${ch.trackingPrefix}" placeholder="เช่น DHL-"></div>
        <div class="form-group"><label class="form-label">URL ติดตามพัสดุ (track URL)</label><input class="form-input" id="ch-url" value="${ch.websiteTrackUrl || ''}" placeholder="https://example.com/track?no="></div>
        <div class="form-group"><label class="form-label">รายละเอียด</label><textarea class="form-input" id="ch-desc" rows="2">${ch.description || ''}</textarea></div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="ch-cod" ${ch.supportsCOD ? 'checked' : ''}> 💰 รับ COD</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="ch-sched" ${ch.supportsScheduledDate ? 'checked' : ''}> 📅 นัดเวลาได้</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="ch-team" ${ch.needsTeam ? 'checked' : ''}> 👥 ใช้ทีม</label>
        </div>

        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-top:10px"><input type="checkbox" id="ch-active" ${ch.active ? 'checked' : ''}> เปิดใช้งาน</label>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="ch-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="ch-save" style="flex:2">💾 บันทึก</button>
        </div>
      </div>`;

    modal.querySelectorAll("[data-ch-icon]").forEach(el => el.addEventListener("click", () => { selIcon = el.dataset.chIcon; build(); }));
    modal.querySelectorAll("[data-ch-color]").forEach(el => el.addEventListener("click", () => { selColor = el.dataset.chColor; build(); }));

    modal.querySelector("#ch-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#ch-save").addEventListener("click", () => {
      const id = modal.querySelector("#ch-id").value.trim().toLowerCase().replace(/\s+/g, "_");
      const name = modal.querySelector("#ch-name").value.trim();
      if (!id || !name) { showToast("⚠️ กรุณากรอก ID และชื่อ", "error"); return; }

      const data = {
        name, icon: selIcon, color: selColor,
        type: modal.querySelector("#ch-type").value,
        trackingPrefix: modal.querySelector("#ch-prefix").value.trim() || "TRK-",
        websiteTrackUrl: modal.querySelector("#ch-url").value.trim() || null,
        description: modal.querySelector("#ch-desc").value.trim(),
        supportsCOD: modal.querySelector("#ch-cod").checked,
        supportsScheduledDate: modal.querySelector("#ch-sched").checked,
        needsTeam: modal.querySelector("#ch-team").checked,
        active: modal.querySelector("#ch-active").checked,
      };

      if (channelId) {
        Object.assign(ch, data);
        logAction("channel.updated", { id, name });
        showToast("✅ แก้ไขช่องทางสำเร็จ", "success");
      } else {
        if (AppData.deliveryChannels.find(c => c.id === id)) { showToast("❌ ID นี้มีอยู่แล้ว", "error"); return; }
        AppData.deliveryChannels.push({ id, ...data });
        logAction("channel.created", { id, name });
        showToast("✅ เพิ่มช่องทางสำเร็จ", "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

function openTeamModal(teamId = null) {
  const t = teamId ? AppData.deliveryTeams.find(x => x.id === teamId) : { id: null, name: "", region: "bkk_inner", color: "#6366f1", driverIds: [], helpers: [], vehicle: "", capacityPerDay: 8, branchId: null, active: true, notes: "" };
  const colors = ["#6366f1","#0ea5e9","#10b981","#f97316","#dc2626","#a855f7","#ec4899","#eab308"];
  let selColor = t.color;
  let selDrivers = [...(t.driverIds || [])];
  let helpers = [...(t.helpers || [])];

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build() {
    const branchOpts = `<option value="">— ไม่จำกัดสาขา —</option>` + AppData.branches.filter(b => !b.isWarehouse).map(b => `<option value="${b.id}" ${t.branchId == b.id ? 'selected' : ''}>${b.name}</option>`).join("");

    const driverChecks = AppData.drivers.map(d => {
      const isUsed = selDrivers.includes(d.id);
      const otherTeam = AppData.deliveryTeams.find(tt => tt.id !== teamId && tt.driverIds.includes(d.id));
      return `
        <label style="display:flex;align-items:center;gap:8px;padding:8px;background:${isUsed ? '#eef2ff' : '#f8fafc'};border:2px solid ${isUsed ? '#6366f1' : '#e2e8f0'};border-radius:8px;cursor:pointer">
          <input type="checkbox" ${isUsed ? 'checked' : ''} data-team-driver="${d.id}" style="width:16px;height:16px;accent-color:#6366f1">
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${d.name}</div>
            <div style="font-size:10px;color:#9ca3af">${d.vehicle}${otherTeam ? ` · <span style="color:#dc2626">อยู่ใน "${otherTeam.name}"</span>` : ''}</div>
          </div>
        </label>`;
    }).join("");

    const helperChips = helpers.map((h, i) => `
      <div class="email-chip">${h} <span class="email-chip-remove" data-rm-helper="${i}">×</span></div>
    `).join("");

    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-title">${teamId ? '✏️ แก้ไข' : '+ เพิ่ม'}ทีมจัดส่ง</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">ชื่อทีม *</label><input class="form-input" id="t-name" value="${t.name}" placeholder="เช่น ทีม D - กทม. ตะวันออก"></div>
          <div class="form-group">
            <label class="form-label">สาขาประจำ</label>
            <select class="form-input" id="t-branch">${branchOpts}</select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">ยานพาหนะ</label><input class="form-input" id="t-vehicle" value="${t.vehicle}" placeholder="เช่น 6 ล้อ + กระบะ"></div>
          <div class="form-group"><label class="form-label">capacity / วัน</label><input type="number" class="form-input" id="t-cap" value="${t.capacityPerDay}" min="1" max="50"></div>
          <div class="form-group">
            <label class="form-label">สี</label>
            <div class="color-picker">${colors.map(c => `<div class="color-pick ${c === selColor ? 'selected' : ''}" data-team-color="${c}" style="background:${c}"></div>`).join("")}</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">คนขับในทีม (เลือกได้หลายคน)</label>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;max-height:200px;overflow-y:auto">${driverChecks}</div>
        </div>

        <div class="form-group">
          <label class="form-label">ผู้ช่วย / คนยกของ (${helpers.length})</label>
          <div style="margin-bottom:6px">${helperChips || '<div style="font-size:12px;color:#9ca3af">ยังไม่มี</div>'}</div>
          <div style="display:flex;gap:6px">
            <input type="text" class="form-input" id="t-helper-name" placeholder="ชื่อ-สกุล (เช่น คุณสมพงษ์ ผู้ช่วย)" style="flex:1">
            <button class="btn btn-secondary" id="t-add-helper">+ เพิ่ม</button>
          </div>
        </div>

        <div class="form-group"><label class="form-label">หมายเหตุ</label><textarea class="form-input" id="t-notes" rows="2" placeholder="ข้อมูลพิเศษ เช่น พร้อมขึ้นชั้น 5 / มีรอกขนของ">${t.notes}</textarea></div>

        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;margin-top:6px"><input type="checkbox" id="t-active" ${t.active ? 'checked' : ''}> ทีมพร้อมใช้งาน</label>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="t-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="t-save" style="flex:2">💾 บันทึก</button>
        </div>
      </div>`;

    modal.querySelectorAll("[data-team-color]").forEach(el => el.addEventListener("click", () => { selColor = el.dataset.teamColor; build(); }));
    modal.querySelectorAll("[data-team-driver]").forEach(el => el.addEventListener("change", () => {
      const did = parseInt(el.dataset.teamDriver);
      if (el.checked) { if (!selDrivers.includes(did)) selDrivers.push(did); }
      else { selDrivers = selDrivers.filter(x => x !== did); }
    }));
    modal.querySelector("#t-add-helper").addEventListener("click", () => {
      const inp = modal.querySelector("#t-helper-name");
      if (inp.value.trim()) { helpers.push(inp.value.trim()); build(); }
    });
    modal.querySelectorAll("[data-rm-helper]").forEach(el => el.addEventListener("click", () => {
      helpers.splice(parseInt(el.dataset.rmHelper), 1);
      build();
    }));

    modal.querySelector("#t-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#t-save").addEventListener("click", () => {
      const name = modal.querySelector("#t-name").value.trim();
      if (!name) { showToast("⚠️ กรุณากรอกชื่อทีม", "error"); return; }
      const data = {
        name,
        vehicle: modal.querySelector("#t-vehicle").value.trim(),
        capacityPerDay: parseInt(modal.querySelector("#t-cap").value) || 8,
        branchId: modal.querySelector("#t-branch").value ? parseInt(modal.querySelector("#t-branch").value) : null,
        notes: modal.querySelector("#t-notes").value.trim(),
        color: selColor,
        driverIds: selDrivers,
        helpers,
        active: modal.querySelector("#t-active").checked,
      };
      if (teamId) {
        Object.assign(t, data);
        logAction("team.updated", { id: teamId, name });
        showToast("✅ แก้ไขทีมสำเร็จ", "success");
      } else {
        const newId = (AppData.deliveryTeams.length ? Math.max(...AppData.deliveryTeams.map(x => x.id)) : 0) + 1;
        AppData.deliveryTeams.push({ id: newId, ...data });
        logAction("team.created", { id: newId, name });
        showToast("✅ เพิ่มทีมสำเร็จ", "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

function openZoneModal(zoneId = null) {
  const z = zoneId ? AppData.deliveryZones.find(z => z.id === zoneId) : { id: "", name: "", fee: 500, leadDays: 2, color: "#6366f1", custom: false };
  const isProtected = zoneId === "pickup" || zoneId === "custom";
  const colors = ["#10b981","#0ea5e9","#6366f1","#a855f7","#ec4899","#f59e0b","#dc2626","#64748b"];
  let selectedColor = z.color;
  const iconChoices = ["🏪","🛵","🚚","🚛","⚡","💰","✈️","🚂","🛺","🚁"];
  // Extract icon from name if exists
  const iconMatch = (z.name || "").match(/^(\p{Extended_Pictographic})/u);
  let selectedIcon = iconMatch ? iconMatch[1] : "🚚";
  let cleanName = (z.name || "").replace(/^\p{Extended_Pictographic}\s*/u, "");

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build() {
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">${zoneId ? "✏️ แก้ไขเขตจัดส่ง" : "🚚 เพิ่มเขตจัดส่งใหม่"}</div>

        <div class="form-group">
          <label class="form-label">Zone ID (a-z, _) ${isProtected ? "<span style='color:#dc2626'>(ห้ามแก้)</span>" : ""}</label>
          <input class="form-input" id="z-id" value="${z.id}" ${zoneId ? "disabled" : ""} placeholder="เช่น samui_delivery">
        </div>

        <div class="form-group">
          <label class="form-label">Icon</label>
          <div class="icon-picker" style="grid-template-columns:repeat(10,1fr)">
            ${iconChoices.map(i => `<div class="icon-pick ${i === selectedIcon ? 'selected' : ''}" data-zone-icon="${i}">${i}</div>`).join("")}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">ชื่อเขต</label>
          <input class="form-input" id="z-name" value="${cleanName}" placeholder="เช่น เกาะสมุย">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="form-group">
            <label class="form-label">ค่าจัดส่ง (บาท) ${z.id === 'custom' ? '<span style="color:#dc2626">(N/A — กำหนดเอง)</span>' : ''}</label>
            <input type="number" class="form-input" id="z-fee" value="${z.fee || 0}" ${z.id === 'custom' ? 'disabled' : ''} min="0" step="50">
          </div>
          <div class="form-group">
            <label class="form-label">Lead Time (วัน)</label>
            <input type="number" class="form-input" id="z-lead" value="${z.leadDays || 0}" min="0" max="30">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">สี</label>
          <div class="color-picker">
            ${colors.map(c => `<div class="color-pick ${c === selectedColor ? 'selected' : ''}" data-zone-color="${c}" style="background:${c}"></div>`).join("")}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="z-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="z-save" style="flex:2">💾 บันทึก</button>
        </div>
      </div>`;

    modal.querySelectorAll("[data-zone-icon]").forEach(el => {
      el.addEventListener("click", () => { selectedIcon = el.dataset.zoneIcon; build(); });
    });
    modal.querySelectorAll("[data-zone-color]").forEach(el => {
      el.addEventListener("click", () => { selectedColor = el.dataset.zoneColor; build(); });
    });

    modal.querySelector("#z-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#z-save").addEventListener("click", () => {
      const id = modal.querySelector("#z-id").value.trim().toLowerCase().replace(/\s+/g, "_");
      const name = `${selectedIcon} ${modal.querySelector("#z-name").value.trim()}`;
      const fee = parseInt(modal.querySelector("#z-fee").value) || 0;
      const leadDays = parseInt(modal.querySelector("#z-lead").value) || 0;

      if (!id || !modal.querySelector("#z-name").value.trim()) { showToast("⚠️ กรุณากรอก ID และชื่อ", "error"); return; }

      if (zoneId) {
        const oldFee = z.fee, oldLead = z.leadDays, oldName = z.name;
        z.name = name;
        if (z.id !== "custom") z.fee = fee;
        z.leadDays = leadDays;
        z.color = selectedColor;
        logAction("zone.updated", {
          id: z.id,
          name,
          changes: {
            ...(oldFee !== fee && z.id !== "custom" ? { fee: { from: oldFee, to: fee } } : {}),
            ...(oldLead !== leadDays ? { leadDays: { from: oldLead, to: leadDays } } : {}),
            ...(oldName !== name ? { name: { from: oldName, to: name } } : {}),
          },
        });
        showToast("✅ แก้ไขเขตจัดส่งสำเร็จ", "success");
      } else {
        if (AppData.deliveryZones.find(zz => zz.id === id)) { showToast("❌ ID นี้มีอยู่แล้ว", "error"); return; }
        AppData.deliveryZones.push({ id, name, fee, leadDays, color: selectedColor });
        logAction("zone.created", { id, name, fee, leadDays });
        showToast("✅ เพิ่มเขตจัดส่งสำเร็จ", "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

function renderSettingsImportExport() {
  const canImport = hasPermission("data.import");

  // Stats
  const stats = {
    products: AppData.products.length,
    customers: AppData.customers.length,
    receipts: AppData.receipts.length,
    branches: AppData.branches.length,
    quotations: AppData.quotations.length,
    audit: AppData.auditLog.length,
  };

  return `
    <div class="card">
      <div class="card-title">📊 Import / Export ข้อมูล (Excel)</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:20px">นำเข้า/ส่งออกข้อมูลในรูปแบบ <b>.xlsx</b> ใช้กับ Microsoft Excel / Google Sheets ได้โดยตรง</p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">

        <!-- EXPORT SECTION -->
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px">
          <div style="font-size:14px;font-weight:800;color:#15803d;margin-bottom:12px">📥 ส่งออก (Export)</div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">🛍️</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">สินค้าทั้งหมด</div>
              <div style="font-size:11px;color:#9ca3af">${stats.products} SKU · รวม sizes/colors/materials/stock</div>
            </div>
            <button class="btn btn-primary" id="exp-products">📥 .xlsx</button>
          </div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">👥</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">ลูกค้า + Loyalty</div>
              <div style="font-size:11px;color:#9ca3af">${stats.customers} คน · totalSpent, points, tier</div>
            </div>
            <button class="btn btn-primary" id="exp-customers">📥 .xlsx</button>
          </div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">🧾</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">ใบเสร็จ + Items</div>
              <div style="font-size:11px;color:#9ca3af">${stats.receipts} ใบ · 2 sheets (header + line items)</div>
            </div>
            <button class="btn btn-primary" id="exp-receipts">📥 .xlsx</button>
          </div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">📦</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">Stock ทุกสาขา</div>
              <div style="font-size:11px;color:#9ca3af">Matrix แยกคอลัมน์ตาม ${stats.branches} สาขา</div>
            </div>
            <button class="btn btn-primary" id="exp-stock">📥 .xlsx</button>
          </div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">📝</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">ใบเสนอราคา</div>
              <div style="font-size:11px;color:#9ca3af">${stats.quotations} ใบ · status, validUntil, items</div>
            </div>
            <button class="btn btn-primary" id="exp-quotes">📥 .xlsx</button>
          </div>

          <div class="export-item" style="background:#fff;border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px">
            <div style="font-size:24px">📋</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">Audit Log</div>
              <div style="font-size:11px;color:#9ca3af">${stats.audit} รายการ · timestamp + user + action</div>
            </div>
            <button class="btn btn-primary" id="exp-audit">📥 .xlsx</button>
          </div>

          <button class="btn btn-secondary" id="exp-all" style="width:100%;margin-top:10px">🗂️ Export ทั้งหมด (Backup)</button>
        </div>

        <!-- IMPORT SECTION -->
        <div style="background:${canImport ? '#fefce8;border:1px solid #fde047' : '#f1f5f9;border:1px solid #e2e8f0'};border-radius:12px;padding:16px">
          <div style="font-size:14px;font-weight:800;color:${canImport ? '#854d0e' : '#9ca3af'};margin-bottom:12px">📤 นำเข้า (Import) ${canImport ? "" : "🔒"}</div>

          ${canImport ? `
          <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px;color:#854d0e;border:1px solid #fde047">
            ⚠️ <b>ข้อควรระวัง:</b> Import จะ <b>เพิ่ม</b> หรือ <b>อัปเดต</b> ข้อมูลตาม id/sku — โปรด export ปัจจุบันเก็บไว้ก่อน หากต้องการรีเซ็ต
          </div>

          <div class="import-item" style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="font-size:24px">🛍️</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">สินค้า</div>
                <div style="font-size:11px;color:#9ca3af">เพิ่ม/อัปเดตตาม SKU · ต้องมี cols: sku, name, categoryId, price, cost</div>
              </div>
            </div>
            <input type="file" id="imp-products" accept=".xlsx,.xls,.csv" style="font-size:11px;width:100%">
          </div>

          <div class="import-item" style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="font-size:24px">👥</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">ลูกค้า</div>
                <div style="font-size:11px;color:#9ca3af">cols: name, phone, email, address (ใหม่ทั้งหมด)</div>
              </div>
            </div>
            <input type="file" id="imp-customers" accept=".xlsx,.xls,.csv" style="font-size:11px;width:100%">
          </div>

          <div class="import-item" style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="font-size:24px">📦</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">Stock Adjustment</div>
                <div style="font-size:11px;color:#9ca3af">cols: sku + คอลัมน์รหัสสาขา (BKK01, BKK02...)</div>
              </div>
            </div>
            <input type="file" id="imp-stock" accept=".xlsx,.xls,.csv" style="font-size:11px;width:100%">
          </div>

          <button class="btn btn-secondary" id="dl-template" style="width:100%;margin-top:8px;font-size:11px">📋 ดาวน์โหลด Template เปล่า</button>
          ` : `
          <div style="text-align:center;padding:30px 10px;color:#9ca3af">
            <div style="font-size:48px;margin-bottom:12px">🔒</div>
            <div style="font-size:13px">บทบาทของคุณไม่มีสิทธิ์ Import</div>
            <div style="font-size:11px;margin-top:4px">เฉพาะ Owner / Admin เท่านั้น</div>
          </div>`}
        </div>
      </div>

      <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:10px;font-size:12px;color:#374151;line-height:1.7">
        💡 <b>เคล็ดลับ:</b><br>
        • Export แต่ละไฟล์ก่อน import เพื่อเป็น backup<br>
        • ไฟล์ <code style="background:#fff;padding:1px 5px;border-radius:3px">.xlsx</code> มี column header ชัดเจน — แก้ใน Excel/Sheets แล้ว upload กลับ<br>
        • <b>"Stock Adjustment"</b> import จะ <b>แทน</b> ค่า stock เดิม ไม่ได้บวกเข้าไป<br>
        • <b>"Export ทั้งหมด"</b> รวม 6 ไฟล์ในรอบเดียว ใช้สำหรับสำรองข้อมูล
      </div>
    </div>`;
}

function renderSettingsAudit() {
  const filterUser = State.auditFilterUser || "all";
  const filterAction = State.auditFilterAction || "all";

  let logs = AppData.auditLog;
  if (filterUser !== "all") logs = logs.filter(l => l.userId === parseInt(filterUser));
  if (filterAction !== "all") logs = logs.filter(l => l.action.startsWith(filterAction));

  const display = logs.slice(0, 200);

  // Action category icons
  const actionIcon = (a) => {
    if (a.startsWith("login")) return "🔓";
    if (a.startsWith("logout")) return "🚪";
    if (a.startsWith("sale")) return "💰";
    if (a.startsWith("discount")) return "🏷️";
    if (a.startsWith("transfer")) return "🔄";
    if (a.startsWith("branch")) return "🏢";
    if (a.startsWith("user")) return "👤";
    if (a.startsWith("category")) return "📂";
    if (a.startsWith("product")) return "🛍️";
    if (a.startsWith("stock")) return "📦";
    return "📝";
  };

  const actionColor = (a) => {
    if (a.includes("failed") || a.includes("delete")) return "#dc2626";
    if (a.includes("success") || a.includes("completed") || a.includes("created")) return "#16a34a";
    if (a.includes("updated") || a.includes("transfer")) return "#0ea5e9";
    return "#6b7280";
  };

  const userOpts = `<option value="all">ทุกคน</option>` +
    AppData.users.map(u => `<option value="${u.id}" ${filterUser == u.id ? "selected" : ""}>${u.name}</option>`).join("");

  const actionOpts = `<option value="all">ทุกประเภท</option>
    <option value="login" ${filterAction === "login" ? "selected" : ""}>🔓 เข้า/ออกระบบ</option>
    <option value="sale" ${filterAction === "sale" ? "selected" : ""}>💰 การขาย</option>
    <option value="discount" ${filterAction === "discount" ? "selected" : ""}>🏷️ ส่วนลด</option>
    <option value="transfer" ${filterAction === "transfer" ? "selected" : ""}>🔄 โอน Stock</option>
    <option value="branch" ${filterAction === "branch" ? "selected" : ""}>🏢 สาขา</option>
    <option value="user" ${filterAction === "user" ? "selected" : ""}>👤 ผู้ใช้</option>
    <option value="product" ${filterAction === "product" ? "selected" : ""}>🛍️ สินค้า</option>
    <option value="category" ${filterAction === "category" ? "selected" : ""}>📂 หมวดหมู่</option>`;

  const rows = display.map(l => {
    const user = AppData.users.find(u => u.id === l.userId);
    const role = user ? AppData.roles[user.role] : null;
    const branch = AppData.branches.find(b => b.id === l.branchId);
    const date = new Date(l.timestamp);
    const detailStr = formatAuditDetails(l);

    return `
    <tr>
      <td style="font-size:11px;white-space:nowrap;color:#6b7280">${date.toLocaleString("th-TH", { hour:"2-digit", minute:"2-digit", second:"2-digit", day:"2-digit", month:"short" })}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:16px">${actionIcon(l.action)}</span>
          <code style="font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:${actionColor(l.action)};font-weight:600">${l.action}</code>
        </div>
      </td>
      <td>
        ${user ? `<div style="font-size:12px;font-weight:600">${l.userName}</div><span class="role-pill" style="background:${role?.color};font-size:9px;padding:1px 6px">${role?.name}</span>` : `<span style="color:#9ca3af">${l.userName}</span>`}
      </td>
      <td style="font-size:11px;color:#9ca3af">${branch ? branch.code : "—"}</td>
      <td style="font-size:11px;color:#374151;max-width:340px">${detailStr}</td>
    </tr>`;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
        <div>
          <div class="card-title" style="margin-bottom:2px">ประวัติการใช้งานระบบ (Audit Log)</div>
          <div class="card-subtitle">${AppData.auditLog.length} รายการทั้งหมด · แสดง ${display.length} ล่าสุด</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:12px;color:#6b7280">ผู้ใช้:</label>
          <select class="form-input" id="audit-filter-user" style="width:160px">${userOpts}</select>
          <label style="font-size:12px;color:#6b7280">ประเภท:</label>
          <select class="form-input" id="audit-filter-action" style="width:160px">${actionOpts}</select>
          <button class="btn btn-secondary" id="btn-export-audit">📥 Export</button>
          <button class="btn btn-danger" id="btn-clear-audit">🗑️ ล้าง Log</button>
        </div>
      </div>
      <div style="overflow-x:auto;max-height:600px">
        <table class="data-table">
          <thead style="position:sticky;top:0;background:#fff;z-index:1">
            <tr><th>เวลา</th><th>Action</th><th>ผู้ใช้</th><th>สาขา</th><th>รายละเอียด</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" style="text-align:center;padding:40px;color:#9ca3af">ไม่มีประวัติ</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function formatAuditDetails(l) {
  const d = l.details || {};
  if (l.action === "login.success") return `เข้าสู่ระบบสำเร็จ (${d.username})`;
  if (l.action === "login.failed") return `<span style="color:#dc2626">เข้าสู่ระบบล้มเหลว: ${d.username}</span>`;
  if (l.action === "logout") return `ออกจากระบบ`;
  if (l.action === "sale.completed") {
    const items = (d.items || []).map(i => `${i.name} ×${i.qty}`).join(", ");
    return `${d.receiptNo} · ${items} · <b>฿${formatCurrency(d.total)}</b> ${d.discAmount > 0 ? ` <span style="color:#10b981">(ลด ฿${formatCurrency(d.discAmount)})</span>` : ""}`;
  }
  if (l.action === "sale.stock_insufficient") return `<span style="color:#dc2626">พยายามขายแต่ stock ไม่พอ: ${(d.items||[]).map(x=>x.name).join(", ")}</span>`;
  if (l.action === "discount.applied") return `ใช้ส่วนลด ${d.percent}% (฿${formatCurrency(d.amount)}) ${d.reason ? `· "${d.reason}"` : ""}`;
  if (l.action === "transfer.completed") return `${d.product} · ${d.qty} ชิ้น · ${d.from} → ${d.to}`;
  if (l.action === "branch.created") return `เพิ่มสาขา <b>${d.name}</b> (${d.code})`;
  if (l.action === "branch.updated") return `แก้ไขสาขา <b>${d.name}</b> (${d.code})`;
  if (l.action === "branch.deleted") return `<span style="color:#dc2626">ลบสาขา <b>${d.name}</b></span>`;
  if (l.action === "user.created") return `เพิ่มผู้ใช้ <b>${d.name}</b> (${d.role})`;
  if (l.action === "user.updated") return `แก้ไขผู้ใช้ <b>${d.name}</b>`;
  if (l.action === "user.toggled") return `${d.active ? "เปิด" : "ปิด"}บัญชี <b>${d.name}</b>`;
  if (l.action === "category.created") return `เพิ่มหมวด <b>${d.name}</b>`;
  if (l.action === "category.updated") return `แก้ไขหมวด <b>${d.name}</b>`;
  if (l.action === "category.deleted") return `<span style="color:#dc2626">ลบหมวด <b>${d.name}</b></span>`;
  if (l.action === "product.created") return `เพิ่มสินค้า <b>${d.name}</b> (${d.sku})`;
  if (l.action === "product.updated") return `แก้ไขสินค้า <b>${d.name}</b>`;
  if (l.action === "product.deleted") return `<span style="color:#dc2626">ลบสินค้า <b>${d.name}</b></span>`;
  if (l.action === "stock.export") return `Export Stock CSV`;
  if (l.action === "delivery.updated") return `${d.trackingNo} → ${AppData.deliveryStatuses[d.status]?.name} ${d.note ? `· ${d.note}` : ''}`;
  if (l.action === "delivery.custom_price") return `<span style="color:#ca8a04">💰 ค่าส่งกำหนดเอง ฿${formatCurrency(d.fee)} · "${d.reason}" · ${d.receiptNo}</span>`;
  if (l.action === "zone.created") return `เพิ่มเขตจัดส่ง <b>${d.name}</b> (ค่าส่ง ฿${formatCurrency(d.fee)} · lead ${d.leadDays} วัน)`;
  if (l.action === "zone.updated") {
    const changes = Object.entries(d.changes || {}).map(([k, v]) => {
      if (k === "fee") return `ค่าส่ง: ฿${formatCurrency(v.from)} → ฿${formatCurrency(v.to)}`;
      if (k === "leadDays") return `lead: ${v.from}d → ${v.to}d`;
      if (k === "name") return `ชื่อ`;
      return k;
    }).join(", ");
    return `แก้ไขเขต <b>${d.name}</b>${changes ? ` · ${changes}` : ""}`;
  }
  if (l.action === "zone.deleted") return `<span style="color:#dc2626">ลบเขตจัดส่ง <b>${d.name}</b></span>`;
  if (l.action === "data.export") return `📥 Export ${d.filename} (${d.rows} rows · ${d.sheets?.length || 1} sheets)`;
  if (l.action === "data.import.products") return `📤 Import Products: เพิ่ม ${d.added} · อัปเดต ${d.updated} · ข้าม ${d.skipped}`;
  if (l.action === "data.import.customers") return `📤 Import Customers: เพิ่ม ${d.added} · อัปเดต ${d.updated}`;
  if (l.action === "data.import.stock") return `📤 Import Stock: ${d.updated} SKU · ${d.cellsChanged} cells changed`;
  return JSON.stringify(d).slice(0, 80);
}

// ===== CRUD MODALS =====
function openBranchModal(branchId = null) {
  const branch = branchId ? AppData.branches.find(b => b.id === branchId) : { id: null, name: "", code: "", target: 300000, color: "#6366f1" };
  const colors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

  let selectedColor = branch.color;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build() {
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">${branchId ? "✏️ แก้ไขสาขา" : "🏢 เพิ่มสาขาใหม่"}</div>
        <div class="form-group"><label class="form-label">ชื่อสาขา</label><input class="form-input" id="b-name" value="${branch.name}" placeholder="เช่น สาขาเอเชียทีค"></div>
        <div class="form-group"><label class="form-label">รหัสสาขา</label><input class="form-input" id="b-code" value="${branch.code}" placeholder="เช่น BKK05"></div>
        <div class="form-group"><label class="form-label">เป้ายอดขาย/เดือน (บาท)</label><input type="number" class="form-input" id="b-target" value="${branch.target}"></div>
        <div class="form-group">
          <label class="form-label">สีประจำสาขา</label>
          <div class="color-picker">
            ${colors.map(c => `<div class="color-pick ${c === selectedColor ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`).join("")}
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="b-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="b-save" style="flex:2">💾 บันทึก</button>
        </div>
      </div>`;

    modal.querySelectorAll("[data-color]").forEach(el => {
      el.addEventListener("click", () => { selectedColor = el.dataset.color; build(); });
    });
    modal.querySelector("#b-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#b-save").addEventListener("click", () => {
      const name = modal.querySelector("#b-name").value.trim();
      const code = modal.querySelector("#b-code").value.trim().toUpperCase();
      const target = parseInt(modal.querySelector("#b-target").value) || 0;
      if (!name || !code) { showToast("⚠️ กรุณากรอกชื่อและรหัส", "error"); return; }
      if (branchId) {
        Object.assign(branch, { name, code, target, color: selectedColor });
        logAction("branch.updated", { id: branchId, name, code });
        showToast("✅ แก้ไขสาขาสำเร็จ", "success");
      } else {
        const newId = Math.max(...AppData.branches.map(b => b.id)) + 1;
        AppData.branches.push({ id: newId, name, code, target, color: selectedColor });
        AppData.todaySales[newId] = { amount: 0, count: 0, customers: 0 };
        AppData.salesHistory[newId] = [0,0,0,0,0,0];
        AppData.products.forEach(p => { p.stock[newId] = 0; });
        logAction("branch.created", { id: newId, name, code, target });
        showToast(`✅ เพิ่ม "${name}" สำเร็จ — สาขาใหม่เริ่มที่ stock 0`, "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

function openUserModal(userId = null) {
  const user = userId ? AppData.users.find(u => u.id === userId) : { id: null, username: "", password: "1234", name: "", role: "cashier", branchId: 1, email: "", phone: "", active: true };

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const roleOpts = Object.entries(AppData.roles).map(([k, r]) => `<option value="${k}" ${user.role === k ? "selected" : ""}>${r.name}</option>`).join("");
  const branchOpts = `<option value="">— ทุกสาขา —</option>` + AppData.branches.map(b => `<option value="${b.id}" ${user.branchId === b.id ? "selected" : ""}>${b.name}</option>`).join("");

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">${userId ? "✏️ แก้ไขผู้ใช้" : "👤 เพิ่มผู้ใช้ใหม่"}</div>
      <div class="form-group"><label class="form-label">ชื่อ-สกุล</label><input class="form-input" id="u-name" value="${user.name}"></div>
      <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="u-username" value="${user.username}"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="u-password" value="${user.password}"></div>
      <div class="form-group"><label class="form-label">บทบาท</label><select class="form-input" id="u-role">${roleOpts}</select></div>
      <div class="form-group"><label class="form-label">สาขา</label><select class="form-input" id="u-branch">${branchOpts}</select></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="u-email" value="${user.email}"></div>
      <div class="form-group"><label class="form-label">โทรศัพท์</label><input class="form-input" id="u-phone" value="${user.phone}"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="u-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="u-save" style="flex:2">💾 บันทึก</button>
      </div>
    </div>`;

  modal.querySelector("#u-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#u-save").addEventListener("click", () => {
    const data = {
      name: modal.querySelector("#u-name").value.trim(),
      username: modal.querySelector("#u-username").value.trim(),
      password: modal.querySelector("#u-password").value,
      role: modal.querySelector("#u-role").value,
      branchId: modal.querySelector("#u-branch").value ? parseInt(modal.querySelector("#u-branch").value) : null,
      email: modal.querySelector("#u-email").value.trim(),
      phone: modal.querySelector("#u-phone").value.trim(),
    };
    if (!data.name || !data.username) { showToast("⚠️ กรุณากรอกชื่อและ username", "error"); return; }
    if (userId) {
      // Hash password if changed (not yet hashed)
      if (data.password && !data.password.startsWith("fh$")) data.password = hashPassword(data.password);
      Object.assign(user, data);
      logAction("user.updated", { id: userId, name: data.name, role: data.role });
      showToast("✅ แก้ไขผู้ใช้สำเร็จ", "success");
    } else {
      if (AppData.users.find(u => u.username === data.username)) {
        showToast("❌ Username นี้มีอยู่แล้ว", "error"); return;
      }
      data.password = hashPassword(data.password);
      const newId = Math.max(...AppData.users.map(u => u.id)) + 1;
      AppData.users.push({ id: newId, ...data, active: true });
      logAction("user.created", { id: newId, name: data.name, role: data.role, username: data.username });
      showToast("✅ เพิ่มผู้ใช้สำเร็จ", "success");
    }
    modal.remove();
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function openCategoryModal(catId = null) {
  const cat = catId ? AppData.categories.find(c => c.id === catId) : { id: "", name: "", icon: "📦", color: "#6366f1" };
  const icons = ["🛋️","🛏️","🪵","🪑","🗄️","💡","🖼️","📦","🎨","🪞","🧺","🪴","🛁","🚪","🪟","🎭"];
  const colors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];
  let selIcon = cat.icon, selColor = cat.color;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build() {
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">${catId ? "✏️ แก้ไขหมวดหมู่" : "📂 เพิ่มหมวดหมู่ใหม่"}</div>
        <div class="form-group"><label class="form-label">ID (ภาษาอังกฤษ ห้ามมีช่องว่าง)</label><input class="form-input" id="c-id" value="${cat.id}" ${catId ? "disabled" : ""}></div>
        <div class="form-group"><label class="form-label">ชื่อหมวด</label><input class="form-input" id="c-name" value="${cat.name}"></div>
        <div class="form-group">
          <label class="form-label">Icon</label>
          <div class="icon-picker">${icons.map(i => `<div class="icon-pick ${i === selIcon ? "selected" : ""}" data-icon="${i}">${i}</div>`).join("")}</div>
        </div>
        <div class="form-group">
          <label class="form-label">สี</label>
          <div class="color-picker">${colors.map(c => `<div class="color-pick ${c === selColor ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`).join("")}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="c-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="c-save" style="flex:2">💾 บันทึก</button>
        </div>
      </div>`;
    modal.querySelectorAll("[data-icon]").forEach(el => {
      el.addEventListener("click", () => { selIcon = el.dataset.icon; build(); });
    });
    modal.querySelectorAll("[data-color]").forEach(el => {
      el.addEventListener("click", () => { selColor = el.dataset.color; build(); });
    });
    modal.querySelector("#c-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#c-save").addEventListener("click", () => {
      const id = modal.querySelector("#c-id").value.trim().toLowerCase();
      const name = modal.querySelector("#c-name").value.trim();
      if (!id || !name) { showToast("⚠️ กรุณากรอกข้อมูลให้ครบ", "error"); return; }
      if (catId) {
        Object.assign(cat, { name, icon: selIcon, color: selColor });
        logAction("category.updated", { id: catId, name });
        showToast("✅ แก้ไขหมวดหมู่สำเร็จ", "success");
      } else {
        if (AppData.categories.find(c => c.id === id)) { showToast("❌ ID นี้มีอยู่แล้ว", "error"); return; }
        AppData.categories.push({ id, name, icon: selIcon, color: selColor });
        logAction("category.created", { id, name });
        showToast("✅ เพิ่มหมวดหมู่สำเร็จ", "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

function openProductModalEdit(prodId = null) {
  const product = prodId ? AppData.products.find(p => p.id === prodId)
    : { id: "", categoryId: "sofa", name: "", description: "", price: 0, sku: "", images: [""], sizes: [{code:"STD",label:"มาตรฐาน",w:0,d:0,h:0,seat_h:0,room_min:""}], colors: [{code:"DEF",name:"มาตรฐาน",hex:"#6b7280"}], materials: { fabric:{name:"",grade:"",origin:"",properties:[]}, frame:{name:"",grade:"",origin:"",properties:[]}, foam:{name:"",grade:"",origin:"",properties:[]}, legs:{name:"",grade:"",origin:"",properties:[]} }, stock: Object.fromEntries(AppData.branches.map(b => [b.id, 0])), minStock: 1 };

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const catOpts = AppData.categories.map(c => `<option value="${c.id}" ${product.categoryId === c.id ? "selected" : ""}>${c.icon} ${c.name}</option>`).join("");
  const stockInputs = AppData.branches.map(b => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>
      <label style="font-size:12px;width:130px">${b.name}</label>
      <input type="number" class="form-input" data-stock-branch="${b.id}" value="${product.stock[b.id] || 0}" style="flex:1" min="0">
    </div>`).join("");

  const previewCode = !prodId ? generateItemCode(product.categoryId || "sofa") : (product.itemCode || "—");
  modal.innerHTML = `
    <div class="modal modal-large">
      <div class="modal-title">${prodId ? "✏️ แก้ไขสินค้า" : "🛍️ เพิ่มสินค้าใหม่"} ${!prodId ? `<span style="font-size:13px;color:#6366f1;background:#ede9fe;padding:3px 10px;border-radius:6px;font-family:monospace;font-weight:800;margin-left:6px">รหัส: ${previewCode}</span>` : `<span style="font-size:13px;color:#6366f1;background:#ede9fe;padding:3px 10px;border-radius:6px;font-family:monospace;font-weight:800;margin-left:6px">${product.itemCode || ''}</span>`}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div class="form-group"><label class="form-label">SKU (description code)</label><input class="form-input" id="p-sku" value="${product.sku}" placeholder="เช่น SF-LUX-001"></div>
          <div class="form-group"><label class="form-label">ชื่อสินค้า</label><input class="form-input" id="p-name" value="${product.name}"></div>
          <div class="form-group"><label class="form-label">หมวดหมู่</label><select class="form-input" id="p-cat">${catOpts}</select></div>
          <div class="form-group"><label class="form-label">ราคา (บาท)</label><input type="number" class="form-input" id="p-price" value="${product.price}"></div>
          <div class="form-group"><label class="form-label">เกณฑ์ Stock ขั้นต่ำ</label><input type="number" class="form-input" id="p-min" value="${product.minStock}"></div>
          <div class="form-group"><label class="form-label">รายละเอียด</label><textarea class="form-input" id="p-desc" rows="3">${product.description}</textarea></div>
          <div class="form-group"><label class="form-label">URL รูปภาพ (1 บรรทัด/รูป)</label><textarea class="form-input" id="p-images" rows="3">${product.images.join("\n")}</textarea></div>
        </div>
        <div>
          <div class="form-group">
            <label class="form-label">Stock แต่ละสาขา</label>
            <div style="background:#f8fafc;border-radius:8px;padding:12px">${stockInputs}</div>
          </div>
          <div style="background:#fef9c3;border-radius:8px;padding:10px;font-size:11px;color:#854d0e">
            💡 <b>หมายเหตุ:</b> สำหรับการแก้ไขไซส์ สี และวัตถุดิบโดยละเอียด ให้ใช้ JSON editor ในเวอร์ชัน Production
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="p-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="p-save" style="flex:2">💾 บันทึก</button>
      </div>
    </div>`;

  modal.querySelector("#p-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#p-save").addEventListener("click", () => {
    const sku = modal.querySelector("#p-sku").value.trim();
    const name = modal.querySelector("#p-name").value.trim();
    if (!sku || !name) { showToast("⚠️ กรุณากรอก SKU และชื่อ", "error"); return; }

    const data = {
      sku, name,
      categoryId: modal.querySelector("#p-cat").value,
      price: parseInt(modal.querySelector("#p-price").value) || 0,
      minStock: parseInt(modal.querySelector("#p-min").value) || 1,
      description: modal.querySelector("#p-desc").value,
      images: modal.querySelector("#p-images").value.split("\n").map(s => s.trim()).filter(Boolean),
    };
    const stock = {};
    modal.querySelectorAll("[data-stock-branch]").forEach(el => {
      stock[parseInt(el.dataset.stockBranch)] = parseInt(el.value) || 0;
    });
    data.stock = stock;

    if (prodId) {
      Object.assign(product, data);
      logAction("product.updated", { id: prodId, name: data.name, sku: data.sku });
      showToast("✅ แก้ไขสินค้าสำเร็จ", "success");
    } else {
      const newId = sku;
      if (AppData.products.find(p => p.id === newId)) { showToast("❌ SKU นี้มีอยู่แล้ว", "error"); return; }
      // Auto-generate itemCode based on category
      const itemCode = generateItemCode(data.categoryId);
      AppData.products.push({ id: newId, itemCode, ...data, sizes: [{code:"STD",label:"มาตรฐาน",w:0,d:0,h:0,seat_h:0,room_min:""}], colors: [{code:"DEF",name:"มาตรฐาน",hex:"#6b7280"}], materials: { fabric:{name:"-",grade:"-",origin:"-",properties:[]}, frame:{name:"-",grade:"-",origin:"-",properties:[]}, foam:{name:"-",grade:"-",origin:"-",properties:[]}, legs:{name:"-",grade:"-",origin:"-",properties:[]} } });
      logAction("product.created", { id: newId, name: data.name, sku, itemCode });
      showToast(`✅ เพิ่มสินค้า ${itemCode} สำเร็จ`, "success");
    }
    modal.remove();
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== EVENT HANDLERS =====
function attachEvents() {
  // Branch selector
  document.getElementById("branch-selector")?.addEventListener("click", () => {
    document.getElementById("branch-dropdown")?.classList.toggle("open");
  });

  document.querySelectorAll(".branch-option").forEach(el => {
    el.addEventListener("click", () => {
      State.currentBranch = parseInt(el.dataset.bid);
      State.cart = [];
      document.getElementById("branch-dropdown")?.classList.remove("open");
      render();
    });
  });

  // Nav
  document.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      State.currentPage = el.dataset.page;
      State.selectedProduct = null;
      render();
    });
  });

  // Dashboard — no extra events needed

  // POS events
  document.querySelectorAll(".product-card-pos[data-clickable]").forEach(el => {
    el.addEventListener("click", () => {
      const p = AppData.products.find(pr => pr.id === el.dataset.pid);
      if (p) openProductModal(p);
    });
  });

  document.querySelectorAll(".qty-btn").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      const idx = parseInt(el.dataset.idx);
      if (el.dataset.action === "inc") State.cart[idx].qty++;
      else if (el.dataset.action === "dec") {
        State.cart[idx].qty--;
        if (State.cart[idx].qty <= 0) State.cart.splice(idx, 1);
      }
      renderMain();
    });
  });

  document.querySelectorAll("[data-remove]").forEach(el => {
    el.addEventListener("click", () => {
      State.cart.splice(parseInt(el.dataset.remove), 1);
      renderMain();
    });
  });

  document.querySelectorAll(".pay-method").forEach(el => {
    el.addEventListener("click", () => { State.payMethod = el.dataset.pay; renderMain(); });
  });

  // Delivery section in POS cart
  const dlZone = document.getElementById("dl-zone");
  if (dlZone) dlZone.addEventListener("change", () => { State.delivery.zoneId = dlZone.value; renderMain(); });
  const dlChannel = document.getElementById("dl-channel");
  if (dlChannel) dlChannel.addEventListener("change", () => { State.delivery.channelId = dlChannel.value; State.delivery.teamId = null; renderMain(); });
  const dlTeam = document.getElementById("dl-team");
  if (dlTeam) dlTeam.addEventListener("change", () => { State.delivery.teamId = dlTeam.value ? parseInt(dlTeam.value) : null; });
  ["dl-recipient", "dl-phone", "dl-address", "dl-time", "dl-note", "dl-custom-reason"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const key = { "dl-recipient": "recipientName", "dl-phone": "recipientPhone", "dl-address": "address", "dl-time": "timeSlot", "dl-note": "note", "dl-custom-reason": "customReason" }[id];
    el.addEventListener("input", () => { State.delivery[key] = el.value; });
    el.addEventListener("change", () => { State.delivery[key] = el.value; });
  });

  // Calendar picker for delivery date
  document.getElementById("dl-date-btn")?.addEventListener("click", () => {
    const zone = AppData.deliveryZones.find(z => z.id === State.delivery.zoneId);
    openDeliveryDatePicker({
      currentDate: State.delivery.date || new Date(Date.now() + (zone?.leadDays || 1) * 86400000).toISOString().split("T")[0],
      leadDays: zone?.leadDays || 0,
      channelId: State.delivery.channelId || "inhouse",
      onSelect: (date) => {
        State.delivery.date = date;
        renderMain();
      },
    });
  });
  // Custom fee — update total live
  const dlCustomFee = document.getElementById("dl-custom-fee");
  if (dlCustomFee) {
    dlCustomFee.addEventListener("input", () => {
      State.delivery.customFee = parseInt(dlCustomFee.value) || 0;
      // Live update checkout button without losing focus
      const subtotal = State.cart.reduce((s, i) => s + i.product.price * i.qty, 0);
      const cust = State.selectedCustomer ? AppData.customers.find(c => c.id === State.selectedCustomer) : null;
      const maxPct = getMaxDiscountPercent();
      let dAmt = 0;
      if (State.discount.value > 0 && maxPct > 0) {
        dAmt = State.discount.type === "percent"
          ? Math.round(subtotal * Math.min(State.discount.value, maxPct) / 100)
          : Math.min(State.discount.value, Math.round(subtotal * maxPct / 100));
      }
      let tDiscPct = 0;
      if (cust) {
        const tk = getTierKey(cust.totalSpent);
        if (tk === "gold") tDiscPct = 5;
        else if (tk === "platinum") tDiscPct = 10;
      }
      const tDiscAmt = Math.round(subtotal * tDiscPct / 100);
      const redeem = cust ? Math.min(State.redeemPoints || 0, cust.points) : 0;
      const after = Math.max(0, subtotal - dAmt - tDiscAmt - redeem);
      const total = after + Math.round(after * 0.07) + State.delivery.customFee;
      const btn = document.getElementById("btn-checkout");
      if (btn) btn.textContent = `💳 ชำระเงิน ฿${formatCurrency(total)}`;
    });
    dlCustomFee.addEventListener("blur", () => renderMain());
  }

  // Delivery page filters & actions
  const delSearch = document.getElementById("delivery-search");
  if (delSearch) delSearch.addEventListener("input", e => { State.deliverySearch = e.target.value; renderMain(); delSearch.focus(); });
  const delBranch = document.getElementById("delivery-branch");
  if (delBranch) delBranch.addEventListener("change", () => { State.deliveryBranchFilter = delBranch.value; renderMain(); });
  document.querySelectorAll("[data-dstatus]").forEach(el => {
    el.addEventListener("click", () => { State.deliveryStatusFilter = el.dataset.dstatus; renderMain(); });
  });
  document.querySelectorAll("[data-view-delivery]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); openDeliveryDetail(parseFloat(el.dataset.viewDelivery)); });
  });
  document.querySelectorAll("[data-update-delivery]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); openDeliveryUpdateModal(parseFloat(el.dataset.updateDelivery)); });
  });

  // Delivery view switcher (list / month / week / day)
  document.querySelectorAll("[data-dview]").forEach(el => {
    el.addEventListener("click", () => {
      State.deliveryView = el.dataset.dview;
      // Reset anchor to today when switching views
      State.deliveryAnchorDate = new Date().toISOString().split("T")[0];
      renderMain();
    });
  });

  // Calendar navigation (prev/next/today)
  document.querySelectorAll("[data-cal-nav]").forEach(el => {
    el.addEventListener("click", () => {
      const action = el.dataset.calNav;
      const anchor = new Date(State.deliveryAnchorDate || new Date().toISOString().split("T")[0]);
      if (action === "today") {
        State.deliveryAnchorDate = new Date().toISOString().split("T")[0];
      } else if (action === "prev") {
        anchor.setMonth(anchor.getMonth() - 1);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      } else if (action === "next") {
        anchor.setMonth(anchor.getMonth() + 1);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      } else if (action === "prev-week") {
        anchor.setDate(anchor.getDate() - 7);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      } else if (action === "next-week") {
        anchor.setDate(anchor.getDate() + 7);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      } else if (action === "prev-day") {
        anchor.setDate(anchor.getDate() - 1);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      } else if (action === "next-day") {
        anchor.setDate(anchor.getDate() + 1);
        State.deliveryAnchorDate = anchor.toISOString().split("T")[0];
      }
      renderMain();
    });
  });

  // Click month cell → drill down to day view
  document.querySelectorAll("[data-cal-date]").forEach(el => {
    el.addEventListener("click", () => {
      State.deliveryAnchorDate = el.dataset.calDate;
      State.deliveryView = "day";
      renderMain();
    });
  });

  // Customer panel in POS
  document.getElementById("btn-attach-customer")?.addEventListener("click", () => openCustomerPicker());
  document.getElementById("btn-remove-customer")?.addEventListener("click", () => {
    State.selectedCustomer = null;
    State.redeemPoints = 0;
    renderMain();
  });
  const redeemInput = document.getElementById("redeem-points");
  if (redeemInput) {
    redeemInput.addEventListener("input", () => {
      let v = parseInt(redeemInput.value) || 0;
      v = Math.floor(v / 100) * 100; // multiples of 100
      State.redeemPoints = Math.max(0, v);
    });
    redeemInput.addEventListener("blur", () => renderMain());
  }

  // Customers page
  document.querySelectorAll("[data-tier]").forEach(el => {
    el.addEventListener("click", () => { State.customerTierFilter = el.dataset.tier; renderMain(); });
  });
  const custSearch = document.getElementById("customer-search");
  if (custSearch) custSearch.addEventListener("input", e => { State.customerSearch = e.target.value; renderMain(); custSearch.focus(); });
  document.querySelectorAll("[data-view-customer]").forEach(el => {
    el.addEventListener("click", () => {
      State.selectedCustomerView = AppData.customers.find(c => c.id === parseInt(el.dataset.viewCustomer));
      renderMain();
    });
  });
  document.getElementById("back-to-customers")?.addEventListener("click", () => { State.selectedCustomerView = null; renderMain(); });
  document.getElementById("btn-add-customer")?.addEventListener("click", () => openCustomerModal());
  document.getElementById("btn-edit-customer")?.addEventListener("click", e => openCustomerModal(parseInt(e.currentTarget.dataset.cid)));

  // Receipts page
  const recSearch = document.getElementById("receipt-search");
  if (recSearch) recSearch.addEventListener("input", e => { State.receiptSearch = e.target.value; renderMain(); recSearch.focus(); });
  const recDate = document.getElementById("receipt-date");
  if (recDate) recDate.addEventListener("change", () => { State.receiptDate = recDate.value; renderMain(); });
  const recBranch = document.getElementById("receipt-branch");
  if (recBranch) recBranch.addEventListener("change", () => { State.receiptBranchFilter = recBranch.value; renderMain(); });
  document.querySelectorAll("[data-view-receipt]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); openReceiptDetail(parseFloat(el.dataset.viewReceipt)); });
  });
  document.querySelectorAll("[data-refund-receipt]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); openRefundModal(parseFloat(el.dataset.refundReceipt)); });
  });

  // Discount fields
  const discType = document.getElementById("disc-type");
  const discValue = document.getElementById("disc-value");
  const discReason = document.getElementById("disc-reason");
  if (discType) discType.addEventListener("change", () => { State.discount.type = discType.value; State.discount.value = 0; renderMain(); });
  if (discValue) discValue.addEventListener("input", () => {
    const v = parseFloat(discValue.value) || 0;
    State.discount.value = v;
    // Update only the summary rows without full re-render to keep focus
    const subtotal = State.cart.reduce((s, i) => s + i.product.price * i.qty, 0);
    const maxPct = getMaxDiscountPercent();
    let amt = State.discount.type === "percent" ? Math.round(subtotal * Math.min(v, maxPct) / 100) : Math.min(v, Math.round(subtotal * maxPct / 100));
    const after = subtotal - amt;
    const vat = Math.round(after * 0.07);
    const total = after + vat;
    const btn = document.getElementById("btn-checkout");
    if (btn) btn.textContent = `💳 ชำระเงิน ฿${formatCurrency(total)}`;
  });
  if (discValue) discValue.addEventListener("blur", () => renderMain());
  if (discReason) discReason.addEventListener("input", () => { State.discount.reason = discReason.value; });

  document.getElementById("btn-checkout")?.addEventListener("click", () => {
    if (!State.cart.length || !State.payMethod) return;
    processCheckout();
  });

  // Save Quote button
  document.getElementById("btn-save-quote")?.addEventListener("click", () => {
    if (!State.cart.length) return;
    openSaveQuoteModal();
  });

  // Deposit toggle + value
  document.getElementById("dep-toggle")?.addEventListener("change", e => {
    State.deposit.enabled = e.target.checked;
    if (e.target.checked && !State.deposit.value) State.deposit.value = AppData.appSettings.defaultDepositPercent || 30;
    renderMain();
  });
  document.getElementById("dep-type")?.addEventListener("change", e => {
    State.deposit.type = e.target.value;
    State.deposit.value = e.target.value === "percent" ? 30 : 10000;
    renderMain();
  });
  const depValueEl = document.getElementById("dep-value");
  if (depValueEl) {
    depValueEl.addEventListener("input", () => {
      State.deposit.value = parseFloat(depValueEl.value) || 0;
      // Live update without full re-render
      const btn = document.getElementById("btn-checkout");
      if (btn) {
        const subtotal = State.cart.reduce((s, i) => s + (i.unitPrice || i.product.price) * i.qty, 0);
        const cust = State.selectedCustomer ? AppData.customers.find(c => c.id === State.selectedCustomer) : null;
        const maxPct = getMaxDiscountPercent();
        let dAmt = 0;
        if (State.discount.value > 0 && maxPct > 0) {
          dAmt = State.discount.type === "percent" ? Math.round(subtotal * Math.min(State.discount.value, maxPct) / 100) : Math.min(State.discount.value, Math.round(subtotal * maxPct / 100));
        }
        let tDiscPct = 0;
        if (cust) { const tk = getTierKey(cust.totalSpent); if (tk === "gold") tDiscPct = 5; else if (tk === "platinum") tDiscPct = 10; }
        const tDiscAmt = Math.round(subtotal * tDiscPct / 100);
        const redeem = cust ? Math.min(State.redeemPoints || 0, cust.points) : 0;
        const after = Math.max(0, subtotal - dAmt - tDiscAmt - redeem);
        const zone = AppData.deliveryZones.find(z => z.id === State.delivery.zoneId);
        let dFee = zone?.id === "custom" ? (parseInt(State.delivery.customFee) || 0) : (zone?.fee || 0);
        if (cust && getTierKey(cust.totalSpent) === "platinum" && zone?.id !== "pickup" && zone?.id !== "custom") dFee = 0;
        const total = after + Math.round(after * 0.07) + dFee;
        const dep = State.deposit.type === "percent" ? Math.round(total * Math.min(State.deposit.value, 100) / 100) : Math.min(State.deposit.value, total);
        btn.textContent = `${State.deposit.enabled ? "💵 รับมัดจำ" : "💳 ชำระเงิน"} ฿${formatCurrency(State.deposit.enabled ? dep : total)}`;
      }
    });
    depValueEl.addEventListener("blur", () => renderMain());
  }

  document.getElementById("clear-cart")?.addEventListener("click", () => {
    State.cart = [];
    State.payMethod = null;
    renderMain();
  });

  // Stock events
  document.querySelectorAll("[data-branch]").forEach(el => {
    el.addEventListener("click", () => { State.stockViewBranch = parseInt(el.dataset.branch); renderMain(); });
  });
  // Only stock-page category buttons (within stock-filters wrapper)
  document.querySelectorAll(".stock-filters [data-cat]").forEach(el => {
    el.addEventListener("click", () => { State.stockCategoryFilter = el.dataset.cat; renderMain(); });
  });
  // POS category buttons (only inside .pos-left)
  document.querySelectorAll(".pos-left [data-cat]").forEach(el => {
    el.addEventListener("click", () => { State.posCategory = el.dataset.cat; renderMain(); });
  });
  document.querySelectorAll(".btn-transfer").forEach(el => {
    el.addEventListener("click", () => openTransferModal(el.dataset.pid));
  });
  document.getElementById("btn-add-stock")?.addEventListener("click", () => showToast("✅ เพิ่ม Stock สำเร็จ (ฟีเจอร์นี้ต้องการ Backend)", "success"));
  document.getElementById("btn-export-stock")?.addEventListener("click", () => exportStockCSV());
  const stockSearchEl = document.getElementById("stock-search");
  if (stockSearchEl) {
    stockSearchEl.addEventListener("input", e => { State.stockSearch = e.target.value; renderMain(); stockSearchEl.focus(); });
  }

  // Products events
  document.querySelectorAll("[data-pcat]").forEach(el => {
    el.addEventListener("click", () => { State.productCategoryFilter = el.dataset.pcat; renderMain(); });
  });
  document.querySelectorAll("[data-view-product]").forEach(el => {
    el.addEventListener("click", () => {
      const p = AppData.products.find(pr => pr.id === el.dataset.viewProduct);
      if (p) { State.selectedProduct = p; State.selectedSize = p.sizes[0]; State.selectedColor = p.colors[0]; State.selectedImageIdx = 0; State.productTab = "detail"; renderMain(); }
    });
  });
  document.getElementById("back-to-products")?.addEventListener("click", () => { State.selectedProduct = null; renderMain(); });
  document.getElementById("product-search")?.addEventListener("input", e => { State.productSearch = e.target.value; renderMain(); });

  // Product detail tabs
  document.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", () => { State.productTab = el.dataset.tab; renderMain(); });
  });
  // Gallery thumbnails
  document.querySelectorAll("[data-imgidx]").forEach(el => {
    el.addEventListener("click", () => {
      State.selectedImageIdx = parseInt(el.dataset.imgidx);
      const mainImg = document.getElementById("gallery-main-img");
      if (mainImg) mainImg.src = State.selectedProduct.images[State.selectedImageIdx];
      document.querySelectorAll(".gallery-thumb").forEach((t, i) => t.classList.toggle("active", i === State.selectedImageIdx));
    });
  });
  // Size options
  document.querySelectorAll("[data-size]").forEach(el => {
    el.addEventListener("click", () => {
      State.selectedSize = State.selectedProduct?.sizes.find(s => s.code === el.dataset.size);
      renderMain();
    });
  });
  // Material type options
  document.querySelectorAll("[data-material]").forEach(el => {
    el.addEventListener("click", () => {
      State.selectedMaterialType = el.dataset.material;
      State.selectedColor = null; // reset color, will pick first of new material
      renderMain();
    });
  });
  // Color options
  document.querySelectorAll("[data-color]").forEach(el => {
    el.addEventListener("click", () => {
      const p = State.selectedProduct;
      if (p && Array.isArray(p.materialTypes) && p.materialTypes.length) {
        const list = getSofaColors(State.selectedMaterialType || p.materialTypes[0]);
        State.selectedColor = list.find(c => c.code === el.dataset.color);
      } else {
        State.selectedColor = p?.colors.find(c => c.code === el.dataset.color);
      }
      renderMain();
    });
  });
  // Add color button (in product detail)
  document.getElementById("btn-add-color-detail")?.addEventListener("click", e => {
    openAddColorModal(e.currentTarget.dataset.mat);
  });
  // L-shape orientation in detail page
  document.querySelectorAll("[data-detail-orient]").forEach(el => {
    el.addEventListener("click", () => { State.selectedOrientation = el.dataset.detailOrient; renderMain(); });
  });
  // Add to POS from product page
  document.getElementById("add-to-pos")?.addEventListener("click", () => {
    const p = State.selectedProduct;
    if (p) {
      const matType = (Array.isArray(p.materialTypes) && p.materialTypes.length)
        ? (State.selectedMaterialType || p.materialTypes[0]) : null;
      const orient = sizeNeedsOrientation(State.selectedSize) ? (State.selectedOrientation || "left") : null;
      addToCart(p, State.selectedSize, State.selectedColor, matType, orient);
      showToast(`✅ เพิ่ม "${p.name}" ในบิลแล้ว`);
      State.currentPage = "pos";
      State.selectedProduct = null;
      render();
    }
  });

  // Report events
  document.querySelectorAll("[data-rtab]").forEach(el => {
    el.addEventListener("click", () => { State.reportTab = el.dataset.rtab; renderMain(); });
  });
  // Old day-toggle handler removed (uses AppData.dailyReport.days now via .day-toggle[data-day] above)
  // === Daily Report events ===
  document.getElementById("dr-enabled")?.addEventListener("change", (e) => {
    AppData.dailyReport.enabled = e.target.checked;
    logAction("daily_report.toggled", { enabled: e.target.checked });
    showToast(e.target.checked ? "✅ Scheduler เปิดใช้งาน" : "⚠️ Scheduler ปิด", "success");
    renderMain();
  });

  document.getElementById("btn-save-schedule")?.addEventListener("click", () => {
    const time = document.getElementById("report-time")?.value;
    if (time) AppData.dailyReport.time = time;
    logAction("daily_report.config_saved", { time: AppData.dailyReport.time, days: AppData.dailyReport.days, channels: AppData.dailyReport.channels });
    showToast(`✅ บันทึกแล้ว · ส่งทุกวันเลือกที่เวลา ${AppData.dailyReport.time} น.`, "success");
    renderMain();
  });

  document.getElementById("btn-send-now")?.addEventListener("click", () => {
    const entry = sendDailyReport(true);
    showToast(`📤 ส่งรายงานสำเร็จ ฿${formatCurrency(entry.revenue)} · ${entry.recipients} ผู้รับ`, "success");
    setTimeout(() => openSentReportModal(entry.id), 500);
  });

  document.getElementById("btn-preview-now")?.addEventListener("click", () => {
    const entry = {
      id: "preview", date: new Date().toISOString(), isManual: true,
      revenue: 0, bills: 0, recipients: 0, channels: ["email", "line"], success: true,
      emailHTML: buildEmailHTML(generateDailyReportContent()),
      lineMsg: buildLineMessage(generateDailyReportContent()),
      recipientsList: AppData.dailyReport.emailRecipients.map(r => ({ type: "email", to: r.email, name: r.name })),
    };
    AppData.dailyReportHistory.unshift(entry);
    openSentReportModal(entry.id);
  });

  document.getElementById("btn-add-email")?.addEventListener("click", () => {
    const name = document.getElementById("new-email-name")?.value.trim();
    const email = document.getElementById("new-email-addr")?.value.trim();
    if (!name || !email) { showToast("⚠️ กรุณากรอกชื่อและ Email", "error"); return; }
    AppData.dailyReport.emailRecipients.push({ id: Date.now(), name, email, enabled: true });
    showToast(`✅ เพิ่ม "${name}" สำเร็จ`, "success");
    renderMain();
  });

  document.getElementById("btn-add-line")?.addEventListener("click", () => {
    const name = document.getElementById("new-line-name")?.value.trim();
    const token = document.getElementById("new-line-token")?.value.trim();
    if (!name || !token) { showToast("⚠️ กรุณากรอกชื่อและ Token", "error"); return; }
    AppData.dailyReport.lineGroups.push({ id: Date.now(), name, token, enabled: true });
    showToast(`✅ เพิ่ม LINE group "${name}"`, "success");
    renderMain();
  });

  document.querySelectorAll("[data-toggle-email]").forEach(el => {
    el.addEventListener("change", () => {
      const id = parseInt(el.dataset.toggleEmail);
      const r = AppData.dailyReport.emailRecipients.find(x => x.id === id);
      if (r) r.enabled = el.checked;
    });
  });
  document.querySelectorAll("[data-toggle-line]").forEach(el => {
    el.addEventListener("change", () => {
      const id = parseInt(el.dataset.toggleLine);
      const g = AppData.dailyReport.lineGroups.find(x => x.id === id);
      if (g) g.enabled = el.checked;
    });
  });
  document.querySelectorAll(".email-chip-remove").forEach(el => {
    el.addEventListener("click", () => {
      if (el.dataset.rid) {
        const id = parseInt(el.dataset.rid);
        const idx = AppData.dailyReport.emailRecipients.findIndex(x => x.id === id);
        if (idx >= 0) AppData.dailyReport.emailRecipients.splice(idx, 1);
      } else if (el.dataset.lineRm) {
        const id = parseInt(el.dataset.lineRm);
        const idx = AppData.dailyReport.lineGroups.findIndex(x => x.id === id);
        if (idx >= 0) AppData.dailyReport.lineGroups.splice(idx, 1);
      }
      renderMain();
    });
  });

  // View sent report
  document.querySelectorAll("[data-view-report]").forEach(el => {
    el.addEventListener("click", () => openSentReportModal(parseFloat(el.dataset.viewReport)));
  });
  document.getElementById("btn-clear-rh")?.addEventListener("click", () => {
    if (!confirm("ลบประวัติการส่งรายงานทั้งหมด?")) return;
    AppData.dailyReportHistory = [];
    renderMain();
  });

  // Day toggle (also bind here in case settings tab is open)
  document.querySelectorAll(".day-toggle[data-day]").forEach(el => {
    el.addEventListener("click", () => {
      const d = parseInt(el.dataset.day);
      const idx = AppData.dailyReport.days.indexOf(d);
      if (idx >= 0) AppData.dailyReport.days.splice(idx, 1);
      else AppData.dailyReport.days.push(d);
      el.classList.toggle("active");
    });
  });

  // === SETTINGS events ===
  document.querySelectorAll("[data-stab]").forEach(el => {
    el.addEventListener("click", () => { State.settingsTab = el.dataset.stab; renderMain(); });
  });

  // Branch CRUD
  document.getElementById("btn-add-branch")?.addEventListener("click", () => openBranchModal());
  document.querySelectorAll("[data-edit-branch]").forEach(el => {
    el.addEventListener("click", () => openBranchModal(parseInt(el.dataset.editBranch)));
  });
  document.querySelectorAll("[data-del-branch]").forEach(el => {
    el.addEventListener("click", () => {
      const bid = parseInt(el.dataset.delBranch);
      const branch = AppData.branches.find(b => b.id === bid);
      if (!confirm(`แน่ใจที่จะลบสาขา "${branch.name}"?\n\n⚠️ ข้อมูล stock และยอดขายของสาขานี้จะถูกลบทั้งหมด`)) return;
      const idx = AppData.branches.findIndex(b => b.id === bid);
      if (idx >= 0) {
        AppData.branches.splice(idx, 1);
        delete AppData.todaySales[bid];
        delete AppData.salesHistory[bid];
        AppData.products.forEach(p => { delete p.stock[bid]; });
        AppData.users.forEach(u => { if (u.branchId === bid) u.branchId = null; });
        if (State.currentBranch === bid) State.currentBranch = AppData.branches[0]?.id;
        logAction("branch.deleted", { id: bid, name: branch.name, code: branch.code });
        showToast("🗑️ ลบสาขาสำเร็จ", "success");
        render();
      }
    });
  });

  // User CRUD
  document.getElementById("btn-add-user")?.addEventListener("click", () => openUserModal());
  document.querySelectorAll("[data-edit-user]").forEach(el => {
    el.addEventListener("click", () => openUserModal(parseInt(el.dataset.editUser)));
  });
  document.querySelectorAll("[data-toggle-user]").forEach(el => {
    el.addEventListener("click", () => {
      const uid = parseInt(el.dataset.toggleUser);
      const user = AppData.users.find(u => u.id === uid);
      if (user.id === State.currentUser.id) { showToast("❌ ไม่สามารถปิดบัญชีตัวเองได้", "error"); return; }
      user.active = !user.active;
      logAction("user.toggled", { id: user.id, name: user.name, active: user.active });
      showToast(user.active ? `✓ เปิดใช้ ${user.name}` : `🚫 ปิดใช้ ${user.name}`, "success");
      renderMain();
    });
  });

  // Category CRUD
  document.getElementById("btn-add-cat")?.addEventListener("click", () => openCategoryModal());
  document.querySelectorAll("[data-edit-cat]").forEach(el => {
    el.addEventListener("click", () => openCategoryModal(el.dataset.editCat));
  });
  document.querySelectorAll("[data-del-cat]").forEach(el => {
    el.addEventListener("click", () => {
      const cid = el.dataset.delCat;
      if (AppData.products.some(p => p.categoryId === cid)) { showToast("❌ ลบไม่ได้ ยังมีสินค้าใช้หมวดนี้อยู่", "error"); return; }
      if (!confirm("ยืนยันการลบหมวดหมู่นี้?")) return;
      const idx = AppData.categories.findIndex(c => c.id === cid);
      if (idx >= 0) {
        const removed = AppData.categories[idx];
        AppData.categories.splice(idx, 1);
        logAction("category.deleted", { id: cid, name: removed.name });
        showToast("🗑️ ลบหมวดหมู่สำเร็จ", "success");
        renderMain();
      }
    });
  });

  // === Quotation events ===
  document.querySelectorAll("[data-qfilter]").forEach(el => {
    el.addEventListener("click", () => { State.quoteFilter = el.dataset.qfilter; renderMain(); });
  });
  const qSearch = document.getElementById("quote-search");
  if (qSearch) qSearch.addEventListener("input", e => { State.quoteSearch = e.target.value; renderMain(); qSearch.focus(); });
  document.querySelectorAll("[data-view-quote]").forEach(el => {
    el.addEventListener("click", () => openQuoteDetail(parseFloat(el.dataset.viewQuote)));
  });
  document.querySelectorAll("[data-convert-quote]").forEach(el => {
    el.addEventListener("click", () => convertQuoteToSale(parseFloat(el.dataset.convertQuote)));
  });

  // === Outstanding events ===
  const oSearch = document.getElementById("outstanding-search");
  if (oSearch) oSearch.addEventListener("input", e => { State.outstandingSearch = e.target.value; renderMain(); oSearch.focus(); });
  document.querySelectorAll("[data-settle]").forEach(el => {
    el.addEventListener("click", () => openSettleBalanceModal(parseFloat(el.dataset.settle)));
  });

  // === Z-Report events ===
  const zrBranch = document.getElementById("zr-branch");
  if (zrBranch) zrBranch.addEventListener("change", () => { State.zreportBranch = zrBranch.value; renderMain(); });

  const zrClosing = document.getElementById("zr-closing");
  const zrOpening = document.getElementById("zr-opening");
  function updateVariance() {
    const opening = parseFloat(zrOpening?.value) || 0;
    const closing = parseFloat(zrClosing?.value) || 0;
    const today = new Date().toISOString().split("T")[0];
    const cashSystem = AppData.receipts.filter(r => r.date.startsWith(today) && r.status === "active" && r.payment === "cash" && (State.zreportBranch === "all" || r.branchId === parseInt(State.zreportBranch || State.currentBranch))).reduce((s, r) => s + r.depositPaid, 0);
    const expected = opening + cashSystem;
    const variance = closing - expected;
    const el = document.getElementById("zr-variance");
    if (el) el.innerHTML = variance === 0 ? `<span style="color:#16a34a">✅ ส่วนต่าง: ฿0 (ตรงกัน)</span>` : `<span style="color:${variance < 0 ? '#dc2626' : '#16a34a'}">${variance >= 0 ? '+' : ''}฿${formatCurrency(variance)}</span>`;
  }
  if (zrClosing) zrClosing.addEventListener("input", updateVariance);
  if (zrOpening) zrOpening.addEventListener("input", updateVariance);

  document.getElementById("btn-close-day")?.addEventListener("click", () => {
    if (!confirm("🔒 ยืนยันปิดบัญชีประจำวัน?\n\n• Z-Report จะถูกบันทึก\n• ยอดวันนี้จะ reset เป็น 0\n• ใบเสร็จยังคงอยู่ในประวัติ")) return;
    const opening = parseFloat(zrOpening?.value) || 0;
    const closing = parseFloat(zrClosing?.value) || 0;
    const today = new Date().toISOString().split("T")[0];
    const branchId = State.zreportBranch === "all" || !State.zreportBranch ? State.currentBranch : parseInt(State.zreportBranch);
    const todayReceipts = AppData.receipts.filter(r => r.date.startsWith(today) && r.status === "active" && r.branchId === branchId);
    const totalRevenue = todayReceipts.reduce((s, r) => s + r.depositPaid, 0);
    const cashSystem = todayReceipts.filter(r => r.payment === "cash").reduce((s, r) => s + r.depositPaid, 0);
    AppData.zReports.unshift({
      id: Date.now(),
      date: new Date().toISOString(),
      branchId,
      closedBy: State.currentUser.name,
      totalRevenue,
      receiptCount: todayReceipts.length,
      cashSystem,
      cashOpening: opening,
      cashCounted: closing,
      cashExpected: opening + cashSystem,
      cashVariance: closing - (opening + cashSystem),
    });
    AppData.todaySales[branchId] = { amount: 0, count: 0, customers: 0 };
    logAction("zreport.closed", { branchId, totalRevenue, variance: closing - (opening + cashSystem) });
    showToast(`🔒 ปิดบัญชีสำเร็จ · ยอดขาย ฿${formatCurrency(totalRevenue)}`, "success");
    renderMain();
  });

  // === Channel CRUD ===
  document.getElementById("btn-add-channel")?.addEventListener("click", () => openChannelModal());
  document.querySelectorAll("[data-edit-channel]").forEach(el => {
    el.addEventListener("click", () => openChannelModal(el.dataset.editChannel));
  });
  document.querySelectorAll("[data-del-channel]").forEach(el => {
    el.addEventListener("click", () => {
      const cid = el.dataset.delChannel;
      const c = AppData.deliveryChannels.find(x => x.id === cid);
      if (!c) return;
      const inUse = AppData.receipts.some(r => r.delivery?.channelId === cid && !["delivered","cancelled","refunded"].includes(r.delivery.status));
      if (inUse) { showToast("❌ ลบไม่ได้ มีการจัดส่งที่ยัง active อยู่", "error"); return; }
      if (!confirm(`ลบช่องทาง "${c.name}"?`)) return;
      AppData.deliveryChannels = AppData.deliveryChannels.filter(x => x.id !== cid);
      logAction("channel.deleted", { id: cid, name: c.name });
      showToast("🗑️ ลบสำเร็จ", "success");
      renderMain();
    });
  });

  // === Team CRUD ===
  document.getElementById("btn-add-team")?.addEventListener("click", () => openTeamModal());
  document.querySelectorAll("[data-edit-team]").forEach(el => {
    el.addEventListener("click", () => openTeamModal(parseInt(el.dataset.editTeam)));
  });
  document.querySelectorAll("[data-del-team]").forEach(el => {
    el.addEventListener("click", () => {
      const tid = parseInt(el.dataset.delTeam);
      const team = AppData.deliveryTeams.find(t => t.id === tid);
      if (!team) return;
      const inUse = AppData.receipts.some(r => r.delivery?.teamId === tid && !["delivered","cancelled","refunded"].includes(r.delivery.status));
      if (inUse) { showToast("❌ ทีมนี้มีงานค้าง — ลบไม่ได้", "error"); return; }
      if (!confirm(`ลบทีม "${team.name}"?`)) return;
      AppData.deliveryTeams = AppData.deliveryTeams.filter(t => t.id !== tid);
      logAction("team.deleted", { id: tid, name: team.name });
      showToast("🗑️ ลบทีมสำเร็จ", "success");
      renderMain();
    });
  });

  document.getElementById("btn-add-driver")?.addEventListener("click", () => {
    const name = prompt("ชื่อคนขับ:");
    if (!name) return;
    const phone = prompt("เบอร์โทร:") || "";
    const vehicle = prompt("ยานพาหนะ:") || "";
    const newId = Math.max(...AppData.drivers.map(d => d.id)) + 1;
    AppData.drivers.push({ id: newId, name, phone, vehicle, license: "", available: true });
    logAction("driver.created", { id: newId, name });
    showToast(`✅ เพิ่ม "${name}" สำเร็จ`, "success");
    renderMain();
  });

  // Zone CRUD
  document.getElementById("btn-add-zone")?.addEventListener("click", () => openZoneModal());
  document.querySelectorAll("[data-edit-zone]").forEach(el => {
    el.addEventListener("click", () => openZoneModal(el.dataset.editZone));
  });
  document.querySelectorAll("[data-del-zone]").forEach(el => {
    el.addEventListener("click", () => {
      const zid = el.dataset.delZone;
      const zone = AppData.deliveryZones.find(z => z.id === zid);
      if (!zone) return;
      // Check if used in any active deliveries
      const inUse = AppData.receipts.some(r => r.delivery && r.delivery.zoneId === zid && !["delivered", "cancelled", "refunded"].includes(r.delivery.status) && r.status === "active");
      if (inUse) { showToast("❌ มีการจัดส่งที่ยังไม่เสร็จในเขตนี้ ลบไม่ได้", "error"); return; }
      if (!confirm(`ลบเขต "${zone.name}"?\n\n⚠️ ใบเสร็จเก่าที่ใช้เขตนี้ยังคงข้อมูลเดิมไว้ แต่จะเลือกในบิลใหม่ไม่ได้`)) return;
      const idx = AppData.deliveryZones.findIndex(z => z.id === zid);
      if (idx >= 0) {
        AppData.deliveryZones.splice(idx, 1);
        logAction("zone.deleted", { id: zid, name: zone.name });
        showToast("🗑️ ลบเขตจัดส่งสำเร็จ", "success");
        renderMain();
      }
    });
  });

  // === Import / Export events ===
  document.getElementById("exp-products")?.addEventListener("click", exportProductsXLSX);
  document.getElementById("exp-customers")?.addEventListener("click", exportCustomersXLSX);
  document.getElementById("exp-receipts")?.addEventListener("click", exportReceiptsXLSX);
  document.getElementById("exp-stock")?.addEventListener("click", exportStockXLSX);
  document.getElementById("exp-quotes")?.addEventListener("click", exportQuotesXLSX);
  document.getElementById("exp-audit")?.addEventListener("click", exportAuditXLSX);
  document.getElementById("exp-all")?.addEventListener("click", () => {
    if (confirm("Export ทั้ง 6 ไฟล์เป็น backup?")) exportAllBackup();
  });
  document.getElementById("dl-template")?.addEventListener("click", downloadTemplateXLSX);

  document.getElementById("imp-products")?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f && confirm(`Import "${f.name}" เข้าระบบ?\n\n• สินค้าที่มี SKU ตรงกัน → จะถูก update\n• สินค้าใหม่ → จะถูกเพิ่ม\n• ข้อมูล stock จะไม่ถูกแตะต้อง`)) importProductsXLSX(f);
    e.target.value = "";
  });
  document.getElementById("imp-customers")?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f && confirm(`Import "${f.name}" เข้าระบบ?`)) importCustomersXLSX(f);
    e.target.value = "";
  });
  document.getElementById("imp-stock")?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f && confirm(`Import "${f.name}"?\n\n⚠️ Stock จะถูก REPLACE ไม่ใช่ ADD — มีปัจจุบัน 5 → ในไฟล์ 10 = ผลลัพธ์ 10 ไม่ใช่ 15`)) importStockXLSX(f);
    e.target.value = "";
  });

  // Audit log filters & actions
  const auditUserSel = document.getElementById("audit-filter-user");
  const auditActionSel = document.getElementById("audit-filter-action");
  if (auditUserSel) auditUserSel.addEventListener("change", () => { State.auditFilterUser = auditUserSel.value; renderMain(); });
  if (auditActionSel) auditActionSel.addEventListener("change", () => { State.auditFilterAction = auditActionSel.value; renderMain(); });
  document.getElementById("btn-export-audit")?.addEventListener("click", () => exportAuditCSV());
  document.getElementById("btn-clear-audit")?.addEventListener("click", () => {
    if (!confirm(`ลบ Audit Log ทั้งหมด ${AppData.auditLog.length} รายการ?\n\n⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    AppData.auditLog = [];
    logAction("audit.cleared", { by: State.currentUser.name });
    showToast("🗑️ ล้าง Audit Log สำเร็จ", "success");
    renderMain();
  });

  // Product CRUD
  document.getElementById("btn-add-prod")?.addEventListener("click", () => openProductModalEdit());
  document.getElementById("btn-add-sofa")?.addEventListener("click", () => openSofaBuilderModal());
  // Add to specific category (auto-fills category in modal)
  document.querySelectorAll("[data-add-to-cat]").forEach(el => {
    el.addEventListener("click", () => {
      const catId = el.dataset.addToCat;
      if (catId === "sofa") openSofaBuilderModal();
      else openProductModalEdit(); // user can pick from dropdown
    });
  });
  document.querySelectorAll("[data-edit-prod]").forEach(el => {
    el.addEventListener("click", () => {
      const p = AppData.products.find(pr => pr.id === el.dataset.editProd);
      // Use sofa builder if it's a sofa
      if (p?.categoryId === "sofa") openSofaBuilderModal(p.id);
      else openProductModalEdit(el.dataset.editProd);
    });
  });
  document.querySelectorAll("[data-del-prod]").forEach(el => {
    el.addEventListener("click", () => {
      const pid = el.dataset.delProd;
      if (!confirm("ยืนยันการลบสินค้านี้?")) return;
      const idx = AppData.products.findIndex(p => p.id === pid);
      if (idx >= 0) {
        const removed = AppData.products[idx];
        AppData.products.splice(idx, 1);
        logAction("product.deleted", { id: pid, name: removed.name, sku: removed.sku });
        showToast("🗑️ ลบสินค้าสำเร็จ", "success");
        renderMain();
      }
    });
  });
}

// ===== PRODUCT ADD MODAL (POS) =====
function openProductModal(product) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "product-modal";

  const hasMaterials = Array.isArray(product.materialTypes) && product.materialTypes.length > 0;
  let selSize = product.sizes[0];
  let selMat = hasMaterials ? product.materialTypes[0] : null;
  let selColor = hasMaterials ? getSofaColors(selMat)[0] : product.colors[0];
  let selOrient = "left";

  function buildModal() {
    const needsOrient = sizeNeedsOrientation(selSize);
    const sizeOpts = product.sizes.map(s => `
      <div class="size-opt ${s.code === selSize?.code ? "selected" : ""}" data-msize="${s.code}">${s.label}</div>`).join("");

    const matOpts = hasMaterials ? product.materialTypes.map(mt => {
      const m = AppData.sofaMaterials[mt];
      return `<div class="size-opt ${mt === selMat ? "selected" : ""}" data-mmat="${mt}" style="text-align:center;padding:8px 4px">
        <div style="font-size:16px">${m.icon}</div>
        <div style="font-weight:700;font-size:11px;line-height:1.1">${m.name}</div>
        <div style="font-size:9px;color:${mt===selMat?'#fff':'#9ca3af'}">${m.surcharge}</div>
      </div>`;
    }).join("") : "";

    const colorList = hasMaterials ? getSofaColors(selMat) : product.colors;
    const colorOpts = colorList.map(c => `
      <div class="color-opt ${c.code === selColor?.code ? "selected" : ""}" data-mcolor="${c.code}" style="background:${c.hex}" title="${c.name}"></div>`).join("");

    const stock = product.stock[State.currentBranch] || 0;
    const mult = hasMaterials ? (AppData.sofaMaterials[selMat]?.priceMultiplier || 1) : 1;
    const effPrice = Math.round(product.price * mult);

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">${product.name}</div>
        <img src="${product.images[0]}" style="width:100%;border-radius:10px;aspect-ratio:16/9;object-fit:cover;margin-bottom:12px" onerror="this.style.display='none'">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
          <div style="font-size:22px;font-weight:800;color:#6366f1">฿${formatCurrency(effPrice)}</div>
          ${mult !== 1 ? `<div style="font-size:11px;color:#9ca3af"><s>฿${formatCurrency(product.price)}</s> · ${AppData.sofaMaterials[selMat]?.surcharge}</div>` : ''}
        </div>
        <div style="margin-bottom:10px">
          <div class="form-label">ไซส์</div>
          <div class="size-options" id="modal-sizes">${sizeOpts}</div>
          ${selSize ? `<div class="size-dim">${selSize.w}×${selSize.d}×${selSize.h} ซม. | ห้องแนะนำ: ${selSize.room_min || "—"}</div>` : ""}
        </div>
        ${needsOrient ? `
        <div style="margin-bottom:10px">
          <div class="form-label">ทิศทาง L-Shape</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div class="size-opt ${selOrient === 'left' ? 'selected' : ''}" data-orient="left" style="text-align:center;padding:10px">
              <div style="font-size:24px;line-height:1">⬛<span style="display:inline-block;transform:scaleX(-1)">L</span></div>
              <div style="font-weight:700;font-size:12px">หันซ้าย (Left)</div>
              <div style="font-size:10px;color:${selOrient==='left'?'#fff':'#9ca3af'};margin-top:2px">เก้าอี้ยาวอยู่ซ้าย</div>
            </div>
            <div class="size-opt ${selOrient === 'right' ? 'selected' : ''}" data-orient="right" style="text-align:center;padding:10px">
              <div style="font-size:24px;line-height:1">L⬛</div>
              <div style="font-weight:700;font-size:12px">หันขวา (Right)</div>
              <div style="font-size:10px;color:${selOrient==='right'?'#fff':'#9ca3af'};margin-top:2px">เก้าอี้ยาวอยู่ขวา</div>
            </div>
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px;background:#f0f9ff;padding:6px 10px;border-radius:6px;border:1px solid #bae6fd">
            💡 <b>ทิป:</b> ดูจากการที่ <b>หันหน้าเข้าโซฟา</b> แล้วเก้าอี้ยาวอยู่ฝั่งไหน
          </div>
        </div>` : ""}
        ${hasMaterials ? `
        <div style="margin-bottom:10px">
          <div class="form-label">ชนิดวัสดุ</div>
          <div class="size-options" id="modal-mats" style="display:grid;grid-template-columns:repeat(${product.materialTypes.length},1fr);gap:6px">${matOpts}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px;background:#f8fafc;padding:6px;border-radius:6px">${AppData.sofaMaterials[selMat]?.icon} ${AppData.sofaMaterials[selMat]?.desc}</div>
        </div>` : ""}
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="form-label" style="margin:0">${hasMaterials ? `สี ${AppData.sofaMaterials[selMat]?.icon} ${AppData.sofaMaterials[selMat]?.name} (${colorList.length} สี)` : "สี"}</div>
            ${hasMaterials && hasPermission("sofa.add_color") ? `<button class="btn btn-secondary" id="modal-add-color" style="font-size:10px;padding:3px 8px">+ เพิ่มสี</button>` : ""}
          </div>
          <div class="color-options" id="modal-colors">${colorOpts}</div>
          ${selColor ? `<div class="color-label">สี: ${selColor.name} <code style="font-size:10px;background:#f1f5f9;padding:1px 5px;border-radius:3px">${selColor.code}</code></div>` : ""}
        </div>
        <div style="font-size:12px;color:${stock <= product.minStock ? "#dc2626" : "#6b7280"};margin-bottom:12px">
          สต็อกสาขา${getCurrentBranch().name}: <b>${stock} ชิ้น</b>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="modal-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="modal-add" style="flex:2" ${stock === 0 ? "disabled" : ""}>
            🛒 เพิ่ม ฿${formatCurrency(effPrice)}
          </button>
        </div>
      </div>`;

    modal.querySelectorAll("[data-msize]").forEach(el => {
      el.addEventListener("click", () => { selSize = product.sizes.find(s => s.code === el.dataset.msize); buildModal(); });
    });
    modal.querySelectorAll("[data-orient]").forEach(el => {
      el.addEventListener("click", () => { selOrient = el.dataset.orient; buildModal(); });
    });
    modal.querySelectorAll("[data-mmat]").forEach(el => {
      el.addEventListener("click", () => {
        selMat = el.dataset.mmat;
        const newColors = getSofaColors(selMat);
        selColor = newColors[0];
        buildModal();
      });
    });
    modal.querySelectorAll("[data-mcolor]").forEach(el => {
      el.addEventListener("click", () => {
        const list = hasMaterials ? getSofaColors(selMat) : product.colors;
        selColor = list.find(c => c.code === el.dataset.mcolor);
        buildModal();
      });
    });
    modal.querySelector("#modal-add-color")?.addEventListener("click", () => {
      modal.remove();
      // Re-open after color added
      const orig = openAddColorModal;
      openAddColorModal(selMat);
      // After color added, the modal will re-render — just open product modal again later
    });
    modal.querySelector("#modal-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#modal-add").addEventListener("click", () => {
      addToCart(product, selSize, selColor, selMat, sizeNeedsOrientation(selSize) ? selOrient : null);
      modal.remove();
      showToast(`✅ เพิ่ม "${product.name}" ในบิลแล้ว`);
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }

  buildModal();
  document.body.appendChild(modal);
}

// ===== SOFA BUILDER MODAL =====
function openSofaBuilderModal(prodId = null) {
  const isEdit = !!prodId;
  const existing = isEdit ? AppData.products.find(p => p.id === prodId) : null;

  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: "", sku: "", categoryId: "sofa", name: "", description: "",
    price: 25000, cost: 14000, minStock: 2,
    materialTypes: ["fabric", "pu", "mixed", "genuine"],
    images: [""],
    sizes: [{ code: "2P", label: "2 ที่นั่ง", w: 160, d: 85, h: 82, seat_h: 46, room_min: "3×4m" }],
    colors: [],
    materials: {
      fabric: { name: "", grade: "", origin: "", properties: [] },
      frame: { name: "", grade: "", origin: "", properties: [] },
      foam: { name: "", grade: "", origin: "", properties: [] },
      legs: { name: "", grade: "", origin: "", properties: [] },
    },
    stock: Object.fromEntries(AppData.branches.map(b => [b.id, b.isWarehouse ? 50 : 0])),
  };

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  let activeTab = "basic";

  function build() {
    const tabBtn = (id, label) => `<div class="settings-tab ${activeTab === id ? "active" : ""}" data-sb-tab="${id}">${label}</div>`;

    let tabBody = "";
    if (activeTab === "basic") {
      tabBody = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">SKU *</label><input class="form-input" id="sb-sku" value="${draft.sku}" placeholder="เช่น SF-NEW-001" ${isEdit?'disabled':''}></div>
          <div class="form-group"><label class="form-label">ID (auto จาก SKU)</label><input class="form-input" id="sb-id" value="${draft.id}" placeholder="—" disabled style="background:#f8fafc"></div>
          <div class="form-group" style="grid-column:1/-1"><label class="form-label">ชื่อรุ่น *</label><input class="form-input" id="sb-name" value="${draft.name}" placeholder="เช่น โซฟา Velvet Modern"></div>
          <div class="form-group" style="grid-column:1/-1"><label class="form-label">รายละเอียด</label><textarea class="form-input" id="sb-desc" rows="2">${draft.description}</textarea></div>
          <div class="form-group"><label class="form-label">ราคาฐาน (ผ้า) *</label><input type="number" class="form-input" id="sb-price" value="${draft.price}" min="0"></div>
          <div class="form-group"><label class="form-label">ต้นทุน COGS *</label><input type="number" class="form-input" id="sb-cost" value="${draft.cost}" min="0"></div>
          <div class="form-group"><label class="form-label">เกณฑ์ Stock ขั้นต่ำ</label><input type="number" class="form-input" id="sb-min" value="${draft.minStock}" min="0"></div>
          <div class="form-group">
            <label class="form-label">Margin (calculated)</label>
            <div style="padding:9px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:13px;font-weight:700;color:#15803d">
              ${draft.price > 0 ? Math.round((draft.price - draft.cost) / draft.price * 100) : 0}% (กำไร ฿${(draft.price - draft.cost).toLocaleString()})
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">URL รูปภาพ (1 บรรทัด/รูป)</label>
          <textarea class="form-input" id="sb-images" rows="3" placeholder="https://...">${draft.images.join("\n")}</textarea>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">แนะนำใช้ Unsplash / Cloudinary · ขนาด 600px ขึ้นไป</div>
        </div>`;
    } else if (activeTab === "sizes") {
      const sizeRows = draft.sizes.map((s, idx) => `
        <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:8px;display:grid;grid-template-columns:80px 1fr 60px 60px 60px 60px 80px 32px;gap:6px;align-items:center">
          <input class="form-input sb-size-code" value="${s.code}" placeholder="2P" data-idx="${idx}" data-key="code" style="font-size:11px;padding:5px">
          <input class="form-input sb-size-input" value="${s.label}" placeholder="2 ที่นั่ง" data-idx="${idx}" data-key="label" style="font-size:11px;padding:5px">
          <input type="number" class="form-input sb-size-input" value="${s.w}" placeholder="W" data-idx="${idx}" data-key="w" style="font-size:11px;padding:5px">
          <input type="number" class="form-input sb-size-input" value="${s.d}" placeholder="D" data-idx="${idx}" data-key="d" style="font-size:11px;padding:5px">
          <input type="number" class="form-input sb-size-input" value="${s.h}" placeholder="H" data-idx="${idx}" data-key="h" style="font-size:11px;padding:5px">
          <input type="number" class="form-input sb-size-input" value="${s.seat_h}" placeholder="seat" data-idx="${idx}" data-key="seat_h" style="font-size:11px;padding:5px">
          <input class="form-input sb-size-input" value="${s.room_min || ''}" placeholder="3×4m" data-idx="${idx}" data-key="room_min" style="font-size:11px;padding:5px">
          <button class="btn btn-danger" data-rm-size="${idx}" style="font-size:14px;padding:4px">×</button>
        </div>`).join("");
      tabBody = `
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px">📏 หน่วยเซนติเมตร · seat_h = ความสูงที่นั่ง · room_min = ขนาดห้องแนะนำ</div>
        <div style="background:#f1f5f9;border-radius:6px;padding:6px;margin-bottom:8px;display:grid;grid-template-columns:80px 1fr 60px 60px 60px 60px 80px 32px;gap:6px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase">
          <div>Code</div><div>Label</div><div>W (cm)</div><div>D (cm)</div><div>H (cm)</div><div>Seat</div><div>Room</div><div></div>
        </div>
        ${sizeRows}
        <button class="btn btn-secondary" id="sb-add-size" style="width:100%;margin-top:6px">+ เพิ่ม Size</button>`;
    } else if (activeTab === "materials") {
      const matCheckboxes = Object.entries(AppData.sofaMaterials).map(([key, m]) => {
        const checked = draft.materialTypes.includes(key);
        return `
          <label style="display:flex;align-items:center;gap:8px;padding:10px;background:${checked?'#eef2ff':'#f8fafc'};border:2px solid ${checked?'#6366f1':'#e2e8f0'};border-radius:10px;cursor:pointer">
            <input type="checkbox" ${checked?'checked':''} data-mt="${key}" style="width:18px;height:18px;accent-color:#6366f1">
            <span style="font-size:18px">${m.icon}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">${m.name}</div>
              <div style="font-size:10px;color:#6b7280">${m.surcharge} · ${AppData.sofaColors[key].length} สีในแคตตาล็อก</div>
            </div>
          </label>`;
      }).join("");

      const matFields = ["fabric", "frame", "foam", "legs"];
      const matLabels = { fabric: "🧵 ผ้า/วัสดุพื้นผิว", frame: "🪵 โครงสร้าง", foam: "🛋️ ฟองน้ำ/เบาะ", legs: "🪑 ขา/ฐาน" };
      const matInputs = matFields.map(f => `
        <div style="background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">${matLabels[f]}</div>
          <div style="display:grid;grid-template-columns:1fr 100px 100px;gap:6px">
            <input class="form-input sb-mat" value="${draft.materials[f]?.name || ''}" placeholder="ชื่อวัสดุ" data-mat-key="${f}" data-mat-prop="name" style="font-size:12px;padding:6px">
            <input class="form-input sb-mat" value="${draft.materials[f]?.grade || ''}" placeholder="Grade" data-mat-key="${f}" data-mat-prop="grade" style="font-size:12px;padding:6px">
            <input class="form-input sb-mat" value="${draft.materials[f]?.origin || ''}" placeholder="ที่มา" data-mat-key="${f}" data-mat-prop="origin" style="font-size:12px;padding:6px">
          </div>
          <input class="form-input sb-mat-props" value="${(draft.materials[f]?.properties || []).join(', ')}" placeholder="คุณสมบัติ คั่นด้วย , (เช่น กันน้ำ, ทนทาน)" data-mat-key="${f}" style="font-size:11px;padding:5px;margin-top:6px">
        </div>`).join("");

      tabBody = `
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px">เลือกชนิดวัสดุที่รุ่นนี้รองรับ — แต่ละชนิดมีราคา multiplier ของตัวเอง</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">${matCheckboxes}</div>
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">📋 รายละเอียดวัสดุประกอบ</div>
        ${matInputs}`;
    } else if (activeTab === "stock") {
      const stockRows = AppData.branches.map(b => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:${b.isWarehouse?'#f3e8ff':'#f8fafc'};border-radius:6px;margin-bottom:4px">
          <div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>
          <span style="font-size:12px;flex:1">${b.isWarehouse?'🏭 ':''}${b.name} <code style="font-size:10px;background:#e2e8f0;padding:1px 5px;border-radius:3px;margin-left:4px">${b.code}</code></span>
          <input type="number" class="form-input sb-stock" value="${draft.stock[b.id] || 0}" data-bid="${b.id}" min="0" style="width:80px;padding:5px;font-size:12px">
        </div>`).join("");
      tabBody = `
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px">🏭 คลังกลางมีพื้นหลังม่วง · ใส่ stock เริ่มต้นแต่ละสาขา</div>
        ${stockRows}
        <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:10px;margin-top:10px;font-size:11px;color:#854d0e">
          💡 แนะนำให้เก็บใน <b>คลังกลาง</b> มากที่สุด แล้วโอนไปแต่ละสาขาเมื่อ stock ต่ำ
        </div>`;
    }

    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-title">🛋️ ${isEdit ? 'แก้ไข' : 'เพิ่ม'}รูปแบบโซฟา</div>
        <div class="settings-tabs" style="margin-bottom:14px">
          ${tabBtn("basic", "📋 ข้อมูลพื้นฐาน")}
          ${tabBtn("sizes", "📏 ไซส์ (" + draft.sizes.length + ")")}
          ${tabBtn("materials", "🧱 วัสดุ (" + draft.materialTypes.length + ")")}
          ${tabBtn("stock", "📦 Stock")}
        </div>
        <div style="max-height:55vh;overflow-y:auto;padding-right:4px">${tabBody}</div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-secondary" id="sb-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="sb-save" style="flex:2">💾 ${isEdit?'บันทึกการแก้ไข':'สร้างรุ่นใหม่'}</button>
        </div>
      </div>`;

    // Capture inputs before tab switch
    function captureBasic() {
      draft.sku = modal.querySelector("#sb-sku")?.value.trim() || draft.sku;
      draft.id = draft.id || draft.sku; // auto-id from sku
      draft.name = modal.querySelector("#sb-name")?.value.trim() || draft.name;
      draft.description = modal.querySelector("#sb-desc")?.value || draft.description;
      draft.price = parseFloat(modal.querySelector("#sb-price")?.value) || draft.price;
      draft.cost = parseFloat(modal.querySelector("#sb-cost")?.value) || draft.cost;
      draft.minStock = parseInt(modal.querySelector("#sb-min")?.value) || 1;
      const imgs = modal.querySelector("#sb-images")?.value || "";
      draft.images = imgs.split("\n").map(s => s.trim()).filter(Boolean);
    }
    function captureSizes() {
      modal.querySelectorAll(".sb-size-input, .sb-size-code").forEach(el => {
        const idx = parseInt(el.dataset.idx);
        const key = el.dataset.key;
        if (!draft.sizes[idx]) return;
        draft.sizes[idx][key] = ["w","d","h","seat_h"].includes(key) ? (parseInt(el.value) || 0) : el.value;
      });
    }
    function captureMaterials() {
      const checked = Array.from(modal.querySelectorAll("[data-mt]:checked")).map(el => el.dataset.mt);
      if (checked.length > 0) draft.materialTypes = checked;
      modal.querySelectorAll(".sb-mat").forEach(el => {
        const k = el.dataset.matKey, p = el.dataset.matProp;
        if (!draft.materials[k]) draft.materials[k] = { name: "", grade: "", origin: "", properties: [] };
        draft.materials[k][p] = el.value;
      });
      modal.querySelectorAll(".sb-mat-props").forEach(el => {
        const k = el.dataset.matKey;
        draft.materials[k].properties = el.value.split(",").map(s => s.trim()).filter(Boolean);
      });
    }
    function captureStock() {
      modal.querySelectorAll(".sb-stock").forEach(el => {
        draft.stock[parseInt(el.dataset.bid)] = parseInt(el.value) || 0;
      });
    }
    function captureCurrent() {
      if (activeTab === "basic") captureBasic();
      else if (activeTab === "sizes") captureSizes();
      else if (activeTab === "materials") captureMaterials();
      else if (activeTab === "stock") captureStock();
    }

    // Tab switch
    modal.querySelectorAll("[data-sb-tab]").forEach(el => {
      el.addEventListener("click", () => { captureCurrent(); activeTab = el.dataset.sbTab; build(); });
    });

    // Live margin update on price/cost change
    modal.querySelector("#sb-price")?.addEventListener("input", () => {
      draft.price = parseFloat(modal.querySelector("#sb-price").value) || 0;
      const marginEl = modal.querySelector(".form-group:nth-of-type(8) > div");
      if (marginEl) {
        const pct = draft.price > 0 ? Math.round((draft.price - draft.cost) / draft.price * 100) : 0;
        marginEl.textContent = `${pct}% (กำไร ฿${(draft.price - draft.cost).toLocaleString()})`;
      }
    });
    modal.querySelector("#sb-cost")?.addEventListener("input", () => {
      draft.cost = parseFloat(modal.querySelector("#sb-cost").value) || 0;
      const marginEl = modal.querySelector(".form-group:nth-of-type(8) > div");
      if (marginEl) {
        const pct = draft.price > 0 ? Math.round((draft.price - draft.cost) / draft.price * 100) : 0;
        marginEl.textContent = `${pct}% (กำไร ฿${(draft.price - draft.cost).toLocaleString()})`;
      }
    });

    // Add size row
    modal.querySelector("#sb-add-size")?.addEventListener("click", () => {
      captureSizes();
      draft.sizes.push({ code: "", label: "", w: 0, d: 0, h: 0, seat_h: 0, room_min: "" });
      build();
    });
    // Remove size
    modal.querySelectorAll("[data-rm-size]").forEach(el => {
      el.addEventListener("click", () => {
        captureSizes();
        const idx = parseInt(el.dataset.rmSize);
        draft.sizes.splice(idx, 1);
        if (!draft.sizes.length) draft.sizes.push({ code: "STD", label: "มาตรฐาน", w: 0, d: 0, h: 0, seat_h: 0, room_min: "" });
        build();
      });
    });

    // Cancel/save
    modal.querySelector("#sb-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#sb-save").addEventListener("click", () => {
      captureCurrent();

      if (!draft.sku || !draft.name) { showToast("⚠️ กรอก SKU และชื่อรุ่นก่อนบันทึก", "error"); return; }
      if (!draft.materialTypes.length) { showToast("⚠️ ต้องเลือกอย่างน้อย 1 ชนิดวัสดุ", "error"); return; }
      if (!draft.sizes.length || !draft.sizes[0].code) { showToast("⚠️ ต้องมีอย่างน้อย 1 ไซส์", "error"); return; }

      // Auto-pick default colors from first materialType
      if (!draft.colors.length) {
        const mt = draft.materialTypes[0];
        draft.colors = AppData.sofaColors[mt].slice(0, 4).map(c => ({ ...c }));
      }
      // Default image if empty
      if (!draft.images.length) draft.images = ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"];

      draft.id = draft.id || draft.sku;
      draft.categoryId = "sofa";

      if (isEdit && existing) {
        Object.assign(existing, draft);
        logAction("product.updated", { id: draft.id, name: draft.name, sku: draft.sku, type: "sofa" });
        showToast(`✅ แก้ไขรุ่น "${draft.name}" สำเร็จ`, "success");
      } else {
        if (AppData.products.find(p => p.id === draft.id || p.sku === draft.sku)) {
          showToast("❌ SKU/ID นี้มีอยู่แล้ว", "error"); return;
        }
        // Auto-generate itemCode
        draft.itemCode = generateItemCode(draft.categoryId);
        AppData.products.push(draft);
        logAction("product.created", { id: draft.id, name: draft.name, sku: draft.sku, itemCode: draft.itemCode, type: "sofa", materials: draft.materialTypes });
        showToast(`✅ สร้างรุ่น "${draft.name}" รหัส ${draft.itemCode} สำเร็จ`, "success");
      }
      modal.remove();
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

// ===== ADD SOFA COLOR MODAL =====
function openAddColorModal(materialType) {
  if (!hasPermission("sofa.add_color")) { showToast("❌ คุณไม่มีสิทธิ์เพิ่มสี", "error"); return; }
  const m = AppData.sofaMaterials[materialType];
  if (!m) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  let selectedHex = "#6366f1";

  // Preset palette for quick pick
  const presets = ["#fef3c7","#d4c5a9","#9ca3af","#1f2937","#78350f","#92400e","#b45309","#c2410c","#b91c1c","#7f1d1d","#ca8a04","#166534","#1e3a8a","#7c3aed","#db2777","#0a0a0a"];

  function build() {
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">${m.icon} เพิ่มสีใหม่ — ${m.name}</div>
        <div style="background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px;font-size:12px;color:#374151">
          เพิ่มสีในแคตตาล็อกของ <b>${m.name}</b> — สีนี้จะใช้ได้กับโซฟาทุกรุ่นที่รองรับวัสดุนี้
        </div>
        <div class="form-group"><label class="form-label">รหัสสี (auto)</label><input class="form-input" id="ac-code" value="${nextColorCode(materialType)}" disabled style="background:#f8fafc"></div>
        <div class="form-group"><label class="form-label">ชื่อสี</label><input class="form-input" id="ac-name" placeholder="เช่น แดงไวน์ Bordeaux" autofocus></div>

        <div class="form-group">
          <label class="form-label">เลือกสี</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="color" id="ac-hex-picker" value="${selectedHex}" style="width:60px;height:40px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer">
            <input type="text" class="form-input" id="ac-hex-text" value="${selectedHex}" placeholder="#RRGGBB" style="font-family:monospace">
            <div style="width:48px;height:40px;border-radius:8px;border:2px solid #e2e8f0" id="ac-preview" style="background:${selectedHex}"></div>
          </div>
          <div style="margin-top:10px">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">สีตัวอย่างยอดนิยม:</div>
            <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
              ${presets.map(c => `<div class="color-preset" data-preset="${c}" style="aspect-ratio:1;border-radius:6px;background:${c};cursor:pointer;border:2px solid transparent" title="${c}"></div>`).join("")}
            </div>
          </div>
        </div>

        <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:10px;font-size:11px;color:#854d0e">
          💡 รหัสสีและสีจะถูกบันทึกเข้าระบบทันที — ใช้กับโซฟาทุกรุ่นที่รองรับ "${m.name}"
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" id="ac-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="ac-save" style="flex:2">💾 เพิ่มสี</button>
        </div>
      </div>`;

    const picker = modal.querySelector("#ac-hex-picker");
    const text = modal.querySelector("#ac-hex-text");
    const preview = modal.querySelector("#ac-preview");

    function syncFromHex(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
      selectedHex = hex;
      picker.value = hex;
      preview.style.background = hex;
    }

    picker.addEventListener("input", () => {
      selectedHex = picker.value;
      text.value = selectedHex;
      preview.style.background = selectedHex;
    });
    text.addEventListener("input", () => syncFromHex(text.value));

    modal.querySelectorAll("[data-preset]").forEach(el => {
      el.addEventListener("click", () => {
        text.value = el.dataset.preset;
        syncFromHex(el.dataset.preset);
      });
    });

    modal.querySelector("#ac-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#ac-save").addEventListener("click", () => {
      const code = modal.querySelector("#ac-code").value;
      const name = modal.querySelector("#ac-name").value.trim();
      if (!name) { showToast("⚠️ กรุณากรอกชื่อสี", "error"); return; }
      if (!/^#[0-9a-fA-F]{6}$/.test(selectedHex)) { showToast("⚠️ Hex code ไม่ถูกต้อง", "error"); return; }

      AppData.sofaColors[materialType].push({ code, name, hex: selectedHex });
      // Set as selected
      State.selectedColor = { code, name, hex: selectedHex };
      logAction("sofa.color_added", { materialType, code, name, hex: selectedHex });
      modal.remove();
      showToast(`✅ เพิ่มสี "${name}" ในแคตตาล็อก ${m.name}`, "success");
      renderMain();
    });
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

// ===== CUSTOMER PICKER MODAL =====
function openCustomerPicker() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function build(query = "") {
    const q = query.toLowerCase().trim();
    const filtered = q ? AppData.customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.code.toLowerCase().includes(q)
    ) : AppData.customers.slice(0, 20);

    const items = filtered.map(c => {
      const tier = AppData.tiers[getTierKey(c.totalSpent)];
      return `
      <div class="customer-pick-item" data-pick-cust="${c.id}">
        <div class="user-avatar" style="background:${tier.color};width:34px;height:34px;font-size:12px">${c.name.replace("คุณ","").trim().split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${c.name}</div>
          <div style="font-size:11px;color:#9ca3af">${c.phone} · ${c.code}</div>
        </div>
        <div style="text-align:right">
          <span class="role-pill" style="background:${tier.color};font-size:9px;padding:1px 6px">${tier.icon} ${tier.name}</span>
          <div style="font-size:10px;color:#7c3aed;margin-top:2px">${c.points.toLocaleString()} pts</div>
        </div>
      </div>`;
    }).join("");

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">👤 เลือกลูกค้าสำหรับบิลนี้</div>
        <div class="search-bar">
          <span>🔍</span>
          <input type="text" id="cp-search" placeholder="ชื่อ / เบอร์โทร / รหัส..." value="${query}" autofocus>
        </div>
        <div style="max-height:400px;overflow-y:auto">${items || `<div class="empty-state"><div class="empty-state-icon">😶</div><p>ไม่พบลูกค้า</p></div>`}</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-secondary" id="cp-cancel" style="flex:1">ยกเลิก</button>
          <button class="btn btn-primary" id="cp-new" style="flex:1">+ ลูกค้าใหม่</button>
        </div>
      </div>`;

    modal.querySelector("#cp-search").addEventListener("input", e => {
      const v = e.target.value;
      build(v);
      const inp = modal.querySelector("#cp-search");
      inp.focus();
      inp.setSelectionRange(v.length, v.length);
    });
    modal.querySelectorAll("[data-pick-cust]").forEach(el => {
      el.addEventListener("click", () => {
        State.selectedCustomer = parseInt(el.dataset.pickCust);
        modal.remove();
        showToast("✅ ผูกลูกค้าให้บิลนี้แล้ว", "success");
        renderMain();
      });
    });
    modal.querySelector("#cp-cancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#cp-new").addEventListener("click", () => { modal.remove(); openCustomerModal(); });
  }
  build();
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== DELIVERY DATE PICKER CALENDAR =====
function openDeliveryDatePicker(opts) {
  // opts: { currentDate, leadDays, channelId, onSelect }
  const channel = AppData.deliveryChannels.find(c => c.id === opts.channelId);
  const needsTeam = channel?.needsTeam || false;

  // Compute total team capacity per day (for in-house) — 2 jobs/slot × 3 slots × team count
  const activeTeams = AppData.deliveryTeams.filter(t => t.active);
  const totalSlotCapacity = activeTeams.reduce((s, t) => s + (t.slotCapacity || 2), 0); // per slot
  const totalDailyCapacity = totalSlotCapacity * 3; // 3 slots per day

  let viewDate = new Date(opts.currentDate || new Date().toISOString().split("T")[0]);

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  function loadByDate() {
    // Build map of date → deliveries (only in-house counts toward team capacity)
    const byDate = {};
    AppData.receipts.forEach(r => {
      if (!r.delivery || !r.delivery.date) return;
      if (r.status !== "active") return;
      if (!byDate[r.delivery.date]) byDate[r.delivery.date] = { total: 0, inhouse: 0, byChannel: {}, items: [] };
      byDate[r.delivery.date].total++;
      if (r.delivery.channelId === "inhouse") byDate[r.delivery.date].inhouse++;
      const ch = r.delivery.channelId || "inhouse";
      byDate[r.delivery.date].byChannel[ch] = (byDate[r.delivery.date].byChannel[ch] || 0) + 1;
      byDate[r.delivery.date].items.push(r);
    });
    return byDate;
  }

  function build() {
    const byDate = loadByDate();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthLabel = viewDate.toLocaleDateString("th-TH", { year: "numeric", month: "long" });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const todayStr = new Date().toISOString().split("T")[0];
    const minDate = new Date(Date.now() + (opts.leadDays || 0) * 86400000).toISOString().split("T")[0];

    const dayCells = [];
    for (let i = 0; i < startWeekday; i++) dayCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const isPast = dateStr < minDate;
      const dayLoad = byDate[dateStr] || { total: 0, inhouse: 0, byChannel: {}, items: [] };

      // Slot-level usage for in-house
      const slotUsage = needsTeam ? getSlotUsageForDate(dateStr) : null;
      let loadColor = "#10b981";
      let loadLabel = "ว่าง";
      let loadIcon = "🟢";

      if (needsTeam && slotUsage) {
        const totalUsed = slotUsage.morning.used + slotUsage.afternoon.used + slotUsage.evening.used + slotUsage.anytime.used;
        const usage = totalDailyCapacity > 0 ? totalUsed / totalDailyCapacity : 0;
        if (usage >= 1.0) { loadColor = "#dc2626"; loadLabel = "เต็ม"; loadIcon = "🔴"; }
        else if (usage >= 0.75) { loadColor = "#f59e0b"; loadLabel = "งานเยอะ"; loadIcon = "🟡"; }
        else if (usage >= 0.5) { loadColor = "#0ea5e9"; loadLabel = "ปานกลาง"; loadIcon = "🔵"; }
        else if (totalUsed > 0) { loadColor = "#10b981"; loadLabel = "ว่าง"; loadIcon = "🟢"; }
      } else {
        if (dayLoad.total >= 50) { loadColor = "#dc2626"; loadLabel = "งานหนัก"; loadIcon = "🔴"; }
        else if (dayLoad.total >= 20) { loadColor = "#f59e0b"; loadLabel = "งานเยอะ"; loadIcon = "🟡"; }
        else if (dayLoad.total >= 10) { loadColor = "#0ea5e9"; loadLabel = "ปานกลาง"; loadIcon = "🔵"; }
      }

      dayCells.push({ d, dateStr, isPast, dayLoad, loadColor, loadLabel, loadIcon, slotUsage });
    }
    while (dayCells.length % 7 !== 0) dayCells.push(null);

    const dayHeaders = ["อา","จ","อ","พ","พฤ","ศ","ส"].map(d => `<div class="dpk-header">${d}</div>`).join("");

    const cells = dayCells.map(c => {
      if (!c) return `<div class="dpk-cell dpk-empty"></div>`;
      const isSelected = c.dateStr === opts.currentDate;
      const isToday = c.dateStr === todayStr;

      // Slot mini-bars (only for in-house with slotUsage)
      let slotBars = "";
      if (needsTeam && c.slotUsage && !c.isPast) {
        const totalUsed = c.slotUsage.morning.used + c.slotUsage.afternoon.used + c.slotUsage.evening.used + c.slotUsage.anytime.used;
        const slotEntries = [
          { key: "morning",   short: "09-11", icon: "🌅", used: c.slotUsage.morning.used,   cap: c.slotUsage.morning.capacity },
          { key: "afternoon", short: "11-14", icon: "☀️", used: c.slotUsage.afternoon.used, cap: c.slotUsage.afternoon.capacity },
          { key: "evening",   short: "15-18", icon: "🌆", used: c.slotUsage.evening.used,   cap: c.slotUsage.evening.capacity },
        ];
        slotBars = `
          <div class="dpk-slots">
            ${slotEntries.map(s => {
              const pct = s.cap > 0 ? (s.used / s.cap) * 100 : 0;
              const barColor = pct >= 100 ? "#dc2626" : pct >= 75 ? "#f59e0b" : pct >= 50 ? "#0ea5e9" : "#10b981";
              return `<div class="dpk-slot" title="${s.icon} ${s.short} น. — ${s.used}/${s.cap}">
                <div class="dpk-slot-time">${s.short}</div>
                <div class="dpk-slot-bar" style="background:${barColor}40">
                  <div class="dpk-slot-fill" style="background:${barColor};width:${Math.min(pct, 100)}%"></div>
                </div>
                <div class="dpk-slot-num" style="color:${barColor}">${s.used}/${s.cap}</div>
              </div>`;
            }).join("")}
          </div>`;
      }

      return `
        <div class="dpk-cell ${c.isPast ? 'dpk-past' : ''} ${isSelected ? 'dpk-selected' : ''} ${isToday ? 'dpk-today' : ''}" data-pick-date="${c.dateStr}" ${c.isPast ? 'data-disabled' : ''}>
          <div class="dpk-day-num">${c.d}</div>
          ${c.dayLoad.total > 0 ? `
            <div class="dpk-load" style="background:${c.loadColor}20;color:${c.loadColor};border:1px solid ${c.loadColor}40">
              ${c.loadIcon} ${c.dayLoad.total}
            </div>
          ` : !c.isPast ? `<div class="dpk-load" style="background:#f0fdf4;color:#16a34a;border:1px solid #86efac">🟢 ว่าง</div>` : ''}
          ${slotBars}
        </div>`;
    }).join("");

    modal.innerHTML = `
      <div class="modal modal-large" style="max-width:780px">
        <div class="modal-title">📅 เลือกวันจัดส่ง</div>

        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#0c4a6e;line-height:1.6">
          ${needsTeam ?
            `🚛 <b>${channel.name}</b> · ${activeTeams.length} ทีม × <b>2 งาน/ช่วงเวลา × 3 ช่วง</b> = <b>${totalDailyCapacity} งาน/วัน</b><br>
            🌅 ช่วง 1 (09-11): ${totalSlotCapacity} · ☀️ ช่วง 2 (11-14): ${totalSlotCapacity} · 🌆 ช่วง 3 (15-18): ${totalSlotCapacity}` :
            `${channel?.icon || '📦'} <b>${channel?.name || 'จัดส่ง'}</b> · ใช้ขนส่งภายนอก · ไม่จำกัดจำนวน/วัน`}
          ${opts.leadDays > 0 ? `<br>⏱️ Lead time <b>${opts.leadDays} วัน</b> (ส่งได้เร็วสุด ${new Date(Date.now() + opts.leadDays * 86400000).toLocaleDateString("th-TH")})` : ''}
        </div>

        <div class="dpk-nav">
          <button class="btn btn-secondary" id="dpk-prev">‹</button>
          <div class="dpk-title">${monthLabel}</div>
          <button class="btn btn-secondary" id="dpk-today">วันนี้</button>
          <button class="btn btn-secondary" id="dpk-next">›</button>
        </div>

        <div class="dpk-headers">${dayHeaders}</div>
        <div class="dpk-grid">${cells}</div>

        <div class="dpk-legend">
          <div><span class="dpk-dot" style="background:#10b981"></span>ว่าง (< 50%)</div>
          <div><span class="dpk-dot" style="background:#0ea5e9"></span>ปานกลาง (50-75%)</div>
          <div><span class="dpk-dot" style="background:#f59e0b"></span>งานเยอะ (75-100%)</div>
          <div><span class="dpk-dot" style="background:#dc2626"></span>เต็ม</div>
          <div><span class="dpk-dot" style="background:#94a3b8"></span>ก่อนวันที่ส่งได้</div>
        </div>

        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-secondary" id="dpk-cancel" style="flex:1">ยกเลิก</button>
        </div>
      </div>`;

    modal.querySelector("#dpk-prev").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() - 1); build(); });
    modal.querySelector("#dpk-next").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth() + 1); build(); });
    modal.querySelector("#dpk-today").addEventListener("click", () => { viewDate = new Date(); build(); });
    modal.querySelector("#dpk-cancel").addEventListener("click", () => modal.remove());

    modal.querySelectorAll("[data-pick-date]:not([data-disabled])").forEach(el => {
      el.addEventListener("click", () => {
        const date = el.dataset.pickDate;
        if (opts.onSelect) opts.onSelect(date);
        modal.remove();
        showToast(`✅ เลือกวันส่ง: ${new Date(date).toLocaleDateString("th-TH", { weekday: "long", day: "2-digit", month: "long" })}`, "success");
      });
    });

    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  }
  build();
  document.body.appendChild(modal);
}

// ===== TRANSFER MODAL =====
function openTransferModal(productId) {
  const product = AppData.products.find(p => p.id === productId);
  if (!product) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const branchOpts = AppData.branches.map(b => `<option value="${b.id}">${b.name} (${b.code}) — ${product.stock[b.id] || 0} ชิ้น</option>`).join("");

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">⇄ โอน Stock — ${product.name}</div>
      <div class="transfer-form">
        <label>โอนจากสาขา</label>
        <select id="transfer-from">${branchOpts}</select>
        <label>โอนไปสาขา</label>
        <select id="transfer-to">${branchOpts}</select>
        <label>จำนวน (ชิ้น)</label>
        <input type="number" id="transfer-qty" min="1" value="1">
        <label>หมายเหตุ</label>
        <input type="text" id="transfer-note" placeholder="เช่น โอนเพื่อเติมสต็อก">
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="transfer-cancel" style="flex:1">ยกเลิก</button>
        <button class="btn btn-primary" id="transfer-confirm" style="flex:2">✅ ยืนยันโอน</button>
      </div>
    </div>`;

  modal.querySelector("#transfer-cancel").addEventListener("click", () => modal.remove());
  modal.querySelector("#transfer-confirm").addEventListener("click", () => {
    const from = parseInt(modal.querySelector("#transfer-from").value);
    const to = parseInt(modal.querySelector("#transfer-to").value);
    const qty = parseInt(modal.querySelector("#transfer-qty").value) || 0;
    if (from === to) { showToast("⚠️ สาขาต้นทางและปลายทางต้องต่างกัน", "error"); return; }
    if (qty <= 0) { showToast("⚠️ จำนวนต้องมากกว่า 0", "error"); return; }
    if ((product.stock[from] || 0) < qty) { showToast("❌ สต็อกต้นทางไม่เพียงพอ", "error"); return; }
    product.stock[from] -= qty;
    product.stock[to] = (product.stock[to] || 0) + qty;
    const fromName = AppData.branches.find(b=>b.id===from)?.name;
    const toName = AppData.branches.find(b=>b.id===to)?.name;
    logAction("transfer.completed", { product: product.name, qty, from: fromName, to: toName, fromId: from, toId: to });
    modal.remove();
    showToast(`✅ โอน ${qty} ชิ้น สำเร็จ`, "success");
    renderMain();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ===== CHECKOUT =====
function processCheckout() {
  // ===== STOCK VALIDATION (re-check live stock to prevent oversell) =====
  const insufficientItems = [];
  const consolidated = {};
  State.cart.forEach(item => {
    const key = item.product.id;
    consolidated[key] = (consolidated[key] || 0) + item.qty;
  });
  for (const [pid, qtyNeeded] of Object.entries(consolidated)) {
    const product = AppData.products.find(p => p.id === pid);
    const available = product.stock[State.currentBranch] || 0;
    if (available < qtyNeeded) {
      insufficientItems.push({ name: product.name, need: qtyNeeded, have: available });
    }
  }
  if (insufficientItems.length > 0) {
    const msg = insufficientItems.map(x => `${x.name}: ต้องการ ${x.need} เหลือ ${x.have}`).join("\n");
    showToast(`❌ Stock ไม่พอ — ${insufficientItems.length} รายการ`, "error");
    logAction("sale.stock_insufficient", { items: insufficientItems });
    alert("❌ Stock ไม่เพียงพอ:\n\n" + msg + "\n\nกรุณาตรวจสอบและลด qty ในตะกร้า");
    return;
  }

  // ===== CUSTOMER REQUIREMENT CHECK =====
  const reqCust = AppData.appSettings.requireCustomer;
  const isDelivery = State.delivery.zoneId !== "pickup";
  const requiresForDelivery = AppData.appSettings.requireCustomerForDelivery && isDelivery;
  if (!State.selectedCustomer && (reqCust === "block" || requiresForDelivery)) {
    showToast(`❌ บิลนี้ต้องผูกลูกค้าก่อนชำระเงิน${requiresForDelivery ? " (เพราะต้องจัดส่ง)" : ""}`, "error");
    return;
  }
  if (!State.selectedCustomer && reqCust === "warn") {
    if (!confirm("⚠️ บิลนี้ยังไม่ผูกลูกค้า — ลูกค้า walk-in จะไม่ได้สะสมแต้ม/ใช้ระบบสมาชิก\n\nยืนยันชำระเงินต่อ?")) return;
  }

  // ===== TOTALS WITH DISCOUNT =====
  const cust = State.selectedCustomer ? AppData.customers.find(c => c.id === State.selectedCustomer) : null;
  const subtotal = State.cart.reduce((s, i) => s + (i.unitPrice || i.product.price) * i.qty, 0);
  const maxPct = getMaxDiscountPercent();
  let discAmount = 0, discPct = 0;
  if (State.discount.value > 0 && maxPct > 0) {
    if (State.discount.type === "percent") {
      discPct = Math.min(State.discount.value, maxPct);
      discAmount = Math.round(subtotal * discPct / 100);
    } else {
      const cap = Math.round(subtotal * maxPct / 100);
      discAmount = Math.min(State.discount.value, cap);
      discPct = subtotal > 0 ? Math.round(discAmount / subtotal * 100) : 0;
    }
  }

  // Tier auto-discount + points
  let tierDiscPct = 0, tierDiscAmount = 0;
  if (cust) {
    const tk = getTierKey(cust.totalSpent);
    if (tk === "gold") tierDiscPct = 5;
    else if (tk === "platinum") tierDiscPct = 10;
    tierDiscAmount = Math.round(subtotal * tierDiscPct / 100);
  }
  const redeemPts = cust ? Math.min(State.redeemPoints || 0, cust.points) : 0;
  const redeemValue = redeemPts;

  // Delivery
  const zone = AppData.deliveryZones.find(z => z.id === State.delivery.zoneId) || AppData.deliveryZones[0];
  const isCustomZone = zone.id === "custom";
  let deliveryFee;
  if (isCustomZone) {
    deliveryFee = parseInt(State.delivery.customFee) || 0;
    // Permission check (defense in depth)
    if (!hasPermission("delivery.custom_price")) {
      showToast("❌ คุณไม่มีสิทธิ์กำหนดราคาเอง", "error");
      return;
    }
    if (deliveryFee < 0) {
      showToast("⚠️ ค่าจัดส่งต้องไม่เป็นลบ", "error");
      return;
    }
    if (!State.delivery.customReason) {
      showToast("⚠️ กรุณาระบุเหตุผลที่กำหนดราคาเอง", "error");
      return;
    }
  } else {
    deliveryFee = zone.fee;
    if (cust && getTierKey(cust.totalSpent) === "platinum" && zone.id !== "pickup") deliveryFee = 0;
  }

  // Validate delivery info if not pickup
  if (zone.id !== "pickup") {
    if (!State.delivery.recipientName || !State.delivery.recipientPhone || !State.delivery.address) {
      showToast("⚠️ กรุณากรอกข้อมูลจัดส่งให้ครบ (ชื่อ/เบอร์/ที่อยู่)", "error");
      return;
    }
  }

  const afterDiscount = Math.max(0, subtotal - discAmount - tierDiscAmount - redeemValue);
  const vat = Math.round(afterDiscount * 0.07);
  const total = afterDiscount + vat + deliveryFee;
  const method = AppData.paymentMethods.find(m => m.id === State.payMethod);
  const receiptNo = `REC-${String(State.receiptCounter++).padStart(6, "0")}`;
  const nowDate = new Date();
  const now = nowDate.toLocaleString("th-TH");

  // Calculate points earned
  const pointsEarned = cust ? calcPointsEarned(afterDiscount, getTierKey(cust.totalSpent)) : 0;

  // Deposit
  let depositPaid = total, outstandingBalance = 0;
  if (State.deposit && State.deposit.enabled) {
    let dep = State.deposit.type === "percent"
      ? Math.round(total * Math.min(State.deposit.value || 0, 100) / 100)
      : Math.min(State.deposit.value || 0, total);
    if (dep < 0) dep = 0;
    depositPaid = dep;
    outstandingBalance = total - dep;
  }

  // ===== DEDUCT STOCK + UPDATE SALES =====
  const itemsForLog = State.cart.map(i => ({
    productId: i.product.id,
    sku: i.product.sku,
    name: i.product.name,
    qty: i.qty,
    price: i.unitPrice || i.product.price,
    basePrice: i.product.price,
    size: i.size?.code,
    sizeLabel: i.size?.label,
    color: i.color?.code,
    colorName: i.color?.name,
    materialType: i.materialType,
    materialName: i.materialType ? AppData.sofaMaterials[i.materialType]?.name : null,
    orientation: i.orientation || null,
  }));
  State.cart.forEach(item => {
    item.product.stock[State.currentBranch] -= item.qty;
  });
  // Only deposit goes into today's sales (rest comes in when balance is settled)
  AppData.todaySales[State.currentBranch].amount += depositPaid;
  AppData.todaySales[State.currentBranch].count += 1;
  AppData.todaySales[State.currentBranch].customers += 1;

  // Save receipt to history (for refund/void)
  const receiptObj = {
    id: Date.now() + Math.random(),
    receiptNo,
    date: nowDate.toISOString(),
    branchId: State.currentBranch,
    cashierId: State.currentUser.id,
    cashierName: State.currentUser.name,
    customerId: cust?.id || null,
    customerName: cust?.name || null,
    customerCode: cust?.code || null,
    items: itemsForLog,
    subtotal,
    discAmount,
    discPct,
    discReason: State.discount.reason || null,
    tierDiscAmount,
    tierDiscPct,
    pointsRedeemed: redeemValue,
    vat,
    total,
    payment: State.payMethod,
    pointsEarned,
    status: "active",
    depositPaid,
    outstandingBalance,
    payments: outstandingBalance > 0 ? [{ method: State.payMethod, amount: depositPaid, date: new Date().toISOString(), note: "มัดจำ" }] : [{ method: State.payMethod, amount: total, date: new Date().toISOString(), note: "ชำระเต็มจำนวน" }],
    delivery: zone.id === "pickup" ? null : {
      trackingNo: (AppData.deliveryChannels.find(c => c.id === (State.delivery.channelId || 'inhouse'))?.trackingPrefix || "TRK-") + String(Date.now()).slice(-8) + Math.floor(Math.random() * 100),
      channelId: State.delivery.channelId || "inhouse",
      teamId: State.delivery.teamId || null,
      zoneId: zone.id,
      fee: deliveryFee,
      isCustomPrice: isCustomZone,
      customReason: isCustomZone ? State.delivery.customReason : null,
      authorizedBy: isCustomZone ? State.currentUser.name : null,
      recipientName: State.delivery.recipientName,
      recipientPhone: State.delivery.recipientPhone,
      address: State.delivery.address,
      date: State.delivery.date || new Date(Date.now() + zone.leadDays * 86400000).toISOString().split("T")[0],
      timeSlot: State.delivery.timeSlot || "anytime",
      note: State.delivery.note || "",
      status: "scheduled",
      driverId: null,
      statusHistory: [{ status: "scheduled", date: new Date().toISOString(), by: State.currentUser.name, note: "สร้างจาก POS" + (isCustomZone ? ` · ค่าส่งกำหนดเอง ฿${deliveryFee} (${State.delivery.customReason})` : "") }],
    },
  };
  AppData.receipts.unshift(receiptObj);

  // Update customer record
  if (cust) {
    cust.totalSpent += total;
    cust.totalOrders += 1;
    cust.points = cust.points - redeemPts + pointsEarned;
  }

  // ===== AUDIT LOG =====
  logAction("sale.completed", {
    receiptNo,
    branchId: State.currentBranch,
    branchName: getCurrentBranch().name,
    items: itemsForLog,
    customerId: cust?.id, customerName: cust?.name,
    subtotal, discAmount, discPct, discReason: State.discount.reason || null,
    tierDiscAmount, redeemPts, pointsEarned,
    vat, total,
    payment: State.payMethod,
  });
  if (discAmount > 0) {
    logAction("discount.applied", { receiptNo, amount: discAmount, percent: discPct, reason: State.discount.reason });
  }
  if (isCustomZone) {
    logAction("delivery.custom_price", { receiptNo, fee: deliveryFee, reason: State.delivery.customReason, authorizedBy: State.currentUser.name });
  }
  if (outstandingBalance > 0) {
    logAction("deposit.received", { receiptNo, deposit: depositPaid, outstanding: outstandingBalance, total });
  }
  // Broadcast for multi-cashier sync
  broadcastEvent("sale.completed", { receiptNo, branchId: State.currentBranch, total, items: itemsForLog.length });

  const itemLines = State.cart.map(i => {
    const up = i.unitPrice || i.product.price;
    const matInfo = i.materialType ? ` [${AppData.sofaMaterials[i.materialType]?.name}]` : "";
    const colInfo = i.color?.name ? ` (${i.color.name})` : "";
    const orientInfo = i.orientation ? ` [หัน${i.orientation === "left" ? "ซ้าย" : "ขวา"}]` : "";
    return `${i.product.name}${orientInfo}${matInfo}${colInfo}\n      ${String(i.qty).padStart(2)} × ฿${formatCurrency(up).padStart(8)} = ฿${formatCurrency(up * i.qty)}`;
  }).join("\n    ");

  const discountLine = discAmount > 0
    ? `\n    ส่วนลด ${discPct}%       −฿${formatCurrency(discAmount)}${State.discount.reason ? `\n    เหตุผล: ${State.discount.reason}` : ""}`
    : "";

  const tierLine = tierDiscAmount > 0 ? `\n    ส่วนลด ${AppData.tiers[getTierKey(cust.totalSpent)].name} ${tierDiscPct}%  −฿${formatCurrency(tierDiscAmount)}` : "";
  const redeemLine = redeemValue > 0 ? `\n    ใช้แต้ม ${redeemPts} pts  −฿${formatCurrency(redeemValue)}` : "";
  const customerLine = cust ? `\n    ลูกค้า: ${cust.name} (${cust.code})` : "";
  const earnedLine = pointsEarned > 0 ? `\n    🎁 แต้มที่ได้รับ: +${pointsEarned} pts (รวม ${cust.points} pts)` : "";
  const deliveryLine = deliveryFee > 0 ? `\n    ค่าจัดส่ง        +฿${formatCurrency(deliveryFee)}` : "";
  const trackingLine = receiptObj.delivery ? `\n    -----------------------------------\n    🚚 จัดส่ง — Tracking: ${receiptObj.delivery.trackingNo}\n    เขต: ${zone.name}\n    ผู้รับ: ${State.delivery.recipientName} · ${State.delivery.recipientPhone}\n    ที่อยู่: ${State.delivery.address}\n    วันส่ง: ${receiptObj.delivery.date} · ${AppData.deliveryTimeSlots.find(t => t.id === receiptObj.delivery.timeSlot)?.name}` : "";

  const receiptText = `
    ===================================
          🛋️ FURNITURE HOUSE POS
    ===================================
    สาขา: ${getCurrentBranch().name}
    แคชเชียร์: ${State.currentUser.name}${customerLine}
    วันที่: ${now}
    เลขที่ใบเสร็จ: ${receiptNo}
    -----------------------------------
    ${itemLines}
    -----------------------------------
    ยอดรวม          ฿${formatCurrency(subtotal)}${discountLine}${tierLine}${redeemLine}
    VAT 7%           ฿${formatCurrency(vat)}${deliveryLine}
    ยอดสุทธิ         ฿${formatCurrency(total)}${outstandingBalance > 0 ? `\n    -----------------------------------\n    💵 รับมัดจำวันนี้   ฿${formatCurrency(depositPaid)}\n    คงค้างชำระ        ฿${formatCurrency(outstandingBalance)}\n    (ชำระตอนรับสินค้า)` : ""}
    -----------------------------------
    ชำระโดย: ${method?.icon} ${method?.name}${earnedLine}${trackingLine}
    -----------------------------------
    ขอบคุณที่ใช้บริการ 🙏
    ===================================`;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">✅ ชำระเงินสำเร็จ!</div>
      <div class="receipt"><pre style="white-space:pre-wrap;font-size:12px">${receiptText}</pre></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" id="receipt-close" style="flex:1">ปิด</button>
        <button class="btn btn-primary" id="receipt-print" style="flex:1">🖨️ พิมพ์ใบเสร็จ</button>
      </div>
    </div>`;
  modal.querySelector("#receipt-close").addEventListener("click", () => modal.remove());
  modal.querySelector("#receipt-print").addEventListener("click", () => { window.print(); });
  document.body.appendChild(modal);

  State.cart = [];
  State.payMethod = null;
  State.discount = { type: "percent", value: 0, reason: "" };
  State.selectedCustomer = null;
  State.redeemPoints = 0;
  State.delivery = { zoneId: "pickup", channelId: "inhouse", teamId: null, address: "", recipientName: "", recipientPhone: "", date: "", timeSlot: "anytime", note: "", customFee: 0, customReason: "" };
  State.deposit = { enabled: false, type: "percent", value: 30 };
  renderMain();
}

// ===== CART HELPER =====
function addToCart(product, size, color, materialType = null, orientation = null) {
  const mult = materialType ? (AppData.sofaMaterials[materialType]?.priceMultiplier || 1) : 1;
  const unitPrice = Math.round(product.price * mult);
  const existing = State.cart.find(i =>
    i.product.id === product.id &&
    i.size?.code === size?.code &&
    i.color?.code === color?.code &&
    i.materialType === materialType &&
    (i.orientation || null) === (orientation || null)
  );
  if (existing) { existing.qty++; }
  else { State.cart.push({ product, size, color, materialType, orientation, unitPrice, qty: 1 }); }
}

// ===== EXCEL HELPERS =====
function exportXLSX(filename, sheetsObj) {
  if (typeof XLSX === "undefined") { showToast("❌ XLSX library ยังโหลดไม่เสร็จ", "error"); return; }
  const wb = XLSX.utils.book_new();
  Object.entries(sheetsObj).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, Math.min(30, Math.max(...rows.slice(0, 50).map(r => String(r[k] ?? "").length)))) }));
      ws["!cols"] = cols;
    }
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
  logAction("data.export", { filename, sheets: Object.keys(sheetsObj), rows: Object.values(sheetsObj).reduce((s, r) => s + r.length, 0) });
}

function readXLSX(file, callback) {
  if (typeof XLSX === "undefined") { showToast("❌ XLSX library ยังโหลดไม่เสร็จ", "error"); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const result = {};
      wb.SheetNames.forEach(name => {
        result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
      });
      callback(result);
    } catch (err) {
      showToast(`❌ อ่านไฟล์ไม่ได้: ${err.message}`, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

// ===== EXPORTS =====
function exportProductsXLSX() {
  const products = AppData.products.map(p => ({
    sku: p.sku, id: p.id, name: p.name, categoryId: p.categoryId,
    price: p.price, cost: p.cost,
    minStock: p.minStock,
    description: p.description,
    materialTypes: (p.materialTypes || []).join(","),
    sizes: p.sizes.map(s => `${s.code}:${s.label}(${s.w}x${s.d}x${s.h})`).join(" | "),
    colors: (p.colors || []).map(c => `${c.code}:${c.name}(${c.hex})`).join(" | "),
    images: p.images.join(" | "),
    totalStock: AppData.branches.reduce((s, b) => s + (p.stock[b.id] || 0), 0),
  }));

  const sofaColors = [];
  Object.entries(AppData.sofaColors).forEach(([mt, list]) => {
    list.forEach(c => sofaColors.push({ materialType: mt, code: c.code, name: c.name, hex: c.hex }));
  });

  exportXLSX(`products_${new Date().toISOString().split("T")[0]}.xlsx`, {
    "Products": products,
    "Sofa Colors": sofaColors,
    "Categories": AppData.categories,
  });
  showToast("✅ Export Products สำเร็จ", "success");
}

function exportCustomersXLSX() {
  const data = AppData.customers.map(c => ({
    code: c.code, name: c.name, phone: c.phone, email: c.email,
    address: c.address, joinDate: c.joinDate,
    totalSpent: c.totalSpent, totalOrders: c.totalOrders, points: c.points,
    tier: getTierKey(c.totalSpent),
    notes: c.notes,
  }));
  exportXLSX(`customers_${new Date().toISOString().split("T")[0]}.xlsx`, {
    "Customers": data,
    "Tier Definitions": Object.entries(AppData.tiers).map(([k, t]) => ({ key: k, name: t.name, threshold: t.threshold, multiplier: t.multiplier, perks: t.perks })),
  });
  showToast("✅ Export Customers สำเร็จ", "success");
}

function exportReceiptsXLSX() {
  const headers = AppData.receipts.map(r => {
    const branch = AppData.branches.find(b => b.id === r.branchId);
    return {
      receiptNo: r.receiptNo, date: r.date, branch: branch?.code,
      cashier: r.cashierName, customer: r.customerName || "Walk-in",
      subtotal: r.subtotal, discount: r.discAmount || 0, tierDiscount: r.tierDiscAmount || 0,
      pointsRedeemed: r.pointsRedeemed || 0, vat: r.vat,
      deliveryFee: r.delivery?.fee || 0, total: r.total,
      depositPaid: r.depositPaid, outstandingBalance: r.outstandingBalance,
      payment: r.payment, status: r.status,
      itemCount: r.items.length, totalQty: r.items.reduce((s, i) => s + i.qty, 0),
    };
  });

  const lineItems = [];
  AppData.receipts.forEach(r => {
    r.items.forEach(it => {
      lineItems.push({
        receiptNo: r.receiptNo, date: r.date,
        sku: it.sku, productName: it.name,
        qty: it.qty, unitPrice: it.price, lineTotal: it.price * it.qty,
        size: it.sizeLabel || it.size,
        material: it.materialName || "",
        color: it.colorName || "",
      });
    });
  });

  exportXLSX(`receipts_${new Date().toISOString().split("T")[0]}.xlsx`, {
    "Receipts": headers,
    "Line Items": lineItems,
  });
  showToast(`✅ Export ${headers.length} ใบเสร็จ + ${lineItems.length} รายการ`, "success");
}

function exportStockXLSX() {
  const data = AppData.products.map(p => {
    const row = {
      sku: p.sku, name: p.name,
      category: AppData.categories.find(c => c.id === p.categoryId)?.name,
      price: p.price, cost: p.cost, minStock: p.minStock,
    };
    AppData.branches.forEach(b => {
      row[b.code] = p.stock[b.id] || 0;
    });
    row.total = AppData.branches.reduce((s, b) => s + (p.stock[b.id] || 0), 0);
    return row;
  });
  exportXLSX(`stock_${new Date().toISOString().split("T")[0]}.xlsx`, {
    "Stock by Branch": data,
    "Branches": AppData.branches.map(b => ({ id: b.id, code: b.code, name: b.name, target: b.target, isWarehouse: b.isWarehouse || false })),
  });
  showToast("✅ Export Stock Matrix สำเร็จ", "success");
}

function exportQuotesXLSX() {
  const data = AppData.quotations.map(q => ({
    quoteNo: q.quoteNo, date: q.date,
    branch: AppData.branches.find(b => b.id === q.branchId)?.code,
    customer: q.customerName, customerPhone: q.customerPhone,
    total: q.total, items: q.items.length,
    validUntil: q.validUntil, status: q.status, note: q.note,
  }));
  exportXLSX(`quotations_${new Date().toISOString().split("T")[0]}.xlsx`, { "Quotations": data });
  showToast("✅ Export Quotations สำเร็จ", "success");
}

function exportAuditXLSX() {
  const data = AppData.auditLog.map(l => ({
    timestamp: l.timestamp, user: l.userName, role: l.role,
    branch: AppData.branches.find(b => b.id === l.branchId)?.code || "",
    action: l.action, details: JSON.stringify(l.details),
  }));
  exportXLSX(`audit_log_${new Date().toISOString().split("T")[0]}.xlsx`, { "Audit Log": data });
  showToast("✅ Export Audit Log สำเร็จ", "success");
}

function exportAllBackup() {
  exportProductsXLSX();
  exportCustomersXLSX();
  exportReceiptsXLSX();
  exportStockXLSX();
  exportQuotesXLSX();
  exportAuditXLSX();
  setTimeout(() => showToast("🗂️ Backup ทั้งหมด 6 ไฟล์", "success"), 500);
}

// ===== IMPORTS =====
function importProductsXLSX(file) {
  readXLSX(file, (sheets) => {
    const rows = sheets["Products"] || sheets[Object.keys(sheets)[0]] || [];
    if (!rows.length) { showToast("❌ ไม่พบข้อมูลในไฟล์", "error"); return; }

    let added = 0, updated = 0, skipped = 0;
    rows.forEach(row => {
      if (!row.sku || !row.name) { skipped++; return; }
      const existing = AppData.products.find(p => p.sku === row.sku);
      const data = {
        name: row.name,
        categoryId: row.categoryId || existing?.categoryId || "sofa",
        price: parseFloat(row.price) || existing?.price || 0,
        cost: parseFloat(row.cost) || existing?.cost || 0,
        minStock: parseInt(row.minStock) || existing?.minStock || 1,
        description: row.description || existing?.description || "",
      };
      if (existing) {
        Object.assign(existing, data);
        updated++;
      } else {
        AppData.products.push({
          id: row.id || row.sku,
          sku: row.sku,
          ...data,
          materialTypes: row.materialTypes ? row.materialTypes.split(",").map(s => s.trim()).filter(Boolean) : undefined,
          images: row.images ? row.images.split(" | ") : ["https://via.placeholder.com/600"],
          sizes: [{ code: "STD", label: "มาตรฐาน", w: 0, d: 0, h: 0, seat_h: 0, room_min: "" }],
          colors: [{ code: "DEF", name: "มาตรฐาน", hex: "#888" }],
          materials: { fabric: { name: "—", grade: "—", origin: "—", properties: [] }, frame: { name: "—", grade: "—", origin: "—", properties: [] }, foam: { name: "—", grade: "—", origin: "—", properties: [] }, legs: { name: "—", grade: "—", origin: "—", properties: [] } },
          stock: Object.fromEntries(AppData.branches.map(b => [b.id, 0])),
        });
        added++;
      }
    });

    logAction("data.import.products", { added, updated, skipped, total: rows.length });
    alert(`✅ Import Products เสร็จสิ้น\n\nเพิ่มใหม่: ${added}\nอัปเดต: ${updated}\nข้าม: ${skipped}`);
    renderMain();
  });
}

function importCustomersXLSX(file) {
  readXLSX(file, (sheets) => {
    const rows = sheets["Customers"] || sheets[Object.keys(sheets)[0]] || [];
    if (!rows.length) { showToast("❌ ไม่พบข้อมูลในไฟล์", "error"); return; }

    let added = 0, updated = 0, skipped = 0;
    rows.forEach(row => {
      if (!row.name || !row.phone) { skipped++; return; }
      const existing = row.code ? AppData.customers.find(c => c.code === row.code) : null;
      if (existing) {
        Object.assign(existing, {
          name: row.name, phone: row.phone, email: row.email || existing.email,
          address: row.address || existing.address, notes: row.notes || existing.notes,
        });
        updated++;
      } else {
        const newId = (AppData.customers.length ? Math.max(...AppData.customers.map(c => c.id)) : 0) + 1;
        const code = row.code || `CUST${String(newId).padStart(3, "0")}`;
        AppData.customers.push({
          id: newId, code,
          name: row.name, phone: row.phone, email: row.email || "",
          address: row.address || "", notes: row.notes || "",
          joinDate: row.joinDate || new Date().toISOString().split("T")[0],
          totalSpent: parseFloat(row.totalSpent) || 0,
          totalOrders: parseInt(row.totalOrders) || 0,
          points: parseInt(row.points) || 0,
        });
        added++;
      }
    });
    logAction("data.import.customers", { added, updated, skipped });
    alert(`✅ Import Customers เสร็จสิ้น\n\nเพิ่มใหม่: ${added}\nอัปเดต: ${updated}\nข้าม: ${skipped}`);
    renderMain();
  });
}

function importStockXLSX(file) {
  readXLSX(file, (sheets) => {
    const rows = sheets["Stock by Branch"] || sheets[Object.keys(sheets)[0]] || [];
    if (!rows.length) { showToast("❌ ไม่พบข้อมูลในไฟล์", "error"); return; }

    let updated = 0, skipped = 0, branchesSet = 0;
    const branchByCode = Object.fromEntries(AppData.branches.map(b => [b.code, b.id]));

    rows.forEach(row => {
      if (!row.sku) { skipped++; return; }
      const product = AppData.products.find(p => p.sku === row.sku);
      if (!product) { skipped++; return; }

      let touched = false;
      Object.entries(row).forEach(([key, val]) => {
        if (branchByCode[key] !== undefined) {
          const newVal = parseInt(val) || 0;
          if (product.stock[branchByCode[key]] !== newVal) {
            product.stock[branchByCode[key]] = newVal;
            touched = true; branchesSet++;
          }
        }
      });
      if (touched) updated++;
    });

    logAction("data.import.stock", { updated, skipped, cellsChanged: branchesSet });
    alert(`✅ Import Stock เสร็จสิ้น\n\nสินค้าที่อัปเดต: ${updated}\nCell ที่เปลี่ยน: ${branchesSet}\nข้าม: ${skipped}`);
    renderMain();
  });
}

function downloadTemplateXLSX() {
  const templates = {
    "Products Template": [
      { sku: "SAMPLE-001", id: "SAMPLE-001", name: "ชื่อสินค้าตัวอย่าง", categoryId: "sofa", price: 38900, cost: 21400, minStock: 3, description: "รายละเอียด" },
    ],
    "Customers Template": [
      { code: "CUST999", name: "ชื่อลูกค้าตัวอย่าง", phone: "081-234-5678", email: "test@example.com", address: "ที่อยู่...", notes: "หมายเหตุ" },
    ],
    "Stock Template": (() => {
      const row = { sku: "SF001", name: "โซฟา Luxe Nordic" };
      AppData.branches.forEach(b => { row[b.code] = 10; });
      return [row];
    })(),
  };
  exportXLSX(`templates_furniture_pos.xlsx`, templates);
  showToast("✅ Download Template สำเร็จ — ใช้เป็นแม่แบบสำหรับ Import", "success");
}

// ===== EXPORT AUDIT CSV =====
function exportAuditCSV() {
  const headers = ["timestamp", "user", "role", "branch", "action", "details"];
  const rows = AppData.auditLog.map(l => [
    l.timestamp,
    l.userName,
    l.role,
    AppData.branches.find(b => b.id === l.branchId)?.code || "",
    l.action,
    JSON.stringify(l.details).replace(/,/g, ";").replace(/"/g, "'"),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  logAction("audit.exported", { count: AppData.auditLog.length });
  showToast("✅ Export Audit Log สำเร็จ", "success");
}

// ===== EXPORT CSV =====
function exportStockCSV() {
  const headers = ["SKU", "สินค้า", "หมวดหมู่", "ราคา", ...AppData.branches.map(b => b.code), "รวม", "เกณฑ์ขั้นต่ำ"];
  const rows = AppData.products.map(p => {
    const cat = AppData.categories.find(c => c.id === p.categoryId)?.name || "";
    const branchStocks = AppData.branches.map(b => p.stock[b.id] || 0);
    const total = branchStocks.reduce((a, b) => a + b, 0);
    return [p.sku, p.name, cat, p.price, ...branchStocks, total, p.minStock];
  });
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  logAction("stock.export", { count: AppData.products.length });
  showToast("✅ Export CSV สำเร็จ", "success");
}

// ===== TOAST =====
function showToast(msg, type = "") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== LOGIN INIT =====
function initLogin() {
  const overlay = document.getElementById("login-overlay");
  const userInput = document.getElementById("login-user");
  const passInput = document.getElementById("login-pass");
  const errorEl = document.getElementById("login-error");

  function tryLogin() {
    errorEl.style.display = "none";
    const u = userInput.value.trim();
    const p = passInput.value;
    if (login(u, p)) return;
    errorEl.style.display = "block";
    setTimeout(() => { errorEl.style.display = "none"; }, 3000);
  }

  document.getElementById("btn-login").addEventListener("click", tryLogin);
  passInput.addEventListener("keypress", e => { if (e.key === "Enter") tryLogin(); });
  userInput.addEventListener("keypress", e => { if (e.key === "Enter") passInput.focus(); });

  document.querySelectorAll(".demo-user").forEach(el => {
    el.addEventListener("click", () => {
      userInput.value = el.dataset.user;
      passInput.value = "1234";
      tryLogin();
    });
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    if (confirm("ออกจากระบบ?")) logout();
  });
  document.getElementById("btn-darkmode").addEventListener("click", () => {
    applyDarkMode(!AppData.appSettings.darkMode);
    document.getElementById("btn-darkmode").textContent = AppData.appSettings.darkMode ? "☀️" : "🌙";
  });

  // Language toggle (sidebar)
  document.getElementById("btn-language").addEventListener("click", () => {
    setLanguage(State.language === "th" ? "en" : "th");
  });
  // Language toggle (login page)
  document.getElementById("btn-language-login").addEventListener("click", () => {
    setLanguage(State.language === "th" ? "en" : "th");
  });

  // Restore preferences
  try {
    const dark = localStorage.getItem("fh_dark") === "1";
    if (dark) {
      applyDarkMode(true);
      document.getElementById("btn-darkmode").textContent = "☀️";
    }
    const savedLang = localStorage.getItem("fh_lang");
    if (savedLang && AppData.i18n[savedLang]) {
      setLanguage(savedLang);
    } else {
      setLanguage("th"); // default to set login labels
    }
  } catch(e) { setLanguage("th"); }

  // Auto-restore session
  try {
    const saved = JSON.parse(localStorage.getItem("fh_user"));
    if (saved?.id) {
      const user = AppData.users.find(u => u.id === saved.id && u.active);
      if (user) {
        State.currentUser = user;
        if (isBranchScoped() && user.branchId) State.currentBranch = user.branchId;
        showApp();
        return;
      }
    }
  } catch(e) {}

  // Show login
  overlay.style.display = "flex";
  userInput.focus();
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  // Start daily report scheduler timer
  startDailyReportTimer();
  // Request browser notification permission (for desktop alert when report sent)
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    setTimeout(() => Notification.requestPermission(), 3000);
  }
  // Live clock
  setInterval(() => {
    const sub = document.getElementById("topbar-sub");
    if (sub && State.currentPage !== "pos" && State.currentUser) {
      sub.textContent = `อัปเดต: ${new Date().toLocaleTimeString("th-TH")}`;
    }
  }, 1000);
});
