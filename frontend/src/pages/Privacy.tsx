import styles from './StaticPage.module.css';

export default function Privacy() {
  return (
    <div className="page-container">
      <div className={styles.page}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: May 2025</p>

        <section className={styles.section}>
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide when registering (name, email address), information generated through your use of the Platform (task completions, withdrawal requests, login events), and technical information (IP address, browser type, device identifiers).</p>
        </section>

        <section className={styles.section}>
          <h2>2. How We Use Your Information</h2>
          <p>We use your information to operate and improve the Platform, process withdrawals, prevent fraud and abuse, send transactional emails (account events, security alerts), and comply with legal obligations.</p>
        </section>

        <section className={styles.section}>
          <h2>3. Sharing of Information</h2>
          <p>We do not sell your personal data. We share data only with: (a) third-party offer partners to verify task completions; (b) payment processors to execute withdrawals; (c) service providers under confidentiality obligations; (d) law enforcement when legally required.</p>
        </section>

        <section className={styles.section}>
          <h2>4. Cookies and Local Storage</h2>
          <p>We use secure, httpOnly cookies to maintain your authenticated session. We also use browser local storage for theme preferences. We do not use tracking or advertising cookies.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Data Retention</h2>
          <p>We retain your account data for as long as your account is active and for a reasonable period after deletion to satisfy legal and audit obligations. Login events and audit logs are retained for fraud-prevention purposes.</p>
        </section>

        <section className={styles.section}>
          <h2>6. Security</h2>
          <p>We use industry-standard measures including bcrypt password hashing, HTTPS, rate limiting, and two-factor authentication to protect your data. No system is completely secure; use a strong, unique password and enable 2FA.</p>
        </section>

        <section className={styles.section}>
          <h2>7. Your Rights</h2>
          <p>You may access, correct, or delete your personal information at any time through Account Settings. To request a full data export or erasure, contact us at <a href="mailto:support@kitazon.com">support@kitazon.com</a>.</p>
        </section>

        <section className={styles.section}>
          <h2>8. Children's Privacy</h2>
          <p>The Platform is not directed to individuals under 18. We do not knowingly collect personal data from minors. If we become aware that a minor has registered, we will delete the account.</p>
        </section>

        <section className={styles.section}>
          <h2>9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or an in-app notice. Continued use of the Platform constitutes acceptance.</p>
        </section>

        <section className={styles.section}>
          <h2>10. Contact</h2>
          <p>For privacy inquiries, contact us at <a href="mailto:support@kitazon.com">support@kitazon.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
