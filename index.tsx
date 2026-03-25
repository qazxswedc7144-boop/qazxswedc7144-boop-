import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/AppContext';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);