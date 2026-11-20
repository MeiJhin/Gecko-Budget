import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Mise à jour automatique de l'appli installée quand une nouvelle version est en ligne
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
