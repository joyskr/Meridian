import { createRuntime } from './app-runtime.js';
import { createApp } from './platform/http/create-app.js';
import { createLogger } from './platform/logging/logger.js';

const logger = createLogger('api');

async function bootstrap() {
  try {
    logger.info('server_boot_start');
    const runtime = await createRuntime();
    const app = createApp(runtime);

    app.listen(runtime.config.apiPort, () => {
      logger.info('server_started', { port: runtime.config.apiPort });
    });
  } catch (error) {
    const bootError = error instanceof Error ? error : new Error(String(error));
    logger.error('server_boot_failed', {
      message: bootError.message,
      stack: bootError.stack
    });
    throw bootError;
  }
}

bootstrap().catch((error: Error) => {
  logger.error('server_boot_failed', {
    message: error.message,
    stack: error.stack
  });
  process.exitCode = 1;
});
