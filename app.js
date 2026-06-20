const STORAGE_KEY = "herbal_consignment_v1";

const emptyData = () => ({
  products: [],
  pharmacies: [],
  deliveries: [],
  sales: [],
  payments: [],
});

let data = loadData();

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function loadData() {
  try {
    return { ...emptyData(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return emptyData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeId(prefix) {
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${id}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function numberValue(id) {
  return Number(document.getElementById(id).value || 0);
}

function textValue(id) {
  return document.getElementById(id).value.trim();
}

function dateInReportRange(date) {
  const start = textValue("reportStartDate");
  const end = textValue("reportEndDate");
  return (!start || date >= start) && (!end || date <= end);
}

function reportDateNote() {
  const start = textValue("reportStartDate");
  const end = textValue("reportEndDate");
  if (start && end) return `Showing ${start} to ${end}.`;
  if (start) return `Showing from ${start}.`;
  if (end) return `Showing until ${end}.`;
  return "Showing all dates.";
}

function productName(id) {
  return data.products.find((item) => item.product_id === id)?.product_name || "(deleted product)";
}

function pharmacyName(id) {
  return data.pharmacies.find((item) => item.pharmacy_id === id)?.pharmacy_name || "(deleted pharmacy)";
}

function productById(id) {
  return data.products.find((item) => item.product_id === id);
}

function money(value) {
  return rupiah.format(value || 0);
}

function setDefaultDates() {
  ["deliveryDate", "salesDate", "paymentDate"].forEach((id) => {
    document.getElementById(id).value = today();
  });
}

function renderAll() {
  renderDropdowns();
  renderDashboard();
  renderProducts();
  renderPharmacies();
  renderDeliveries();
  renderSales();
  renderPayments();
  renderReports();
}

function renderDropdowns() {
  fillSelect("deliveryPharmacy", data.pharmacies, "pharmacy_id", "pharmacy_name", "Choose pharmacy");
  fillSelect("salesPharmacy", data.pharmacies, "pharmacy_id", "pharmacy_name", "Choose pharmacy");
  fillSelect("paymentPharmacy", data.pharmacies, "pharmacy_id", "pharmacy_name", "Choose pharmacy");
  document.querySelectorAll(".delivery-product").forEach((select) => {
    fillSelectElement(select, data.products, "product_id", "product_name", "Choose product");
  });
  document.querySelectorAll(".sales-product").forEach((select) => {
    fillSelectElement(select, data.products, "product_id", "product_name", "Choose product");
  });
}

function fillSelect(id, rows, valueKey, labelKey, placeholder) {
  fillSelectElement(document.getElementById(id), rows, valueKey, labelKey, placeholder);
}

function fillSelectElement(select, rows, valueKey, labelKey, placeholder) {
  const selected = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row[valueKey];
    option.textContent = row[labelKey];
    select.appendChild(option);
  });
  select.value = rows.some((row) => row[valueKey] === selected) ? selected : "";
}

function addDeliveryLine() {
  const line = document.createElement("div");
  line.className = "delivery-line";
  line.innerHTML = `
    <label>
      Product *
      <select class="delivery-product" required></select>
    </label>
    <label>
      Quantity sent *
      <input class="delivery-quantity" type="number" min="1" step="1" required>
    </label>
    <button type="button" class="secondary remove-delivery-line" data-remove-delivery-line>Remove</button>
  `;
  document.getElementById("deliveryLines").appendChild(line);
  renderDropdowns();
  updateDeliveryLineButtons();
}

function resetDeliveryLines() {
  const lines = document.getElementById("deliveryLines");
  lines.innerHTML = "";
  addDeliveryLine();
}

function updateDeliveryLineButtons() {
  const buttons = document.querySelectorAll(".remove-delivery-line");
  buttons.forEach((button) => button.hidden = buttons.length === 1);
}

function addSalesLine() {
  const line = document.createElement("div");
  line.className = "sales-line";
  line.innerHTML = `
    <label>
      Product *
      <select class="sales-product" required></select>
    </label>
    <label>
      Quantity sold *
      <input class="sales-quantity" type="number" min="1" step="1" required>
    </label>
    <button type="button" class="secondary remove-sales-line" data-remove-sales-line>Remove</button>
  `;
  document.getElementById("salesLines").appendChild(line);
  renderDropdowns();
  updateSalesLineButtons();
}

function resetSalesLines() {
  const lines = document.getElementById("salesLines");
  lines.innerHTML = "";
  addSalesLine();
}

function updateSalesLineButtons() {
  const buttons = document.querySelectorAll(".remove-sales-line");
  buttons.forEach((button) => button.hidden = buttons.length === 1);
}

function totals() {
  const stockRows = stockReportRows();
  const balanceRows = balanceReportRows();
  return {
    sent: sum(stockRows, "sent"),
    sold: sum(stockRows, "sold"),
    remaining: sum(stockRows, "remaining"),
    omzet: sum(stockRows, "omzet"),
    profit: sum(stockRows, "profit"),
    unpaid: sum(balanceRows, "balance"),
  };
}

function renderDashboard() {
  const t = totals();
  const cards = [
    ["Total stock sent", t.sent],
    ["Total quantity sold", t.sold],
    ["Total remaining stock", t.remaining],
    ["Total omzet / revenue", money(t.omzet)],
    ["Total profit", money(t.profit)],
    ["Total unpaid balance", money(t.unpaid)],
  ];
  document.getElementById("dashboardCards").innerHTML = cards
    .map(([label, value]) => `<div class="summary-card"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderProducts() {
  renderRows(
    "productTable",
    data.products,
    (item) => `
      <td>${escapeHtml(item.product_id)}</td>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${escapeHtml(item.supplier_name)}</td>
      <td>${money(item.purchase_price)}</td>
      <td>${money(item.selling_price)}</td>
      <td>${escapeHtml(item.notes)}</td>
      <td class="actions">
        <button type="button" data-edit-product="${item.product_id}">Edit</button>
        <button type="button" class="danger" data-delete-product="${item.product_id}">Delete</button>
      </td>
    `
  );
}

function renderPharmacies() {
  renderRows(
    "pharmacyTable",
    data.pharmacies,
    (item) => `
      <td>${escapeHtml(item.pharmacy_id)}</td>
      <td>${escapeHtml(item.pharmacy_name)}</td>
      <td>${escapeHtml(item.address)}</td>
      <td>${escapeHtml(item.contact_person)}</td>
      <td>${escapeHtml(item.phone_number)}</td>
      <td>${escapeHtml(item.notes)}</td>
      <td class="actions">
        <button type="button" data-edit-pharmacy="${item.pharmacy_id}">Edit</button>
        <button type="button" class="danger" data-delete-pharmacy="${item.pharmacy_id}">Delete</button>
      </td>
    `
  );
}

function renderDeliveries() {
  renderRows(
    "deliveryTable",
    data.deliveries,
    (item) => `
      <td>${item.date}</td>
      <td>${escapeHtml(pharmacyName(item.pharmacy_id))}</td>
      <td>${escapeHtml(productName(item.product_id))}</td>
      <td>${item.quantity_sent}</td>
      <td>${escapeHtml(item.notes)}</td>
      <td class="actions"><button type="button" class="danger" data-delete-delivery="${item.delivery_id}">Delete</button></td>
    `
  );
}

function renderSales() {
  renderRows(
    "salesTable",
    data.sales,
    (item) => `
      <td>${item.date}</td>
      <td>${escapeHtml(pharmacyName(item.pharmacy_id))}</td>
      <td>${escapeHtml(productName(item.product_id))}</td>
      <td>${item.quantity_sold}</td>
      <td>${money(saleOmzet(item))}</td>
      <td>${money(saleProfit(item))}</td>
      <td>${escapeHtml(item.notes)}</td>
      <td class="actions"><button type="button" class="danger" data-delete-sale="${item.sales_id}">Delete</button></td>
    `
  );
}

function renderPayments() {
  renderRows(
    "paymentTable",
    data.payments,
    (item) => `
      <td>${item.date}</td>
      <td>${escapeHtml(pharmacyName(item.pharmacy_id))}</td>
      <td>${money(item.amount_paid)}</td>
      <td>${escapeHtml(item.notes)}</td>
      <td class="actions"><button type="button" class="danger" data-delete-payment="${item.payment_id}">Delete</button></td>
    `
  );
}

function renderReports() {
  document.getElementById("reportDateNote").textContent = reportDateNote();
  renderRows(
    "stockReportTable",
    stockReportRows(),
    (item) => `
      <td>${escapeHtml(item.pharmacy)}</td>
      <td>${escapeHtml(item.product)}</td>
      <td>${item.sent}</td>
      <td>${item.sold}</td>
      <td>${item.remaining}</td>
      <td>${money(item.omzet)}</td>
      <td>${money(item.profit)}</td>
    `
  );
  renderRows(
    "balanceReportTable",
    balanceReportRows(),
    (item) => `
      <td>${escapeHtml(item.pharmacy)}</td>
      <td>${money(item.omzet)}</td>
      <td>${money(item.paid)}</td>
      <td>${money(item.balance)}</td>
    `
  );
}

function renderRows(tableId, rows, rowHtml) {
  const tbody = document.getElementById(tableId);
  if (!rows.length) {
    const colspan = tbody.closest("table").querySelectorAll("th").length;
    tbody.innerHTML = `<tr><td class="empty" colspan="${colspan}">No data yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((row) => `<tr>${rowHtml(row)}</tr>`).join("");
  addMobileLabels(tbody);
}

function addMobileLabels(tbody) {
  const labels = [...tbody.closest("table").querySelectorAll("th")].map((th) => th.textContent);
  tbody.querySelectorAll("tr").forEach((row) => {
    row.querySelectorAll("td").forEach((cell, index) => {
      cell.dataset.label = labels[index] || "";
    });
  });
}

function saleOmzet(sale) {
  const product = productById(sale.product_id);
  return sale.quantity_sold * (product?.selling_price || 0);
}

function saleProfit(sale) {
  const product = productById(sale.product_id);
  return sale.quantity_sold * ((product?.selling_price || 0) - (product?.purchase_price || 0));
}

function stockReportRows() {
  const rows = new Map();
  data.deliveries.filter((item) => dateInReportRange(item.date)).forEach((item) => getStockRow(rows, item.pharmacy_id, item.product_id).sent += item.quantity_sent);
  data.sales.filter((item) => dateInReportRange(item.date)).forEach((item) => {
    const row = getStockRow(rows, item.pharmacy_id, item.product_id);
    row.sold += item.quantity_sold;
    row.omzet += saleOmzet(item);
    row.profit += saleProfit(item);
  });
  return [...rows.values()]
    .map((row) => ({ ...row, remaining: row.sent - row.sold }))
    .sort((a, b) => a.pharmacy.localeCompare(b.pharmacy) || a.product.localeCompare(b.product));
}

function getStockRow(rows, pharmacy_id, product_id) {
  const key = `${pharmacy_id}|${product_id}`;
  if (!rows.has(key)) {
    rows.set(key, {
      pharmacy_id,
      product_id,
      pharmacy: pharmacyName(pharmacy_id),
      product: productName(product_id),
      sent: 0,
      sold: 0,
      omzet: 0,
      profit: 0,
    });
  }
  return rows.get(key);
}

function balanceReportRows() {
  const rows = new Map();
  data.pharmacies.forEach((item) => rows.set(item.pharmacy_id, balanceRow(item.pharmacy_id)));
  data.sales.filter((item) => dateInReportRange(item.date)).forEach((item) => getBalanceRow(rows, item.pharmacy_id).omzet += saleOmzet(item));
  data.payments.filter((item) => dateInReportRange(item.date)).forEach((item) => getBalanceRow(rows, item.pharmacy_id).paid += item.amount_paid);
  return [...rows.values()]
    .map((row) => ({ ...row, balance: row.omzet - row.paid }))
    .filter((row) => row.omzet || row.paid || data.pharmacies.some((p) => p.pharmacy_id === row.pharmacy_id))
    .sort((a, b) => a.pharmacy.localeCompare(b.pharmacy));
}

function balanceRow(pharmacy_id) {
  return { pharmacy_id, pharmacy: pharmacyName(pharmacy_id), omzet: 0, paid: 0 };
}

function getBalanceRow(rows, pharmacy_id) {
  if (!rows.has(pharmacy_id)) rows.set(pharmacy_id, balanceRow(pharmacy_id));
  return rows.get(pharmacy_id);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function saveProduct(event) {
  event.preventDefault();
  const item = {
    product_id: document.getElementById("productEditId").value || makeId("product"),
    product_name: textValue("productName"),
    supplier_name: textValue("supplierName"),
    purchase_price: numberValue("purchasePrice"),
    selling_price: numberValue("sellingPrice"),
    notes: textValue("productNotes"),
  };
  if (item.purchase_price < 0 || item.selling_price < 0) return alert("Prices cannot be negative.");
  upsert(data.products, "product_id", item);
  saveData();
  event.target.reset();
  endProductEdit();
  renderAll();
}

function savePharmacy(event) {
  event.preventDefault();
  const item = {
    pharmacy_id: document.getElementById("pharmacyEditId").value || makeId("pharmacy"),
    pharmacy_name: textValue("pharmacyName"),
    address: textValue("pharmacyAddress"),
    contact_person: textValue("contactPerson"),
    phone_number: textValue("phoneNumber"),
    notes: textValue("pharmacyNotes"),
  };
  upsert(data.pharmacies, "pharmacy_id", item);
  saveData();
  event.target.reset();
  endPharmacyEdit();
  renderAll();
}

function saveDelivery(event) {
  event.preventDefault();
  const lines = [...document.querySelectorAll(".delivery-line")].map((line) => ({
    product_id: line.querySelector(".delivery-product").value,
    quantity_sent: Number(line.querySelector(".delivery-quantity").value || 0),
  }));
  if (lines.some((line) => !line.product_id || line.quantity_sent <= 0)) return alert("Choose a product and quantity more than 0 for each line.");
  data.deliveries.push(...lines.map((line) => ({
    delivery_id: makeId("delivery"),
    date: textValue("deliveryDate"),
    pharmacy_id: document.getElementById("deliveryPharmacy").value,
    product_id: line.product_id,
    quantity_sent: line.quantity_sent,
    notes: textValue("deliveryNotes"),
  })));
  saveData();
  event.target.reset();
  resetDeliveryLines();
  setDefaultDates();
  renderAll();
}

function saveSale(event) {
  event.preventDefault();
  const lines = [...document.querySelectorAll(".sales-line")].map((line) => ({
    product_id: line.querySelector(".sales-product").value,
    quantity_sold: Number(line.querySelector(".sales-quantity").value || 0),
  }));
  if (lines.some((line) => !line.product_id || line.quantity_sold <= 0)) return alert("Choose a product and quantity more than 0 for each line.");
  data.sales.push(...lines.map((line) => ({
    sales_id: makeId("sales"),
    date: textValue("salesDate"),
    pharmacy_id: document.getElementById("salesPharmacy").value,
    product_id: line.product_id,
    quantity_sold: line.quantity_sold,
    notes: textValue("salesNotes"),
  })));
  saveData();
  event.target.reset();
  resetSalesLines();
  setDefaultDates();
  renderAll();
}

function savePayment(event) {
  event.preventDefault();
  const amount = numberValue("amountPaid");
  if (amount <= 0) return alert("Payment amount must be more than 0.");
  data.payments.push({
    payment_id: makeId("payment"),
    date: textValue("paymentDate"),
    pharmacy_id: document.getElementById("paymentPharmacy").value,
    amount_paid: amount,
    notes: textValue("paymentNotes"),
  });
  saveData();
  event.target.reset();
  setDefaultDates();
  renderAll();
}

function upsert(rows, idKey, item) {
  const index = rows.findIndex((row) => row[idKey] === item[idKey]);
  if (index >= 0) rows[index] = item;
  else rows.push(item);
}

function editProduct(id) {
  const item = data.products.find((row) => row.product_id === id);
  if (!item) return;
  document.getElementById("productEditId").value = item.product_id;
  document.getElementById("productName").value = item.product_name;
  document.getElementById("supplierName").value = item.supplier_name;
  document.getElementById("purchasePrice").value = item.purchase_price;
  document.getElementById("sellingPrice").value = item.selling_price;
  document.getElementById("productNotes").value = item.notes;
  document.getElementById("productSubmit").textContent = "Update product";
  document.getElementById("cancelProductEdit").hidden = false;
}

function editPharmacy(id) {
  const item = data.pharmacies.find((row) => row.pharmacy_id === id);
  if (!item) return;
  document.getElementById("pharmacyEditId").value = item.pharmacy_id;
  document.getElementById("pharmacyName").value = item.pharmacy_name;
  document.getElementById("pharmacyAddress").value = item.address;
  document.getElementById("contactPerson").value = item.contact_person;
  document.getElementById("phoneNumber").value = item.phone_number;
  document.getElementById("pharmacyNotes").value = item.notes;
  document.getElementById("pharmacySubmit").textContent = "Update pharmacy";
  document.getElementById("cancelPharmacyEdit").hidden = false;
}

function endProductEdit() {
  document.getElementById("productEditId").value = "";
  document.getElementById("productSubmit").textContent = "Save product";
  document.getElementById("cancelProductEdit").hidden = true;
}

function endPharmacyEdit() {
  document.getElementById("pharmacyEditId").value = "";
  document.getElementById("pharmacySubmit").textContent = "Save pharmacy";
  document.getElementById("cancelPharmacyEdit").hidden = true;
}

function deleteProduct(id) {
  const used = data.deliveries.some((row) => row.product_id === id) || data.sales.some((row) => row.product_id === id);
  if (used && !confirm("This product already has transactions. Delete it anyway? Reports will show it as deleted.")) return;
  data.products = data.products.filter((row) => row.product_id !== id);
  saveData();
  renderAll();
}

function deletePharmacy(id) {
  const used = [...data.deliveries, ...data.sales, ...data.payments].some((row) => row.pharmacy_id === id);
  if (used && !confirm("This pharmacy already has transactions. Delete it anyway? Reports will show it as deleted.")) return;
  data.pharmacies = data.pharmacies.filter((row) => row.pharmacy_id !== id);
  saveData();
  renderAll();
}

function deleteById(listName, idKey, id) {
  if (!confirm("Delete this record?")) return;
  data[listName] = data[listName].filter((row) => row[idKey] !== id);
  saveData();
  renderAll();
}

function exportBackup() {
  downloadJson(`herbal-consignment-backup-${today()}.json`, data);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = { ...emptyData(), ...JSON.parse(reader.result) };
      if (!Array.isArray(imported.products) || !Array.isArray(imported.pharmacies)) throw new Error("Bad backup");
      data = imported;
      saveData();
      renderAll();
      alert("Backup imported.");
    } catch {
      alert("Could not import this JSON backup.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function downloadJson(filename, value) {
  downloadFile(filename, JSON.stringify(value, null, 2), "application/json");
}

function exportCsv(filename, rows, columns) {
  const header = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => column.value(row)));
  downloadFile(filename, [header, ...body].map(csvLine).join("\n"), "text/csv");
}

function csvLine(values) {
  return values.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".page").forEach((page) => page.classList.remove("active-page"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active-page");
    });
  });

  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("pharmacyForm").addEventListener("submit", savePharmacy);
  document.getElementById("deliveryForm").addEventListener("submit", saveDelivery);
  document.getElementById("salesForm").addEventListener("submit", saveSale);
  document.getElementById("paymentForm").addEventListener("submit", savePayment);
  document.getElementById("addDeliveryLine").addEventListener("click", addDeliveryLine);
  document.getElementById("addSalesLine").addEventListener("click", addSalesLine);
  document.getElementById("cancelProductEdit").addEventListener("click", () => {
    document.getElementById("productForm").reset();
    endProductEdit();
  });
  document.getElementById("cancelPharmacyEdit").addEventListener("click", () => {
    document.getElementById("pharmacyForm").reset();
    endPharmacyEdit();
  });

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (target.dataset.editProduct) editProduct(target.dataset.editProduct);
    if (target.dataset.deleteProduct) deleteProduct(target.dataset.deleteProduct);
    if (target.dataset.editPharmacy) editPharmacy(target.dataset.editPharmacy);
    if (target.dataset.deletePharmacy) deletePharmacy(target.dataset.deletePharmacy);
    if ("removeDeliveryLine" in target.dataset) {
      target.closest(".delivery-line").remove();
      updateDeliveryLineButtons();
    }
    if ("removeSalesLine" in target.dataset) {
      target.closest(".sales-line").remove();
      updateSalesLineButtons();
    }
    if (target.dataset.deleteDelivery) deleteById("deliveries", "delivery_id", target.dataset.deleteDelivery);
    if (target.dataset.deleteSale) deleteById("sales", "sales_id", target.dataset.deleteSale);
    if (target.dataset.deletePayment) deleteById("payments", "payment_id", target.dataset.deletePayment);
  });

  document.getElementById("exportBackup").addEventListener("click", exportBackup);
  document.getElementById("importBackup").addEventListener("change", importBackup);
  document.getElementById("reportStartDate").addEventListener("change", renderAll);
  document.getElementById("reportEndDate").addEventListener("change", renderAll);
  document.getElementById("clearReportDates").addEventListener("click", () => {
    document.getElementById("reportStartDate").value = "";
    document.getElementById("reportEndDate").value = "";
    renderAll();
  });
  document.getElementById("exportStockCsv").addEventListener("click", () => {
    exportCsv(`stock-report-${today()}.csv`, stockReportRows(), [
      { label: "Pharmacy", value: (row) => row.pharmacy },
      { label: "Product", value: (row) => row.product },
      { label: "Total sent", value: (row) => row.sent },
      { label: "Total sold", value: (row) => row.sold },
      { label: "Remaining", value: (row) => row.remaining },
      { label: "Total omzet", value: (row) => row.omzet },
      { label: "Total profit", value: (row) => row.profit },
    ]);
  });
  document.getElementById("exportBalanceCsv").addEventListener("click", () => {
    exportCsv(`balance-report-${today()}.csv`, balanceReportRows(), [
      { label: "Pharmacy", value: (row) => row.pharmacy },
      { label: "Total omzet", value: (row) => row.omzet },
      { label: "Payment received", value: (row) => row.paid },
      { label: "Unpaid balance", value: (row) => row.balance },
    ]);
  });
}

wireEvents();
setDefaultDates();
updateDeliveryLineButtons();
updateSalesLineButtons();
renderAll();
