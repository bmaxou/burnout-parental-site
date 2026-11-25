"""Structural checks for generated public search and glossary output."""
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = []
        self.buttons = []
        self.links = []
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'button':
            self.buttons.append(a.get('id'))
        if tag == 'a' and 'href' in a:
            self.links.append(a)


pages = {}
for file in ROOT.glob('*.html'):
    page = Page(file)
    if 'btnSearch' not in page.buttons:
        continue  # compatibility redirect, not a rendered public page
    assert not [key for key, count in Counter(page.ids).items() if count > 1], file.name
    assert page.buttons[page.buttons.index('btnSearch') + 1] == 'btnA11y', file.name
    assert {'bpSearchDialog', 'bpSearchInput', 'bpSearchResults', 'bpSearchStatus'} <= set(page.ids), file.name
    for a in page.links:
        if a['href'] in ('le-cabinet.html', 'bilans.html', 'pedopsy.html', 'bilan-mdph.html'):
            assert a.get('data-reseau-url', '').startswith('https://'), (file.name, a)
    pages[file.name] = page

rows = json.loads((ROOT / 'assets/index-recherche.json').read_text(encoding='utf-8'))
compact = json.loads((ROOT / 'assets/recherche-catalogue.json').read_text(encoding='utf-8'))
assert len({r['url'] for r in rows}) == len(rows)
assert len(compact) == len([r for r in rows if r['type'] not in ('action', 'section', 'faq')])
for row in rows:
    if row['type'] == 'action':
        continue
    dest = urlsplit(row['url'])
    filename = dest.path.lstrip('/') or 'index.html'
    assert filename in pages, row['url']
    assert filename not in ('tests.html', 'mentions-legales.html', 'plan-du-site.html')
    if dest.fragment:
        assert dest.fragment in pages[filename].ids, row['url']
gloss = pages['glossaire.html']
for anchor in ('terme-emdr', 'terme-tcc', 'terme-br2', 'terme-epuisement-parental', 'terme-parental-burnout-assessment', 'g-e', 'g-b', 'g-p', 'g-t'):
    assert anchor in gloss.ids, anchor
for link in gloss.links:
    if link['href'].startswith('#terme-'):
        assert link['href'][1:] in gloss.ids, link
print(f'{len(pages)} pages : loupe avant œil, identifiants uniques, destinations et {len(rows)} entrées vérifiées. Glossaire : {sum(i.startswith("terme-") for i in gloss.ids)} accès alphabétiques, liens et ancres valides.')
