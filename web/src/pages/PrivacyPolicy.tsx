export default function PrivacyPolicy() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: February 21, 2026</p>
      </header>

      <section className="panel legal">
        <h2>1. Introduction</h2>
        <p>
          This Sleep Reliability Dashboard (&quot;Service&quot;) is operated for
          personal use. This Privacy Policy explains how we collect, use, and
          protect information when you use the Service.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect the following information through SMS interactions:</p>
        <ul>
          <li>
            <strong>Sleep duration data</strong> — the number of hours you report
            sleeping each night.
          </li>
          <li>
            <strong>Phone number</strong> — the mobile number used to send and
            receive SMS messages.
          </li>
          <li>
            <strong>Message content</strong> — the text of SMS messages sent to
            the Service.
          </li>
          <li>
            <strong>Timestamps</strong> — when messages are sent and received.
          </li>
        </ul>
        <p>
          We do not collect names, email addresses, location data, or any other
          personally identifiable information beyond what is listed above.
        </p>

        <h2>3. How We Use Your Information</h2>
        <p>The information collected is used solely to:</p>
        <ul>
          <li>Record and display sleep duration statistics.</li>
          <li>Send daily prompts and reminders via SMS.</li>
          <li>Generate the dashboard visualizations you see on this site.</li>
        </ul>

        <h2>4. Data Storage</h2>
        <p>
          Your data is stored in Azure Table Storage with encryption at rest.
          Access to the storage account is restricted to the Service
          administrators.
        </p>

        <h2>5. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li>
            <strong>Twilio</strong> — for sending and receiving SMS messages.
            Twilio&apos;s privacy policy is available at{' '}
            <a
              href="https://www.twilio.com/en-us/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              twilio.com/legal/privacy
            </a>
            .
          </li>
          <li>
            <strong>Microsoft Azure</strong> — for hosting and data storage.
            Azure&apos;s privacy statement is available at{' '}
            <a
              href="https://privacy.microsoft.com/privacystatement"
              target="_blank"
              rel="noopener noreferrer"
            >
              privacy.microsoft.com
            </a>
            .
          </li>
        </ul>

        <h2>6. Data Sharing</h2>
        <p>
          We do not sell, trade, or share your personal information with third
          parties, except as required to operate the Service (i.e., through
          Twilio for SMS delivery and Azure for hosting).
        </p>

        <h2>7. Data Retention</h2>
        <p>
          Sleep data and SMS event logs are retained indefinitely for the purpose
          of historical tracking and trend analysis. You may request deletion of
          your data by contacting the Service administrator.
        </p>

        <h2>8. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Request access to the data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>
            Opt out of SMS communications by replying &quot;STOP&quot; to any
            message.
          </li>
        </ul>

        <h2>9. Security</h2>
        <p>
          We take reasonable measures to protect your information, including
          encrypted storage, secure API authentication, and signature
          verification on all inbound webhooks.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be
          reflected on this page with an updated &quot;Last updated&quot; date.
        </p>

        <h2>11. Contact</h2>
        <p>
          If you have questions about this Privacy Policy, please contact the
          Service administrator.
        </p>
      </section>

      <footer className="page-footer">
        <a href="/">Dashboard</a>
        <span className="footer-sep">·</span>
        <a href="/terms">Terms &amp; Conditions</a>
      </footer>
    </div>
  )
}
