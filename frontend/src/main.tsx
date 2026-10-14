import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { createBooksApi } from './api';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

const api = createBooksApi();

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App api={api} />
    </HashRouter>
  </StrictMode>,
);
