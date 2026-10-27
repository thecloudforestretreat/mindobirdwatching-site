from pathlib import Path
from html import escape as e
import json
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'assets/data/navigation.json').read_text())
groups=data['groups'];contact=data['contact'];book=data['book']
def labels(en,es):return f'data-label-en="{e(en)}" data-label-es="{e(es)}"'
def link(i,cls=''):
 return f'<a class="{cls}" href="{i["path"]}" data-href-en="{i["path"]}" data-href-es="{i["espath"]}" {labels(i["en"],i["es"])}>{e(i["en"])}</a>'
def sections(g):return '\n'.join('<div class="navSection"><p class="navSectionTitle" '+labels(s['en'],s['es'])+'>'+s['en']+'</p>'+'\n'.join(link(i) for i in s['items'])+'</div>' for s in g['sections'])
html='''<header class="topbar" data-mbw-header data-header-version="v4-navigation" data-current-lang="en">
<a class="brand" href="/" aria-label="Mindo Bird Watching home"><img src="/assets/images/logo/mbw-logo-mark-256.webp" alt="" width="256" height="256" decoding="async"><span>Mindo Bird Watching</span></a>
<div class="right">
<nav class="nav" aria-label="Primary" data-i18n-aria="primaryNav">'''
for g in groups:
 html+=f'''<div class="dropdown" data-dd="{g['id']}"><button class="pill navTrigger" type="button" aria-expanded="false" aria-controls="nav-{g['id']}" {labels(g['en'],g['es'])}>{g['en']}</button><div class="dropdownMenu" id="nav-{g['id']}" hidden>{sections(g)}</div></div>'''
html+=link(contact,'pill')+link(book,'pill navBook')+'''</nav><div class="lang langDesktop" aria-label="Language switch"><a href="/" data-lang="en">EN</a><a href="/es/" data-lang="es">ES</a></div>'''
html+=link(book,'pill mobileBook navBook')+'''<button class="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menuPanel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
<div class="menuPanel" id="menuPanel" aria-label="Mobile menu" hidden><nav class="menuList m-main" aria-label="Primary mobile" data-i18n-aria="primaryNavMobile">'''
for g in groups:
 html+=f'<details class="mobileGroup" name="mobile-navigation"><summary {labels(g["en"],g["es"])}>{g["en"]}</summary><div class="mobileGroupLinks">{sections(g)}</div></details>'
html+=link(contact,'mobileContact')+'''</nav><div class="menuLangFooter" data-lang-footer aria-label="Language mobile"></div></div></header>\n'''
(root/'assets/includes/header.html').write_text(html)
