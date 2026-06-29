import Link from "next/link";
import { Brand } from "./brand";

export function Footer() {
  const year = new Date().getFullYear();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

  return (
    <footer className="bdl-footer">
      <div className="ftr-inner">
        <div className="ftr-grid">
          <div className="ftr-brand">
            <div className="ftr-mark">
              <Brand height={48} />
            </div>
            <p className="ftr-blurb">
              A pickup basketball tracker for leagues that take their stat lines
              seriously. Every game counts.
            </p>
          </div>

          <div className="ftr-col">
            <h4>Product</h4>
            <Link href="/about">About</Link>
            <Link href="/grades">Grades</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy</Link>
          </div>

          <div className="ftr-ai">
            <span className="ftr-ai-label">Powered by</span>
            <a
              className="ftr-ai-link"
              href="https://rivals.com"
              target="_blank"
              rel="noopener"
              aria-label="Rivals — opens in new tab"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rivals-logo.png"
                alt="Rivals"
                width={101}
                height={22}
                style={{ height: 22, width: "auto", display: "block" }}
              />
            </a>
          </div>
        </div>

        <div className="ftr-bottom">
          <div className="ftr-copy">
            © {year} <b>BDL</b>. All games count. ·{" "}
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link>
          </div>
          <div className="ftr-meta">
            <span className="status-dot">All systems normal</span>
            <span className="ftr-version">v{version}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
