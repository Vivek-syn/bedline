// Small shared pieces used across the modules. Kept in one file
// because each is a handful of lines and splitting them into
// separate modules would be more ceremony than it is worth.

import { useEffect, useState } from 'react';

export function StatusPill({ status }) {
  return <span className={`pill pill--${String(status).replace(/\s+/g, '-')}`}>{status}</span>;
}

/** Inline feedback. `tone` is 'ok' | 'error' | 'info'. */
export function Notice({ tone = 'info', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="notice__close" onClick={onDismiss} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className={`field${error ? ' field--invalid' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <p className="loading" role="status">{label}…</p>;
}

/**
 * Copy-to-clipboard for the one-time passwords the server issues.
 * Confirms in place, because a generated password is shown once
 * and "did that copy?" is a bad moment to be unsure about.
 */
export function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <span className="copy-value">
      <code>{value}</code>
      <button
        type="button"
        className="btn btn--tiny"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

/** Turns an ApiError into something a form can render. */
export function fieldErrors(error) {
  return error?.details && typeof error.details === 'object' ? error.details : {};
}

export function firstError(errors, field) {
  const entry = errors[field];
  return Array.isArray(entry) ? entry[0] : entry;
}
