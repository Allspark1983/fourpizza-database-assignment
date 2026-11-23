const { MongoClient } = require('mongodb');

async function openDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env or your hosting environment.');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'fourpizza');
    // The database enforces uniqueness even when two requests arrive together.
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('pizzas').createIndex(
      { name: 1 },
      { unique: true, collation: { locale: 'en', strength: 2 } }
    );
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}

module.exports = { openDatabase };
