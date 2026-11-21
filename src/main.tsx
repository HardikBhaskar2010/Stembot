import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/motion.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './pwa';
import { dismissSplash } from './splash';
import { exposeTestHooks } from './testHooks';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

exposeTestHooks();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Let the first frame of the app paint under the splash, then hand over.
requestAnimationFrame(() => requestAnimationFrame(dismissSplash));

registerServiceWorker();
