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
          </div>

          <div className="ftr-ai">
            <span className="ftr-ai-label">Powered by</span>
            <a
              className="ftr-ai-link"
              href="https://aurumco.ai"
              target="_blank"
              rel="noopener"
              aria-label="AurumCo — opens in new tab"
            >
              <span className="au-square" aria-hidden="true">
                <span>Au</span>
              </span>
              <span className="au-word">
                Aurum<span className="co">Co</span>
              </span>
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
