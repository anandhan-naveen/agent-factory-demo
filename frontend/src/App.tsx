import { useCallback, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import type { BooksApi } from './api/client';
import { AddBookPage } from './components/AddBookPage';
import { CatalogPage } from './components/CatalogPage';
import { Toast, type ToastKind, type ToastMessage } from './components/Toast';

interface Props {
  api: BooksApi;
}

let toastSeq = 0;

export function App({ api }: Readonly<Props>) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback((text: string, kind: ToastKind = 'success') => {
    toastSeq += 1;
    setToast({ id: toastSeq, text, kind });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Skip to content
      </a>
      <header className="masthead">
        <div className="masthead__inner">
          <Link to="/" className="brand">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <rect x="5" y="6" width="5" height="20" rx="1" />
              <rect x="12" y="4" width="5" height="22" rx="1" />
              <rect x="19.5" y="7" width="5" height="19" rx="1" transform="rotate(-12 22 16.5)" />
              <rect x="3" y="27" width="26" height="2" rx="1" />
            </svg>
            <span className="brand__text">
              <span className="brand__name">Larkspur Library</span>
              <span className="brand__sub">Catalog desk</span>
            </span>
          </Link>
          {api.mode === 'demo' ? (
            <span className="demo-badge" data-testid="demo-badge" title="No backend configured: changes are stored in this browser only">
              Demo data
            </span>
          ) : null}
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CatalogPage api={api} notify={notify} />} />
          <Route path="/books/new" element={<AddBookPage api={api} notify={notify} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>{api.mode === 'demo' ? 'Demo mode · changes are saved in this browser only.' : 'Live catalog: changes are saved to the catalog service.'}</p>
      </footer>
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
