#!/usr/bin/env python3
"""Refresh this site's entries from its public local catalogue, without network access.

Configuration: reseau/site.json = {"site": "burnout", "origin":
"https://burnout-parental.fr", "catalogue": "assets/recherche-catalogue.json"}.
Run: python reseau/actualiser.py [repository-root]
Other sites' entries remain untouched; their own builds publish their updates.
"""
import json
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import urljoin, urlsplit

ORIGINS = {
    'psy': 'https://www.psy-psy.fr',
    'mdph': 'https://bilan-mdph.fr',
    'burnout': 'https://burnout-parental.fr',
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def public_entries(source, site, origin):
    if isinstance(source, dict):
        source = source.get('entries')
    if not isinstance(source, list):
        raise ValueError('Le catalogue public doit être une liste ou un objet avec entries.')
    own_origin = urlsplit(origin)
    entries = []
    seen = set()
    skipped = 0
    for row in source:
        if not isinstance(row, dict):
            skipped += 1
            continue
        if row.get('private') or row.get('noindex') or 'noindex' in str(row.get('robots', '')).lower():
            skipped += 1
            continue
        if row.get('type') in ('private', 'prive', 'privé') or row.get('site', site) != site:
            skipped += 1
            continue
        raw_url = str(row.get('url', '')).strip()
        title = str(row.get('title', '')).strip()
        if not raw_url or not title or '\\' in raw_url or any(ord(c) < 32 for c in raw_url):
            skipped += 1
            continue
        url = urljoin(origin + '/', raw_url)
        try:
            dest = urlsplit(url)
            valid = (dest.scheme == own_origin.scheme and dest.netloc.lower() == own_origin.netloc.lower()
                     and not dest.username and not dest.password)
        except ValueError:
            valid = False
        if not valid:
            skipped += 1
            continue
        words = []
        for key in ('keywords', 'aliases'):
            values = row.get(key, [])
            if isinstance(values, str):
                values = [values]
            if isinstance(values, list):
                words.extend(value.strip() for value in values if isinstance(value, str) and value.strip())
        item = {
            'site': site,
            'url': url,
            'title': title,
            'description': str(row.get('description') or ''),
            'keywords': list(dict.fromkeys(words)),
            'type': str(row.get('type') or 'page'),
        }
        if isinstance(row.get('intention'), bool):
            item['intention'] = row['intention']
        if isinstance(row.get('ordre'), int) and not isinstance(row['ordre'], bool):
            item['ordre'] = row['ordre']
        # Preserve different intentions for a shared URL, removing only exact duplicates.
        signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if signature not in seen:
            entries.append(item)
            seen.add(signature)
    return entries, skipped


def actualiser(root=None):
    root = Path(root).resolve() if root is not None else Path(__file__).resolve().parent.parent
    folder = root / 'reseau'
    config = read_json(folder / 'site.json')
    site = config.get('site')
    origin = str(config.get('origin', '')).rstrip('/')
    if site not in ORIGINS or origin != ORIGINS[site]:
        raise ValueError('site/origin doit identifier exactement un des trois sites du cabinet.')
    source_path = (root / config['catalogue']).resolve()
    try:
        source_path.relative_to(root)
    except ValueError as error:
        raise ValueError('Le catalogue public doit se trouver dans le dépôt du site.') from error
    own_entries, skipped = public_entries(read_json(source_path), site, origin)
    if not own_entries:
        raise ValueError('Aucune entrée publique valide : catalogue commun conservé sans modification.')
    target = folder / 'catalogue.json'
    document = read_json(target) if target.exists() else {'version': 1, 'entries': []}
    if not isinstance(document, dict) or not isinstance(document.get('entries'), list):
        raise ValueError('Format du catalogue commun invalide : aucune modification.')
    others = [entry for entry in document['entries'] if entry.get('site') != site]
    document['entries'] = others + own_entries
    encoded = (json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    changed = not target.exists() or target.read_bytes() != encoded
    if changed:
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=folder, prefix='.catalogue-', suffix='.tmp', delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(encoded)
            os.replace(temporary, target)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
    result = {'site': site, 'local': len(own_entries), 'other': len(others), 'skipped': skipped, 'changed': changed}
    print('[reseau] {site} : {local} entrées locales, {other} autres conservées, {skipped} exclues.'.format(**result))
    return result


if __name__ == '__main__':
    actualiser(sys.argv[1] if len(sys.argv) > 1 else None)
