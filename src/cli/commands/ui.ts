import { openBrowser, startServer } from '../../server';

export async function runUi(port: string | undefined): Promise<void> {
  const requestedPort = port ? Number(port) : 0;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  const { app, port: boundPort, url } = await startServer(requestedPort);
  openBrowser(url);
  console.log(`devin-switcher UI listening on http://127.0.0.1:${boundPort}`);

  const shutdown = async (): Promise<void> => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}
