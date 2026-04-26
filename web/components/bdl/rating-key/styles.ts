/**
 * Stand-alone CSS for the Rating Key modal. Kept as a string and
 * injected via a single <style> tag so the modal stays a portable,
 * self-contained widget — no global tokens, no Tailwind dependency.
 */
export const ratingKeyStyles = `
  .rk-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: rk-fade-in 150ms ease-out;
  }
  .rk-dialog {
    --bdl-orange: #E87722;
    --court-black: #0A0A0A;
    --chalk: #FAFAFA;
    --stat-gray: #777777;
    --rk-surface: #131313;
    --rk-border: #1F1F1F;

    position: relative;
    width: 100%; max-width: 560px;
    max-height: calc(100vh - 48px);
    overflow: auto;
    background: var(--rk-surface);
    color: var(--chalk);
    border: 1px solid var(--rk-border);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    animation: rk-pop-in 200ms ease-out;
    font-family: var(--font), -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .rk-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 16px;
    padding: 22px 22px 14px;
    border-bottom: 1px solid var(--rk-border);
  }
  .rk-titles { display: flex; flex-direction: column; gap: 6px; }
  .rk-subtitle {
    font-family: var(--mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--stat-gray);
  }
  .rk-title {
    font-family: var(--font-display), var(--font), -apple-system, sans-serif;
    font-weight: 800;
    font-size: 24px;
    letter-spacing: -0.02em;
    color: var(--chalk);
    margin: 0;
  }
  .rk-close {
    width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent;
    color: var(--stat-gray);
    border: 1px solid var(--rk-border);
    border-radius: 8px;
    cursor: pointer;
    transition: color 120ms, border-color 120ms, background 120ms;
  }
  .rk-close:hover { color: var(--chalk); background: rgba(255,255,255,0.04); }
  .rk-close:focus-visible {
    outline: 2px solid var(--bdl-orange);
    outline-offset: 2px;
  }

  .rk-tabs {
    display: inline-flex;
    margin: 14px 22px 0;
    padding: 4px;
    gap: 4px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--rk-border);
    border-radius: 10px;
  }
  .rk-tab {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 8px 16px;
    border-radius: 8px;
    font-family: var(--font-display), var(--font), sans-serif;
    font-weight: 700;
    font-size: 14px;
    color: var(--stat-gray);
    cursor: pointer;
    transition: color 120ms, background 120ms;
  }
  .rk-tab:hover { color: var(--chalk); }
  .rk-tab-active {
    background: var(--bdl-orange);
    color: var(--court-black);
  }
  .rk-tab-active:hover { color: var(--court-black); }
  .rk-tab:focus-visible {
    outline: 2px solid var(--bdl-orange);
    outline-offset: 2px;
  }

  .rk-rows {
    list-style: none;
    margin: 14px 0 8px;
    padding: 0 22px;
  }
  .rk-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    align-items: start;
    gap: 16px;
    padding: 18px 0;
    border-top: 1px solid var(--rk-border);
  }
  .rk-row:first-child { border-top: 0; }
  .rk-row-active {
    border-top: 0;
    background: rgba(232,119,34,0.06);
    border-left: 3px solid var(--bdl-orange);
    padding-left: 13px;
    margin-left: -16px;
    margin-right: -16px;
    padding-right: 16px;
    border-radius: 6px;
  }
  .rk-label {
    display: inline-flex; align-items: center; gap: 10px;
    padding-top: 2px;
  }
  .rk-dot {
    width: 10px; height: 10px; border-radius: 50%;
    flex-shrink: 0;
  }
  .rk-grade-name {
    font-family: var(--mono), ui-monospace, monospace;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--chalk);
  }
  .rk-desc {
    margin: 0;
    font-family: var(--font), -apple-system, sans-serif;
    font-weight: 400;
    font-size: 15px;
    line-height: 1.55;
    color: #cfcfcf;
  }
  .rk-row-active .rk-desc { color: var(--chalk); }
  .rk-desc strong {
    font-weight: 600;
    color: var(--chalk);
  }

  @keyframes rk-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rk-pop-in {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes rk-slide-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  @media (max-width: 600px) {
    .rk-backdrop {
      align-items: flex-end;
      padding: 0;
    }
    .rk-dialog {
      max-width: 600px;
      max-height: 85vh;
      border-radius: 18px 18px 0 0;
      border-bottom: 0;
      animation: rk-slide-up 220ms ease-out;
    }
    .rk-dialog::before {
      content: "";
      position: sticky;
      top: 0;
      display: block;
      width: 40px; height: 4px;
      margin: 12px auto 0;
      border-radius: 2px;
      background: var(--stat-gray);
      opacity: 0.6;
    }
    .rk-header { padding-top: 8px; }
    .rk-row { grid-template-columns: 1fr; gap: 8px; }
  }
`;
