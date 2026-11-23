const { openDatabase } = require('../src/db');
const { normalizeEmail } = require('../src/auth');

async function promote() {
  const email = normalizeEmail(process.argv[2]);
  if (!email) throw new Error('Usage: npm run promote -- staff@example.com');
  const { client, db } = await openDatabase();
  try {
    const result = await db.collection('users').updateOne({ email }, { $set: { role: 'staff' } });
    if (!result.matchedCount) throw new Error('Account not found. Register this email first.');
    console.log('Staff access is enabled. Sign in again to open the staff page.');
  } finally {
    await client.close();
  }
}

promote().catch(error => {
  console.error('Staff setup failed:', error.message);
  process.exitCode = 1;
});
