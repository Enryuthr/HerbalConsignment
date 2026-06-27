import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

assert.match(source, /removeSaleItem\(row\)/);
assert.doesNotMatch(source, /removeSale\(row\.report_id\)/);

console.log("sales delete regression test passed");
