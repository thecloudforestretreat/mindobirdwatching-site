(function () {
  'use strict';

  var root = document.querySelector('[data-recommendations-directory]');
  if (!root) return;

  var grid = root.querySelector('[data-directory-grid]');
  var cards = Array.prototype.slice.call(root.querySelectorAll('[data-partner-card]'));
  var search = root.querySelector('[data-directory-search]');
  var sort = root.querySelector('[data-directory-sort]');
  var count = root.querySelector('[data-directory-count]');
  var empty = root.querySelector('[data-directory-empty]');
  var categoryButtons = Array.prototype.slice.call(root.querySelectorAll('[data-filter-category]'));
  var typeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-filter-type]'));
  var activeCategory = 'all';
  var activeType = 'all';

  function tokens(value) {
    return String(value || '').split(/\s+/).filter(Boolean);
  }

  function includesToken(value, token) {
    return token === 'all' || tokens(value).indexOf(token) !== -1;
  }

  function normalize(value) {
    return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function compareCards(a, b) {
    var mode = sort ? sort.value : 'recommended';
    if (mode === 'price-low') return Number(a.dataset.price) - Number(b.dataset.price) || Number(a.dataset.order) - Number(b.dataset.order);
    if (mode === 'price-high') return Number(b.dataset.price) - Number(a.dataset.price) || Number(a.dataset.order) - Number(b.dataset.order);
    if (mode === 'early') return Number(b.dataset.early) - Number(a.dataset.early) || Number(a.dataset.order) - Number(b.dataset.order);
    if (mode === 'recent') return String(b.dataset.verified).localeCompare(String(a.dataset.verified));
    if (mode === 'az') return String(a.dataset.name).localeCompare(String(b.dataset.name));
    return Number(a.dataset.order) - Number(b.dataset.order);
  }

  function updatePressed(buttons, active, attribute) {
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute(attribute) === active ? 'true' : 'false');
    });
  }

  function render() {
    var query = normalize(search ? search.value : '');
    var visible = 0;

    cards.sort(compareCards).forEach(function (card) {
      grid.appendChild(card);
      var matchesCategory = includesToken(card.dataset.category, activeCategory);
      var matchesType = includesToken(card.dataset.types, activeType);
      var matchesSearch = !query || normalize(card.dataset.search).indexOf(query) !== -1;
      var show = matchesCategory && matchesType && matchesSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeCategory = button.dataset.filterCategory;
      updatePressed(categoryButtons, activeCategory, 'data-filter-category');
      render();
    });
  });

  typeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeType = button.dataset.filterType;
      updatePressed(typeButtons, activeType, 'data-filter-type');
      render();
    });
  });

  if (search) search.addEventListener('input', render);
  if (sort) sort.addEventListener('change', render);
  render();
})();
