function log(event: string, context: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      scope: 'worker',
      event,
      context
    })
  );
}

log('worker_bootstrap_ready', {
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1)
});
