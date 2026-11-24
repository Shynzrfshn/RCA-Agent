import test from "node:test";
import assert from "node:assert/strict";
import { readLocalAttachment } from "../src/lib/localFileText.ts";

test("extracts a local text attachment without a network call", async () => {
  const file = new File(["قبض برق، موعد فردا"], "bill.txt", { type: "text/plain" });
  assert.equal(await readLocalAttachment(file), "قبض برق، موعد فردا");
});

test("rejects oversized and unsupported attachments", async () => {
  await assert.rejects(readLocalAttachment(new File([new Uint8Array(2_000_001)], "large.txt")), /۲ مگابایت/);
  await assert.rejects(readLocalAttachment(new File(["x"], "unknown.bin")), /PDF/);
});

