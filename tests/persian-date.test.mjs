import test from "node:test";
import assert from "node:assert/strict";
import { parsePersianDraft } from "../src/lib/persianDate.ts";

const base = new Date(2026, 10, 22, 8);

test("parses Persian relative dates and digits locally", () => {
  const result = parsePersianDraft("پس‌فردا ساعت ۹:۳۰ صبح کار مهم", base);
  assert.match(result.due, /2026-11-24T09:30/);
  assert.equal(result.priority, 2);
});

test("parses the next Persian weekday", () => {
  const result = parsePersianDraft("پنجشنبه عصر قبض را بدهم", base);
  assert.match(result.due, /2026-11-26T18:00/);
});

test("warns when a medication phrase appears to contain multiple times", () => {
  const result = parsePersianDraft("هر روز ساعت ۸ و ۲۰ قرص بخورم", base);
  assert.equal(result.recurrence, "daily");
  assert.match(result.note, /چند ساعت/);
});

