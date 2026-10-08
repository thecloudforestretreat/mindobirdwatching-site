(function () {
  "use strict";
  var hub = "https://admin.mindobirdwatching.com/";
  var pages = [
    { id:"guest-crm", label:"Guest CRM", href:hub+"guest-crm/", group:"Guests & Sales" },
    { id:"whatsapp", label:"WhatsApp", href:hub+"whatsapp/", group:"Guests & Sales" },
    { id:"pilot", label:"Inquiry Studio", href:hub+"inquiry-studio/", group:"Guests & Sales" },
    { id:"email", label:"Email Generator", href:hub+"custom-email-generator/", group:"Guest Documents" },
    { id:"itinerary", label:"Itinerary Generator", href:hub+"itinerary-generator/", group:"Guest Documents" },
    { id:"confirmation", label:"Tour Confirmation", href:hub+"tour-confirmation-generator/", group:"Guest Documents" },
    { id:"stripe", label:"Stripe Invoice", href:"https://mindobirdwatching.com/book-tour/create/", group:"Payments", external:true },
    { id:"zelle", label:"Zelle Invoice", href:hub+"zelle-invoice-generator/", group:"Payments" },
    { id:"staff", label:"Staff Info", href:hub+"staff-info/", group:"Operations" },
    { id:"recommendations", label:"Recommendations", href:hub+"recommendations/", group:"Operations" },
    { id:"birding", label:"Birding", href:hub+"birding/", group:"Operations" },
    { id:"marketing", label:"Marketing", href:hub+"marketing/", group:"Growth & Content" },
    { id:"media", label:"Media", href:hub+"media/", group:"Growth & Content" },
    { id:"portfolio", label:"Website Growth", href:hub+"portfolio/", group:"Growth & Content" },
    { id:"maps", label:"Markets & Origins", href:hub+"analytics/maps/", group:"Growth & Content" },
    { id:"reports", label:"Reports", href:hub+"reports/", group:"Growth & Content" }
  ];
  var quickIds = ["guest-crm", "whatsapp", "marketing", "reports"];
  function currentId(host) {
    if (host.dataset.adminPage) return host.dataset.adminPage;
    var path = window.location.pathname.replace(/\/?$/, "/");
    if (path === "/") return "admin";
    for (var i=0;i<pages.length;i+=1) if (!pages[i].external && new URL(pages[i].href).pathname === path) return pages[i].id;
    return "";
  }
  function isRestricted(page) { return document.body.dataset.adminRole === "birding-guide" && page.id !== "birding"; }
  function toolLink(page, className) {
    var link=document.createElement("a");
    link.className=className||"adminGlobalNav__link";
    link.textContent=page.label;
    if (isRestricted(page)) { link.setAttribute("aria-disabled","true"); link.title="Your account has Birding access only."; return link; }
    link.href=page.href; link.target="_blank"; link.rel="noopener noreferrer"; return link;
  }
  function render(host) {
    var activeId=currentId(host);
    var active=pages.find(function(page){return page.id===activeId;});
    var nav=document.createElement("nav"); nav.className="adminGlobalNav adminGlobalNav--compact"; nav.setAttribute("aria-label","Admin navigation");
    var inner=document.createElement("div"); inner.className="adminGlobalNav__inner";
    var brand=document.createElement("a"); brand.className="adminGlobalNav__label"; brand.href=hub;
    brand.innerHTML='<img class="adminGlobalNav__logo" src="https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png" alt=""><span>'+(activeId==="admin"?"MBW Admin":"← Admin Hub")+"</span>";
    inner.appendChild(brand);
    if (active && activeId!=="admin") { var current=document.createElement("span"); current.className="adminGlobalNav__current"; current.textContent=active.label; inner.appendChild(current); }
    var links=document.createElement("div"); links.className="adminGlobalNav__links";
    quickIds.forEach(function(id){var page=pages.find(function(item){return item.id===id;}); if(page&&page.id!==activeId) links.appendChild(toolLink(page));});
    var more=document.createElement("details"); more.className="adminGlobalNav__more";
    var summary=document.createElement("summary"); summary.className="adminGlobalNav__link"; summary.textContent="All tools"; more.appendChild(summary);
    var menu=document.createElement("div"); menu.className="adminGlobalNav__menu";
    ["Guests & Sales","Guest Documents","Payments","Operations","Growth & Content"].forEach(function(group){
      var section=document.createElement("section"); var heading=document.createElement("strong"); heading.textContent=group; section.appendChild(heading);
      pages.filter(function(page){return page.group===group;}).forEach(function(page){section.appendChild(toolLink(page,"adminGlobalNav__menuLink"));}); menu.appendChild(section);
    });
    more.appendChild(menu); links.appendChild(more); inner.appendChild(links); nav.appendChild(inner);
    host.replaceChildren(nav); host.dataset.adminNavReady="true";
  }
  function init(){document.querySelectorAll("[data-admin-nav]").forEach(render);}
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
