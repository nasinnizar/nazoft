# Proposals

Open Proposals in the sidebar, or Proposals in the client workspace. Draft, Saved, and Sent tabs keep each stage of the proposal workflow separate. Choose the client, edit cover details, select catalog products or enter custom services, and adjust quantities, prices, discount and VAT. Save draft stores unfinished work; Save marks the proposal ready to send. Preview PDF and Download PDF generate the full document locally in the browser; neither sends a message nor changes the pipeline stage.

The provided Corprights PDF was sanitized: the original cover's personal text was removed, and the old quotation page was replaced. All nine other pages remain pixel-identical. The quotation is rebuilt in a matching green style with explicit quantities, unit prices and calculated totals, rather than reproducing the original merged cells. The two original bundled service rows are represented by one combined priced service.

Important limits:
- Fixed scope, government fee and payment-term pages must be reviewed before sending.
- PDF export currently supports Latin-script text, with validation errors for unsupported characters.
- Up to 10 quotation rows, subject to fitting the quotation page. Long descriptions must be shortened; content is never silently clipped.
- Draft saving uses the CRM's existing workspace save mechanism. The PDF is regenerated from the draft, not stored as a sent-document archive.
- WhatsApp/email options prepare the PDF and open a message draft. Attach the downloaded file manually and send, then use Confirm sent to record the event and move the client to Proposal sent. Opening the app alone does not change the stage; automatic server-side delivery is not connected.
- The editor previews the next proposal number without reserving it. The CRM assigns the number automatically when the proposal is first saved as a draft, saved as ready, or prepared for sending. Existing numbers are retained and number allocation uses the workspace counter mechanism.
- Proposal dates use the same shared calendar control as the rest of the CRM.
- Optional Note text appears after Exclusions in the PDF.
- The template retains Corprights branding, not Nazoft branding.

Validation: sample output has 11 pages; total SAR 51,000.00; old client text absent. Nine fixed pages were compared pixel-for-pixel to the original. Automated total/validation tests and UI inspection passed. No live client proposal was saved or sent during verification.
