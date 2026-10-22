#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur du site burnout-parental.fr.

Chaque page est écrite dans _build/pages/<slug>.html : un bloc <!--meta {…} --> en tête
(titre, description, rubrique…) puis le contenu HTML de la page. Ce script ajoute
l'en-tête, la navigation, le fil d'Ariane, le sommaire, les liens précédent/suivant,
le pied de page, les données structurées, puis écrit <slug>.html à la racine,
ainsi que sitemap.xml et robots.txt.

Usage : python3 _build/build.py          (depuis la racine du dépôt)

PREVIEW = True  : site en préparation (code d'accès, balise noindex, robots.txt fermé).
PREVIEW = False : site public (pas de code d'accès, pages indexables, sitemap déclaré).
"""
import json, os, re, sys, html, datetime

PREVIEW = False
SITE = "https://burnout-parental.fr/"
GATE_CODE = "1024"
RDV = "https://www.doctolib.fr/psychotherapeute/paris/max-bouche"
MAIL = "contact@burnout-parental.fr"
TODAY = datetime.date.today().isoformat()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES_DIR = os.path.join(ROOT, "_build", "pages")

# ---------------------------------------------------------------------------
# Structure du site : rubriques et ordre des pages (sert au menu, au fil
# d'Ariane, aux liens précédent/suivant, au plan du site et au sitemap).
# ---------------------------------------------------------------------------
SECTIONS = [
    {"id": "comprendre", "label": "Comprendre", "hub": "comprendre",
     "pages": ["burnout-parental-definition", "signes-symptomes", "causes-facteurs-de-risque",
               "burnout-parental-depression-fatigue", "burnout-parental-et-professionnel",
               "consequences-enfant-couple", "chiffres-cles"]},
    {"id": "tests", "label": "Auto-tests", "hub": "auto-tests",
     "pages": ["test-burnout-parental", "test-risques-ressources", "test-charge-mentale",
               "test-fatigue-epuisement", "test-coparentalite", "test-perfectionnisme-parental", "tests"]},
    {"id": "situations", "label": "Situations", "hub": "situations",
     "pages": ["mere-epuisee", "pere-epuise", "parent-solo", "famille-recomposee",
               "enfant-besoins-specifiques", "perinatalite-post-partum", "teletravail-double-charge",
               "aidants-epuisement"]},
    {"id": "accompagnement", "label": "Accompagnement", "hub": "accompagnement",
     "pages": ["quand-consulter", "deroule-accompagnement", "approches-therapeutiques",
               "equipe-cabinet", "proches-professionnels"]},
    {"id": "ressources", "label": "Ressources", "hub": "ressources",
     "pages": ["prevention-au-quotidien", "signaux-alerte-negligence-violence", "urgences-et-aide",
               "glossaire", "bibliographie", "faq"]},
    {"id": "reflexion", "label": "Réflexion clinique", "hub": "reflexion-clinique", "in_menu": False,
     "pages": ["reflexion-parents-ensemble", "reflexion-parents-separes", "reflexion-jeune-enfant",
               "reflexion-adolescent", "reflexion-fratrie", "reflexion-burnout-general",
               "reflexion-distinction-parentale", "reflexion-accompagnement"]},
]
STANDALONE = ["index", "mentions-legales", "plan-du-site"]

SVG = {
    "chev": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "arrowl": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    "leaf": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7.5-7 10Z"/><path d="M12 12v-3"/></svg>',
    "cal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    "pen": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    "warn": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
}

# ---------------------------------------------------------------------------
def read_pages():
    pages = {}
    for fn in sorted(os.listdir(PAGES_DIR)):
        if not fn.endswith(".html"):
            continue
        slug = fn[:-5]
        src = open(os.path.join(PAGES_DIR, fn), encoding="utf-8").read()
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", src, re.S)
        if not m:
            sys.exit(f"[build] {fn} : bloc <!--meta … --> manquant")
        try:
            meta = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            sys.exit(f"[build] {fn} : meta JSON invalide ({e})")
        meta["slug"] = slug
        meta["body"] = src[m.end():]
        pages[slug] = meta
    return pages


def section_of(slug):
    for s in SECTIONS:
        if slug == s["hub"] or slug in s["pages"]:
            return s
    return None


def url(slug):
    return "index.html" if slug == "index" else slug + ".html"


def abs_url(slug):
    return SITE if slug == "index" else SITE + slug + ".html"


def e(s):
    return html.escape(s, quote=True)


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def slugify(s):
    s = strip_tags(s).lower()
    s = s.replace("’", "'")
    tr = str.maketrans("àâäéèêëîïôöùûüçœ", "aaaeeeeiioouuuco")
    s = s.translate(tr)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "section"


# ---------------------------------------------------------------------------
def nav_html(pages, current):
    cur_sec = section_of(current)
    items = []
    for s in SECTIONS:
        if s.get("in_menu") is False:
            continue
        hub = pages[s["hub"]]
        active = " is-active" if cur_sec and cur_sec["id"] == s["id"] else ""
        sub = f'<li class="sub-hub"><a href="{url(s["hub"])}"{" aria-current=\"page\"" if current == s["hub"] else ""}>Tout sur : {e(hub.get("nav_label", hub["title"]))}<small>{e(hub.get("nav_desc", ""))}</small></a></li>'
        for p in s["pages"]:
            pg = pages[p]
            cur = ' aria-current="page"' if p == current else ""
            sub += f'<li><a href="{url(p)}"{cur}>{e(pg.get("nav_label", pg["title"]))}</a></li>'
        items.append(
            f'<li class="nav-item has-sub"><button class="nav-link{active}" type="button" aria-haspopup="true" aria-expanded="false">{e(s["label"])}{SVG["chev"]}</button>'
            f'<ul class="sub-menu">{sub}</ul></li>')
    items.append(f'<li class="nav-item"><a class="nav-link{" is-active" if current == "faq" else ""}" href="faq.html">FAQ</a></li>')
    return '<nav class="main-nav" aria-label="Navigation principale"><ul class="nav-list">' + "".join(items) + "</ul></nav>"


def mobile_nav_html(pages, current):
    h = ''
    for s in SECTIONS:
        if s.get("in_menu") is False:
            continue
        hub = pages[s["hub"]]
        opened = " open" if section_of(current) and section_of(current)["id"] == s["id"] else ""
        h += f'<details class="mnav-group"{opened}><summary>{e(s["label"])}{SVG["chev"]}</summary><ul>'
        h += f'<li class="hub"><a href="{url(s["hub"])}"{" aria-current=\"page\"" if current == s["hub"] else ""}>{e(hub.get("nav_label", hub["title"]))}</a></li>'
        for p in s["pages"]:
            pg = pages[p]
            cur = ' aria-current="page"' if p == current else ""
            h += f'<li><a href="{url(p)}"{cur}>{e(pg.get("nav_label", pg["title"]))}</a></li>'
        h += '</ul></details>'
    h += '<a class="mnav-single" href="faq.html">Questions fréquentes</a>'
    h += '<a class="mnav-single" href="reflexion-clinique.html">Réflexion clinique (espace professionnel)</a>'
    h += f'<div class="mnav-cta"><a class="btn btn-primary" href="{RDV}" target="_blank" rel="noopener">{SVG["cal"]}Prendre rendez-vous</a><a class="btn btn-secondary" href="mailto:{MAIL}">Écrire au cabinet</a></div>'
    return (f'<div class="mobile-nav" id="mobileNav" role="dialog" aria-modal="true" aria-labelledby="mnavTitle">'
            f'<div class="panel-head"><h2 id="mnavTitle">Menu</h2><button class="icon-btn" id="btnCloseMenu" aria-label="Fermer le menu">'
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
            f'<nav class="panel-body" aria-label="Navigation mobile">{h}</nav></div>')


def header_html(pages, current):
    return f'''<a class="skip-link" href="#contenu">Aller au contenu</a>
<div class="progress"><span id="progressBar"></span></div>
<div class="scrim" id="scrim"></div>
<header class="site-header" id="siteHeader">
  <div class="wrap header-inner">
    <a class="logo" href="index.html" aria-label="Burnout parental, accueil">
      <span class="logo-mark">{SVG["leaf"]}</span>
      <span class="logo-text"><span class="logo-name">Burnout parental</span><span class="logo-tagline">Épuisement parental</span></span>
    </a>
    {nav_html(pages, current)}
    <div class="header-actions">
      <button class="icon-btn" id="btnA11y" aria-haspopup="dialog" aria-controls="a11yPanel" aria-expanded="false" title="Affichage et lecture" aria-label="Ouvrir les options d'affichage et de lecture">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/></svg>
      </button>
      <a class="btn btn-primary" href="{RDV}" target="_blank" rel="noopener" style="--bh:40px;padding:0 1.1em;font-size:.86rem;">Prendre RDV</a>
      <button class="icon-btn menu-btn" id="btnMenu" aria-haspopup="dialog" aria-controls="mobileNav" aria-expanded="false" aria-label="Ouvrir le menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
</header>
'''


def crumbs(pages, meta):
    slug = meta["slug"]
    trail = [("index", "Accueil")]
    sec = section_of(slug)
    if sec and slug != sec["hub"]:
        trail.append((sec["hub"], pages[sec["hub"]].get("nav_label", pages[sec["hub"]]["title"])))
    parent = meta.get("parent")
    if parent and parent not in [t[0] for t in trail] and parent in pages:
        trail.append((parent, pages[parent].get("nav_label", pages[parent]["title"])))
    trail.append((slug, meta.get("nav_label", meta.get("h1", meta["title"]))))
    items = "".join(
        f'<li><a href="{url(s)}">{e(l)}</a></li>' if s != slug else f'<li><span aria-current="page">{e(l)}</span></li>'
        for s, l in trail)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": strip_tags(l), "item": abs_url(s)} for i, (s, l) in enumerate(trail)]}
    return f'<nav aria-label="Fil d\'Ariane"><ol class="crumbs">{items}</ol></nav>', ld


def page_tools():
    return f'''<div class="page-tools" data-reveal style="--d:.2s">
        <button class="tool-btn" id="btnAudio" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M19 8a6 6 0 0 1 0 8M15.5 10.5a2.5 2.5 0 0 1 0 3"/></svg>Écouter cette page</button>
        <div class="share-wrap">
          <button class="tool-btn" id="btnShare" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2"/></svg>Partager</button>
          <div class="popover" id="sharePopover">
            <button id="btnCopyLink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>Copier le lien</button>
            <button id="btnPrint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v7H6z"/></svg>Imprimer</button>
          </div>
        </div>
      </div>'''


def add_ids_and_toc(body):
    """Donne un id à chaque <h2> de l'article et construit le sommaire."""
    entries = []
    used = set()

    def rep(m):
        attrs, inner = m.group(1), m.group(2)
        idm = re.search(r'\sid="([^"]+)"', attrs)
        if idm:
            hid = idm.group(1)
        else:
            hid = slugify(inner)
            base, n = hid, 2
            while hid in used:
                hid = f"{base}-{n}"; n += 1
            attrs = attrs + f' id="{hid}"'
        used.add(hid)
        entries.append((hid, strip_tags(inner)))
        return f"<h2{attrs}>{inner}</h2>"

    body = re.sub(r"<h2((?:\s[^>]*)?)>(.*?)</h2>", rep, body, flags=re.S)
    return body, entries


def toc_html(entries):
    if len(entries) < 2:
        return ""
    lis = "".join(f'<li><a href="#{h}">{e(t)}</a></li>' for h, t in entries)
    return f'<details class="toc" open><summary>Sommaire{SVG["chev"]}</summary><ol>{lis}</ol></details>'


def pager_html(pages, slug):
    sec = section_of(slug)
    if not sec:
        return ""
    order = [sec["hub"]] + sec["pages"]
    i = order.index(slug)
    prev = order[i - 1] if i > 0 else None
    nxt = order[i + 1] if i + 1 < len(order) else None
    if not prev and not nxt:
        return ""
    h = '<nav class="pager" aria-label="Pages voisines">'
    if prev:
        h += f'<a class="prev" href="{url(prev)}"><small>{SVG["arrowl"]}Page précédente</small><strong>{e(pages[prev].get("nav_label", pages[prev]["title"]))}</strong></a>'
    if nxt:
        h += f'<a class="next" href="{url(nxt)}"><small>Page suivante{SVG["arrow"]}</small><strong>{e(pages[nxt].get("nav_label", pages[nxt]["title"]))}</strong></a>'
    return h + "</nav>"


def related_html(pages, meta):
    rel = meta.get("related") or []
    if not rel:
        return ""
    cards = ""
    for r in rel:
        if r not in pages:
            sys.exit(f"[build] {meta['slug']} : page liée inconnue « {r} »")
        p = pages[r]
        sec = section_of(r)
        cards += f'<a href="{url(r)}"><small>{e(sec["label"] if sec else "Site")}</small><strong>{e(p.get("nav_label", p["title"]))}</strong></a>'
    return f'<section class="related" aria-labelledby="rel-title"><h2 id="rel-title">À lire ensuite</h2><div class="related-grid">{cards}</div></section>'


def cta_html(meta):
    if meta.get("kind") in ("legal",):
        return ""
    return f'''<section class="section" aria-label="Prendre contact">
    <div class="wrap">
      <div class="cta-band" data-reveal>
        <span class="eyebrow">Vous n'avez pas à porter ça seul·e</span>
        <h2 class="h-section">Un premier échange pour poser les choses clairement</h2>
        <p>Il permet de voir si cet accompagnement vous correspond, sans engagement. Au cabinet ou en téléconsultation.</p>
        <div class="actions">
          <a class="btn btn-primary btn-lg" href="{RDV}" target="_blank" rel="noopener">{SVG["cal"]}Prendre rendez-vous</a>
          <a class="btn btn-secondary btn-lg" href="mailto:{MAIL}">{MAIL}</a>
        </div>
      </div>
    </div>
  </section>'''


def footer_html(pages, meta):
    cols = ""
    for s in SECTIONS:
        if s.get("in_menu") is False:
            continue
        lis = f'<li><a href="{url(s["hub"])}"><strong>{e(pages[s["hub"]].get("nav_label", ""))}</strong></a></li>'
        lis += "".join(f'<li><a href="{url(p)}">{e(pages[p].get("nav_label", pages[p]["title"]))}</a></li>' for p in s["pages"])
        cols += f'<div><h3>{e(s["label"])}</h3><ul>{lis}</ul></div>'
    cols += (f'<div class="cta-col"><h3>Le cabinet</h3><p>Cabinet Bouche &amp; Chmura. Colombes, Les Pavillons-sous-Bois, Colombier-le-Vieux, et téléconsultation partout en France.</p>'
             f'<ul><li><a href="equipe-cabinet.html">L\'équipe</a></li><li><a href="{RDV}" target="_blank" rel="noopener">Prendre rendez-vous (Doctolib)</a></li><li><a href="mailto:{MAIL}">{MAIL}</a></li>'
             f'<li><a href="urgences-et-aide.html">Urgences : 15, 3114, 119</a></li><li><a href="reflexion-clinique.html">Réflexion clinique (professionnels)</a></li></ul></div>')
    updated = meta.get("updated", TODAY)
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="logo" href="index.html"><span class="logo-mark">{SVG["leaf"]}</span><span class="logo-text"><span class="logo-name">Burnout parental</span><span class="logo-tagline">Épuisement parental</span></span></a>
      </div>
      <div><span>© Cabinet Bouche &amp; Chmura</span><br><span>Site d'information rédigé par des cliniciens. Il ne remplace pas une consultation.</span></div>
    </div>
    <div class="footer-map">{cols}</div>
    <div class="footer-bottom">
      <p class="sources">Page mise à jour le {e(fr_date(updated))}. Rédaction : Max Bouche, clinicien, psychothérapeute, psychanalyste. Les auto-tests de ce site sont des outils d'orientation, pas des outils de diagnostic ; aucune réponse n'est enregistrée ni transmise.</p>
      <p class="footer-legal"><a href="mentions-legales.html">Mentions légales et confidentialité</a><a href="plan-du-site.html">Plan du site</a><a href="bibliographie.html">Sources</a></p>
    </div>
  </div>
</footer>'''


def fr_date(iso):
    try:
        d = datetime.date.fromisoformat(iso)
    except ValueError:
        return iso
    mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    return f"{d.day} {mois[d.month - 1]} {d.year}"


def a11y_panel():
    return '''<div class="audio-player" id="audioPlayer">
  <span class="audio-bars"><i></i><i></i><i></i></span>
  <span class="ap-label">Lecture de la page</span>
  <button id="apPlayPause" aria-label="Lecture / pause"><svg id="apIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>
  <button id="apStop" aria-label="Arrêter la lecture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg></button>
</div>
<div class="a11y-panel" id="a11yPanel" role="dialog" aria-modal="true" aria-labelledby="a11yTitle">
  <div class="panel-head">
    <h2 id="a11yTitle">Affichage et lecture</h2>
    <button class="icon-btn" id="btnCloseA11y" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>
  <div class="panel-body">
    <div class="opt-group"><p class="opt-title">Taille du texte</p>
      <div class="seg" id="segFs"><button data-fs="0" aria-pressed="true">A</button><button data-fs="1" aria-pressed="false">A</button><button data-fs="2" aria-pressed="false">A</button><button data-fs="3" aria-pressed="false">A</button></div></div>
    <div class="opt-group"><p class="opt-title">Thème</p>
      <div class="seg wrap" id="segTheme">
        <button data-theme="auto" aria-pressed="true"><span class="swatch" style="background:#EEE"></span>Auto</button>
        <button data-theme="light" aria-pressed="false"><span class="swatch" style="background:#F6F4EF"></span>Clair</button>
        <button data-theme="dark" aria-pressed="false"><span class="swatch" style="background:#182722"></span>Sombre</button>
        <button data-theme="sepia" aria-pressed="false"><span class="swatch" style="background:#F2E9D6"></span>Confort</button>
        <button data-theme="contrast" aria-pressed="false"><span class="swatch" style="background:#000"></span>Contraste élevé</button>
      </div></div>
    <div class="opt-group">
      <div class="switch-row"><label for="swSpacing">Espacement de lecture<br><small>Plus d'air entre les lignes et les lettres</small></label><button class="switch" id="swSpacing" role="switch" aria-checked="false"></button></div>
      <div class="switch-row"><label for="swMotion">Réduire les animations<br><small>Supprime les mouvements décoratifs</small></label><button class="switch" id="swMotion" role="switch" aria-checked="false"></button></div>
    </div>
  </div>
</div>
<div class="toast" id="toast" role="status">Lien copié</div>
<button class="to-top" id="toTop" aria-label="Retour en haut"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>'''


def gate_html():
    if not PREVIEW:
        return ""
    return '''<div id="gatescreen">
  <div class="box">
    <h2>Aperçu privé</h2>
    <p>Ce site est en cours de préparation. Merci de saisir le code d'accès.</p>
    <label for="gatecode" class="sr-only">Code d'accès</label>
    <input id="gatecode" type="password" inputmode="numeric" placeholder="Code" autocomplete="off">
    <button type="button" id="gatebtn">Continuer</button>
    <div class="err" id="gateerr" aria-live="polite"></div>
  </div>
</div>
'''


def faq_ld(body):
    qa = []
    for m in re.finditer(r'<details[^>]*>\s*<summary>(.*?)</summary>\s*<div class="answer">(.*?)</div>\s*</details>', body, re.S):
        q = strip_tags(re.sub(r'<span class="pm"></span>', "", m.group(1)))
        a = strip_tags(m.group(2))
        if q and a:
            qa.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
    if not qa:
        return None
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": qa}


ORG = {"@type": "MedicalBusiness", "@id": SITE + "#cabinet", "name": "Cabinet Bouche & Chmura", "url": SITE, "email": MAIL,
       "areaServed": "France", "availableLanguage": "fr",
       "employee": [
           {"@type": "Person", "name": "Max Bouche", "jobTitle": "Clinicien, psychothérapeute, psychanalyste",
            "identifier": {"@type": "PropertyValue", "propertyID": "RPPS", "value": "10010375631"}},
           {"@type": "Person", "name": "Sabrina Chmura", "jobTitle": "Psychologue clinicienne spécialisée en neuropsychologie",
            "identifier": {"@type": "PropertyValue", "propertyID": "RPPS", "value": "10008870825"}}]}


def jsonld(meta, body, crumb_ld):
    out = [crumb_ld]
    kind = meta.get("kind", "article")
    if meta["slug"] == "index":
        out.append({"@context": "https://schema.org", "@type": "WebSite", "name": "Burnout parental", "url": SITE, "inLanguage": "fr-FR",
                    "publisher": {"@id": SITE + "#cabinet"}})
        out.append(dict({"@context": "https://schema.org"}, **ORG))
    elif kind != "legal":
        page = {"@context": "https://schema.org", "@type": "MedicalWebPage", "name": strip_tags(meta.get("h1", meta["title"])),
                "description": meta["description"], "url": abs_url(meta["slug"]), "inLanguage": "fr-FR",
                "dateModified": meta.get("updated", TODAY), "about": {"@type": "MedicalCondition", "name": "Burn-out parental"},
                "author": {"@type": "Person", "name": "Max Bouche", "jobTitle": "Clinicien, psychothérapeute, psychanalyste"},
                "publisher": {"@id": SITE + "#cabinet"}, "audience": {"@type": "MedicalAudience", "audienceType": "Patient"}}
        if meta.get("quiz"):
            page["mainEntity"] = {"@type": "Quiz", "name": strip_tags(meta.get("h1", meta["title"])), "educationalUse": "self-assessment"}
        out.append(page)
        if meta["slug"] == "equipe-cabinet":
            out.append(dict({"@context": "https://schema.org"}, **ORG))
    f = faq_ld(body)
    if f:
        out.append(f)
    return "\n".join('<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False) + "</script>" for o in out)


def head_html(meta, body, crumb_ld):
    title = meta["title"]
    desc = meta["description"]
    canon = abs_url(meta["slug"])
    robots = '<meta name="robots" content="noindex,nofollow">' if PREVIEW else '<meta name="robots" content="index,follow,max-image-preview:large">'
    gate_js = '<script>(function(){try{if(localStorage.getItem(\'bp_gate_ok\')===\'1\'){document.documentElement.classList.add(\'gate-ok\');}}catch(e){}})();</script>' if PREVIEW else ""
    return f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{gate_js}
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{robots}
<link rel="canonical" href="{canon}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="sitemap" type="application/xml" href="sitemap.xml">
<meta property="og:site_name" content="Burnout parental">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="{'website' if meta['slug'] == 'index' else 'article'}">
<meta property="og:url" content="{canon}">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="{SITE}og-image.png">
<meta property="og:image:alt" content="Burnout parental : le reconnaître et se faire accompagner">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{SITE}og-image.png">
<meta name="theme-color" content="#12201C">
<link rel="preload" href="fonts/cormorant-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/inter-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
{jsonld(meta, body, crumb_ld)}
</head>
<body class="{'locked' if PREVIEW else ''}">
{gate_html()}'''


def hero_html(pages, meta, crumb):
    kind = meta.get("kind", "article")
    minutes = max(1, round(len(strip_tags(meta["body"]).split()) / 200))
    metas = f'<span>{SVG["clock"]}Lecture : {minutes} min</span><span>{SVG["pen"]}Max Bouche, clinicien</span><span>{SVG["cal"]}Mis à jour le {e(fr_date(meta.get("updated", TODAY)))}</span>'
    if meta.get("quiz"):
        metas = f'<span>{SVG["clock"]}Environ {meta["quiz"]} min</span><span>{SVG["pen"]}Rédigé par un clinicien</span><span>Vos réponses restent dans votre navigateur</span>'
    lead = f'<p class="lead" data-reveal style="--d:.08s">{meta["lead"]}</p>' if meta.get("lead") else ""
    return f'''<section class="page-hero">
    <div class="wrap">
      {crumb}
      <span class="eyebrow" data-reveal>{e(meta.get("eyebrow", section_of(meta["slug"])["label"] if section_of(meta["slug"]) else "Burnout parental"))}</span>
      <h1 class="h-display" data-reveal style="--d:.04s">{meta.get("h1", meta["title"])}</h1>
      {lead}
      <div class="hero-meta" data-reveal style="--d:.12s">{metas}</div>
      {page_tools()}
    </div>
  </section>'''


DISCLAIMER = ('<div class="quiz-disclaimer">' + SVG["warn"] + '<span><strong>Outil d\'orientation, pas de diagnostic.</strong> Ce questionnaire n\'est pas un instrument validé scientifiquement : il aide à mettre des mots sur ce que vous vivez. Seul un entretien avec un professionnel permet une évaluation. Vos réponses restent dans votre navigateur et ne sont jamais envoyées.</span></div>')


def expand(body):
    return (body.replace("{{DISCLAIMER}}", DISCLAIMER).replace("{{RDV}}", RDV).replace("{{MAIL}}", MAIL)
            .replace("{{ARROW}}", SVG["arrow"]).replace("{{WARN}}", SVG["warn"]))


def sitemap_html(pages):
    h = '<div class="grid grid-3">'
    for s in SECTIONS:
        hub = pages[s["hub"]]
        lis = f'<li><a href="{url(s["hub"])}"><strong>{e(hub.get("nav_label", hub["title"]))}</strong></a></li>'
        lis += "".join(f'<li><a href="{url(p)}">{e(pages[p].get("nav_label", pages[p]["title"]))}</a></li>' for p in s["pages"])
        h += f'<div class="card" data-reveal><h2 style="font-size:1.2rem;margin:0 0 10px">{e(s["label"])}</h2><ul class="check-list" style="gap:7px">{lis}</ul></div>'
    h += '<div class="card" data-reveal><h2 style="font-size:1.2rem;margin:0 0 10px">Autres pages</h2><ul class="check-list" style="gap:7px"><li><a href="index.html">Accueil</a></li><li><a href="mentions-legales.html">Mentions légales et confidentialité</a></li><li><a href="sitemap.xml">Sitemap XML (pour les moteurs de recherche)</a></li></ul></div>'
    return h + "</div>"


def render(pages, meta):
    slug = meta["slug"]
    body = expand(meta["body"])
    if "{{SITEMAP}}" in body:
        body = body.replace("{{SITEMAP}}", sitemap_html(pages))
    crumb, crumb_ld = crumbs(pages, meta)
    kind = meta.get("kind", "article")
    head = head_html(meta, body, crumb_ld)
    hdr = header_html(pages, slug)
    if kind == "home":
        main = f'<main id="contenu">\n{body}\n{cta_html(meta)}\n</main>'
    elif kind in ("hub", "legal", "plain"):
        main = f'''<main id="contenu">
  {hero_html(pages, meta, crumb)}
  {body}
  <section class="section"><div class="wrap">{related_html(pages, meta)}{pager_html(pages, slug)}</div></section>
  {cta_html(meta)}
</main>'''
    else:
        body, entries = add_ids_and_toc(body)
        toc = toc_html(entries) if meta.get("toc", True) else ""
        aside = f'<aside aria-label="Sommaire de la page">{toc}</aside>' if toc else ""
        layout = f'<div class="article-layout">{aside}<div class="article-body prose">{body}</div></div>' if toc else f'<div class="prose">{body}</div>'
        main = f'''<main id="contenu">
  {hero_html(pages, meta, crumb)}
  <section class="section" style="padding-top:0"><div class="wrap">{layout}{related_html(pages, meta)}{pager_html(pages, slug)}</div></section>
  {cta_html(meta)}
</main>'''
    out = head + "\n" + hdr + main + "\n" + footer_html(pages, meta) + "\n" + mobile_nav_html(pages, slug) + "\n" + a11y_panel() + '\n<script src="assets/site.js" defer></script>\n</body>\n</html>\n'
    return out


# ---------------------------------------------------------------------------
def check(pages, outputs):
    errors = []
    known = set(outputs.keys()) | {"index.html"}
    for slug, html_out in outputs.items():
        n_h1 = len(re.findall(r"<h1[\s>]", html_out))
        if n_h1 != 1:
            errors.append(f"{slug}: {n_h1} balises h1")
        for href in re.findall(r'href="([^"#?]+)(?:[#?][^"]*)?"', html_out):
            if href.startswith(("http", "mailto:", "tel:", "data:")):
                continue
            if href.endswith(".html") and href not in known:
                errors.append(f"{slug}: lien cassé vers {href}")
            elif not href.endswith(".html") and href != "sitemap.xml" and not os.path.exists(os.path.join(ROOT, href)):
                errors.append(f"{slug}: fichier manquant {href}")
        for href in re.findall(r'href="#([^"]+)"', html_out):
            if href in ("contenu",):
                continue
            if f'id="{href}"' not in html_out:
                errors.append(f"{slug}: ancre #{href} introuvable")
        for src in re.findall(r'<img[^>]+>', html_out):
            if 'alt=' not in src:
                errors.append(f"{slug}: image sans attribut alt")
    titles = {}
    for slug, m in pages.items():
        titles.setdefault(m["title"], []).append(slug)
        if len(m["description"]) > 170:
            errors.append(f"{slug}: meta description trop longue ({len(m['description'])} caractères)")
    for t, s in titles.items():
        if len(s) > 1:
            errors.append(f"titre en double « {t} » : {', '.join(s)}")
    if errors:
        print("\n".join("[build] " + x for x in errors))
        sys.exit(1)


def main():
    pages = read_pages()
    expected = set(STANDALONE) | {s["hub"] for s in SECTIONS} | {p for s in SECTIONS for p in s["pages"]}
    missing = expected - set(pages)
    if missing:
        sys.exit("[build] pages manquantes dans _build/pages : " + ", ".join(sorted(missing)))
    extra = set(pages) - expected
    if extra:
        sys.exit("[build] pages non déclarées dans SECTIONS/STANDALONE : " + ", ".join(sorted(extra)))
    outputs = {}
    for slug, meta in pages.items():
        outputs[url(slug)] = render(pages, meta)
    check(pages, outputs)
    for fn, content in outputs.items():
        with open(os.path.join(ROOT, fn), "w", encoding="utf-8") as f:
            f.write(content)
    # sitemap
    order = ["index"] + [x for s in SECTIONS for x in [s["hub"]] + s["pages"]] + ["mentions-legales", "plan-du-site"]
    urls = []
    for slug in order:
        m = pages[slug]
        prio = "1.0" if slug == "index" else ("0.8" if slug in {s["hub"] for s in SECTIONS} else ("0.5" if slug.startswith("reflexion") or slug in ("mentions-legales", "plan-du-site") else "0.7"))
        urls.append(f"  <url><loc>{abs_url(slug)}</loc><lastmod>{m.get('updated', TODAY)}</lastmod><changefreq>monthly</changefreq><priority>{prio}</priority></url>")
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as f:
        if PREVIEW:
            f.write("# Site en préparation : exploration interdite. Au lancement, mettre PREVIEW = False\n# dans _build/build.py et relancer le script : ce fichier sera réécrit automatiquement.\nUser-agent: *\nDisallow: /\n")
        else:
            f.write(f"User-agent: *\nAllow: /\nDisallow: /_build/\n\nSitemap: {SITE}sitemap.xml\n")
    print(f"[build] {len(outputs)} pages générées, sitemap.xml et robots.txt écrits (PREVIEW={PREVIEW}).")


if __name__ == "__main__":
    main()
