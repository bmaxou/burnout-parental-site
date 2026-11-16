"""Public search catalogue and independently addressable glossary entries."""
import html
import json
import re
import unicodedata
from pathlib import Path


def plain(value):
    value = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', value, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value))).strip()


def norm(value):
    value = unicodedata.normalize('NFKD', value.lower()).replace('œ', 'oe')
    return re.sub(r'[^a-z0-9]+', '-', ''.join(c for c in value if not unicodedata.combining(c))).strip('-')


ALIASES = {
    'Balance entre risques et ressources (BR²)': ['BR²', 'BR2', 'Risques et ressources'],
    'Burn-out parental (épuisement parental)': ['Épuisement parental', 'Burnout parental'],
    'Burn-out professionnel': ['Épuisement professionnel'],
    'Dépression du post-partum': ['Post-partum', 'Dépression après la naissance'],
    'EMDR': ['Désensibilisation et retraitement par les mouvements oculaires', 'Eye Movement Desensitization and Reprocessing'],
    'MBI (Maslach Burnout Inventory)': ['Inventaire du burn-out professionnel (MBI)'],
    'PBA (Parental Burnout Assessment)': ['Parental Burnout Assessment'],
    'PBI (Parental Burnout Inventory)': ['Parental Burnout Inventory'],
    'TCC (thérapies cognitives et comportementales)': ['Thérapies cognitives et comportementales'],
}


def prepare_glossary(body):
    match = re.search(r'<dl class="gloss">(.*?)</dl>', body, re.S)
    if not match:
        return body
    entries = []
    for title, definition in re.findall(r'<div class="gloss-item"[^>]*>\s*<dt>(.*?)</dt><dd>(.*?)</dd>\s*</div>', match.group(1), re.S):
        key = plain(title)
        anchor = 'terme-' + (norm(key.split(' (')[0]) if key.startswith(('MBI (', 'PBA (', 'PBI (', 'TCC (')) else norm(key))
        aliases = ALIASES.get(key, [])
        entries.append((key, title, definition, anchor, aliases, False))
        seen = {norm(key)}
        for alias in aliases:
            if norm(alias) in seen:
                continue
            seen.add(norm(alias))
            entries.append((alias, html.escape(alias), 'Voir <a href="#' + anchor + '">' + title + '</a>.', 'terme-' + norm(alias), [key], True))
    entries.sort(key=lambda item: norm(item[0]))
    letters = []
    blocks = []
    for key, title, definition, anchor, aliases, alias in entries:
        letter = norm(key)[0]
        letter_html = ''
        if letter not in letters:
            letters.append(letter)
            letter_html = '<span class="gloss-letter" id="g-' + letter + '" aria-hidden="true"></span>'
        # Keep the site's existing author-name masking in attributes and search metadata as well.
        searchable = ' '.join([key] + aliases).replace('Maslach', '')
        blocks.append('<div class="gloss-item" id="' + anchor + '" data-gloss-terms="' + html.escape(searchable, quote=True) + '"' + (' data-gloss-alias="true"' if alias else '') + '><dt>' + letter_html + title + '</dt><dd>' + definition + '</dd></div>')
    nav = '<nav class="alpha-nav" aria-label="Lettres du glossaire">' + ''.join('<a href="#g-' + letter + '">' + letter.upper() + '</a>' for letter in letters) + '</nav>'
    filter_html = '<div class="gloss-search"><label for="glossSearch">Chercher un mot ou un sigle</label><input id="glossSearch" type="search" placeholder="Ex. : épuisement, BR², EMDR…" autocomplete="off" aria-controls="glossEntries"><p id="glossCount" role="status" aria-live="polite"></p></div>'
    body = re.sub(r'<nav class="alpha-nav".*?</nav>', filter_html + nav, body, flags=re.S)
    return body.replace(match.group(0), '<dl class="gloss" id="glossEntries">' + '\n'.join(blocks) + '</dl><div id="glossNetwork" class="bp-network-results"></div>')


KEYWORDS = {
    'comprendre': ['burn out', 'burnout', 'burn out parental', 'epuisement parental', 'guide', 'dossier burn out parental'],
    'burnout-parental-definition': ['definition burn out', 'definition epuisement parental', 'qu est ce que le burnout'],
    'signes-symptomes': ['symptomes', 'signes', 'irritabilite', 'colere', 'sommeil', 'je ne dors plus', 'insomnie', 'ruminations', 'je suis a bout', 'je craque'],
    'causes-facteurs-de-risque': ['causes', 'facteurs de risque', 'risques', 'pourquoi', 'ressources', 'balance'],
    'burnout-parental-depression-fatigue': ['depression', 'fatigue', 'difference', 'epuisement ou depression'],
    'burnout-parental-et-professionnel': ['burn out professionnel', 'epuisement professionnel', 'travail', 'double burn out'],
    'consequences-enfant-couple': ['consequences', 'enfant', 'couple', 'distance emotionnelle', 'distanciation', 'conflits', 'disputes', 'culpabilite'],
    'chiffres-cles': ['statistiques', 'chiffres', 'prevalence', 'frequence'],
    'auto-tests': ['test', 'tests', 'auto test', 'questionnaire', 'questionnaires'],
    'test-burnout-parental': ['test burn out', 'test burnout', 'test burnout parental', 'suis je en burn out', 'evaluer mon epuisement'],
    'test-risques-ressources': ['test balance', 'test risques ressources', 'br2', 'br²'],
    'test-charge-mentale': ['charge mentale', 'penser a tout', 'repartition des taches', 'organisation familiale'],
    'test-fatigue-epuisement': ['test fatigue', 'test epuisement'],
    'test-coparentalite': ['coparentalite', 'co parentalite', 'test couple', 'test coparentalite'],
    'test-perfectionnisme-parental': ['perfectionnisme', 'parent parfait', 'perfectionnisme parental'],
    'situations': ['situations', 'familles'],
    'mere-epuisee': ['mere', 'maman', 'maman epuisee', 'mere epuisee', 'mere a bout'],
    'pere-epuise': ['pere', 'papa', 'papa epuise', 'pere epuise', 'pere a bout'],
    'parent-solo': ['parent solo', 'monoparentalite', 'famille monoparentale', 'parent seul', 'mere seule', 'pere seul'],
    'famille-recomposee': ['famille recomposee', 'beau parent', 'belle mere', 'beau pere'],
    'enfant-besoins-specifiques': ['handicap', 'autisme', 'tsa', 'tdah', 'besoins specifiques', 'enfant handicape', 'enfant autiste'],
    'perinatalite-post-partum': ['post partum', 'postpartum', 'perinatalite', 'baby blues', 'naissance', 'grossesse', 'bebe', 'depression post partum'],
    'teletravail-double-charge': ['teletravail', 'double charge', 'travail a domicile'],
    'aidants-epuisement': ['aidant', 'aidants', 'repit', 'parent aidant', 'aidant familial'],
    'accompagnement': ['accompagnement', 'aide', 'therapie', 'traitement', 'se faire aider'],
    'quand-consulter': ['consulter', 'quand consulter', 'besoin aide'],
    'deroule-accompagnement': ['seance', 'premier entretien', 'deroulement', 'comment se passe'],
    'approches-therapeutiques': ['emdr', 'tcc', 'psychanalyse', 'psychotherapie', 'guidance parentale', 'therapies', 'methodes'],
    'proches-professionnels': ['proches', 'entourage', 'aider un parent', 'professionnels'],
    'prevention-au-quotidien': ['prevention', 'prevenir', 'recuperation', 'repos', 'relais'],
    'signaux-alerte-negligence-violence': ['violence', 'negligence', 'bebe secoue', 'secouement', 'signaux alerte'],
    'ressources': ['ressources utiles', 'outils'],
    'glossaire': ['glossaire', 'lexique', 'definitions', 'sigles'],
    'bibliographie': ['sources', 'bibliographie', 'etudes', 'recherche scientifique', 'livres'],
    'faq': ['questions frequentes', 'faq'],
    'reflexion-clinique': ['reflexion clinique', 'professionnel', 'clinique'],
}


def write_catalogue(root, pages, outputs, private):
    rows = []
    for slug, meta in pages.items():
        if slug in private or meta.get('noindex') or slug in ('mentions-legales', 'plan-du-site'):
            continue
        rendered = outputs['index.html' if slug == 'index' else slug + '.html']
        main = re.search(r'<main\b[^>]*>(.*?)</main>', rendered, re.S)
        body = main.group(1) if main else ''
        rows.append({'url': '/' if slug == 'index' else '/' + slug + '.html', 'title': plain(meta.get('h1', meta['title'])), 'description': meta['description'], 'keywords': KEYWORDS.get(slug, []), 'type': 'dossier' if meta.get('kind') in ('hub', 'home') else 'page', 'headings': ' '.join(plain(h) for h in re.findall(r'<h[23]\b[^>]*>(.*?)</h[23]>', body, re.S)), 'text': plain(body)[:18000]})
    # The appointment action already exists throughout the site; index it directly.
    rows.append({'url': '/#rdv', 'title': 'Prendre rendez-vous au cabinet', 'description': 'Choisir un rendez-vous au cabinet ou en téléconsultation.', 'keywords': ['rendez vous', 'rdv', 'prendre rdv', 'reservation', 'reserver', 'doctolib'], 'type': 'action'})
    gloss = outputs.get('glossaire.html', '')
    for attrs, title, definition in re.findall(r'<div class="gloss-item"([^>]*)><dt>(.*?)</dt><dd>(.*?)</dd></div>', gloss, re.S):
        anchor = re.search(r'id="([^"]+)"', attrs)
        if anchor and 'data-gloss-alias=' not in attrs:
            terms = re.search(r'data-gloss-terms="([^"]*)"', attrs)
            rows.append({'url': '/glossaire.html#' + anchor.group(1), 'title': plain(title), 'description': plain(definition), 'keywords': [html.unescape(terms.group(1))] if terms else [], 'type': 'glossaire'})
    assets = Path(root) / 'assets'
    (assets / 'index-recherche.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    compact = [{k: row[k] for k in ('url', 'title', 'description', 'keywords', 'type')} for row in rows if row['type'] != 'action']
    (assets / 'recherche-catalogue.json').write_text(json.dumps(compact, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return rows
