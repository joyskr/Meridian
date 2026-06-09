import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'api'
  });
});

healthRouter.get('/ready', (_request, response) => {
  response.status(200).json({
    status: 'ready',
    service: 'api'
  });
});
