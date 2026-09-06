function normalizeCertificate(value) {
  return String(value || "").replaceAll("\\n", "\n").trim();
}

export function databaseSslOptions(hostname, {
  caCertificate,
  defaultSupabaseCa,
  rejectUnauthorized = true,
} = {}) {
  const ca = normalizeCertificate(caCertificate);
  if (ca) return { ca, rejectUnauthorized: true };

  // Supabase's shared pooler CA is not part of Node's default trust store.
  // Pin Supabase's published root so production keeps verify-full semantics.
  if (String(hostname || "").endsWith(".pooler.supabase.com")) {
    const bundledCa = normalizeCertificate(defaultSupabaseCa);
    if (!bundledCa) throw new Error("The Supabase database CA certificate is unavailable.");
    return { ca: bundledCa, rejectUnauthorized: true };
  }

  return { rejectUnauthorized };
}
