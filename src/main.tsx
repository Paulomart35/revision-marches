import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';

// Demande au navigateur de ne pas effacer les données locales quand la place manque.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
