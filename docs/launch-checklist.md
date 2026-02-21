# Launch Checklist (Custom Domain)

Use this as the final cutover checklist when moving to a custom domain.

## 1) Azure Static Web Apps → Custom domain
- [ ] Add custom domain in **Azure Portal → Static Web App → Custom domains**.
- [ ] Copy the DNS records Azure provides (CNAME + TXT validation).

## 2) Namecheap DNS
- [ ] Add CNAME for subdomain (recommended `www`):
  - Host: `www`
  - Value: `<your-swa-host>.azurestaticapps.net`
- [ ] Add TXT record for domain validation:
  - Host: `asuid` (or `asuid.<subdomain>`)
  - Value: `<provided by Azure>`
- [ ] If using apex/root domain (`@`):
  - Prefer ALIAS/ANAME → `<your-swa-host>.azurestaticapps.net`
  - Otherwise, redirect `@` → `www`

## 3) Enforce HTTPS
- [ ] In **Static Web App → Custom domains**, ensure HTTPS is enabled (Azure will provision the cert).
- [ ] Confirm HTTP requests redirect to HTTPS.

## 4) Twilio webhook (custom domain)
- [ ] Update Twilio inbound webhook to the custom domain:
  - `https://<your-domain>/api/twilio/inbound`
- [ ] In SWA app settings, set:
  - `TWILIO_WEBHOOK_URL=https://<your-domain>/api/twilio/inbound`
  - (Required for inbound webhook) `TWILIO_AUTH_TOKEN`, `ADAM_TO_NUMBER`
  - (Required for outbound SMS / scheduled jobs) `TWILIO_ACCOUNT_SID`, `TWILIO_FROM_NUMBER`

## 5) Logic Apps (scheduled jobs)
- [ ] Update Logic Apps HTTP action URIs to use the custom domain:
  - `https://<your-domain>/api/jobs/sendPrompt`
  - `https://<your-domain>/api/jobs/sendReminder`
- [ ] Keep the same `x-job-secret` header value.

## 6) Smoke tests
- [ ] **Public site:** open `https://<your-domain>`
- [ ] **Health endpoint:** `https://<your-domain>/api/health`
- [ ] **Twilio inbound:** send an SMS to the Twilio number and confirm data updates.
- [ ] **Job endpoints** (if needed):
  ```bash
  curl -X POST "https://<your-domain>/api/jobs/sendPrompt" \
    -H "x-job-secret: <JOB_SECRET>"

  curl -X POST "https://<your-domain>/api/jobs/sendReminder" \
    -H "x-job-secret: <JOB_SECRET>"
  ```

## 7) Final verification
- [ ] Verify the dashboard reflects the latest SMS (date = local day - 1).
- [ ] Confirm no signature validation errors in logs.
