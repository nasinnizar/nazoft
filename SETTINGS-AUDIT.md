# Settings functionality audit — 5 September 2026

## Scope and result

Reviewed Settings renderers, click/change handlers, persistence, and downstream workflows in index.html, scripts, and backend services. This is a source-level audit, not a claim that every operation was exercised against production. Password changes, invitations, deletions, reassignment, external messages, and live integrations were not triggered against real accounts for testing.

**Result: not every Settings control is fully functional.** Several save a value without all workflows consuming it. Existing automated tests passing does not establish end-to-end functionality for every button.

## How the selected lead-automation controls work

- Blue means enabled; grey means disabled. Clicking a toggle saves the preference immediately. The Save button saves again; it is not a separate Apply step.
- **Click a contact button:** attempts to mark an uncontacted lead as Contacted when a contact action is opened. This is not proof that a call connected or a message was delivered.
- **Send a quick response:** marks the selected lead as contacted through the quick-response handler. Delivery confirmation is not checked by this wrapper.
- **Add to an active sequence:** wired to the older bulk-enrolment path. The newer direct sequence selector does not invoke that same contact-status rule.
- **Add an activity to the timeline:** implemented around the contact-log handler, not consistently around every way to add timeline activity.
- **Created manually:** the preference saves, but the current add-lead form always sets new leads to Uncontacted. Turning this switch off does not change that default.
- **Imported from a spreadsheet:** the older import function reads the switch. The newer mapping importer does not; it uses the mapped status, defaulting to Uncontacted.
- **External lead-source integrations:** applies to non-Manual sources entered through the lead form. It is not a server-side rule for all integrations. No live Meta ingestion webhook was found in the reviewed project.
- **Reassigned leads:** the form-edit path reads the preference, but the dedicated bulk/API reassignment paths preserve status regardless of this choice.

## Settings inventory

| Area | What the controls do | Audit result / limitation |
| --- | --- | --- |
| Country, currency & time | Save regional formatting preferences; format money and dates in supported views/exports | Implemented, but separate notification timezone choices are forced back to the regional timezone on save. Not every legacy date path uses the regional zone. |
| Custom fields | Add/edit/remove field definitions; toggle their enabled flag | Configuration works. No general custom-field input renderer consuming these definitions was found in the current lead form. A saved toggle alone does not make a field appear/disappear there. |
| Pipelines & stages | Add/edit workflows, reorder stages, update lead stage indexes | Implemented handlers; not mutation-tested against live data. Stages are shared rather than independently defined for every pipeline. |
| Products & services | Save products, default values and pipeline associations | Implemented configuration handlers. |
| Client groups | Save groups and select a group on a lead | Implemented; current direct selector represents one group, despite earlier copy suggesting multiple groups. |
| Document checklists | Save checklist definitions and product association | Definition editor exists; completion workflows were not verified end-to-end. |
| Follow-up sequences | Save steps, enable/disable definitions and enrol a lead | Configuration/enrolment implemented. No background message/call execution engine found; do not assume enrolment sends messages. |
| Quick responses | Open content library for reusable messages/files/pages | Navigation and content actions exist. Delivery depends on the selected channel; opening an external app is not delivery confirmation. |
| Notifications | Save alert preferences, enable browser permission, send a browser test, clear inbox, daily summary | Browser/in-app alerts implemented while CRM is open. No closed-browser push or email scheduler verified. Permission-granting and sending tests were not triggered. |
| Personalisation | Save display-name, channel and content-view preferences | Consumers exist in client-side workflows; not every combination was tested. |
| Follow-up defaults | Suggest a next date based on current follow-up state and chosen delay | Implemented in interaction workflow; suggestions remain editable. |
| Lead automation | Save contact-status preferences | Partial; specific gaps listed above. |
| Lead sources | Add/edit/delete classifications | Configuration handlers exist; adding a source does not connect an external service. |
| Lead capture forms | Configure forms and share links | Browser configuration exists; external submission-to-server delivery was not established in this audit. |
| Meta Ads | Connect/disconnect and test controls | **Placeholder:** connect flips a saved boolean; Test only displays “Connection test passed.” No OAuth or live connectivity test is performed. |
| Campaign assignment rules | Match campaign keywords to a designated active user | Server-side matching for new Meta-labelled leads with campaign data; first matching rule wins, case-insensitive. Admin-only rule updates. Does not itself connect Meta. Now located in Meta Ads. |
| Branding & reports | Choose report logo and export branding | Implemented client-side settings/export integration; verify final document per chosen format. |
| Import & export | Map columns, preview imports, download XLSX/PDF and restore deleted leads | Implemented handlers and file-format tests. Mapped follow-up text is stored in `due` while `followAt` remains blank, so it does not create a scheduled reminder automatically. |
| Lead & proposal numbering | Configure prefixes, starting values and formats | Implemented generation with shared counters; existing identifiers are preserved. |
| Company profile | Edit company information/branding | Save/render paths exist; not all output destinations were verified. |
| Users & access | Invite/edit/suspend users, reassign leads, open reset flow | Real authenticated backend paths exist. Not executed in audit to avoid changing accounts; reassignment preference gap noted above. |
| Team work hours | Configure workday and track active browser usage | Implemented operational usage tracking while visible/recently active; not a payroll clock or background attendance service. |
| Profile & security | Edit profile, start password/reset flow, sign out | Authenticated handlers exist. “Send reset link” opens the reset-request step; it does not silently send immediately. Password changes and sign-out were not performed. |

## Persistence caveat

Preferences are saved locally and included in workspace state. The non-admin server merge allowlist does not merge `accountPreferences`, so a non-admin seeing “saved” is not evidence those preferences will follow them to another browser. This needs a dedicated per-user persistence design before promising cross-device settings.

## Recommended next repair order

1. Make Meta connection/test labels honest until a real integration exists.
2. Unify contact-status rules across form, mapping import, direct sequence enrolment and server reassignment.
3. Correct per-user preference persistence and timezone conflicts.
4. Connect custom-field definitions to actual lead inputs; implement or clearly label sequence execution.
5. Run isolated end-to-end tests with disposable users/leads for every settings operation.
