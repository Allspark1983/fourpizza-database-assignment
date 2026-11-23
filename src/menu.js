const express = require('express');
const { ObjectId } = require('mongodb');
const { createAiSearch } = require('./ai');

const categories = ['Classic', 'Signature', 'Veggie'];
const sliceCounts = new Map([[8, 4], [10, 6], [14, 8]]);
const sortByName = { name: 1, _id: 1 };

function badInput(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function textField(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw badInput(`Enter ${name} using between 1 and ${maxLength} characters.`);
  }
  return value.trim();
}

function normalizePizza(body) {
  const name = textField(body?.name, 'a pizza name', 100);
  const description = textField(body?.description, 'a description', 400);
  if (!categories.includes(body?.category)) throw badInput('Choose Classic, Signature or Veggie.');
  if (!Array.isArray(body.sizes) || body.sizes.length < 1 || body.sizes.length > 3) {
    throw badInput('Include between one and three sizes.');
  }
  const used = new Set();
  const sizes = body.sizes.map(size => {
    const { inches, slices, price, available } = size || {};
    if (!sliceCounts.has(inches) || slices !== sliceCounts.get(inches) || used.has(inches)) {
      throw badInput('Each size can appear once. Use 8 inches / 4 slices, 10 / 6 or 14 / 8.');
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10000
      || Math.round(price * 100) / 100 !== price) {
      throw badInput('Enter a positive SGD price up to 10000, with at most two decimal places.');
    }
    if (typeof available !== 'boolean') throw badInput('Availability must be true or false for every size.');
    used.add(inches);
    return { inches, slices, price, available };
  });
  sizes.sort((a, b) => a.inches - b.inches);
  return { name, description, category: body.category, sizes };
}

function escapedTerm(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createMenu(pizzas, requireStaff) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const q = req.query.q ?? '';
    if (typeof q !== 'string' || q.length > 100) throw badInput('Search with up to 100 characters.');
    const term = q.trim();
    let filter = {};
    if (term) {
      const match = { $regex: escapedTerm(term), $options: 'i' };
      filter = { $or: [{ name: match }, { description: match }, { category: match }] };
    }
    const records = await pizzas.find(filter).sort(sortByName).toArray();
    return res.json({ pizzas: records });
  });

  router.post('/search', createAiSearch(pizzas));

  router.param('id', (req, res, next, value) => {
    if (!/^[a-f\d]{24}$/i.test(value)) return res.status(400).json({ error: 'Invalid pizza ID.' });
    req.pizzaId = new ObjectId(value);
    return next();
  });

  router.get('/:id', async (req, res) => {
    const pizza = await pizzas.findOne({ _id: req.pizzaId });
    if (!pizza) return res.status(404).json({ error: 'Pizza not found.' });
    return res.json({ pizza });
  });

  router.post('/', requireStaff, async (req, res) => {
    const pizza = normalizePizza(req.body);
    const { insertedId } = await pizzas.insertOne(pizza);
    return res.location('/api/pizzas/' + insertedId).status(201).json({ pizza: { ...pizza, _id: insertedId } });
  });

  // Replace all editable fields together, preserving the document's stable ID.
  router.put('/:id', requireStaff, async (req, res) => {
    const fields = normalizePizza(req.body);
    const pizza = await pizzas.findOneAndUpdate(
      { _id: req.pizzaId }, { $set: fields }, { returnDocument: 'after' }
    );
    if (!pizza) return res.status(404).json({ error: 'Pizza not found.' });
    return res.json({ pizza });
  });

  router.delete('/:id', requireStaff, async (req, res) => {
    const result = await pizzas.deleteOne({ _id: req.pizzaId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Pizza not found.' });
    return res.sendStatus(204);
  });

  return router;
}

module.exports = { createMenu, normalizePizza };
