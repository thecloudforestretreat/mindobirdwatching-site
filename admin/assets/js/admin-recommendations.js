/* MBW Admin Recommendations Dashboard build 2026.09.25.3 - protected admin asset */
(function () {
  "use strict";

  document.documentElement.dataset.recommendationsBuild = "2026.09.25.3";

  var STORAGE_KEY = "mbw-recommendations-dashboard-v1";
  var CATEGORY_LABELS = {
    accommodations: "Accommodations",
    restaurants: "Restaurants",
    services: "Services & experiences"
  };

  var seedPartners = [
    {
      id: "sachatamia-lodge",
      category: "accommodations",
      type: "Lodge",
      name: "Sachatamia Lodge",
      area: "Mindo",
      status: "current",
      statusText: "Rates current",
      regularPrice: "$60.79",
      ourPrice: "$53.40",
      savings: "Save 12%",
      pricingBasis: "Per person / night",
      rateValidTo: "2027",
      contact: "Andrea",
      phone: "",
      email: "",
      website: "",
      recommendation: "pending",
      followUp: "2027-10-01",
      followUpDue: false,
      owner: "Juan",
      breakfast: "08:00–10:00; box breakfast from 04:00 by prior request",
      note: "Agency pricing is confidential. Keep partner rates visible only to authorized admin users."
    },
    {
      id: "bellavista-cloud-forest",
      category: "accommodations",
      type: "Lodge",
      name: "Bellavista Cloud Forest",
      area: "Tandayapa Valley",
      status: "review",
      statusText: "Needs review",
      regularPrice: "$60.00",
      ourPrice: "$54.00",
      savings: "Save 10%",
      pricingBasis: "Confirm basis",
      rateValidTo: "Confirm tariff year",
      contact: "Rosa Rogel",
      phone: "+593 9 9416 5868",
      email: "",
      website: "https://www.bellavistacloudforest.com/",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      breakfast: "Confirm schedule and early box breakfast",
      note: "The Birding Tours 2027 filename contains a 2026 tariff reference. Confirm the correct validity year before publishing."
    },
    {
      id: "toucan-platinum-suites",
      category: "accommodations",
      type: "Suites",
      name: "Toucan Platinum Suites",
      area: "Mindo",
      status: "review",
      statusText: "Validity missing",
      regularPrice: "—",
      ourPrice: "$70.00",
      savings: "Agency rate",
      pricingBasis: "Starting price / room",
      rateValidTo: "Not supplied",
      contact: "Maria Viteri",
      phone: "",
      email: "",
      website: "https://www.lodgemindoecuador.com/",
      recommendation: "pending",
      followUp: "2026-10-05",
      followUpDue: false,
      owner: "Juan",
      breakfast: "07:00–10:00; takeaway breakfast available",
      note: "Restaurant service is for breakfast only. No lunch or dinner. Confirm tariff validity dates."
    },
    {
      id: "royal-river-suites",
      category: "accommodations",
      type: "Suites",
      name: "Royal River Suites",
      area: "Mindo",
      status: "review",
      statusText: "Validity missing",
      regularPrice: "—",
      ourPrice: "$115.00",
      savings: "Agency rate",
      pricingBasis: "Starting price / room",
      rateValidTo: "Not supplied",
      contact: "Maria Viteri",
      phone: "",
      email: "",
      website: "https://www.cloudforestecuador.com/",
      recommendation: "pending",
      followUp: "2026-10-05",
      followUpDue: false,
      owner: "Juan",
      breakfast: "07:00–10:00; takeaway breakfast available",
      note: "Confirm tariff validity dates and final room-by-room inclusions before recommending."
    },
    {
      id: "casa-de-vista-alta",
      category: "accommodations",
      type: "Hotel",
      name: "Casa de Vista Alta",
      area: "Mindo",
      status: "pending",
      statusText: "Awaiting rates",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Vicky",
      phone: "",
      email: "",
      website: "",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      breakfast: "To confirm",
      note: "Vicky is reviewing the tariff and expects to provide the information soon."
    },
    {
      id: "las-terrazas-de-dana",
      category: "accommodations",
      type: "Lodge",
      name: "Las Terrazas de Dana Boutique Lodge & Spa",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "David Brito",
      phone: "+593 93 956 5819",
      email: "",
      website: "https://www.lasterrazasdedana.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026. Request agency terms and a direct reservation contact."
    },
    {
      id: "terrabambu-lodge",
      category: "accommodations",
      type: "Lodge",
      name: "Terrabambú Lodge",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 2 217 0252 / +593 9 992 45686",
      email: "reservas@terrabambu.com",
      website: "https://terrabambu.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026. Request agency pricing and conditions."
    },
    {
      id: "la-casa-de-cecilia",
      category: "accommodations",
      type: "Hostel",
      name: "La Casa de Cecilia",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 2 217 0243 / +593 99 334 5393",
      email: "casadececiliamindo@gmail.com",
      website: "https://www.lacasadececilia.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Nine past pickups. Public contact verified September 19, 2026."
    },
    {
      id: "secret-garden-quito",
      category: "accommodations",
      type: "Hostel",
      name: "The Secret Garden Hostel Quito",
      area: "Quito",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 99 357 2714 / +593 99 198 0027",
      email: "hola@secretgardenquito.com",
      website: "https://www.secretgardenquito.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026."
    },
    {
      id: "mindo-chocolate-makers",
      category: "services",
      type: "Experience",
      name: "Mindo Chocolate Makers",
      area: "Mindo",
      status: "pending",
      statusText: "Awaiting rates",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Per experience",
      rateValidTo: "Pending",
      contact: "Sales team",
      phone: "",
      email: "",
      website: "",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      breakfast: "Café and restaurant available",
      note: "Request operator pricing and booking terms for chocolate, cacao, coffee, and make-your-own-bar experiences."
    }
  ];

  var elements = {
    cards: document.getElementById("recommendationsCards"),
    detail: document.getElementById("recommendationsDetail"),
    empty: document.getElementById("recommendationsEmpty"),
    search: document.getElementById("recommendationsSearch"),
    type: document.getElementById("recommendationsType"),
    decision: document.getElementById("recommendationsDecision"),
    title: document.getElementById("recommendationsSectionTitle"),
    count: document.getElementById("recommendationsResultCount"),
    toast: document.getElementById("recommendationsToast"),
    dialog: document.getElementById("addRecommendationDialog"),
    form: document.getElementById("addRecommendationForm")
  };

  var state = loadState();
  var partners = seedPartners.map(function (partner) {
    return Object.assign({}, partner, state.updates[partner.id] || {});
  }).concat(state.customPartners || []);
  var activeCategory = "accommodations";
  var selectedId = partners.find(function (partner) { return partner.category === activeCategory; }).id;
  var currentView = "cards";
  var toastTimer;

  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        updates: parsed.updates && typeof parsed.updates === "object" ? parsed.updates : {},
        customPartners: Array.isArray(parsed.customPartners) ? parsed.customPartners : []
      };
    } catch (error) {
      return { updates: {}, customPartners: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("This browser could not save the change");
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 1900);
  }

  function storePartnerUpdate(partner) {
    if (partner.custom) {
      state.customPartners = partners.filter(function (item) { return item.custom; });
    } else {
      state.updates[partner.id] = {
        recommendation: partner.recommendation,
        followUp: partner.followUp,
        followUpDue: partner.followUpDue,
        owner: partner.owner,
        note: partner.note
      };
    }
    saveState();
  }

  function categoryPartners(category) {
    return partners.filter(function (partner) { return partner.category === category; });
  }

  function recommendationLabel(value) {
    if (value === "yes") return "Recommended";
    if (value === "no") return "Not recommended";
    return "Pending decision";
  }

  function isFollowUpDue(dateValue) {
    if (!dateValue) return false;
    var followUpDate = new Date(dateValue + "T12:00:00");
    var cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + 7);
    return followUpDate <= cutoff;
  }

  function updateMetrics() {
    document.getElementById("metricPartners").textContent = partners.length;
    document.getElementById("metricRecommended").textContent = partners.filter(function (partner) { return partner.recommendation === "yes"; }).length;
    document.getElementById("metricPending").textContent = partners.filter(function (partner) { return partner.recommendation === "pending"; }).length;
    document.getElementById("metricDue").textContent = partners.filter(function (partner) { return partner.followUpDue; }).length;
    document.querySelectorAll("[data-category-count]").forEach(function (element) {
      element.textContent = categoryPartners(element.dataset.categoryCount).length;
    });
  }

  function updateTypeOptions() {
    var previous = elements.type.value;
    var types = categoryPartners(activeCategory).map(function (partner) { return partner.type; }).filter(function (value, index, list) {
      return list.indexOf(value) === index;
    }).sort();
    elements.type.innerHTML = '<option value="all">All subtypes</option>' + types.map(function (type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</option>';
    }).join("");
    elements.type.value = types.indexOf(previous) >= 0 ? previous : "all";
  }

  function filteredPartners() {
    var query = elements.search.value.trim().toLowerCase();
    return partners.filter(function (partner) {
      var searchable = [partner.name, partner.type, partner.area, partner.contact, partner.email, partner.phone].join(" ").toLowerCase();
      return partner.category === activeCategory &&
        (!query || searchable.indexOf(query) >= 0) &&
        (elements.type.value === "all" || partner.type === elements.type.value) &&
        (elements.decision.value === "all" || partner.recommendation === elements.decision.value);
    });
  }

  function cardMarkup(partner) {
    var hasEmail = Boolean(partner.email);
    var hasPhone = Boolean(partner.phone);
    return '' +
      '<article class="recommendationCard' + (partner.id === selectedId ? ' is-selected' : '') + '" data-partner-id="' + escapeHtml(partner.id) + '">' +
        '<div class="recommendationCardTop">' +
          '<div><div class="recommendationType">' + escapeHtml(partner.type) + '</div><h3>' + escapeHtml(partner.name) + '</h3><div class="recommendationLocation">⌖ ' + escapeHtml(partner.area || "Area pending") + '</div></div>' +
          '<span class="recommendationBadge recommendationBadge--' + escapeHtml(partner.status) + '">' + escapeHtml(partner.statusText) + '</span>' +
        '</div>' +
        '<div class="recommendationPricing">' +
          '<div><span>Regular price</span><strong>' + escapeHtml(partner.regularPrice) + '</strong></div>' +
          '<div><span>Our price</span><strong>' + escapeHtml(partner.ourPrice) + '</strong></div>' +
          '<div class="recommendationSavings">' + escapeHtml(partner.savings) + '</div>' +
        '</div>' +
        '<div class="recommendationContact">' +
          '<div><small>Direct contact</small><strong>' + escapeHtml(partner.contact || "Add contact") + '</strong></div>' +
          '<div class="recommendationCopyActions">' +
            '<button class="recommendationCopyButton" type="button" data-copy="email"' + (hasEmail ? '' : ' disabled') + '>Copy email</button>' +
            '<button class="recommendationCopyButton" type="button" data-copy="phone"' + (hasPhone ? '' : ' disabled') + '>Copy WhatsApp</button>' +
          '</div>' +
        '</div>' +
        '<div class="recommendationDecision"><span>Recommend?</span>' +
          ['yes', 'no', 'pending'].map(function (decision) {
            return '<button class="recommendationDecisionButton" type="button" data-decision="' + decision + '" aria-pressed="' + (partner.recommendation === decision) + '">' + (decision === 'yes' ? 'Yes' : decision === 'no' ? 'No' : 'Pending') + '</button>';
          }).join("") +
        '</div>' +
        '<div class="recommendationCardBottom">' +
          '<div class="recommendationFollowUp' + (partner.followUpDue ? ' is-due' : '') + '">Next follow-up<strong>' + escapeHtml(partner.followUp || "Not scheduled") + '</strong></div>' +
          '<button class="recommendationDetailButton" type="button" data-view-detail="' + escapeHtml(partner.id) + '">View details →</button>' +
        '</div>' +
      '</article>';
  }

  function renderCards() {
    var filtered = filteredPartners();
    elements.cards.classList.toggle("is-list", currentView === "list");
    elements.cards.innerHTML = filtered.map(cardMarkup).join("");
    elements.cards.style.display = filtered.length ? "grid" : "none";
    elements.empty.style.display = filtered.length ? "none" : "block";
    elements.count.textContent = filtered.length + " partner" + (filtered.length === 1 ? "" : "s") + " shown";

    if (filtered.length && !filtered.some(function (partner) { return partner.id === selectedId; })) {
      selectedId = filtered[0].id;
    }
    renderDetail();
  }

  function renderDetail() {
    var partner = partners.find(function (item) { return item.id === selectedId; });
    if (!partner || partner.category !== activeCategory) {
      partner = categoryPartners(activeCategory)[0];
      selectedId = partner ? partner.id : "";
    }

    if (!partner) {
      elements.detail.style.display = "none";
      return;
    }

    elements.detail.style.display = "block";
    elements.detail.innerHTML = '' +
      '<div class="recommendationsDetailHeader">' +
        '<div class="recommendationType">Selected partner</div>' +
        '<h2>' + escapeHtml(partner.name) + '</h2>' +
        '<p>' + escapeHtml(partner.type) + ' · ' + escapeHtml(partner.area || "Area pending") + ' · ' + escapeHtml(recommendationLabel(partner.recommendation)) + '</p>' +
      '</div>' +
      '<div class="recommendationsDetailBody">' +
        '<div class="recommendationsDetailActions">' +
          '<button class="recommendationsDetailAction recommendationsDetailAction--primary" type="button" data-detail-copy="email"' + (partner.email ? '' : ' disabled') + '>Copy email</button>' +
          '<button class="recommendationsDetailAction" type="button" data-detail-copy="phone"' + (partner.phone ? '' : ' disabled') + '>Copy WhatsApp</button>' +
          (partner.website ? '<a class="recommendationsDetailAction" href="' + escapeHtml(partner.website) + '" target="_blank" rel="noopener noreferrer">Open website ↗</a>' : '') +
        '</div>' +
        '<div class="recommendationsDetailLabel">Partner details</div>' +
        '<div class="recommendationsFacts">' +
          '<div class="recommendationsFact"><span>Contact</span><strong>' + escapeHtml(partner.contact || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>Email</span><strong>' + escapeHtml(partner.email || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>WhatsApp / phone</span><strong>' + escapeHtml(partner.phone || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>Pricing basis</span><strong>' + escapeHtml(partner.pricingBasis) + '</strong></div>' +
          '<div class="recommendationsFact"><span>Rate validity</span><strong>' + escapeHtml(partner.rateValidTo) + '</strong></div>' +
          '<div class="recommendationsFact"><span>Breakfast / service</span><strong>' + escapeHtml(partner.breakfast) + '</strong></div>' +
        '</div>' +
        '<div class="recommendationsDetailLabel">Attention</div>' +
        '<div class="recommendationsNotice">' + escapeHtml(partner.note || "No notes yet.") + '</div>' +
        '<div class="recommendationsDetailLabel">Follow-up tracking</div>' +
        '<div class="recommendationsFollowUpFields">' +
          '<label class="recommendationsField"><span>Next follow-up</span><input id="detailFollowUp" type="date" value="' + escapeHtml(partner.followUp || "") + '" /></label>' +
          '<label class="recommendationsField"><span>Owner</span><input id="detailOwner" value="' + escapeHtml(partner.owner || "") + '" placeholder="Assign owner" /></label>' +
          '<label class="recommendationsField recommendationsField--full"><span>Internal note</span><textarea id="detailNote">' + escapeHtml(partner.note || "") + '</textarea></label>' +
        '</div>' +
        '<button class="recommendationsSaveFollowUp" id="savePartnerTracking" type="button">Save tracking</button>' +
      '</div>';
  }

  async function copyText(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      var textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(label + " copied");
  }

  function switchCategory(category) {
    activeCategory = category;
    document.querySelectorAll("[data-category]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.category === category));
    });
    elements.title.textContent = CATEGORY_LABELS[category];
    var first = categoryPartners(category)[0];
    selectedId = first ? first.id : "";
    updateTypeOptions();
    renderCards();
  }

  function addPartner(formData) {
    var name = String(formData.get("name") || "").trim();
    var category = String(formData.get("category") || "accommodations");
    var id = "custom-" + Date.now();
    var partner = {
      id: id,
      custom: true,
      category: category,
      type: String(formData.get("type") || "Partner").trim(),
      name: name,
      area: String(formData.get("area") || "").trim(),
      status: "pending",
      statusText: "New entry",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: String(formData.get("contact") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "New partner entry. Add pricing, service details, and review notes."
    };
    partners.push(partner);
    state.customPartners.push(partner);
    saveState();
    elements.form.reset();
    elements.dialog.close();
    updateMetrics();
    switchCategory(category);
    selectedId = id;
    renderCards();
    showToast(name + " added");
  }

  document.querySelectorAll("[data-category]").forEach(function (button) {
    button.addEventListener("click", function () { switchCategory(button.dataset.category); });
  });

  [elements.search, elements.type, elements.decision].forEach(function (element) {
    element.addEventListener(element === elements.search ? "input" : "change", renderCards);
  });

  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      currentView = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderCards();
    });
  });

  elements.cards.addEventListener("click", function (event) {
    var card = event.target.closest("[data-partner-id]");
    if (!card) return;
    var partner = partners.find(function (item) { return item.id === card.dataset.partnerId; });
    if (!partner) return;

    var copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      var copyKey = copyButton.dataset.copy;
      copyText(partner[copyKey], copyKey === "email" ? "Email" : "WhatsApp");
      return;
    }

    var decisionButton = event.target.closest("[data-decision]");
    if (decisionButton) {
      partner.recommendation = decisionButton.dataset.decision;
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast("Recommendation updated");
      return;
    }

    var detailButton = event.target.closest("[data-view-detail]");
    if (detailButton) {
      selectedId = detailButton.dataset.viewDetail;
      renderCards();
    }
  });

  elements.detail.addEventListener("click", function (event) {
    var partner = partners.find(function (item) { return item.id === selectedId; });
    if (!partner) return;

    var copyButton = event.target.closest("[data-detail-copy]");
    if (copyButton) {
      var copyKey = copyButton.dataset.detailCopy;
      copyText(partner[copyKey], copyKey === "email" ? "Email" : "WhatsApp");
      return;
    }

    if (event.target.id === "savePartnerTracking") {
      partner.followUp = document.getElementById("detailFollowUp").value;
      partner.owner = document.getElementById("detailOwner").value.trim();
      partner.note = document.getElementById("detailNote").value.trim();
      partner.followUpDue = isFollowUpDue(partner.followUp);
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast("Tracking saved");
    }
  });

  document.getElementById("addRecommendation").addEventListener("click", function () {
    elements.dialog.showModal();
  });
  document.getElementById("closeRecommendationDialog").addEventListener("click", function () { elements.dialog.close(); });
  document.getElementById("cancelRecommendationDialog").addEventListener("click", function () { elements.dialog.close(); });
  elements.form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    addPartner(new FormData(elements.form));
  });

  updateMetrics();
  updateTypeOptions();
  renderCards();
})();
