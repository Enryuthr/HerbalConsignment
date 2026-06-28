export const emptyData = () => ({
  products: [],
  pharmacies: [],
  deliveryBatches: [],
  deliveryItems: [],
  salesReports: [],
  salesItems: [],
  payments: [],
  expenses: [],
});

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function makeCode(prefix, rows) {
  const max = Math.max(0, ...rows.map((row) => Number(String(row.code || "").match(new RegExp(`^${prefix}(\\d+)$`))?.[1] || 0)));
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function normalizeData(data) {
  return {
    products: (data.products || []).map((row) => ({
      ...row,
      purchase_price: Number(row.purchase_price || 0),
      selling_price: Number(row.selling_price || 0),
    })),
    pharmacies: data.pharmacies || [],
    deliveryBatches: data.deliveryBatches || [],
    deliveryItems: (data.deliveryItems || []).map((row) => ({ ...row, quantity_sent: Number(row.quantity_sent || 0) })),
    salesReports: data.salesReports || [],
    salesItems: (data.salesItems || []).map((row) => ({ ...row, quantity_sold: Number(row.quantity_sold || 0) })),
    payments: (data.payments || []).map((row) => ({ ...row, amount_paid: Number(row.amount_paid || 0) })),
    expenses: (data.expenses || []).map((row) => ({ ...row, amount: Number(row.amount || 0) })),
  };
}

export function productById(data, id) {
  return data.products.find((row) => row.id === id);
}

export function pharmacyById(data, id) {
  return data.pharmacies.find((row) => row.id === id);
}

export function productName(data, id) {
  const item = productById(data, id);
  return item ? item.name : "Deleted product";
}

export function pharmacyName(data, id) {
  const item = pharmacyById(data, id);
  return item ? item.name : "Deleted pharmacy";
}

export function dateInRange(date, filters = {}) {
  if (filters.month) return date <= `${filters.month}-31`;
  return (!filters.startDate || date >= filters.startDate) && (!filters.endDate || date <= filters.endDate);
}

export function deliveries(data) {
  return data.deliveryItems.map((item) => {
    const batch = data.deliveryBatches.find((row) => row.id === item.batch_id) || {};
    return { ...item, date: batch.date, pharmacy_id: batch.pharmacy_id, notes: batch.notes };
  });
}

export function sales(data) {
  return data.salesItems.map((item) => {
    const report = data.salesReports.find((row) => row.id === item.report_id) || {};
    return { ...item, date: report.date, pharmacy_id: report.pharmacy_id, notes: report.notes };
  });
}

export function saleOmzet(data, sale) {
  return sale.quantity_sold * (productById(data, sale.product_id)?.selling_price || 0);
}

export function saleProfit(data, sale) {
  const product = productById(data, sale.product_id);
  return sale.quantity_sold * ((product?.selling_price || 0) - (product?.purchase_price || 0));
}

export function stockReportRows(rawData, filters = {}, filterPharmacy = true) {
  const data = normalizeData(rawData);
  const rows = filters.month ? monthlyStockReportRows(data, filters.month) : allTimeStockReportRows(data, filters);
  return rows
    .filter((row) => !filterPharmacy || !filters.pharmacyId || row.pharmacy_id === filters.pharmacyId)
    .sort((a, b) => a.pharmacy.localeCompare(b.pharmacy) || a.product.localeCompare(b.product));
}

function allTimeStockReportRows(data, filters) {
  const rows = new Map();
  deliveries(data).filter((item) => dateInRange(item.date, filters)).forEach((item) => {
    getStockRow(data, rows, item.pharmacy_id, item.product_id).sent += item.quantity_sent;
  });
  sales(data).filter((item) => dateInRange(item.date, filters)).forEach((item) => {
    const row = getStockRow(data, rows, item.pharmacy_id, item.product_id);
    row.sold += item.quantity_sold;
    row.omzet += saleOmzet(data, item);
    row.profit += saleProfit(data, item);
  });
  return [...rows.values()].map((row) => withMoney(data, row));
}

export function monthlyStockReportRows(data, month) {
  const rows = new Map();
  const start = `${month}-01`;
  const end = `${month}-31`;
  deliveries(data).filter((item) => item.date <= end).forEach((item) => {
    const row = getStockRow(data, rows, item.pharmacy_id, item.product_id);
    if (item.date < start) row.last_stock += item.quantity_sent;
    else row.sent += item.quantity_sent;
  });
  sales(data).filter((item) => item.date <= end).forEach((item) => {
    const row = getStockRow(data, rows, item.pharmacy_id, item.product_id);
    if (item.date < start) row.last_stock -= item.quantity_sold;
    else {
      row.sold += item.quantity_sold;
      row.omzet += saleOmzet(data, item);
      row.profit += saleProfit(data, item);
    }
  });
  return [...rows.values()].map((row) => withMoney(data, row)).filter((row) => row.last_stock || row.sent || row.sold);
}

function getStockRow(data, rows, pharmacy_id, product_id) {
  const key = `${pharmacy_id}|${product_id}`;
  if (!rows.has(key)) {
    rows.set(key, {
      pharmacy_id,
      product_id,
      pharmacy: pharmacyName(data, pharmacy_id),
      product: productName(data, product_id),
      last_stock: 0,
      sent: 0,
      sold: 0,
      remaining: 0,
      inventory_value: 0,
      omzet: 0,
      modal: 0,
      modal_delivered: 0,
      modal_sold: 0,
      modal_remaining: 0,
      profit: 0,
    });
  }
  return rows.get(key);
}

function withMoney(data, row) {
  const product = productById(data, row.product_id);
  const purchasePrice = product?.purchase_price || 0;
  const sellingPrice = product?.selling_price || 0;
  const remaining = row.last_stock + row.sent - row.sold;
  return {
    ...row,
    remaining,
    modal: (row.last_stock + row.sent) * purchasePrice,
    modal_delivered: row.sent * purchasePrice,
    modal_sold: row.sold * purchasePrice,
    modal_remaining: remaining * purchasePrice,
    inventory_value: remaining * sellingPrice,
  };
}

export function balanceReportRows(data, filters = {}, filterPharmacy = true) {
  const rows = new Map();
  data.pharmacies.forEach((item) => rows.set(item.id, balanceRow(data, item.id)));
  stockReportRows(data, filters, filterPharmacy).forEach((item) => {
    const row = getBalanceRow(data, rows, item.pharmacy_id);
    row.inventory_value += item.inventory_value;
    row.modal += item.modal;
    row.modal_delivered += item.modal_delivered;
    row.modal_sold += item.modal_sold;
    row.modal_remaining += item.modal_remaining;
  });
  sales(normalizeData(data)).filter((item) => dateInRange(item.date, filters)).forEach((item) => {
    getBalanceRow(data, rows, item.pharmacy_id).omzet += saleOmzet(data, item);
  });
  data.payments.filter((item) => dateInRange(item.date, filters)).forEach((item) => {
    getBalanceRow(data, rows, item.pharmacy_id).paid += Number(item.amount_paid || 0);
  });
  return [...rows.values()]
    .map((row) => ({ ...row, balance: row.omzet - row.paid }))
    .filter((row) => !filterPharmacy || !filters.pharmacyId || row.pharmacy_id === filters.pharmacyId)
    .filter((row) => row.inventory_value || row.omzet || row.modal || row.modal_delivered || row.modal_sold || row.modal_remaining || row.paid || data.pharmacies.some((p) => p.id === row.pharmacy_id))
    .sort((a, b) => a.pharmacy.localeCompare(b.pharmacy));
}

function balanceRow(data, pharmacy_id) {
  return { pharmacy_id, pharmacy: pharmacyName(data, pharmacy_id), inventory_value: 0, omzet: 0, modal: 0, modal_delivered: 0, modal_sold: 0, modal_remaining: 0, paid: 0 };
}

function getBalanceRow(data, rows, pharmacy_id) {
  if (!rows.has(pharmacy_id)) rows.set(pharmacy_id, balanceRow(data, pharmacy_id));
  return rows.get(pharmacy_id);
}

export function totalExpenses(data, filters = {}) {
  return normalizeData(data).expenses.filter((item) => dateInRange(item.date, filters)).reduce((total, item) => total + item.amount, 0);
}

export function totals(data, filters = {}) {
  const stockRows = stockReportRows(data, filters, false);
  const balanceRows = balanceReportRows(data, filters, false);
  const expenses = totalExpenses(data, filters);
  return {
    sent: sum(stockRows, "sent"),
    sold: sum(stockRows, "sold"),
    remaining: sum(stockRows, "remaining"),
    inventory_value: sum(stockRows, "inventory_value"),
    omzet: sum(stockRows, "omzet"),
    modal: sum(stockRows, "modal"),
    modal_delivered: sum(stockRows, "modal_delivered"),
    modal_sold: sum(stockRows, "modal_sold"),
    modal_remaining: sum(stockRows, "modal_remaining"),
    gross_profit: sum(stockRows, "profit"),
    paid: sum(balanceRows, "paid"),
    expenses,
    profit: sum(stockRows, "profit") - expenses,
    unpaid: sum(balanceRows, "balance"),
    cash_earned: sum(balanceRows, "paid") - sum(stockRows, "modal_sold") - expenses,
  };
}

export function dashboardInsight(data, filters = {}, type = "topProducts") {
  const stockRows = stockReportRows(data, filters, false);
  const saleRows = sales(normalizeData(data)).filter((item) => dateInRange(item.date, filters));
  const insights = {
    topProducts: () => countBy(saleRows, "product_id", (id) => productName(data, id), "quantity_sold"),
    lowStock: () => stockRows.filter((row) => row.remaining > 0 && row.remaining <= 5).sort((a, b) => a.remaining - b.remaining).slice(0, 10).map((row) => ({ label: `${row.product} (${row.pharmacy})`, value: row.remaining })),
    topUnpaid: () => balanceReportRows(data, filters, false).filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 10).map((row) => ({ label: row.pharmacy, value: row.balance })),
    monthlyOmzet: () => monthlyOmzetTrend(data),
    expenseBreakdown: () => expenseBreakdown(data, filters),
    bestPharmacy: () => sumBy(saleRows, "pharmacy_id", (id) => pharmacyName(data, id), (row) => saleOmzet(data, row)),
    slowMoving: () => stockRows.filter((row) => row.remaining > 0 && row.sold === 0).sort((a, b) => b.remaining - a.remaining).slice(0, 10).map((row) => ({ label: `${row.product} (${row.pharmacy})`, value: row.remaining })),
  };
  return (insights[type] || insights.topProducts)();
}

function countBy(rows, key, label, valueKey) {
  return sumBy(rows, key, label, (row) => Number(row[valueKey] || 0));
}

function sumBy(rows, key, label, value) {
  const totals = new Map();
  rows.forEach((row) => totals.set(row[key], (totals.get(row[key]) || 0) + value(row)));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, total]) => ({ label: label(id), value: total }));
}

function monthlyOmzetTrend(data) {
  const rows = new Map();
  sales(normalizeData(data)).forEach((sale) => rows.set(sale.date.slice(0, 7), (rows.get(sale.date.slice(0, 7)) || 0) + saleOmzet(data, sale)));
  return [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([label, value]) => ({ label, value }));
}

function expenseBreakdown(data, filters) {
  const rows = new Map();
  normalizeData(data).expenses.filter((item) => dateInRange(item.date, filters)).forEach((item) => rows.set(item.category, (rows.get(item.category) || 0) + item.amount));
  return [...rows.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

export function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}
