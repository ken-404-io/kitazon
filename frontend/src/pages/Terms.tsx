import styles from './StaticPage.module.css';

export default function Terms() {
  return (
    <div className="page-container">
      <div className={styles.page}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.updated}>Last updated: May 2025</p>

        <section className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Kitazon ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>
        </section>

        <section className={styles.section}>
          <h2>2. Eligibility</h2>
          <p>You must be at least 18 years old to register and use Kitazon. By creating an account you confirm you meet this requirement and that all information you provide is accurate.</p>
        </section>

        <section className={styles.section}>
          <h2>3. Account Responsibilities</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use. Each person may hold only one account; duplicate accounts may be suspended.</p>
        </section>

        <section className={styles.section}>
          <h2>4. Earning and Withdrawals</h2>
          <p>Earnings are credited when qualifying tasks or offers are completed as verified by our third-party partners. Kitazon reserves the right to withhold or reverse credits obtained through fraudulent activity. Withdrawals are subject to minimum amounts and processing fees disclosed at the time of request.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Referral Program</h2>
          <p>Referral commissions are awarded when a referred user completes qualifying tasks. Abuse of the referral system (e.g., self-referrals, fake accounts) will result in forfeiture of commissions and account termination.</p>
        </section>

        <section className={styles.section}>
          <h2>6. Prohibited Conduct</h2>
          <p>You may not use the Platform to engage in fraud, abuse, spamming, reverse-engineering, or any activity that violates applicable law. We reserve the right to suspend or terminate accounts that violate these rules.</p>
        </section>

        <section className={styles.section}>
          <h2>7. Modifications</h2>
          <p>Kitazon may update these Terms at any time. Continued use after changes constitutes acceptance. We will notify you of material changes via email or an in-app notice.</p>
        </section>

        <section className={styles.section}>
          <h2>8. Disclaimers</h2>
          <p>The Platform is provided "as is" without warranties of any kind. Kitazon is not liable for interruptions, data loss, or indirect damages arising from your use of the Platform.</p>
        </section>

        <section className={styles.section}>
          <h2>9. Governing Law</h2>
          <p>These Terms are governed by the laws of the Republic of the Philippines. Any disputes shall be resolved in the competent courts of the Philippines.</p>
        </section>

        <section className={styles.section}>
          <h2>10. Contact</h2>
          <p>For questions about these Terms, contact us at <a href="mailto:support@kitazon.com">support@kitazon.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
