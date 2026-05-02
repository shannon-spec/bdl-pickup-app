import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Terms of Service · BDL",
  description:
    "Ball Don't Lie Terms of Service — the agreement governing use of the BDL platform.",
};

export default function TermsPage() {
  return (
    <>
      <TopBar active="/terms" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Terms of Service" />
        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          Effective Date: May 2, 2026 · Nashville, Tennessee
        </p>

        <article className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 py-6 max-sm:px-5 flex flex-col gap-6 text-[color:var(--text-2)] leading-[1.65]">
          <Notice>
            PLEASE READ THESE TERMS OF SERVICE CAREFULLY BEFORE USING THE BALL
            DON&apos;T LIE PLATFORM. BY CREATING AN ACCOUNT OR USING OUR
            SERVICES, YOU AGREE TO BE BOUND BY THESE TERMS.
          </Notice>

          <Section title="1. Acceptance of Terms">
            <P>
              These Terms of Service (&quot;Terms&quot;) constitute a legally
              binding agreement between you (&quot;User,&quot; &quot;you,&quot;
              or &quot;your&quot;) and BDL Sports, LLC (&quot;BDL,&quot;
              &quot;Ball Don&apos;t Lie,&quot; &quot;Company,&quot;
              &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a company
              headquartered in Nashville, Tennessee, governing your access to
              and use of the Ball Don&apos;t Lie website, mobile application,
              and related services (collectively, the &quot;Platform&quot; or
              &quot;Services&quot;).
            </P>
            <P>
              By accessing or using the Platform, registering an account, or
              clicking any button that indicates acceptance, you acknowledge
              that you have read, understood, and agree to be bound by these
              Terms, our Privacy Policy, and any additional guidelines or
              policies incorporated herein by reference. If you do not agree
              to these Terms, you must not access or use the Platform.
            </P>
          </Section>

          <Section title="2. Eligibility and Age Requirements">
            <Sub title="2.1 General Eligibility" />
            <P>
              You must be at least thirteen (13) years of age to register for
              and use the Platform. By creating an account, you represent and
              warrant that you meet this minimum age requirement.
            </P>
            <Sub title="2.2 Users Under 13 — COPPA Compliance" />
            <P>
              The Platform is not directed to children under the age of 13.
              We do not knowingly collect personal information from children
              under 13 without verifiable parental consent as required by the
              Children&apos;s Online Privacy Protection Act
              (&quot;COPPA&quot;). If we discover that a child under 13 has
              provided personal information without parental consent, we will
              promptly delete such information and terminate the account. If
              you are a parent or guardian and believe your child under 13
              has created an account or provided personal information, please
              contact us immediately at privacy@bdlpickup.com.
            </P>
            <Sub title="2.3 Users Ages 13–17 (Minors)" />
            <P>
              If you are between the ages of 13 and 17, you may only use the
              Platform with the prior consent of a parent or legal guardian.
              By registering, your parent or guardian agrees to be bound by
              these Terms on your behalf. BDL reserves the right to require
              parental consent verification at any time.
            </P>
            <Sub title="2.4 Geographic Eligibility" />
            <P>
              The Platform is operated from the United States. If you access
              the Platform from outside the United States, you do so at your
              own risk and are responsible for compliance with your local
              laws and regulations.
            </P>
          </Section>

          <Section title="3. Account Registration and Security">
            <Sub title="3.1 Account Creation" />
            <P>
              To access certain features of the Platform, you must register
              for an account. During registration, you may be required to
              provide information including, but not limited to:
            </P>
            <UL>
              <LI>Full legal name</LI>
              <LI>Email address</LI>
              <LI>Date of birth</LI>
              <LI>Phone number</LI>
              <LI>Physical address or general location</LI>
              <LI>Basketball skill level, position(s), and playing history</LI>
              <LI>Profile photo or other identifying media</LI>
              <LI>Payment information (where applicable)</LI>
            </UL>
            <Sub title="3.2 Accuracy of Information" />
            <P>
              You agree to provide accurate, current, and complete information
              during registration and to update such information promptly if
              it changes. BDL reserves the right to suspend or terminate your
              account if any information provided is found to be inaccurate,
              false, or misleading.
            </P>
            <Sub title="3.3 Account Security" />
            <P>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity that occurs under your
              account. You agree to:
            </P>
            <UL>
              <LI>
                Choose a strong, unique password and keep it confidential
              </LI>
              <LI>Not share your account credentials with any third party</LI>
              <LI>
                Log out of your account at the end of each session on shared
                devices
              </LI>
              <LI>
                Notify BDL immediately at support@bdlpickup.com if you
                suspect unauthorized use of your account
              </LI>
            </UL>
            <P>
              BDL shall not be liable for any loss or damage arising from
              your failure to comply with these security obligations.
            </P>
            <Sub title="3.4 One Account Per Person" />
            <P>
              Each individual may register only one account. Creating
              multiple accounts for the same individual is prohibited unless
              expressly authorized by BDL in writing.
            </P>
          </Section>

          <Section title="4. Use of the Platform">
            <Sub title="4.1 Permitted Uses" />
            <P>
              Subject to these Terms, BDL grants you a limited,
              non-exclusive, non-transferable, revocable license to access
              and use the Platform for your personal, non-commercial use to:
            </P>
            <UL>
              <LI>
                Find and participate in pickup basketball games and organized
                leagues
              </LI>
              <LI>Create and manage player profiles</LI>
              <LI>Connect with other players and teams</LI>
              <LI>
                Access basketball statistics, scores, and related content
              </LI>
              <LI>
                Communicate with other users through Platform-provided
                messaging features
              </LI>
            </UL>
            <Sub title="4.2 Prohibited Conduct" />
            <P>You agree that you will NOT:</P>
            <UL>
              <LI>
                Use the Platform for any unlawful purpose or in violation of
                any applicable law or regulation
              </LI>
              <LI>
                Impersonate any person or entity, or falsely state or
                misrepresent your affiliation with any person or entity
              </LI>
              <LI>
                Post, upload, or transmit content that is harassing,
                threatening, abusive, defamatory, obscene, vulgar, or
                otherwise objectionable
              </LI>
              <LI>
                Harass, intimidate, or bully other users, particularly minors
              </LI>
              <LI>
                Collect or harvest personal information about other users
                without their express consent
              </LI>
              <LI>Use the Platform to send unsolicited communications (spam)</LI>
              <LI>
                Attempt to gain unauthorized access to any portion of the
                Platform or any systems or networks connected thereto
              </LI>
              <LI>
                Use automated scripts, bots, scrapers, or other automated
                means to access, collect data from, or interact with the
                Platform
              </LI>
              <LI>
                Interfere with or disrupt the integrity or performance of the
                Platform
              </LI>
              <LI>Upload or transmit viruses or any other malicious code</LI>
              <LI>
                Reproduce, duplicate, sell, resell, or exploit any portion of
                the Platform without express written permission from BDL
              </LI>
              <LI>
                Use the Platform in any manner that could damage, disable,
                overburden, or impair BDL&apos;s servers or networks
              </LI>
            </UL>
          </Section>

          <Section title="5. User-Generated Content">
            <Sub title="5.1 Your Content" />
            <P>
              The Platform may allow you to post, upload, submit, store,
              transmit, or display content, including but not limited to
              profile information, photos, videos, game statistics, reviews,
              messages, and other materials (&quot;User Content&quot;). You
              retain ownership of the intellectual property rights in your
              original User Content.
            </P>
            <Sub title="5.2 License to BDL" />
            <P>
              By submitting User Content to the Platform, you grant BDL a
              worldwide, non-exclusive, royalty-free, sublicensable, and
              transferable license to use, reproduce, distribute, prepare
              derivative works of, display, and perform your User Content in
              connection with operating and promoting the Platform and
              BDL&apos;s business.
            </P>
            <Sub title="5.3 Content Standards" />
            <P>
              All User Content must comply with the following standards.
              Content must not:
            </P>
            <UL>
              <LI>Violate any applicable law or regulation</LI>
              <LI>
                Infringe any intellectual property right or other proprietary
                right of any third party
              </LI>
              <LI>Contain sexually explicit material of any kind</LI>
              <LI>
                Contain content that sexualizes, exploits, or endangers
                minors in any way
              </LI>
              <LI>
                Promote violence, self-harm, discrimination, or illegal
                activity
              </LI>
              <LI>
                Disclose another person&apos;s private information without
                their consent
              </LI>
            </UL>
            <Sub title="5.4 BDL's Right to Remove Content" />
            <P>
              BDL reserves the right, but not the obligation, to review,
              monitor, edit, or remove any User Content that we determine, in
              our sole discretion, violates these Terms or is otherwise
              objectionable. We may take action without prior notice.
            </P>
          </Section>

          <Section title="6. Collection and Use of Data">
            <Sub title="6.1 Personal Information" />
            <P>
              By registering and using the Platform, you consent to BDL&apos;s
              collection, processing, and use of your personal information as
              described in our Privacy Policy, which is incorporated into
              these Terms by reference. The types of data we collect include:
            </P>
            <UL>
              <LI>Identity and contact data (name, email, phone, address)</LI>
              <LI>Date of birth and age verification data</LI>
              <LI>
                Athletic profile data (skill level, positions, statistics)
              </LI>
              <LI>Location data (for game matching and event coordination)</LI>
              <LI>Usage data and device information</LI>
              <LI>Communications and messages sent through the Platform</LI>
              <LI>Payment and transaction data</LI>
            </UL>
            <Sub title="6.2 Data Sharing" />
            <P>
              Certain profile information (such as your display name, player
              profile, and basketball statistics) may be visible to other
              registered users of the Platform. You control the visibility of
              certain information through your account privacy settings.
            </P>
            <Sub title="6.3 Minor User Data" />
            <P>
              For users under 18, BDL applies additional data minimization
              practices and does not use such users&apos; data for behavioral
              advertising. Parents and guardians of minor users may contact
              us to review, correct, or delete their child&apos;s personal
              information.
            </P>
          </Section>

          <Section title="7. Payments and Fees">
            <Sub title="7.1 Paid Features" />
            <P>
              Certain features of the Platform may require payment of fees.
              All fees are stated in U.S. dollars and are non-refundable
              except as required by applicable law or as expressly stated at
              the time of purchase.
            </P>
            <Sub title="7.2 Billing" />
            <P>
              By providing payment information, you authorize BDL (or its
              third-party payment processor) to charge the applicable fees to
              your designated payment method. You agree to keep your payment
              information current and accurate.
            </P>
            <Sub title="7.3 Refunds" />
            <P>
              Refunds are issued at BDL&apos;s sole discretion, except where
              required by law. Please contact support@bdlpickup.com within 7
              days of a charge if you believe you have been incorrectly
              billed.
            </P>
          </Section>

          <Section title="8. Intellectual Property">
            <Sub title="8.1 BDL's Intellectual Property" />
            <P>
              The Platform and its entire contents, features, and
              functionality — including but not limited to text, graphics,
              logos, icons, images, audio clips, software, and code — are
              owned by BDL, its licensors, or other providers and are
              protected by United States and international copyright,
              trademark, patent, and other intellectual property laws.
            </P>
            <Sub title="8.2 Trademarks" />
            <P>
              &quot;Ball Don&apos;t Lie,&quot; &quot;BDL,&quot; and
              associated logos and marks are trademarks of BDL Sports, LLC.
              You may not use any BDL trademark without prior written
              permission.
            </P>
            <Sub title="8.3 Feedback" />
            <P>
              Any feedback, suggestions, or ideas you provide to BDL
              regarding the Platform may be used by BDL without restriction
              or compensation to you.
            </P>
          </Section>

          <Section title="9. Community Safety and Conduct">
            <P>
              Because BDL connects people for in-person athletic activities,
              including players of all ages:
            </P>
            <UL>
              <LI>
                You agree to conduct yourself in a safe, sportsmanlike, and
                respectful manner at all BDL-organized or BDL-facilitated
                events
              </LI>
              <LI>
                You will not use the Platform to arrange meetings with minors
                for any purpose other than legitimate basketball
                participation
              </LI>
              <LI>
                BDL reserves the right to verify user identities in
                connection with safety investigations
              </LI>
              <LI>
                Any threat of violence or sexual misconduct, especially
                involving minors, will be reported to law enforcement
                immediately
              </LI>
              <LI>
                Users may report safety concerns to safety@bdlpickup.com at
                any time
              </LI>
            </UL>
          </Section>

          <Section title="10. Disclaimers">
            <Notice>
              THE PLATFORM AND ALL CONTENT, SERVICES, AND FEATURES THEREON
              ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot; BASIS WITHOUT ANY WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, OR NON-INFRINGEMENT.
            </Notice>
            <P>
              BDL does not warrant that the Platform will be uninterrupted,
              error-free, secure, or free of viruses or other harmful
              components. BDL does not warrant the accuracy, completeness,
              or usefulness of any information on the Platform.
            </P>
            <P>
              BDL is not responsible for any injuries, accidents, or other
              harm that may occur during basketball activities arranged
              through the Platform. Participation in athletic activities
              involves inherent risks, and you assume full responsibility for
              your participation.
            </P>
          </Section>

          <Section title="11. Limitation of Liability">
            <Notice>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, BDL, ITS
              OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, AND SERVICE
              PROVIDERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES,
              INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE,
              GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED
              TO YOUR USE OF OR INABILITY TO USE THE PLATFORM.
            </Notice>
            <P>
              In no event shall BDL&apos;s aggregate liability to you for all
              claims arising from or related to the Platform exceed the
              greater of (a) the total fees you paid to BDL in the twelve
              (12) months preceding the claim or (b) one hundred dollars
              ($100.00).
            </P>
            <P>
              Some jurisdictions do not allow the exclusion or limitation of
              certain damages, so the above limitations may not apply to you.
            </P>
          </Section>

          <Section title="12. Indemnification">
            <P>
              You agree to defend, indemnify, and hold harmless BDL, its
              affiliates, officers, directors, employees, contractors,
              agents, licensors, and service providers from and against any
              claims, liabilities, damages, judgments, awards, losses, costs,
              expenses, or fees (including reasonable attorneys&apos; fees)
              arising out of or relating to:
            </P>
            <UL>
              <LI>Your violation of these Terms</LI>
              <LI>Your User Content</LI>
              <LI>Your use of the Platform</LI>
              <LI>
                Your participation in any basketball activity or event
                arranged through the Platform
              </LI>
              <LI>
                Your violation of any third-party right, including
                intellectual property, privacy, or publicity rights
              </LI>
            </UL>
          </Section>

          <Section title="13. Governing Law and Dispute Resolution">
            <Sub title="13.1 Governing Law" />
            <P>
              These Terms and any dispute arising out of or related to them
              or the Platform shall be governed by the laws of the State of
              Tennessee, without regard to its conflict of law principles.
              You consent to the exclusive jurisdiction of the state and
              federal courts located in Davidson County, Tennessee.
            </P>
            <Sub title="13.2 Informal Resolution" />
            <P>
              Before filing any formal legal claim, you agree to first
              contact BDL at legal@bdlpickup.com and attempt to resolve the
              dispute informally. BDL will attempt to resolve the dispute
              within 30 days of receiving written notice.
            </P>
            <Sub title="13.3 Arbitration" />
            <P>
              Any dispute that cannot be resolved informally shall be
              submitted to binding arbitration conducted by JAMS under its
              applicable rules, in Nashville, Tennessee, before a single
              arbitrator. The arbitrator&apos;s decision shall be final and
              binding. Judgment on the award may be entered in any court of
              competent jurisdiction.
            </P>
            <Sub title="13.4 Class Action Waiver" />
            <Notice>
              YOU AND BDL AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER
              ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF
              OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE
              ACTION.
            </Notice>
            <Sub title="13.5 Exception for Minor Users" />
            <P>
              The arbitration clause above does not apply to claims arising
              under COPPA or other laws specifically protecting children.
            </P>
          </Section>

          <Section title="14. Termination">
            <Sub title="14.1 Termination by You" />
            <P>
              You may terminate your account at any time by contacting
              support@bdlpickup.com or using any account deletion feature
              available within the Platform. Termination does not relieve
              you of any obligations accrued prior to termination.
            </P>
            <Sub title="14.2 Termination by BDL" />
            <P>
              BDL may suspend or terminate your account and access to the
              Platform at any time, with or without cause or notice,
              including for violation of these Terms. BDL shall not be liable
              to you for any termination of your account.
            </P>
            <Sub title="14.3 Effect of Termination" />
            <P>
              Upon termination, your right to use the Platform will
              immediately cease. Provisions of these Terms that by their
              nature should survive termination shall survive, including
              sections on intellectual property, disclaimers, indemnification,
              limitation of liability, and governing law.
            </P>
          </Section>

          <Section title="15. Modifications to Terms">
            <P>
              BDL reserves the right to modify these Terms at any time. When
              we make changes, we will update the &quot;Effective Date&quot;
              at the top of this document and, for material changes, provide
              notice to registered users via email or a prominent notice on
              the Platform. Your continued use of the Platform after any
              modification constitutes your acceptance of the updated Terms.
              If you do not agree to the modified Terms, you must stop using
              the Platform.
            </P>
          </Section>

          <Section title="16. Third-Party Links and Services">
            <P>
              The Platform may contain links to third-party websites or
              services. BDL is not responsible for the content, privacy
              practices, or terms of any third-party sites. Accessing
              third-party sites is at your own risk.
            </P>
          </Section>

          <Section title="17. Privacy Policy">
            <P>
              Your use of the Platform is also governed by our Privacy
              Policy, available at www.bdlpickup.com/privacy, which is
              incorporated into these Terms by reference. By using the
              Platform, you consent to the data practices described in the
              Privacy Policy.
            </P>
          </Section>

          <Section title="18. DMCA — Copyright Complaints">
            <P>
              BDL respects the intellectual property of others. If you
              believe that any content on the Platform infringes your
              copyright, please send a DMCA-compliant takedown notice to:
            </P>
            <Block>
              DMCA Agent
              <br />
              BDL Sports, LLC
              <br />
              Nashville, Tennessee
              <br />
              dmca@bdlpickup.com
            </Block>
          </Section>

          <Section title="19. Severability and Entire Agreement">
            <P>
              If any provision of these Terms is held to be invalid or
              unenforceable by a court of competent jurisdiction, the
              remaining provisions will continue in full force and effect.
              These Terms, together with the Privacy Policy and any other
              policies incorporated herein, constitute the entire agreement
              between you and BDL with respect to the Platform and supersede
              all prior or contemporaneous agreements, representations, and
              understandings.
            </P>
          </Section>

          <Section title="20. Waiver">
            <P>
              No waiver by BDL of any term or condition set out in these
              Terms shall be deemed a further or continuing waiver of such
              term or condition, and any failure by BDL to assert a right or
              provision under these Terms shall not constitute a waiver of
              such right or provision.
            </P>
          </Section>

          <Section title="21. Contact Information">
            <P>
              If you have any questions about these Terms, please contact us:
            </P>
            <Block>
              BDL Sports, LLC
              <br />
              Nashville, Tennessee
              <br />
              Email: legal@bdlpickup.com
              <br />
              Support: support@bdlpickup.com
              <br />
              Website: www.bdlpickup.com
            </Block>
          </Section>

          <p className="text-[12.5px] text-[color:var(--text-3)] pt-2 border-t border-[color:var(--hairline)]">
            These Terms of Service are effective as of May 2, 2026.
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
