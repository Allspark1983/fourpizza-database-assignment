const systemPrompt = `Translate each Four Pizza menu question into a single JSON filter.
Use only the fields the customer mentions. All conditions are combined with AND.
keyword: one literal pizza name or topping, e.g. "pepperoni".
category: "Classic", "Signature", or "Veggie" (the menu category).
inches: 8, 10, or 14. available: true for in stock, false for sold out.
priceUnder: a strict SGD upper limit. maxPrice: an inclusive SGD upper limit.
Use exactly one price field, only when requested. Use numbers for inches and prices.
Examples:
"Available 10-inch pizzas under S$20" -> {"inches":10,"available":true,"priceUnder":20}
"14-inch pizzas for S$26 or less" -> {"inches":14,"maxPrice":26}
"Sold out pepperoni" -> {"keyword":"pepperoni","available":false}
"All pizzas" -> {"all":true}
If a request cannot be expressed by these fields, return {"unsupported":true}.
This includes allergen guarantees, certification, ranking, multiple alternatives or asking to change data.
Return just the JSON object. Never add fields, currency strings, markdown, or database operators.`;

const filterKeys = new Set(['keyword', 'category', 'inches', 'priceUnder', 'maxPrice', 'available']);
const categories = ['Classic', 'Signature', 'Veggie'];

function menuError(status, message) {
  return Object.assign(new Error(message), { status });
}

function validPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000;
}

// Only these typed values may become part of a database query.
function validateFilter(filter) {
  const malformed = () => menuError(502, 'The AI returned an unreadable menu filter. Try rephrasing your question.');
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw malformed();
  const keys = Object.keys(filter);
  if (keys.length === 1 && filter.unsupported === true) {
    throw menuError(422, 'Try a question about a pizza name, topping, category, size, availability or maximum price.');
  }
  if (keys.length === 1 && filter.all === true) return filter;
  if (!keys.length || keys.some(key => !filterKeys.has(key))) throw malformed();
  if ('keyword' in filter && (typeof filter.keyword !== 'string' || !filter.keyword.trim() || filter.keyword.length > 100)) throw malformed();
  if ('category' in filter && !categories.includes(filter.category)) throw malformed();
  if ('inches' in filter && ![8, 10, 14].includes(filter.inches)) throw malformed();
  if ('available' in filter && typeof filter.available !== 'boolean') throw malformed();
  if ('priceUnder' in filter && !validPrice(filter.priceUnder)) throw malformed();
  if ('maxPrice' in filter && !validPrice(filter.maxPrice)) throw malformed();
  if ('priceUnder' in filter && 'maxPrice' in filter) throw malformed();
  return filter;
}

function buildQuery(filter) {
  const query = {};
  const size = {};
  if (filter.keyword) {
    const match = { $regex: filter.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    query.$or = [{ name: match }, { description: match }];
  }
  if (filter.category) query.category = filter.category;
  if ('inches' in filter) size.inches = filter.inches;
  if ('available' in filter) size.available = filter.available;
  if ('priceUnder' in filter) size.price = { $lt: filter.priceUnder };
  if ('maxPrice' in filter) size.price = { $lte: filter.maxPrice };
  // One size option must satisfy every condition, including its own price and stock.
  if (Object.keys(size).length) query.sizes = { $elemMatch: size };
  return query;
}

function matchesSize(size, filter) {
  return (!('inches' in filter) || size.inches === filter.inches)
    && (!('available' in filter) || size.available === filter.available)
    && (!('priceUnder' in filter) || size.price < filter.priceUnder)
    && (!('maxPrice' in filter) || size.price <= filter.maxPrice);
}

async function inferFilter(question) {
  const localUrl = process.env.AI_LOCAL_URL;
  let endpoint = 'https://api.deepseek.com/chat/completions';
  let model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  const headers = { 'Content-Type': 'application/json' };
  if (localUrl) {
    const url = new URL(localUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      throw menuError(503, 'The local AI connection is misconfigured.');
    }
    endpoint = url.toString();
    model = process.env.AI_LOCAL_MODEL || 'local-model';
  } else {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw menuError(503, 'AI search is not connected yet. Use keyword search or ask the operator to configure DeepSeek.');
    }
    headers.Authorization = 'Bearer ' + process.env.DEEPSEEK_API_KEY;
  }

  const request = {
    model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
    response_format: { type: 'json_object' }, temperature: 0, max_tokens: 192
  };
  if (!localUrl) request.thinking = { type: 'disabled' };
  let response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(request), signal: AbortSignal.timeout(45000) });
  } catch {
    throw menuError(503, 'The AI service could not be reached. Try again or use keyword search.');
  }
  if (!response.ok) throw menuError(503, 'The AI provider could not complete this search. Check its connection, model and quota.');
  let filter;
  try {
    const reply = await response.json();
    filter = JSON.parse(reply.choices[0].message.content);
  } catch {
    throw menuError(502, 'The AI did not return readable JSON. Please rephrase your question.');
  }
  return validateFilter(filter);
}

function createAiSearch(pizzas) {
  // A fixed per-instance budget bounds calls to the metered provider.
  let minuteStarts = 0;
  let requests = 0;
  return async (req, res, next) => {
    const question = req.body?.question;
    if (typeof question !== 'string' || !question.trim() || question.length > 300) {
      return res.status(400).json({ error: 'Enter a menu question of up to 300 characters.' });
    }
    if (Date.now() - minuteStarts >= 60000) { minuteStarts = Date.now(); requests = 0; }
    if (requests >= 30) return res.status(429).json({ error: 'AI search is busy. Please try again in a minute.' });
    requests++;
    let filter;
    try {
      filter = await inferFilter(question.trim());
    } catch (error) {
      if (!error.status) return next(error);
      return res.status(error.status).json({ error: error.message });
    }
    const records = await pizzas.find(buildQuery(filter)).sort({ name: 1 }).toArray();
    const matches = records.map(pizza => ({ ...pizza, sizes: pizza.sizes.filter(size => matchesSize(size, filter)) }));
    return res.json({ filter, pizzas: matches });
  };
}

module.exports = { createAiSearch, validateFilter, buildQuery, matchesSize, systemPrompt };
