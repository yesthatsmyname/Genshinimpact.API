// Character data and artwork are provided by http://127.0.0.1:5000/.
const API = 'http://127.0.0.1:5000';
const state = { slugs: [], filtered: [], cache: new Map() };
const $ = selector => document.querySelector(selector);

const searchInput = $('#search');
const grid = $('#character-grid');
const status = $('#status');
const resultCount = $('#result-count');
const dialog = $('#character-dialog');
const closeButton = $('#close-dialog');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.hidden = !message;
}

function slugLabel(slug) {
  return slug
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createArtwork(slug, className = '') {
  const image = document.createElement('img');
  image.className = className;
  image.alt = '';
  image.loading = 'lazy';
  image.src = `${API}/characters/${encodeURIComponent(slug)}/icon-big`;
  image.addEventListener('error', () => {
    image.hidden = true;
  }, { once: true });
  return image;
}

function renderCharacters() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  state.filtered = state.slugs.filter(slug => slugLabel(slug).toLocaleLowerCase().includes(query));
  grid.replaceChildren();
  resultCount.textContent = state.filtered.length ? `(${state.filtered.length})` : '';

  if (!state.filtered.length) {
    setStatus(query ? 'No characters match your search.' : 'No characters are available right now.');
    return;
  }

  setStatus('');
  const fragment = document.createDocumentFragment();
  for (const slug of state.filtered) {
    const button = document.createElement('button');
    button.className = 'character-card';
    button.type = 'button';
    button.setAttribute('aria-label', `View ${slugLabel(slug)} details`);

    const artwork = document.createElement('span');
    artwork.className = 'card-artwork';
    artwork.append(createArtwork(slug));

    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = slugLabel(slug);

    button.append(artwork, name);
    button.addEventListener('click', () => openCharacter(slug));
    fragment.append(button);
  }
  grid.append(fragment);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The character service returned ${response.status}.`);
  }
  return response.json();
}

async function loadCharacters() {
  grid.replaceChildren();
  resultCount.textContent = '';
  setStatus('Loading characters…');
  try {
    const data = await fetchJson(`${API}/characters`);
    if (!Array.isArray(data)) {
      throw new Error('The character service returned an unexpected response.');
    }
    state.slugs = data
      .map(item => typeof item === 'string' ? item : item?.name)
      .filter(slug => typeof slug === 'string' && slug.length > 0);
    renderCharacters();
  } catch (error) {
    setStatus(`${error.message} Check your connection and try again.`, true);
    const retry = document.createElement('button');
    retry.className = 'retry-button';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', loadCharacters);
    status.append(' ', retry);
  }
}

function addFact(list, label, value) {
  if (value === undefined || value === null || value === '') return;
  const item = document.createElement('div');
  item.className = 'fact';
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = Array.isArray(value) ? value.join(', ') : String(value);
  item.append(term, detail);
  list.append(item);
}

function addDetailSection(container, title, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const section = document.createElement('section');
  section.className = 'detail-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading);

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const item = document.createElement('div');
    item.className = 'detail-entry';
    const name = document.createElement('h4');
    name.textContent = entry.name || entry.unlock || 'Details';
    item.append(name);
    if (entry.type) {
      const type = document.createElement('span');
      type.className = 'entry-type';
      type.textContent = entry.type;
      item.append(type);
    }
    if (entry.description) {
      const description = document.createElement('p');
      description.textContent = entry.description;
      item.append(description);
    }
    section.append(item);
  }
  container.append(section);
}

function showCharacter(data, slug) {
  $('#detail-name').textContent = data.name || slugLabel(slug);
  $('#detail-subtitle').textContent = [data.title, data.vision && `${data.vision} Vision`].filter(Boolean).join(' · ');
  $('#detail-description').textContent = data.description || 'No description is available for this character.';

  const image = $('#detail-image');
  const fallback = $('#detail-image-fallback');
  image.hidden = false;
  fallback.hidden = true;
  image.src = `${API}/characters/${encodeURIComponent(slug)}/gacha-splash`;
  image.onerror = () => {
    image.hidden = true;
    fallback.hidden = false;
    image.onerror = null;
  };
  image.alt = `${data.name || slugLabel(slug)} artwork`;

  const facts = $('#detail-facts');
  facts.replaceChildren();
  addFact(facts, 'Element', data.vision);
  addFact(facts, 'Weapon', data.weapon);
  addFact(facts, 'Nation', data.nation);
  addFact(facts, 'Affiliation', data.affiliation);
  addFact(facts, 'Rarity', data.rarity ? `${data.rarity} ★` : '');
  addFact(facts, 'Birthday', data.birthday);
  addFact(facts, 'Constellation', data.constellation);

  const extra = $('#detail-extra');
  extra.replaceChildren();
  addDetailSection(extra, 'Combat talents', data.skillTalents);
  addDetailSection(extra, 'Passive talents', data.passiveTalents);
  addDetailSection(extra, 'Constellations', data.constellations);
  dialog.showModal();
  closeButton.focus();
}

async function openCharacter(slug) {
  try {
    const data = state.cache.has(slug)
      ? state.cache.get(slug)
      : await fetchJson(`${API}/characters/${encodeURIComponent(slug)}`);
    state.cache.set(slug, data);
    showCharacter(data, slug);
  } catch (error) {
    setStatus(`Couldn't load ${slugLabel(slug)}: ${error.message}`, true);
  }
}

searchInput.addEventListener('input', renderCharacters);
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadCharacters();
