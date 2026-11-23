const { readFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const { openDatabase } = require('../src/db');
const { normalizePizza } = require('../src/menu');

async function seed() {
  const file = path.join(__dirname, '..', 'data', 'pizzas.json');
  const samples = JSON.parse(await readFile(file, 'utf8')).map(normalizePizza);
  const { client, db } = await openDatabase();
  try {
    const pizzas = db.collection('pizzas');
    let added = 0;
    for (const sample of samples) {
      // Stable IDs make seeding repeatable and preserve later staff edits.
      const hex = createHash('sha256').update('four-pizza-seed:' + sample.name).digest('hex').slice(0, 24);
      const result = await pizzas.updateOne(
        { _id: new ObjectId(hex) }, { $setOnInsert: sample }, { upsert: true }
      );
      added += result.upsertedCount;
    }
    console.log(`Added ${added} sample pizzas. ${samples.length - added} samples already existed.`);
  } finally {
    await client.close();
  }
}

seed().catch(error => {
  console.error('Menu seeding failed:', error.message);
  process.exitCode = 1;
});
