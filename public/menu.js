const byId = id => document.getElementById(id);
const statusLine = byId('menu-status');
const searchInput = byId('search-input');
let searchMode = 'keyword';
let selectedCategory = 'All';
let currentPizzas = [];
let currentQuery = '';
let requestNumber = 0;
let loaded = false;

function menuCard(pizza) {
  const card = element('article', 'pizza-card');
  const heading = element('div', 'card-heading');
  heading.append(element('span', 'category-label', pizza.category), element('h3', '', pizza.name));
  card.append(heading, element('p', 'description', pizza.description));

  const sizes = element('ul', 'size-list');
  sizes.setAttribute('aria-label', 'Sizes, availability and prices for ' + pizza.name);
  for (const size of [...pizza.sizes].sort((a, b) => a.inches - b.inches)) {
    const row = element('li', 'size-row');
    const detail = element('span', 'size-detail');
    detail.append(element('strong', '', size.inches + '″'), element('span', 'slices', size.slices + ' slices'));
    row.append(detail, element('span', size.available ? 'available' : 'sold-out', size.available ? 'Available' : 'Sold out'), element('strong', 'price', priceSGD(size.price)));
    sizes.append(row);
  }
  card.append(sizes);
  return card;
}

function renderMenu() {
  const matches = currentPizzas.filter(pizza => selectedCategory === 'All' || pizza.category === selectedCategory);
  byId('pizzas').replaceChildren(...matches.map(menuCard));
  if (loaded) {
    statusLine.className = 'status';
    statusLine.textContent = matches.length
      ? matches.length + (matches.length === 1 ? ' pizza' : ' pizzas') + (currentQuery ? ' matching your search' : ' on the menu')
      : 'No pizzas match these filters. Try another search or reset the filters.';
  }
  byId('reset-menu').hidden = !currentQuery && selectedCategory === 'All' && !searchInput.value;
}

async function loadMenu(query = '') {
  // Only the newest submitted search should update the menu.
  const request = ++requestNumber;
  loaded = false;
  currentPizzas = [];
  currentQuery = query;
  renderMenu();
  statusLine.className = 'status';
  statusLine.textContent = searchMode === 'ai' && query ? 'Finding matching sizes…' : 'Loading menu…';
  try {
    const result = searchMode === 'ai' && query
      ? await api('/api/pizzas/search', { method: 'POST', data: { question: query } })
      : await api('/api/pizzas' + (query ? '?q=' + encodeURIComponent(query) : ''));
    if (request !== requestNumber) return;
    currentPizzas = result.pizzas;
    loaded = true;
    renderMenu();
  } catch (error) {
    if (request !== requestNumber) return;
    statusLine.className = 'status error';
    statusLine.textContent = error.message;
    if (!query) {
      const retry = element('button', 'text-btn retry', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => loadMenu());
      statusLine.append(' ', retry);
    }
  }
}

function setMode(mode) {
  if (searchMode === mode) return;
  searchMode = mode;
  const ai = mode === 'ai';
  byId('keyword-mode').setAttribute('aria-pressed', String(!ai));
  byId('ai-mode').setAttribute('aria-pressed', String(ai));
  byId('search-label').textContent = ai ? 'Ask a menu question' : 'Pizza name or ingredient';
  byId('search-submit').textContent = ai ? 'Ask' : 'Search';
  byId('ai-hint').hidden = !ai;
  searchInput.placeholder = ai ? 'Which 10-inch pizzas are available under S$20?' : 'Try mushroom or pepperoni';
  searchInput.maxLength = ai ? 300 : 100;
  searchInput.setCustomValidity('');
  searchInput.required = ai;
  searchInput.value = '';
  loadMenu();
  searchInput.focus();
}

byId('keyword-mode').addEventListener('click', () => setMode('keyword'));
byId('ai-mode').addEventListener('click', () => setMode('ai'));
byId('search-form').addEventListener('submit', event => {
  event.preventDefault();
  if (searchMode === 'ai' && !searchInput.value.trim()) {
    searchInput.setCustomValidity('Enter a menu question.');
    searchInput.reportValidity();
    return;
  }
  loadMenu(searchInput.value.trim());
});
searchInput.addEventListener('input', () => {
  searchInput.setCustomValidity('');
  byId('reset-menu').hidden = !searchInput.value && !currentQuery && selectedCategory === 'All';
});
const categoryButtons = document.querySelectorAll('[data-category]');
function selectCategory(category) {
  selectedCategory = category;
  for (const button of categoryButtons) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  renderMenu();
}
for (const button of categoryButtons) button.addEventListener('click', () => selectCategory(button.dataset.category));
byId('reset-menu').addEventListener('click', () => {
  searchInput.value = '';
  searchInput.setCustomValidity('');
  selectCategory('All');
  loadMenu();
});
loadMenu();
