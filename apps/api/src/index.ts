import { createRuntime } from './app-runtime.js';
import { createApp } from './platform/http/create-app.js';
import { createLogger } from './platform/logging/logger.js';

const logger = createLogger('api');

async function bootstrap() {
  const runtime = await createRuntime();
  const app = createApp(runtime);

  app.listen(runtime.config.apiPort, () => {
    logger.info('server_started', { port: runtime.config.apiPort });
  });
}

bootstrap().catch((error: Error) => {
  logger.error('server_boot_failed', {
    message: error.message
  });
  process.exitCode = 1;
});
