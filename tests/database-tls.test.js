import assert from "node:assert/strict";
import test from "node:test";
import { databaseSslOptions } from "../src/db/tls.js";

const bundledCa = "-----BEGIN CERTIFICATE-----\nbundled-certificate\n-----END CERTIFICATE-----";

test("Supabase pooler connections pin the bundled Supabase CA", () => {
  assert.deepEqual(
    databaseSslOptions("aws-0-ap-south-1.pooler.supabase.com", {
      defaultSupabaseCa: bundledCa,
      rejectUnauthorized: false,
    }),
    { ca: bundledCa, rejectUnauthorized: true },
  );
});

test("a supplied Supabase CA enables full certificate verification", () => {
  assert.deepEqual(
    databaseSslOptions("aws-0-ap-south-1.pooler.supabase.com", {
      caCertificate: "-----BEGIN CERTIFICATE-----\\ncertificate-data\\n-----END CERTIFICATE-----",
      defaultSupabaseCa: bundledCa,
      rejectUnauthorized: false,
    }),
    {
      ca: "-----BEGIN CERTIFICATE-----\ncertificate-data\n-----END CERTIFICATE-----",
      rejectUnauthorized: true,
    },
  );
});

test("Supabase pooler connections fail closed if no trusted CA is available", () => {
  assert.throws(
    () => databaseSslOptions("aws-0-ap-south-1.pooler.supabase.com"),
    /CA certificate is unavailable/,
  );
});

test("non-Supabase databases keep the configured verification policy", () => {
  assert.deepEqual(
    databaseSslOptions("database.internal.example", { rejectUnauthorized: true }),
    { rejectUnauthorized: true },
  );
});
