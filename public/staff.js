const byId = id => document.getElementById(id);
// Keep the staff token in memory. Refreshing the page signs the operator out.
let token = '';
let signedInUser = null;
let registering = false;
let editingId = null;
let deleteTarget = null;
let menuItems = [];

function showMessage(id, message = '', isError = false) {
  const line = byId(id);
  line.textContent = message;
  line.className = isError ? 'status error' : 'status';
}

function authMode(create) {
  registering = create;
  byId('auth-title').textContent = create ? 'Create an account' : 'Staff sign-in';
  byId('auth-help').textContent = create ? 'New accounts start with customer access. A shop administrator can grant staff access.' : 'Use your staff account to edit menu items, prices and availability.';
  byId('auth-submit').textContent = create ? 'Create account' : 'Sign in';
  byId('auth-toggle').textContent = create ? 'Back to sign-in' : 'Create an account';
  const password = byId('password');
  password.autocomplete = create ? 'new-password' : 'current-password';
  password.minLength = create ? 8 : 1;
  password.value = '';
  showMessage('auth-message');
}

byId('auth-toggle').addEventListener('click', () => authMode(!registering));
byId('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = byId('auth-submit');
  submit.disabled = true;
  byId('auth-toggle').disabled = true;
  showMessage('auth-message');
  try {
    const data = { email: byId('email').value.trim(), password: byId('password').value };
    if (registering) {
      await api('/api/auth/register', { method: 'POST', data });
      authMode(false);
      showMessage('auth-message', 'Account created. A shop administrator can enable staff access for your email.');
      byId('password').focus();
    } else {
      const session = await api('/api/auth/login', { method: 'POST', data });
      byId('password').value = '';
      if (session.user.role !== 'staff') {
        showMessage('auth-message', 'This account has customer access. Ask a shop administrator for staff access.', true);
        return;
      }
      token = session.token;
      signedInUser = session.user;
      byId('auth-section').hidden = true;
      byId('staff-section').hidden = false;
      byId('sign-out').hidden = false;
      byId('staff-identity').textContent = 'Signed in as ' + session.user.email;
      await refreshInventory();
    }
  } catch (error) {
    showMessage('auth-message', error.message, true);
  } finally {
    submit.disabled = false;
    byId('auth-toggle').disabled = false;
  }
});

function signOut(message = '') {
  token = '';
  signedInUser = null;
  menuItems = [];
  byId('staff-section').hidden = true;
  byId('sign-out').hidden = true;
  byId('auth-section').hidden = false;
  byId('edit-panel').hidden = true;
  byId('inventory-list').replaceChildren();
  authMode(false);
  showMessage('auth-message', message);
  byId('email').focus();
}
byId('sign-out').addEventListener('click', () => signOut());

function staffError(id, error) {
  if (error.status === 401) signOut('Your session has ended. Sign in to continue.');
  else showMessage(id, error.message, true);
}

function buildInventory() {
  const list = byId('inventory-list');
  list.replaceChildren();
  if (!menuItems.length) list.append(element('p', 'hint', 'Your menu is empty. Add a pizza to get started.'));
  for (const pizza of menuItems) {
    const row = element('article', 'inventory-row');
    const summary = element('div');
    summary.append(element('span', 'category-label', pizza.category), element('h3', '', pizza.name));
    const available = pizza.sizes.filter(size => size.available).length;
    summary.append(element('p', 'hint', available + ' of ' + pizza.sizes.length + ' sizes available'));
    const actions = element('div', 'row-actions');
    const edit = element('button', 'text-btn', 'Edit');
    edit.type = 'button';
    edit.setAttribute('aria-label', 'Edit ' + pizza.name);
    edit.addEventListener('click', () => openEditor(pizza));
    const remove = element('button', 'text-btn danger-text', 'Delete');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Delete ' + pizza.name);
    remove.addEventListener('click', () => {
      deleteTarget = pizza;
      byId('delete-detail').textContent = 'Remove ' + pizza.name + ' and all of its sizes from the menu?';
      byId('delete-dialog').showModal();
    });
    actions.append(edit, remove);
    row.append(summary, actions);
    list.append(row);
  }
}

async function refreshInventory(successMessage = '') {
  byId('retry-inventory').hidden = true;
  showMessage('staff-message', 'Loading menu items…');
  try {
    const result = await api('/api/pizzas');
    if (!signedInUser) return;
    menuItems = result.pizzas;
    buildInventory();
    showMessage('staff-message', successMessage);
  } catch (error) {
    if (!signedInUser) return;
    menuItems = [];
    buildInventory();
    byId('inventory-list').replaceChildren();
    showMessage('staff-message', (successMessage ? successMessage + ' ' : '') + error.message, true);
    byId('retry-inventory').hidden = false;
  }
}
byId('retry-inventory').addEventListener('click', () => refreshInventory());

// Each embedded size has its own price and availability in MongoDB.
function sizeFields(inches, slices, existing) {
  const row = element('div', 'variant');
  row.dataset.inches = inches;
  row.dataset.slices = slices;
  const includeLabel = element('label', 'checkbox-label');
  const include = element('input');
  include.type = 'checkbox';
  include.className = 'include-size';
  include.checked = Boolean(existing);
  includeLabel.append(include, document.createTextNode('Include ' + inches + '″ · ' + slices + ' slices'));
  const inner = element('div', 'variant-fields');
  const priceLabel = element('label', '', 'Price (S$)');
  const price = element('input', 'variant-price');
  price.type = 'number';
  price.step = '0.01';
  price.min = '0.01';
  price.max = '10000';
  price.required = true;
  price.setAttribute('aria-label', inches + '-inch price in Singapore dollars');
  if (existing) price.value = existing.price;
  priceLabel.append(price);
  const soldLabel = element('label', 'checkbox-label');
  const sold = element('input', 'variant-sold');
  sold.type = 'checkbox';
  sold.checked = Boolean(existing && !existing.available);
  sold.setAttribute('aria-label', inches + '-inch size sold out');
  soldLabel.append(sold, document.createTextNode('Sold out'));
  inner.append(priceLabel, soldLabel);
  function toggle() {
    price.disabled = !include.checked;
    sold.disabled = !include.checked;
    inner.hidden = !include.checked;
  }
  include.addEventListener('change', toggle);
  toggle();
  row.append(includeLabel, inner);
  return row;
}

function openEditor(pizza) {
  editingId = pizza?._id || null;
  byId('editor-title').textContent = pizza ? 'Edit pizza' : 'Add pizza';
  byId('pizza-name').value = pizza?.name || '';
  byId('description').value = pizza?.description || '';
  byId('category').value = pizza?.category || 'Classic';
  const variants = byId('variant-list');
  variants.replaceChildren();
  for (const [inches, slices] of [[8, 4], [10, 6], [14, 8]]) {
    variants.append(sizeFields(inches, slices, pizza?.sizes.find(size => size.inches === inches)));
  }
  showMessage('editor-message');
  byId('edit-panel').hidden = false;
  byId('editor-title').focus();
}
byId('add-pizza').addEventListener('click', () => openEditor(null));
byId('cancel-edit').addEventListener('click', () => {
  byId('edit-panel').hidden = true;
  editingId = null;
  byId('add-pizza').focus();
});

byId('pizza-form').addEventListener('submit', async event => {
  event.preventDefault();
  const sizes = [];
  for (const row of byId('variant-list').children) {
    if (!row.querySelector('.include-size').checked) continue;
    sizes.push({
      inches: Number(row.dataset.inches), slices: Number(row.dataset.slices),
      price: Number(row.querySelector('.variant-price').value), available: !row.querySelector('.variant-sold').checked
    });
  }
  if (!sizes.length) {
    showMessage('editor-message', 'Include at least one size and enter its price.', true);
    byId('variant-list').querySelector('input').focus();
    return;
  }
  const data = { name: byId('pizza-name').value.trim(), description: byId('description').value.trim(), category: byId('category').value, sizes };
  const submit = byId('save-pizza');
  submit.disabled = true;
  try {
    await api(editingId ? '/api/pizzas/' + editingId : '/api/pizzas', { method: editingId ? 'PUT' : 'POST', data, token });
    byId('edit-panel').hidden = true;
    editingId = null;
    await refreshInventory(data.name + ' saved.');
    byId('add-pizza').focus();
  } catch (error) {
    staffError('editor-message', error);
  } finally {
    submit.disabled = false;
  }
});

byId('cancel-delete').addEventListener('click', () => byId('delete-dialog').close());
byId('confirm-delete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  const pizza = deleteTarget;
  deleteTarget = null;
  byId('delete-dialog').close();
  try {
    await api('/api/pizzas/' + pizza._id, { method: 'DELETE', token });
    if (editingId === pizza._id) {
      editingId = null;
      byId('edit-panel').hidden = true;
    }
    await refreshInventory(pizza.name + ' deleted.');
  } catch (error) {
    staffError('staff-message', error);
  }
});
