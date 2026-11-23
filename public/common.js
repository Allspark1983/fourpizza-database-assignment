// The menu and staff pages share one way to call the Express API.
async function api(path, options = {}) {
  const headers = { ...options.headers };
  let body;
  if (options.data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.data);
  }
  if (options.token) headers.Authorization = 'Bearer ' + options.token;

  let response;
  try {
    response = await fetch(path, { method: options.method || 'GET', headers, body });
  } catch (error) {
    throw new Error('Could not reach Four Pizza. Check your connection and try again.');
  }
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(typeof payload?.error === 'string' ? payload.error : 'The menu service could not complete your request. Please try again.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

// Always add text from database records through textContent.
function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
}

function priceSGD(value) {
  return 'S$' + Number(value).toFixed(2);
}
