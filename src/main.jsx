import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { hasSupabaseConfig, supabase } from "./supabase.js";
import {
  balanceReportRows,
  dashboardInsight,
  deliveries,
  emptyData,
  makeCode,
  normalizeData,
  pharmacyName,
  productName,
  sales,
  stockReportRows,
  today,
  totals,
} from "./reports.js";
import "../styles.css";

const STORAGE_KEY = "herbal_consignment_v1";
const APP_VERSION = "2026-06-25.2";
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const tabs = ["Dashboard", "Products", "Pharmacies", "Deliveries", "Sales", "Payments", "Expenses", "Reports", "Backup"];
const insightLabels = {
  topProducts: "Top selling products",
  lowStock: "Low stock products",
  topUnpaid: "Top unpaid pharmacies",
  monthlyOmzet: "Monthly omzet trend",
  expenseBreakdown: "Expense breakdown",
  bestPharmacy: "Best pharmacy",
  slowMoving: "Slow moving stock",
};

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig) return <SetupMissing />;
  if (!authReady) return <ShellMessage title="Loading" text="Checking login..." />;
  if (!session) return <AuthScreen />;
  return <Tracker user={session.user} />;
}

function Tracker({ user }) {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [data, setData] = useState(emptyData());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({ month: today().slice(0, 7), pharmacyId: "", startDate: "", endDate: "" });
  const [insight, setInsight] = useState("topProducts");

  async function refresh() {
    setLoading(true);
    try {
      setData(normalizeData(await loadAll()));
      setLoadError("");
    } catch (error) {
      setLoadError(friendlySupabaseError(error));
      toast(setMessage, error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const hasData = Object.values(data).some((rows) => rows.length);
  const localBackup = getLocalBackup();

  async function run(action, success = "Saved.") {
    try {
      const value = await action();
      await refresh();
      toast(setMessage, success);
      return { ok: true, value };
    } catch (error) {
      toast(setMessage, error.message);
      return { ok: false, error };
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <h1>Herbal Consignment</h1>
          <p>{user.email}</p>
        </div>
        <nav>
          {tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </nav>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </aside>
      <main className="content">
        <div className="topbar">
          <div>
            <h2>{activeTab}</h2>
            <p>{loading ? "Loading data..." : `${hasData ? "Synced with Supabase" : "No records yet"}`}</p>
          </div>
          {message && <span className="toast">{message}</span>}
        </div>
        {loadError && <section className="error-panel"><strong>Supabase load failed.</strong><span>{loadError}</span></section>}
        {!hasData && localBackup && <ImportPrompt onImport={() => run(() => importLegacy(localBackup, user.id), "Browser data imported.")} />}
        <section className="tab-page" hidden={activeTab !== "Dashboard"}><Dashboard data={data} filters={filters} setFilters={setFilters} insight={insight} setInsight={setInsight} /></section>
        <section className="tab-page" hidden={activeTab !== "Products"}><Products data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Pharmacies"}><Pharmacies data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Deliveries"}><Deliveries data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Sales"}><Sales data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Payments"}><Payments data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Expenses"}><Expenses data={data} run={run} userId={user.id} /></section>
        <section className="tab-page" hidden={activeTab !== "Reports"}><Reports data={data} filters={filters} setFilters={setFilters} /></section>
        <section className="tab-page" hidden={activeTab !== "Backup"}><Backup data={data} run={run} userId={user.id} /></section>
      </main>
    </div>
  );
}

function Dashboard({ data, filters, setFilters, insight, setInsight }) {
  const t = totals(data, filters);
  const rows = dashboardInsight(data, filters, insight);
  const max = Math.max(1, ...rows.map((row) => row.value));
  const cards = [
    [filters.month ? "Stock sent this month" : "Total stock sent", t.sent],
    [filters.month ? "Sold this month" : "Total quantity sold", t.sold],
    ["Total remaining stock", t.remaining],
    ["Inventory selling value", money.format(t.inventory_value)],
    ["Total omzet", money.format(t.omzet)],
    ["Total modal", money.format(t.modal)],
    ["Modal delivered", money.format(t.modal_delivered)],
    ["Modal sold", money.format(t.modal_sold)],
    ["Modal remaining", money.format(t.modal_remaining)],
    ["Gross profit", money.format(t.gross_profit)],
    ["Total expenses", money.format(t.expenses)],
    ["Net profit", money.format(t.profit)],
    ["Cash earned", money.format(t.cash_earned)],
    ["Total unpaid balance", money.format(t.unpaid)],
  ];
  return (
    <>
      <MonthFilter filters={filters} setFilters={setFilters} />
      <section className="cards">{cards.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</section>
      <section className="panel">
        <div className="section-head">
          <h3>{insightLabels[insight]}</h3>
          <select value={insight} onChange={(event) => setInsight(event.target.value)}>
            {Object.entries(insightLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="bars">
          {rows.length ? rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <span>{row.label}</span>
              <div className="bar-track"><div style={{ width: `${(row.value / max) * 100}%` }} /></div>
              <strong>{insight.includes("Unpaid") || ["topUnpaid", "monthlyOmzet", "expenseBreakdown", "bestPharmacy"].includes(insight) ? money.format(row.value) : row.value}</strong>
            </div>
          )) : <p className="muted">No data yet.</p>}
        </div>
      </section>
    </>
  );
}

function Products({ data, run, userId }) {
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState(null);
  const rows = data.products.filter((row) => includes(row, query)).sort(byName);
  return (
    <CrudPage
      title="Product Master"
      search="Search product or supplier"
      query={query}
      setQuery={setQuery}
      form={<ProductForm data={data} edit={edit} clear={() => setEdit(null)} onSave={(item) => run(() => saveProduct(item, userId), "Product saved.")} />}
      table={<Table headers={["ID", "Product", "Supplier", "Modal", "Selling", "Notes", "Action"]} rows={rows} render={(row) => [
        row.code, row.name, row.supplier_name, money.format(row.purchase_price), money.format(row.selling_price), row.notes,
        <RowActions onEdit={() => setEdit(row)} onDelete={() => run(() => removeProduct(row.id), "Product deleted.")} />,
      ]} />}
    />
  );
}

function ProductForm({ data, edit, clear, onSave }) {
  const [form, setForm] = useState(blankProduct(data));
  const [saving, submit] = useSubmitLock();
  useEffect(() => setForm(edit || blankProduct(data)), [edit, data.products.length]);
  function cancel() {
    setForm(blankProduct(data));
    clear?.();
  }
  async function save() {
    if (edit && form.pharmacy_id !== edit.pharmacy_id) {
      const from = pharmacyName(data, edit.pharmacy_id);
      const to = pharmacyName(data, form.pharmacy_id);
      if (!confirm(`Move this whole delivery from ${from} to ${to}?`)) return { ok: false };
    }
    return onSave(form);
  }
  return <FormGrid onSubmit={() => submit(save, cancel)}>
    <Field label="Product name" value={form.name} set={(name) => setForm({ ...form, name })} required />
    <Field label="Supplier" value={form.supplier_name} set={(supplier_name) => setForm({ ...form, supplier_name })} />
    <Field label="Purchase price / modal" type="number" value={form.purchase_price} set={(purchase_price) => setForm({ ...form, purchase_price })} required />
    <Field label="Selling price" type="number" value={form.selling_price} set={(selling_price) => setForm({ ...form, selling_price })} required />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions editing={Boolean(edit)} clear={cancel} disabled={saving} />
  </FormGrid>;
}

function Pharmacies({ data, run, userId }) {
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState(null);
  const rows = data.pharmacies.filter((row) => includes(row, query)).sort(byName);
  return (
    <CrudPage
      title="Pharmacy Master"
      search="Search pharmacy, contact, or phone"
      query={query}
      setQuery={setQuery}
      form={<PharmacyForm data={data} edit={edit} clear={() => setEdit(null)} onSave={(item) => run(() => savePharmacy(item, userId), "Pharmacy saved.")} />}
      table={<Table headers={["ID", "Pharmacy", "Address", "Contact", "Phone", "Notes", "Action"]} rows={rows} render={(row) => [
        row.code, row.name, row.address, row.contact_person, row.phone_number, row.notes,
        <RowActions onEdit={() => setEdit(row)} onDelete={() => run(() => removePharmacy(row.id), "Pharmacy deleted.")} />,
      ]} />}
    />
  );
}

function PharmacyForm({ data, edit, clear, onSave }) {
  const [form, setForm] = useState(blankPharmacy(data));
  const [saving, submit] = useSubmitLock();
  useEffect(() => setForm(edit || blankPharmacy(data)), [edit, data.pharmacies.length]);
  function cancel() {
    setForm(blankPharmacy(data));
    clear?.();
  }
  return <FormGrid onSubmit={() => submit(() => onSave(form), cancel)}>
    <Field label="Pharmacy name" value={form.name} set={(name) => setForm({ ...form, name })} required />
    <Field label="Contact person" value={form.contact_person} set={(contact_person) => setForm({ ...form, contact_person })} />
    <Field label="Phone number" value={form.phone_number} set={(phone_number) => setForm({ ...form, phone_number })} />
    <Field label="Address" value={form.address} set={(address) => setForm({ ...form, address })} wide textarea />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions editing={Boolean(edit)} clear={cancel} disabled={saving} />
  </FormGrid>;
}

function Deliveries({ data, run, userId }) {
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState(null);
  const rows = data.deliveryBatches
    .filter((row) => !filter || row.pharmacy_id === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <CrudPage
      title="Consignment Delivery"
      form={<DeliveryForm data={data} edit={edit} clear={() => setEdit(null)} onSave={(item) => run(() => saveDelivery(item, userId), "Delivery saved.")} />}
      filter={<Lookup label="Filter deliveries by pharmacy" value={filter} set={setFilter} options={data.pharmacies} placeholder="All pharmacies" />}
      table={<Table headers={["Date", "Pharmacy", "Products sent", "Notes", "Action"]} rows={rows} render={(row) => [
        row.date,
        pharmacyName(data, row.pharmacy_id),
        <ItemList items={deliveryItemsForBatch(data, row.id).map((item) => `${productName(data, item.product_id)}: ${item.quantity_sent}`)} />,
        row.notes,
        <RowActions onEdit={() => setEdit(row)} onDelete={() => run(() => removeDelivery(row.id), "Delivery deleted.")} />,
      ]} />}
    />
  );
}

function DeliveryForm({ data, edit, clear, onSave }) {
  const [form, setForm] = useState(blankDelivery(data));
  const [saving, submit] = useSubmitLock();
  useEffect(() => {
    if (edit) setForm(deliveryForEdit(data, edit));
  }, [edit?.id]);
  function cancel() {
    setForm(blankDelivery(data));
    clear?.();
  }
  return <FormGrid onSubmit={() => submit(() => onSave(form), cancel)}>
    <Field label="Date" type="date" value={form.date} set={(date) => setForm({ ...form, date })} required />
    <Lookup label="Pharmacy" value={form.pharmacy_id} set={(pharmacy_id) => setForm({ ...form, pharmacy_id })} options={data.pharmacies} required />
    <Lines label="Products" rows={form.items} products={data.products} qtyKey="quantity_sent" set={(items) => setForm({ ...form, items })} />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions editing={Boolean(edit)} clear={cancel} disabled={saving} />
  </FormGrid>;
}

function Sales({ data, run, userId }) {
  const [filter, setFilter] = useState("");
  const saleRows = sales(data).filter((row) => !filter || row.pharmacy_id === filter).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <CrudPage
      title="Sales Report"
      form={<SaleForm data={data} onSave={(item) => run(() => saveSale(item, userId), "Sales report saved.")} />}
      filter={<Lookup label="Filter sales by pharmacy" value={filter} set={setFilter} options={data.pharmacies} placeholder="All pharmacies" />}
      table={<Table headers={["Date", "Pharmacy", "Product", "Qty sold", "Omzet", "Profit", "Notes", "Action"]} rows={saleRows} render={(row) => {
        const product = data.products.find((item) => item.id === row.product_id);
        return [row.date, pharmacyName(data, row.pharmacy_id), productName(data, row.product_id), row.quantity_sold, money.format(row.quantity_sold * (product?.selling_price || 0)), money.format(row.quantity_sold * ((product?.selling_price || 0) - (product?.purchase_price || 0))), row.notes, <button className="danger" onClick={() => run(() => removeSaleItem(row), "Sale deleted.")}>Delete</button>];
      }} />}
    />
  );
}

function SaleForm({ data, onSave }) {
  const [form, setForm] = useState(blankSale(data));
  const [saving, submit] = useSubmitLock();
  const products = form.pharmacy_id ? data.products.filter((product) => stockAt(data, form.pharmacy_id, product.id) > 0) : data.products;
  return <FormGrid onSubmit={() => submit(() => onSave(form), () => setForm(blankSale(data)))}>
    <Field label="Date" type="date" value={form.date} set={(date) => setForm({ ...form, date })} required />
    <Lookup label="Pharmacy" value={form.pharmacy_id} set={(pharmacy_id) => setForm({ ...form, pharmacy_id })} options={data.pharmacies} required />
    <Lines label="Products" rows={form.items} products={products} qtyKey="quantity_sold" set={(items) => setForm({ ...form, items })} />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions disabled={saving} />
  </FormGrid>;
}

function Payments({ data, run, userId }) {
  const rows = data.payments.sort((a, b) => b.date.localeCompare(a.date));
  return <CrudPage title="Payment Record" form={<PaymentForm data={data} onSave={(item) => run(() => savePayment(item, userId), "Payment saved.")} />} table={<Table headers={["Date", "Pharmacy", "Amount paid", "Notes", "Action"]} rows={rows} render={(row) => [row.date, pharmacyName(data, row.pharmacy_id), money.format(row.amount_paid), row.notes, <button className="danger" onClick={() => run(() => remove("payments", row.id, "payment"), "Payment deleted.")}>Delete</button>]} />} />;
}

function PaymentForm({ data, onSave }) {
  const [form, setForm] = useState(blankPayment(data));
  const [saving, submit] = useSubmitLock();
  return <FormGrid onSubmit={() => submit(() => onSave(form), () => setForm(blankPayment(data)))}>
    <Field label="Date" type="date" value={form.date} set={(date) => setForm({ ...form, date })} required />
    <Lookup label="Pharmacy" value={form.pharmacy_id} set={(pharmacy_id) => setForm({ ...form, pharmacy_id })} options={data.pharmacies} required />
    <Field label="Amount paid" type="number" value={form.amount_paid} set={(amount_paid) => setForm({ ...form, amount_paid })} required />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions disabled={saving} />
  </FormGrid>;
}

function Expenses({ data, run, userId }) {
  const rows = data.expenses.sort((a, b) => b.date.localeCompare(a.date));
  return <CrudPage title="Expense Record" form={<ExpenseForm data={data} onSave={(item) => run(() => saveExpense(item, userId), "Expense saved.")} />} table={<Table headers={["Date", "Category", "Amount", "Notes", "Action"]} rows={rows} render={(row) => [row.date, row.category, money.format(row.amount), row.notes, <button className="danger" onClick={() => run(() => remove("expenses", row.id, "expense"), "Expense deleted.")}>Delete</button>]} />} />;
}

function ExpenseForm({ data, onSave }) {
  const [form, setForm] = useState(blankExpense(data));
  const [saving, submit] = useSubmitLock();
  return <FormGrid onSubmit={() => submit(() => onSave(form), () => setForm(blankExpense(data)))}>
    <Field label="Date" type="date" value={form.date} set={(date) => setForm({ ...form, date })} required />
    <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="">Choose category</option><option>Gasoline</option><option>Hospitality</option><option>Food & Drink</option></select></label>
    <Field label="Amount" type="number" value={form.amount} set={(amount) => setForm({ ...form, amount })} required />
    <Field label="Notes" value={form.notes} set={(notes) => setForm({ ...form, notes })} wide textarea />
    <Actions disabled={saving} />
  </FormGrid>;
}

function Reports({ data, filters, setFilters }) {
  const stockRows = stockReportRows(data, filters);
  const balanceRows = balanceReportRows(data, filters);
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h3>Stock and Balance Report</h3>
          <div className="inline">
            <button onClick={() => exportCsv("stock-report", stockRows, ["pharmacy", "product", "last_stock", "sent", "sold", "remaining", "inventory_value", "omzet", "modal", "modal_delivered", "modal_sold", "modal_remaining", "profit"])}>Stock CSV</button>
            <button onClick={() => exportCsv("balance-report", balanceRows, ["pharmacy", "inventory_value", "omzet", "modal", "modal_delivered", "modal_sold", "modal_remaining", "paid", "balance"])}>Balance CSV</button>
          </div>
        </div>
        <div className="filters">
          <MonthFilter filters={filters} setFilters={setFilters} />
          <Lookup label="Pharmacy" value={filters.pharmacyId} set={(pharmacyId) => setFilters({ ...filters, pharmacyId })} options={data.pharmacies} placeholder="All pharmacies" />
          <Field label="From date" type="date" value={filters.startDate} set={(startDate) => setFilters({ ...filters, month: "", startDate })} />
          <Field label="To date" type="date" value={filters.endDate} set={(endDate) => setFilters({ ...filters, month: "", endDate })} />
          <button className="secondary" onClick={() => setFilters({ month: "", pharmacyId: "", startDate: "", endDate: "" })}>Clear</button>
        </div>
      </section>
      <h3>Stock per Pharmacy and Product</h3>
      <Table headers={["Pharmacy", "Product", "Last stock", "Total sent", "Total sold", "Remaining", "Inventory value", "Total omzet", "Total modal", "Modal delivered", "Modal sold", "Modal remaining", "Total profit"]} rows={stockRows} render={(row) => [row.pharmacy, row.product, row.last_stock, row.sent, row.sold, row.remaining, money.format(row.inventory_value), money.format(row.omzet), money.format(row.modal), money.format(row.modal_delivered), money.format(row.modal_sold), money.format(row.modal_remaining), money.format(row.profit)]} />
      <h3>Pharmacy Balance</h3>
      <Table headers={["Pharmacy", "Inventory value", "Total omzet", "Total modal", "Modal delivered", "Modal sold", "Modal remaining", "Payment received", "Unpaid balance"]} rows={balanceRows} render={(row) => [row.pharmacy, money.format(row.inventory_value), money.format(row.omzet), money.format(row.modal), money.format(row.modal_delivered), money.format(row.modal_sold), money.format(row.modal_remaining), money.format(row.paid), money.format(row.balance)]} />
    </>
  );
}

function Backup({ data, run, userId }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [csvType, setCsvType] = useState("deliveries");
  const deliveryAudit = data.deliveryBatches
    .map((batch) => {
      const items = data.deliveryItems.filter((item) => item.batch_id === batch.id);
      const pharmacy = data.pharmacies.find((row) => row.id === batch.pharmacy_id);
      return {
        id: batch.id,
        code: batch.code,
        date: batch.date,
        pharmacyCode: pharmacy?.code || "missing",
        pharmacy: pharmacy?.name || "Deleted pharmacy",
        items: items.length,
        quantity: items.reduce((total, item) => total + Number(item.quantity_sent || 0), 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const duplicatePharmacies = duplicateNames(data.pharmacies);
  function onFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    setBusy(true);
    setStatus(`Reading ${file.name}...`);
    reader.onerror = () => {
      setBusy(false);
      setStatus("Could not read this file.");
    };
    reader.onload = async () => {
      try {
        const legacy = JSON.parse(reader.result);
        const count = backupCount(legacy);
        if (!count) throw new Error("This JSON does not look like a Herbal Consignment backup.");
        setStatus(`Importing ${count} records...`);
        const result = await run(() => importLegacy(legacy, userId), "Backup imported.");
        const skipped = result.value?.skipped?.length || 0;
        setStatus(result.ok
          ? `Imported ${count - skipped} records${skipped ? `, skipped ${skipped} broken demo/missing-reference rows` : ""}. Check Products, Pharmacies, Deliveries, Sales, Payments, and Expenses.`
          : `Import failed: ${result.error.message}`);
      } catch (error) {
        setStatus(`Import failed: ${error.message}`);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }
  async function clearData() {
    if (prompt("Type DELETE to clear all Supabase data before re-importing.") !== "DELETE") return;
    setBusy(true);
    setStatus("Clearing Supabase data...");
    const result = await run(() => clearAllData(userId), "All Supabase data cleared.");
    setStatus(result.ok ? "Cleared. Import your JSON once." : `Clear failed: ${result.error.message}`);
    setBusy(false);
  }
  return <section className="panel">
    <h3>Backup</h3>
    <div className="inline">
      <button onClick={() => downloadJson(`herbal-consignment-backup-${today()}.json`, toLegacyBackup(data))}>Export JSON</button>
      <label className="compact-select">CSV data<select value={csvType} onChange={(event) => setCsvType(event.target.value)}>
        <option value="products">Products</option>
        <option value="pharmacies">Pharmacies</option>
        <option value="deliveries">Deliveries</option>
        <option value="sales">Sales</option>
        <option value="payments">Payments</option>
        <option value="expenses">Expenses</option>
      </select></label>
      <button onClick={() => exportBackupCsv(csvType, data)}>Export CSV</button>
      <label className={`file-button ${busy ? "disabled" : ""}`}>Import JSON<input type="file" accept="application/json,.json" onChange={onFile} disabled={busy} /></label>
      <button className="danger" onClick={clearData} disabled={busy}>Clear all Supabase data</button>
    </div>
    <p className="muted">Import keeps your old browser backup format and preserves readable IDs.</p>
    {status && <p className="import-status">{status}</p>}
    <details className="audit-box">
      <summary>Delivery backend audit: {data.deliveryBatches.length} batches / {data.deliveryItems.length} product lines</summary>
      {duplicatePharmacies.length > 0 && <p className="import-status">Duplicate pharmacy names found: {duplicatePharmacies.join(", ")}</p>}
      <div className="audit-list">
        {deliveryAudit.map((row) => <span key={row.id}>{row.date} - {row.pharmacyCode} {row.pharmacy} - {row.code}: {row.items} products, {row.quantity} total qty</span>)}
      </div>
    </details>
  </section>;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function resend() {
    if (!email) return setMessage("Enter your email first.");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setMessage(error ? error.message : "New confirmation email sent.");
  }
  async function submit(mode) {
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Check your email if confirmation is enabled, then sign in.");
  }
  return <ShellMessage title="Herbal Consignment" text="Sign in to sync your business data.">
    <div className="auth-card">
      <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="inline">
        <button onClick={() => submit("signin")}>Sign in</button>
        <button className="secondary" onClick={() => submit("signup")}>Create account</button>
        <button className="secondary" onClick={resend}>Resend confirmation</button>
      </div>
      {message && <p className="muted">{message}</p>}
      <small className="muted">Version {APP_VERSION}</small>
    </div>
  </ShellMessage>;
}

function SetupMissing() {
  return <ShellMessage title="Supabase setup needed" text="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env locally and to Vercel env vars." />;
}

function ShellMessage({ title, text, children }) {
  return <div className="center-screen"><section className="panel narrow"><h1>{title}</h1><p className="muted">{text}</p>{children}</section></div>;
}

function ImportPrompt({ onImport }) {
  return <section className="import-prompt"><strong>Browser data found.</strong><span>Import your old local records into Supabase.</span><button onClick={onImport}>Import browser data</button></section>;
}

function CrudPage({ title, form, table, search, query, setQuery, filter }) {
  return <>
    <section className="panel"><h3>{title}</h3>{form}</section>
    {(search || filter) && <section className="filters">{search && <Field label={search} type="search" value={query} set={setQuery} />}{filter}</section>}
    {table}
  </>;
}

function FormGrid({ children, onSubmit }) {
  return <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>{children}</form>;
}

function useSubmitLock() {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  async function submit(action, onSuccess) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await action();
      if (result?.ok) onSuccess?.(result);
      return result;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return [saving, submit];
}

function Field({ label, value, set, type = "text", required = false, wide = false, textarea = false }) {
  const Tag = textarea ? "textarea" : "input";
  return <label className={wide ? "wide" : ""}>{label}<Tag type={type} value={value || ""} onChange={(event) => set(event.target.value)} required={required} /></label>;
}

function Lookup({ label, value, set, options, placeholder = "Choose", required = false }) {
  const selectedRow = options.find((row) => row.id === value);
  const selected = selectedRow?.name || "";
  const [query, setQuery] = useState(selected);
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(selected), [selected]);
  const sorted = options.slice().sort(byName);
  const suggestions = sorted
    .filter((row) => matchesLookup(row, query))
    .slice(0, 8);
  function exactOption(text) {
    if (!text.trim()) return null;
    if (selectedRow && exactLookup(selectedRow, text)) return selectedRow;
    return sorted.find((row) => exactLookup(row, text));
  }
  function firstMatch(text) {
    if (!text.trim()) return null;
    return exactOption(text) || sorted.find((row) => startsLookup(row, text));
  }
  function choose(row) {
    set(row.id);
    setQuery(row.name);
    setOpen(false);
  }
  return <label className="lookup">{label}
    <input
      value={query}
      placeholder={placeholder}
      required={required}
      autoComplete="off"
      onFocus={() => setOpen(true)}
      onChange={(event) => {
        const text = event.target.value;
        setQuery(text);
        setOpen(true);
      }}
      onBlur={() => {
        const match = firstMatch(query);
        if (match) choose(match);
        else if (query.trim()) {
          if (required && selectedRow) setQuery(selected);
          else {
            set("");
            setQuery("");
          }
          setOpen(false);
        } else {
          set("");
          setQuery("");
          setOpen(false);
        }
      }}
    />
    {open && suggestions.length > 0 && <div className="lookup-options">
      {suggestions.map((row) => (
        <button type="button" key={row.id} onMouseDown={(event) => { event.preventDefault(); choose(row); }}><span>{row.name}</span>{row.code && <small>{row.code}</small>}</button>
      ))}
    </div>}
  </label>;
}

function lookupText(text) {
  return String(text || "").trim().toLowerCase();
}

function lookupLabel(row) {
  return row.code ? `${row.code} ${row.name}` : row.name;
}

function exactLookup(row, text) {
  const typed = lookupText(text);
  return [row.name, row.code, lookupLabel(row)].some((value) => lookupText(value) === typed);
}

function startsLookup(row, text) {
  const typed = lookupText(text);
  return [row.name, row.code, lookupLabel(row)].some((value) => lookupText(value).startsWith(typed));
}

function matchesLookup(row, text) {
  const typed = lookupText(text);
  return !typed || [row.name, row.code, lookupLabel(row)].some((value) => lookupText(value).includes(typed));
}

function Lines({ label, rows, products, qtyKey, set }) {
  function update(index, patch) {
    set(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }
  return <div className="wide line-box"><span>{label}</span>{rows.map((row, index) => (
    <div className="line" key={index}>
      <Lookup label="Product" value={row.product_id} set={(product_id) => update(index, { product_id })} options={products} required />
      <Field label="Quantity" type="number" value={row[qtyKey]} set={(value) => update(index, { [qtyKey]: value })} required />
      <button className="secondary" type="button" disabled={rows.length === 1} onClick={() => set(rows.filter((_row, i) => i !== index))}>Remove</button>
    </div>
  ))}<button className="secondary" type="button" onClick={() => set([...rows, { product_id: "", [qtyKey]: 1 }])}>Add product</button></div>;
}

function Actions({ editing, clear, disabled = false }) {
  const label = disabled ? "Saving..." : editing ? "Update" : "Save";
  return <div className="wide inline"><button type="submit" className={disabled ? "saving" : ""} disabled={disabled}>{label}</button>{editing && <button type="button" className="secondary" onClick={clear} disabled={disabled}>Cancel edit</button>}</div>;
}

function RowActions({ onEdit, onDelete }) {
  return <div className="inline"><button onClick={onEdit}>Edit</button><button className="danger" onClick={onDelete}>Delete</button></div>;
}

function Table({ headers, rows, render }) {
  return <div className="table-wrap"><table><thead><tr><th>#</th>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id || `${row.pharmacy_id}-${row.product_id}-${index}`}><td>{index + 1}</td>{render(row).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length + 1} className="empty">No data yet.</td></tr>}</tbody></table></div>;
}

function Metric({ label, value }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function MonthFilter({ filters, setFilters }) {
  return <label className="month-filter">Month<input type="month" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value, startDate: "", endDate: "" })} /></label>;
}

function ItemList({ items }) {
  return <div className="item-list">{items.map((item, index) => <span key={item}><b>{index + 1}</b>{item}</span>)}</div>;
}

function deliveryItemsForBatch(data, batchId) {
  return data.deliveryItems
    .filter((item) => item.batch_id === batchId)
    .sort((a, b) => productName(data, a.product_id).localeCompare(productName(data, b.product_id)));
}

async function loadAll() {
  const [products, pharmacies, deliveryBatches, deliveryItems, salesReports, salesItems, payments, expenses] = await Promise.all([
    select("products"),
    select("pharmacies"),
    select("delivery_batches"),
    select("delivery_items"),
    select("sales_reports"),
    select("sales_items"),
    select("payments"),
    select("expenses"),
  ]);
  return {
    products,
    pharmacies,
    deliveryBatches,
    deliveryItems,
    salesReports,
    salesItems,
    payments,
    expenses,
  };
}

async function select(table) {
  const { data, error } = await supabase.from(table).select("*").order("created_at");
  if (error) throw error;
  return data || [];
}

async function saveProduct(item, owner_id) {
  await upsert("products", { ...item, code: item.id ? item.code : await nextCode("products", "P"), owner_id, purchase_price: Number(item.purchase_price), selling_price: Number(item.selling_price) });
}

async function savePharmacy(item, owner_id) {
  await upsert("pharmacies", { ...item, code: item.id ? item.code : await nextCode("pharmacies", "PH"), owner_id });
}

async function saveDelivery(item, owner_id) {
  const items = mergeLines(item.items, "quantity_sent");
  const batch = await upsert("delivery_batches", { id: item.id, owner_id, code: item.id ? item.code : await nextCode("delivery_batches", "DB"), date: item.date, pharmacy_id: item.pharmacy_id, notes: item.notes }, true);
  const { error } = await supabase.from("delivery_items").delete().eq("batch_id", batch.id);
  if (error) throw error;
  await insertRows("delivery_items", items.map((line) => ({ owner_id, batch_id: batch.id, product_id: line.product_id, quantity_sent: Number(line.quantity_sent) })));
}

async function saveSale(item, owner_id) {
  const items = mergeLines(item.items, "quantity_sold");
  const report = await upsert("sales_reports", { owner_id, code: item.id ? item.code : await nextCode("sales_reports", "S"), date: item.date, pharmacy_id: item.pharmacy_id, notes: item.notes }, true);
  const { error } = await supabase.from("sales_items").delete().eq("report_id", report.id);
  if (error) throw error;
  await insertRows("sales_items", items.map((line) => ({ owner_id, report_id: report.id, product_id: line.product_id, quantity_sold: Number(line.quantity_sold) })));
}

async function savePayment(item, owner_id) {
  await upsert("payments", { ...item, code: item.id ? item.code : await nextCode("payments", "PAY"), owner_id, amount_paid: Number(item.amount_paid) });
}

async function saveExpense(item, owner_id) {
  await upsert("expenses", { ...item, code: item.id ? item.code : await nextCode("expenses", "E"), owner_id, amount: Number(item.amount) });
}

async function upsert(table, row, single = false) {
  const query = supabase.from(table).upsert(row, { onConflict: "owner_id,code" }).select();
  const { data, error } = single ? await query.single() : await query;
  if (error) throw error;
  return single ? data : data?.[0];
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

async function nextCode(table, prefix) {
  const { data, error } = await supabase.from(table).select("code");
  if (error) throw error;
  return makeCode(prefix, data || []);
}

function mergeLines(lines, qtyKey) {
  const rows = new Map();
  for (const line of lines) {
    if (!line.product_id) continue;
    rows.set(line.product_id, {
      product_id: line.product_id,
      [qtyKey]: Number(rows.get(line.product_id)?.[qtyKey] || 0) + Number(line[qtyKey] || 0),
    });
  }
  return [...rows.values()].filter((row) => row[qtyKey] > 0);
}

async function removeProduct(id) {
  const used = await referenceCount("delivery_items", "product_id", id) + await referenceCount("sales_items", "product_id", id);
  if (used) throw new Error("Cannot delete this product because it is used in deliveries or sales. Edit its name/notes instead.");
  await remove("products", id, "product");
}

async function removePharmacy(id) {
  const used = await referenceCount("delivery_batches", "pharmacy_id", id) + await referenceCount("sales_reports", "pharmacy_id", id) + await referenceCount("payments", "pharmacy_id", id);
  if (used) throw new Error("Cannot delete this pharmacy because it is used in deliveries, sales, or payments. Edit its name/notes instead.");
  await remove("pharmacies", id, "pharmacy");
}

async function referenceCount(table, column, value) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count || 0;
}

async function remove(table, id, label = "record") {
  if (!confirm(`Delete this ${label}?`)) throw new Error("Delete cancelled.");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function deleteWhere(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
}

async function clearAllData(owner_id) {
  for (const table of ["delivery_items", "sales_items", "payments", "expenses", "delivery_batches", "sales_reports", "products", "pharmacies"]) {
    await deleteWhere(table, "owner_id", owner_id);
  }
}

async function removeDelivery(id) {
  await remove("delivery_batches", id, "delivery");
}

async function removeSaleItem(item) {
  // ponytail: delete the clicked product line; the report may contain other lines.
  await remove("sales_items", item.id, "sale");
  if (!await referenceCount("sales_items", "report_id", item.report_id)) {
    await deleteWhere("sales_reports", "id", item.report_id);
  }
}

async function importLegacy(legacy, owner_id) {
  const current = await loadAll();
  const productMap = new Map();
  const pharmacyMap = new Map();
  const usedCodes = {
    P: new Set(current.products.map((row) => row.code)),
    PH: new Set(current.pharmacies.map((row) => row.code)),
    DB: new Set(current.deliveryBatches.map((row) => row.code)),
    S: new Set(current.salesReports.map((row) => row.code)),
    PAY: new Set(current.payments.map((row) => row.code)),
    E: new Set(current.expenses.map((row) => row.code)),
  };
  const clearedBatches = new Set();
  const clearedReports = new Set();
  const deliveryLines = new Map();
  const salesLines = new Map();
  const skipped = [];

  for (const old of legacy.products || []) {
    const row = await upsert("products", {
      owner_id,
      code: readable(old.product_id, "P", usedCodes.P),
      name: old.product_name || old.name || "",
      supplier_name: old.supplier_name || "",
      purchase_price: Number(old.purchase_price || 0),
      selling_price: Number(old.selling_price || 0),
      notes: old.notes || "",
    }, true);
    productMap.set(old.product_id, row.id);
  }

  for (const old of legacy.pharmacies || []) {
    const row = await upsert("pharmacies", {
      owner_id,
      code: readable(old.pharmacy_id, "PH", usedCodes.PH),
      name: old.pharmacy_name || old.name || "",
      address: old.address || "",
      contact_person: old.contact_person || "",
      phone_number: old.phone_number || "",
      notes: old.notes || "",
    }, true);
    pharmacyMap.set(old.pharmacy_id, row.id);
  }

  const batches = new Map();
  for (const old of legacy.deliveries || []) {
    const key = old.delivery_batch_id || old.delivery_id;
    if (!batches.has(key)) {
      const pharmacy_id = pharmacyMap.get(old.pharmacy_id);
      if (!pharmacy_id) {
        skipped.push(`delivery missing pharmacy ${old.pharmacy_id || ""}`);
        continue;
      }
      const batch = await upsert("delivery_batches", {
        owner_id,
        code: stableCode(key, "DB", usedCodes.DB),
        date: old.date,
        pharmacy_id,
        notes: old.notes || "",
      }, true);
      batches.set(key, batch.id);
    }
    if (!clearedBatches.has(batches.get(key))) {
      await deleteWhere("delivery_items", "batch_id", batches.get(key));
      clearedBatches.add(batches.get(key));
    }
    const product_id = productMap.get(old.product_id);
    if (!product_id) {
      skipped.push(`delivery missing product ${old.product_id || ""}`);
      continue;
    }
    const lineKey = `${batches.get(key)}|${product_id}`;
    deliveryLines.set(lineKey, {
      owner_id,
      batch_id: batches.get(key),
      product_id,
      quantity_sent: Number(deliveryLines.get(lineKey)?.quantity_sent || 0) + Number(old.quantity_sent || 0),
    });
  }
  await insertRows("delivery_items", [...deliveryLines.values()].filter((row) => row.quantity_sent > 0));

  for (const old of legacy.sales || []) {
    const pharmacy_id = pharmacyMap.get(old.pharmacy_id);
    if (!pharmacy_id) {
      skipped.push(`sale missing pharmacy ${old.pharmacy_id || ""}`);
      continue;
    }
    const report = await upsert("sales_reports", {
      owner_id,
      code: stableCode(old.sales_id, "S", usedCodes.S),
      date: old.date,
      pharmacy_id,
      notes: old.notes || "",
    }, true);
    if (!clearedReports.has(report.id)) {
      await deleteWhere("sales_items", "report_id", report.id);
      clearedReports.add(report.id);
    }
    const product_id = productMap.get(old.product_id);
    if (!product_id) {
      skipped.push(`sale missing product ${old.product_id || ""}`);
      continue;
    }
    const lineKey = `${report.id}|${product_id}`;
    salesLines.set(lineKey, {
      owner_id,
      report_id: report.id,
      product_id,
      quantity_sold: Number(salesLines.get(lineKey)?.quantity_sold || 0) + Number(old.quantity_sold || 0),
    });
  }
  await insertRows("sales_items", [...salesLines.values()].filter((row) => row.quantity_sold > 0));

  for (const old of legacy.payments || []) {
    const pharmacy_id = pharmacyMap.get(old.pharmacy_id);
    if (!pharmacy_id) {
      skipped.push(`payment missing pharmacy ${old.pharmacy_id || ""}`);
      continue;
    }
    await upsert("payments", { owner_id, code: stableCode(old.payment_id, "PAY", usedCodes.PAY), date: old.date, pharmacy_id, amount_paid: Number(old.amount_paid || 0), notes: old.notes || "" });
  }
  for (const old of legacy.expenses || []) {
    await upsert("expenses", { owner_id, code: stableCode(old.expense_id, "E", usedCodes.E), date: old.date, category: old.category || "Other", amount: Number(old.amount || 0), notes: old.notes || "" });
  }
  return { skipped };
}

function backupCount(backup) {
  return ["products", "pharmacies", "deliveries", "sales", "payments", "expenses", "deliveryBatches", "deliveryItems", "salesReports", "salesItems"]
    .reduce((total, key) => total + (Array.isArray(backup?.[key]) ? backup[key].length : 0), 0);
}

function readable(id, prefix, used) {
  if (new RegExp(`^${prefix}\\d+$`).test(String(id || ""))) {
    used.add(id);
    return id;
  }
  let number = Math.max(0, ...[...used].map((code) => Number(String(code).match(new RegExp(`^${prefix}(\\d+)$`))?.[1] || 0)));
  let code;
  do {
    code = `${prefix}${String(++number).padStart(3, "0")}`;
  } while (used.has(code));
  used.add(code);
  return code;
}

function stableCode(id, prefix, used) {
  if (id) {
    used.add(id);
    return id;
  }
  return readable(id, prefix, used);
}

function duplicateNames(rows) {
  const seen = new Set();
  const duplicates = new Set();
  rows.forEach((row) => {
    const name = String(row.name || "").trim().toLowerCase();
    if (!name) return;
    if (seen.has(name)) duplicates.add(row.name);
    seen.add(name);
  });
  return [...duplicates].sort((a, b) => a.localeCompare(b));
}

function getLocalBackup() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed?.products) || Array.isArray(parsed?.pharmacies) ? parsed : null;
  } catch {
    return null;
  }
}

function toLegacyBackup(data) {
  return {
    products: data.products.map((row) => ({ product_id: row.code, product_name: row.name, supplier_name: row.supplier_name, purchase_price: row.purchase_price, selling_price: row.selling_price, notes: row.notes })),
    pharmacies: data.pharmacies.map((row) => ({ pharmacy_id: row.code, pharmacy_name: row.name, address: row.address, contact_person: row.contact_person, phone_number: row.phone_number, notes: row.notes })),
    deliveries: deliveries(data).map((row) => ({ delivery_id: row.id, delivery_batch_id: data.deliveryBatches.find((batch) => batch.id === row.batch_id)?.code, date: row.date, pharmacy_id: data.pharmacies.find((pharmacy) => pharmacy.id === row.pharmacy_id)?.code, product_id: data.products.find((product) => product.id === row.product_id)?.code, quantity_sent: row.quantity_sent, notes: row.notes })),
    sales: sales(data).map((row) => ({ sales_id: data.salesReports.find((report) => report.id === row.report_id)?.code, date: row.date, pharmacy_id: data.pharmacies.find((pharmacy) => pharmacy.id === row.pharmacy_id)?.code, product_id: data.products.find((product) => product.id === row.product_id)?.code, quantity_sold: row.quantity_sold, notes: row.notes })),
    payments: data.payments.map((row) => ({ payment_id: row.code, date: row.date, pharmacy_id: data.pharmacies.find((pharmacy) => pharmacy.id === row.pharmacy_id)?.code, amount_paid: row.amount_paid, notes: row.notes })),
    expenses: data.expenses.map((row) => ({ expense_id: row.code, date: row.date, category: row.category, amount: row.amount, notes: row.notes })),
  };
}

function blankProduct(data) {
  return { code: makeCode("P", data.products), name: "", supplier_name: "", purchase_price: "", selling_price: "", notes: "" };
}

function blankPharmacy(data) {
  return { code: makeCode("PH", data.pharmacies), name: "", address: "", contact_person: "", phone_number: "", notes: "" };
}

function blankDelivery(data) {
  return { code: makeCode("DB", data.deliveryBatches), date: today(), pharmacy_id: "", notes: "", items: [{ product_id: "", quantity_sent: 1 }] };
}

function blankSale(data) {
  return { code: makeCode("S", data.salesReports), date: today(), pharmacy_id: "", notes: "", items: [{ product_id: "", quantity_sold: 1 }] };
}

function blankPayment(data) {
  return { code: makeCode("PAY", data.payments), date: today(), pharmacy_id: "", amount_paid: "", notes: "" };
}

function blankExpense(data) {
  return { code: makeCode("E", data.expenses), date: today(), category: "", amount: "", notes: "" };
}

function deliveryForEdit(data, batch) {
  return { ...batch, items: deliveryItemsForBatch(data, batch.id).map((item) => ({ product_id: item.product_id, quantity_sent: item.quantity_sent })) };
}

function stockAt(data, pharmacy_id, product_id) {
  const sent = deliveries(data).filter((row) => row.pharmacy_id === pharmacy_id && row.product_id === product_id).reduce((total, row) => total + row.quantity_sent, 0);
  const sold = sales(data).filter((row) => row.pharmacy_id === pharmacy_id && row.product_id === product_id).reduce((total, row) => total + row.quantity_sold, 0);
  return sent - sold;
}

function includes(row, query) {
  return !query || Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function exportBackupCsv(type, data) {
  const options = {
    products: {
      name: "products",
      keys: ["code", "name", "supplier_name", "purchase_price", "selling_price", "notes"],
      rows: data.products.slice().sort(byName),
    },
    pharmacies: {
      name: "pharmacies",
      keys: ["code", "name", "address", "contact_person", "phone_number", "notes"],
      rows: data.pharmacies.slice().sort(byName),
    },
    deliveries: {
      name: "deliveries",
      keys: ["delivery_code", "date", "pharmacy_code", "pharmacy", "product_code", "product", "quantity_sent", "notes"],
      rows: data.deliveryItems.map((item) => {
        const batch = data.deliveryBatches.find((row) => row.id === item.batch_id) || {};
        const pharmacy = data.pharmacies.find((row) => row.id === batch.pharmacy_id) || {};
        const product = data.products.find((row) => row.id === item.product_id) || {};
        return {
          delivery_code: batch.code || "",
          date: batch.date || "",
          pharmacy_code: pharmacy.code || "",
          pharmacy: pharmacy.name || "Deleted pharmacy",
          product_code: product.code || "",
          product: product.name || "Deleted product",
          quantity_sent: item.quantity_sent,
          notes: batch.notes || "",
        };
      }).sort((a, b) => b.date.localeCompare(a.date) || a.pharmacy.localeCompare(b.pharmacy) || a.product.localeCompare(b.product)),
    },
    sales: {
      name: "sales",
      keys: ["sales_code", "date", "pharmacy_code", "pharmacy", "product_code", "product", "quantity_sold", "omzet", "profit", "notes"],
      rows: data.salesItems.map((item) => {
        const report = data.salesReports.find((row) => row.id === item.report_id) || {};
        const pharmacy = data.pharmacies.find((row) => row.id === report.pharmacy_id) || {};
        const product = data.products.find((row) => row.id === item.product_id) || {};
        return {
          sales_code: report.code || "",
          date: report.date || "",
          pharmacy_code: pharmacy.code || "",
          pharmacy: pharmacy.name || "Deleted pharmacy",
          product_code: product.code || "",
          product: product.name || "Deleted product",
          quantity_sold: item.quantity_sold,
          omzet: item.quantity_sold * (product.selling_price || 0),
          profit: item.quantity_sold * ((product.selling_price || 0) - (product.purchase_price || 0)),
          notes: report.notes || "",
        };
      }).sort((a, b) => b.date.localeCompare(a.date) || a.pharmacy.localeCompare(b.pharmacy) || a.product.localeCompare(b.product)),
    },
    payments: {
      name: "payments",
      keys: ["code", "date", "pharmacy_code", "pharmacy", "amount_paid", "notes"],
      rows: data.payments.map((row) => {
        const pharmacy = data.pharmacies.find((item) => item.id === row.pharmacy_id) || {};
        return { ...row, pharmacy_code: pharmacy.code || "", pharmacy: pharmacy.name || "Deleted pharmacy" };
      }).sort((a, b) => b.date.localeCompare(a.date) || a.pharmacy.localeCompare(b.pharmacy)),
    },
    expenses: {
      name: "expenses",
      keys: ["code", "date", "category", "amount", "notes"],
      rows: data.expenses.slice().sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category)),
    },
  };
  const option = options[type] || options.deliveries;
  exportCsv(option.name, option.rows, option.keys);
}

function exportCsv(name, rows, keys) {
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\r\n");
  downloadFile(`${name}-${today()}.csv`, csv, "text/csv");
}

function downloadJson(filename, data) {
  downloadFile(filename, JSON.stringify(data, null, 2), "application/json");
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toast(setMessage, text) {
  setMessage(text);
  setTimeout(() => setMessage(""), 3500);
}

function friendlySupabaseError(error) {
  const text = error?.message || String(error);
  if (/not found|does not exist|Could not find/i.test(text)) {
    return `${text} Run supabase/schema.sql in the Supabase SQL Editor, then refresh.`;
  }
  return text;
}

createRoot(document.getElementById("root")).render(<App />);
