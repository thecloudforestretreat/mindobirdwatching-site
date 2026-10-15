// Species are server-rendered; filtering is progressive enhancement.
(() => {
  const cards = [...document.querySelectorAll('#bcCards [data-species]')];
  const search = document.getElementById('bcSearch');
  const category = document.getElementById('bcCategory');
  const status = document.getElementById('bcStatus');
  if (!cards.length || !search || !category || !status) return;
  const es = document.documentElement.lang === 'es';
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function filter() {
    const query = normalize(search.value.trim());
    let visible = 0;
    for (const card of cards) {
      const show = normalize(card.dataset.species).includes(query) && (category.value === 'all' || card.dataset.category === category.value);
      card.hidden = !show;
      if (show) visible++;
    }
    status.textContent = es ? `Mostrando ${visible} ${visible === 1 ? 'especie' : 'especies'}` : `Showing ${visible} species`;
  }
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  status.setAttribute('aria-live', 'polite');
})();
