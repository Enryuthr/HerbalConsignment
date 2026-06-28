import assert from "node:assert/strict";
import { balanceReportRows, stockReportRows, totals } from "../src/reports.js";

const data = {
  products: [{ id: "p1", code: "P001", name: "Oil", purchase_price: 10000, selling_price: 15000 }],
  pharmacies: [{ id: "ph1", code: "PH001", name: "Benwaras" }],
  deliveryBatches: [
    { id: "db1", code: "DB001", date: "2026-05-20", pharmacy_id: "ph1" },
    { id: "db2", code: "DB002", date: "2026-06-02", pharmacy_id: "ph1" },
  ],
  deliveryItems: [
    { id: "di1", batch_id: "db1", product_id: "p1", quantity_sent: 10 },
    { id: "di2", batch_id: "db2", product_id: "p1", quantity_sent: 5 },
  ],
  salesReports: [
    { id: "sr1", code: "S001", date: "2026-05-25", pharmacy_id: "ph1" },
    { id: "sr2", code: "S002", date: "2026-06-10", pharmacy_id: "ph1" },
  ],
  salesItems: [
    { id: "si1", report_id: "sr1", product_id: "p1", quantity_sold: 2 },
    { id: "si2", report_id: "sr2", product_id: "p1", quantity_sold: 4 },
  ],
  payments: [{ id: "pay1", code: "PAY001", date: "2026-06-12", pharmacy_id: "ph1", amount_paid: 30000 }],
  expenses: [{ id: "e1", code: "E001", date: "2026-06-03", category: "Gasoline", amount: 5000 }],
};

const filters = { month: "2026-06" };
const stock = stockReportRows(data, filters)[0];
const total = totals(data, filters);
const balance = balanceReportRows(data, filters)[0];

assert.equal(stock.last_stock, 8);
assert.equal(stock.sent, 5);
assert.equal(stock.sold, 4);
assert.equal(stock.remaining, 9);
assert.equal(stock.modal, 130000);
assert.equal(stock.modal_delivered, 50000);
assert.equal(stock.modal_sold, 40000);
assert.equal(stock.modal_remaining, 90000);
assert.equal(total.gross_profit, 20000);
assert.equal(total.paid, 30000);
assert.equal(total.expenses, 5000);
assert.equal(total.profit, 15000);
assert.equal(total.cash_earned, -15000);
assert.equal(balance.balance, 60000);

console.log("report tests passed");
