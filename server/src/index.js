import 'dotenv/config';
import { createApp } from './app.js';
import { seedSettings } from './lib/settings.js';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

// Seed default settings (idempotent) before serving.
seedSettings()
  .catch((err) => console.error('seedSettings failed:', err))
  .finally(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`clinic-recall server listening on http://localhost:${port}`);
    });
  });
