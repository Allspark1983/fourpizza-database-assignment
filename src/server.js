const { createApp } = require('./app');
const { openDatabase } = require('./db');

async function start() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const { client, db } = await openDatabase();
  try {
    const app = createApp(db, process.env.JWT_SECRET);
    const server = app.listen(port);
    server.once('listening', () => console.log(`Four Pizza is listening on port ${port}.`));
    server.once('error', async error => {
      console.error('The web server could not start:', error.code);
      await client.close();
      process.exitCode = 1;
    });
    function stop() {
      server.close(() => client.close());
    }
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  } catch (error) {
    await client.close();
    throw error;
  }
}

start().catch(error => {
  console.error('Startup failed:', error.message);
  process.exitCode = 1;
});
