import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './components/ui/Toast';
import { DataProvider } from './state/DataProvider';
import { AuthProvider } from './auth/AuthProvider';
import { registerServiceWorker } from './registerServiceWorker';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
