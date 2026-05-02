import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacy Policy · BDL",
  description:
    "Ball Don't Lie Privacy Policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <TopBar active="/privacy" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Privacy Policy" />
        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          Effective Date: May 2, 2026 · Nashville, Tennessee
        </p>

        <article className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 py-6 max-sm:px-5 flex flex-col gap-6 text-[color:var(--text-2)] leading-[1.65]">
          <Notice>
            AT A GLANCE — We collect information you provide when you sign up
            and use BDL, including your name, email, date of birth, and
            basketball profile. We use it to run the platform, match you with
            games, and keep the community safe. We do not sell your personal
            information. We apply extra protections for users under 18.
          </Notice>

          <Section title="1. Introduction">
            <P>
              BDL Sports, LLC (&quot;BDL,&quot; &quot;Ball Don&apos;t Lie,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the
              Ball Don&apos;t Lie website, mobile application, and related
              services (the &quot;Platform&quot;). This Privacy Policy explains
              how we collect, use, disclose, and protect your personal
              information when you register for and use the Platform.
            </P>
            <P>
              This Policy applies to all users of the Platform, including
              users who are minors. By using the Platform, you consent to the
              practices described in this Privacy Policy. If you do not agree,
              please do not use the Platform.
            </P>
            <P>
              This Privacy Policy is incorporated into and subject to our
              Terms of Service.
            </P>
          </Section>

          <Section title="2. Information We Collect">
            <Sub title="2.1 Information You Provide Directly" />
            <P>
              When you register for and use the Platform, you may provide us
              with:
            </P>
            <UL>
              <LI>
                <strong>Identity &amp; Contact:</strong> Full name, email
                address, phone number, mailing address
              </LI>
              <LI>
                <strong>Account Credentials:</strong> Username, password
                (stored in hashed/encrypted form)
              </LI>
              <LI>
                <strong>Age &amp; Demographics:</strong> Date of birth, gender
                (optional)
              </LI>
              <LI>
                <strong>Athletic Profile:</strong> Skill level, position(s),
                playing history, stats, availability
              </LI>
              <LI>
                <strong>Profile Media:</strong> Profile photo, videos, and
                other media you upload
              </LI>
              <LI>
                <strong>Location:</strong> City, zip code, or precise GPS
                location (for game matching)
              </LI>
              <LI>
                <strong>Payment Information:</strong> Credit/debit card or
                other payment method (processed by our payment provider; we do
                not store full card numbers)
              </LI>
              <LI>
                <strong>Communications:</strong> Messages sent to other users
                or to BDL support
              </LI>
              <LI>
                <strong>User Content:</strong> Game reviews, ratings,
                comments, and other content you post
              </LI>
            </UL>

            <Sub title="2.2 Information Collected Automatically" />
            <P>When you use the Platform, we automatically collect:</P>
            <UL>
              <LI>
                Device information (device type, operating system, browser
                type, unique device identifiers)
              </LI>
              <LI>
                Log data (IP address, access times, pages viewed, links
                clicked, referring URL)
              </LI>
              <LI>
                Location data (general location from IP address; precise
                location only with your permission)
              </LI>
              <LI>
                Usage data (features used, game sessions joined, search
                queries)
              </LI>
              <LI>
                Cookies and similar tracking technologies (see Section 9)
              </LI>
            </UL>

            <Sub title="2.3 Information from Third Parties" />
            <P>We may receive information about you from:</P>
            <UL>
              <LI>
                Social media platforms, if you choose to connect your account
                or sign in via a third-party service
              </LI>
              <LI>
                Other users who tag you in content, report you, or otherwise
                reference your profile
              </LI>
              <LI>
                Identity verification services, where we use them to verify
                age or identity
              </LI>
              <LI>Analytics providers and advertising partners</LI>
            </UL>
          </Section>

          <Section title="3. How We Use Your Information">
            <P>
              We use the information we collect for the following purposes:
            </P>

            <Sub title="3.1 To Provide and Operate the Platform" />
            <UL>
              <LI>Create and manage your account</LI>
              <LI>
                Match you with pickup games, leagues, and other players based
                on skill, location, and availability
              </LI>
              <LI>Process payments and manage transactions</LI>
              <LI>
                Enable communication between users through the Platform&apos;s
                messaging features
              </LI>
              <LI>
                Display your public profile information to other registered
                users
              </LI>
            </UL>

            <Sub title="3.2 To Improve and Develop the Platform" />
            <UL>
              <LI>
                Analyze usage trends and patterns to improve Platform features
                and performance
              </LI>
              <LI>Conduct research and analytics</LI>
              <LI>Test new features and functionality</LI>
            </UL>

            <Sub title="3.3 To Communicate With You" />
            <UL>
              <LI>
                Send transactional messages (account confirmations, game
                reminders, receipts)
              </LI>
              <LI>
                Send service updates, security alerts, and policy change
                notifications
              </LI>
              <LI>Respond to your support requests and inquiries</LI>
              <LI>
                Send promotional communications (with your consent, where
                required by law)
              </LI>
            </UL>

            <Sub title="3.4 For Safety and Security" />
            <UL>
              <LI>Verify your identity and eligibility</LI>
              <LI>
                Detect and prevent fraud, abuse, and other harmful activities
              </LI>
              <LI>
                Enforce our Terms of Service and Community Guidelines
              </LI>
              <LI>
                Protect the safety of all users, particularly minors
              </LI>
              <LI>
                Comply with legal obligations and respond to law enforcement
                requests
              </LI>
            </UL>

            <Sub title="3.5 Legal Bases for Processing (Where Applicable)" />
            <P>
              Where required by law, we process your personal information on
              the following legal bases: (a) performance of our contract with
              you; (b) our legitimate interests in operating and improving the
              Platform; (c) your consent; and (d) compliance with legal
              obligations.
            </P>
          </Section>

          <Section title="4. How We Share Your Information">
            <Sub title="4.1 With Other Users" />
            <P>
              Certain profile information is visible to other registered users
              by default, including your display name, profile photo, skill
              level, position(s), statistics, and general location. You can
              adjust visibility settings in your account preferences.
            </P>

            <Sub title="4.2 With Service Providers" />
            <P>
              We share information with third-party vendors and service
              providers that perform services on our behalf, including:
            </P>
            <UL>
              <LI>Cloud hosting and infrastructure providers</LI>
              <LI>
                Payment processors (who handle payment card data under their
                own PCI-compliant systems)
              </LI>
              <LI>Email and SMS delivery providers</LI>
              <LI>Analytics and performance monitoring services</LI>
              <LI>Customer support tools</LI>
              <LI>Identity verification and age-verification services</LI>
            </UL>
            <P>
              These providers are contractually required to use your
              information only to perform services for us and to protect your
              information.
            </P>

            <Sub title="4.3 For Legal Reasons" />
            <P>
              We may disclose your information if we believe in good faith
              that such disclosure is necessary to:
            </P>
            <UL>
              <LI>
                Comply with a legal obligation, court order, or government
                request
              </LI>
              <LI>Enforce our Terms of Service</LI>
              <LI>
                Protect the rights, property, or safety of BDL, our users, or
                the public
              </LI>
              <LI>
                Investigate or prevent fraud, security incidents, or illegal
                activity
              </LI>
            </UL>
            <P>
              We will specifically report suspected child exploitation or
              abuse to the National Center for Missing and Exploited Children
              (NCMEC) and relevant law enforcement authorities as required by
              federal law.
            </P>

            <Sub title="4.4 Business Transfers" />
            <P>
              If BDL is involved in a merger, acquisition, financing, or sale
              of all or a portion of its assets, your information may be
              transferred as part of that transaction. We will notify you via
              email or a prominent Platform notice of any change in ownership
              or use of your personal information.
            </P>

            <Sub title="4.5 With Your Consent" />
            <P>
              We may share your information with third parties when you have
              given us your express consent to do so.
            </P>

            <Sub title="4.6 We Do Not Sell Your Personal Information" />
            <P>
              BDL does not sell, rent, or trade your personal information to
              third parties for their own marketing or commercial purposes.
            </P>
          </Section>

          <Section title="5. Children's Privacy (COPPA)">
            <Sub title="5.1 Users Under 13" />
            <P>
              The Platform is not directed to children under 13. We do not
              knowingly collect personal information from children under 13
              without verifiable parental consent. If a parent or guardian
              believes their child under 13 has created an account or
              submitted personal information without consent, please contact
              us immediately at privacy@bdlpickup.com. We will promptly
              investigate and, if confirmed, delete the information and
              terminate the account.
            </P>

            <Sub title="5.2 Parental Rights" />
            <P>
              If your child under 13 is using the Platform with your consent,
              you have the right to:
            </P>
            <UL>
              <LI>
                Review the personal information we have collected from your
                child
              </LI>
              <LI>Request that we correct inaccurate information</LI>
              <LI>
                Request deletion of your child&apos;s personal information
              </LI>
              <LI>
                Refuse further collection or use of your child&apos;s
                information
              </LI>
            </UL>
            <P>
              To exercise these rights, contact us at privacy@bdlpickup.com
              with your name, your child&apos;s username, and your
              relationship to the child.
            </P>

            <Sub title="5.3 Users Ages 13–17" />
            <P>
              For users between 13 and 17, we apply the following additional
              protections:
            </P>
            <UL>
              <LI>
                We do not use minor users&apos; data for behavioral
                advertising or interest-based targeting
              </LI>
              <LI>
                We apply stricter default privacy settings to minor user
                profiles
              </LI>
              <LI>
                We limit the visibility of minor users&apos; location
                information
              </LI>
              <LI>
                Parents and guardians may contact us to review or delete their
                minor child&apos;s account data
              </LI>
            </UL>
          </Section>

          <Section title="6. Data Security">
            <P>
              We take the security of your personal information seriously and
              implement commercially reasonable technical, administrative, and
              physical safeguards to protect it, including:
            </P>
            <UL>
              <LI>
                Encryption of sensitive personal data (including email
                addresses, dates of birth, and phone numbers) at rest using
                AES-256-GCM encryption
              </LI>
              <LI>Secure, hashed storage of passwords</LI>
              <LI>
                HTTPS/TLS encryption for all data transmitted between your
                device and our servers
              </LI>
              <LI>
                Access controls limiting employee and contractor access to
                personal data on a need-to-know basis
              </LI>
              <LI>Regular security assessments and monitoring</LI>
            </UL>
            <P>
              Despite these measures, no method of transmission over the
              internet or electronic storage is 100% secure. We cannot
              guarantee absolute security. If you discover a security
              vulnerability, please report it to security@bdlpickup.com.
            </P>
            <P>
              In the event of a data breach that may affect your rights or
              freedoms, we will notify affected users and relevant authorities
              as required by applicable law.
            </P>
          </Section>

          <Section title="7. Data Retention">
            <P>
              We retain your personal information for as long as your account
              is active or as needed to provide you services. Specifically:
            </P>
            <UL>
              <LI>
                Account data is retained for the duration of your account and
                for up to 3 years following account deletion, unless a longer
                retention period is required by law
              </LI>
              <LI>
                Transaction records are retained for 7 years for tax and
                accounting purposes
              </LI>
              <LI>
                Safety-related records (reports of abuse, harassment, or
                misconduct) may be retained indefinitely to protect the safety
                of the community
              </LI>
              <LI>
                Communications and messages are retained for up to 2 years
                after the conversation unless you request earlier deletion
              </LI>
            </UL>
            <P>
              When we no longer need personal data, we securely delete or
              anonymize it.
            </P>
          </Section>

          <Section title="8. Your Rights and Choices">
            <Sub title="8.1 Access and Correction" />
            <P>
              You may access and update most of your personal information
              directly through your account settings. For data not accessible
              through your account, contact us at privacy@bdlpickup.com.
            </P>

            <Sub title="8.2 Deletion" />
            <P>
              You may request deletion of your account and associated personal
              information at any time by contacting support@bdlpickup.com.
              Please note that we may retain certain information as required
              by law or for legitimate business purposes (such as fraud
              prevention or safety records).
            </P>

            <Sub title="8.3 Communications Preferences" />
            <P>
              You may opt out of promotional email communications at any time
              by clicking the &quot;unsubscribe&quot; link in any marketing
              email or by updating your notification preferences in account
              settings. Note that you cannot opt out of transactional messages
              (such as account security alerts or booking confirmations) while
              your account is active.
            </P>

            <Sub title="8.4 Location Data" />
            <P>
              You may disable location sharing through your device settings or
              through your account privacy settings. However, disabling
              location data may limit your ability to use game-matching
              features.
            </P>

            <Sub title="8.5 California Residents — CCPA Rights" />
            <P>
              If you are a California resident, you have additional rights
              under the California Consumer Privacy Act (CCPA), including the
              right to:
            </P>
            <UL>
              <LI>
                Know what personal information we collect, use, disclose, and
                sell
              </LI>
              <LI>
                Delete personal information we have collected (subject to
                exceptions)
              </LI>
              <LI>
                Opt out of the sale of your personal information (note: we do
                not sell personal information)
              </LI>
              <LI>Non-discrimination for exercising your CCPA rights</LI>
            </UL>
            <P>
              To submit a CCPA request, contact us at privacy@bdlpickup.com
              with &quot;CCPA Request&quot; in the subject line. We will
              respond within 45 days.
            </P>

            <Sub title="8.6 Other State Privacy Laws" />
            <P>
              Residents of Virginia, Colorado, Connecticut, and other states
              with comprehensive privacy laws may have additional rights
              regarding access, correction, deletion, data portability, and
              opting out of certain data processing. Please contact us at
              privacy@bdlpickup.com to exercise these rights.
            </P>
          </Section>

          <Section title="9. Cookies and Tracking Technologies">
            <Sub title="9.1 Types of Cookies We Use" />
            <P>
              We use the following types of cookies and similar technologies:
            </P>
            <UL>
              <LI>
                <strong>Essential Cookies:</strong> Required for the Platform
                to function (login sessions, security tokens)
              </LI>
              <LI>
                <strong>Performance Cookies:</strong> Help us understand how
                users interact with the Platform (page views, error rates)
              </LI>
              <LI>
                <strong>Functional Cookies:</strong> Remember your preferences
                and settings
              </LI>
              <LI>
                <strong>Analytics Cookies:</strong> Help us analyze usage
                patterns to improve the Platform
              </LI>
            </UL>

            <Sub title="9.2 Managing Cookies" />
            <P>
              Most browsers allow you to refuse or delete cookies through your
              browser settings. Disabling essential cookies may prevent you
              from logging in or using core Platform features. We honor
              browser-based &quot;Do Not Track&quot; signals to the extent
              technically feasible.
            </P>

            <Sub title="9.3 Third-Party Analytics" />
            <P>
              We may use third-party analytics services (such as Google
              Analytics) that set their own cookies to collect information
              about your use of the Platform. These services&apos; use of your
              information is governed by their own privacy policies.
            </P>
          </Section>

          <Section title="10. Third-Party Links and Services">
            <P>
              The Platform may contain links to third-party websites, social
              media platforms, or integrated services. This Privacy Policy
              does not apply to those third parties. We encourage you to
              review the privacy policies of any third-party services you
              access through the Platform. BDL is not responsible for the
              privacy practices of third parties.
            </P>
          </Section>

          <Section title="11. International Users">
            <P>
              The Platform is operated and hosted in the United States. If you
              access the Platform from outside the United States, your
              information will be transferred to and processed in the United
              States, where data protection laws may differ from those in your
              jurisdiction. By using the Platform, you consent to this
              transfer and processing.
            </P>
          </Section>

          <Section title="12. Changes to This Privacy Policy">
            <P>
              We may update this Privacy Policy from time to time. When we
              make material changes, we will notify you by:
            </P>
            <UL>
              <LI>
                Updating the &quot;Effective Date&quot; at the top of this
                policy
              </LI>
              <LI>
                Sending an email notification to the address associated with
                your account
              </LI>
              <LI>Displaying a prominent notice on the Platform</LI>
            </UL>
            <P>
              Your continued use of the Platform after any update constitutes
              your acceptance of the revised Policy. If you disagree with
              changes to this Policy, you should stop using the Platform and
              may request deletion of your account.
            </P>
          </Section>

          <Section title="13. Contact Us">
            <P>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy or our data practices, please contact us:
            </P>
            <Block>
              BDL Sports, LLC — Privacy Team
              <br />
              Nashville, Tennessee
              <br />
              Email: privacy@bdlpickup.com
              <br />
              Support: support@bdlpickup.com
              <br />
              Website: www.bdlpickup.com/privacy
            </Block>
            <P>
              For COPPA-related inquiries regarding a child&apos;s
              information, please include &quot;COPPA Request&quot; in your
              subject line and provide your name, relationship to the child,
              and the child&apos;s username.
            </P>
          </Section>

          <p className="text-[12px] text-[color:var(--text-3)] mt-2">
            This Privacy Policy is effective as of May 2, 2026.
          </p>
        </article>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-[color:var(--text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title }: { title: string }) {
  return (
    <h3 className="text-[12.5px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] mt-1.5">
      {title}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px]">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 text-[14px] flex flex-col gap-1">
      {children}
    </ul>
  );
}

function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--hairline)] bg-[color:var(--brand-soft)]/30 px-4 py-3 text-[12.5px] font-semibold tracking-[0.01em] text-[color:var(--text)] leading-[1.55]">
      {children}
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--hairline)] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] font-[family-name:var(--mono)] text-[color:var(--text-2)] leading-[1.55]">
      {children}
    </div>
  );
}
