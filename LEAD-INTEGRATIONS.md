# Google Ads and website lead delivery

Implemented, but not live until migration `005_lead_integrations.sql` is applied and APP_URL is a public HTTPS address. No production settings or migrations were changed during implementation.

An administrator opens Settings → Google Ads or Website forms, chooses an active lead owner and creates a connection. The key is shown once; only its hash is retained on the server. Replacing it invalidates the previous key. Disconnecting stops intake without deleting existing clients.

## Google Ads

Copy the URL and key into the lead form's webhook/export settings. Google sends the key as `google_key`. Use Google's test delivery button; successful test submissions update the test timestamp without creating a lead. Live submissions create Uncontacted leads assigned to the selected user. Duplicate lead IDs are ignored.

This is lead-form webhook intake, not Google Ads campaign management, reporting, OAuth or historical backfill.

Official schema: https://developers.google.com/google-ads/webhook/docs/implementation

## Existing website forms

Your website backend sends a JSON POST to the generated URL with `X-CRM-Key` set to its stored secret. Never put the key in public HTML or client-side JavaScript.

```json
{"submission_id":"unique-stable-id","name":"Client","email":"client@example.com","phone":"+966500000000","company":"Company","is_test":true}
```

Remove `is_test` for live intake. Email or phone is required. Use the same submission ID for retries. The website must validate consent and provide its own spam/bot protection. The endpoint does not enable cross-origin browser submissions. Existing CRM form previews are not converted into public hosted forms by this integration.

## Release checks

Apply migration, restart/deploy the server, create a connection, send a test, then verify live delivery and duplicate suppression in a dedicated test workspace. Also verify invalid keys are rejected, inactive owners fail safely, disconnect stops delivery, and a second organization cannot access the connection. Automated tests cover parsing and source contracts, not a live database or Google delivery. No live delivery was tested during implementation.

Processing is synchronous: senders should retry non-2xx failures. There is no durable delivery queue or historical import. Reload the CRM to see new leads in an already-open tab.
