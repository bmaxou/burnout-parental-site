# -*- coding: utf-8 -*-
"""
Masquage des noms de personnes : chaque nom listé dans _build/noms.json est remplacé,
dans le texte des pages, par <span class="nm nXX" role="img" aria-label="nom"></span>.
Le dessin du nom est généré depuis les polices du site (fonts/*.woff2) sous forme de
tracés SVG servant de masque CSS (mask-image, couleur = currentColor). Le HTML ne
contient donc jamais le nom en toutes lettres, et le texte n'est pas copiable.

Nécessite : pip install fonttools brotli (hors du dépôt).
"""
import json, os, re, html as htmlmod

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT_DIR = os.path.join(ROOT, "fonts")

# Variantes de rendu : clé -> (fichier de police, sélecteurs CSS qui l'utilisent)
VARIANTS = {
    "r": ("inter-400.woff2", None),                       # texte courant
    "b": ("inter-700.woff2", "strong,b,.role,legend,.bar-name,.pager strong,.related-grid strong,.sub-menu a,.nav-link,.hub-card h3"),
    "d": ("cormorant-600.woff2", "h1,h2,h3,h4,.acc-name,.logo-name,.counter-value,.ring-value,blockquote"),
}
PLACE = "⟦n{}⟧"  # jeton temporaire ⟦nNN⟧ inséré dans le texte


def load_list():
    with open(os.path.join(HERE, "noms.json"), encoding="utf-8") as f:
        d = json.load(f)
    return d


class Masker:
    def __init__(self):
        d = load_list()
        self.complets = sorted(set(d["complets"]), key=len, reverse=True)
        self.noms = sorted(set(d["noms"]), key=len, reverse=True)
        self.stricts = sorted(set(d["stricts"]), key=len, reverse=True)
        self.courriels = d.get("courriels", [])
        self.index = {}      # texte du nom -> numéro
        self.used = {}       # numéro -> set(variantes)
        self._fonts = {}
        self._cache = {}
        esc = lambda l: "|".join(re.escape(x) for x in l)
        B1, B2 = r"(?<![\w\-’'])", r"(?![\w\-’'])"
        self.rx_complets = re.compile(B1 + "(" + esc(self.complets) + ")" + B2) if self.complets else None
        self.rx_noms = re.compile(B1 + "(" + esc(self.noms) + ")" + B2) if self.noms else None
        ctx_after = r"(?=,? [A-ZÀ-Ý]{1,3}(?:\.|,|\b)| et (?:al|coll)| & | &amp; | and |, (?:19|20)\d\d| \((?:19|20)\d\d|, |;)"
        ctx_before = r"(?:(?<=& )|(?<=et )|(?<=and )|(?<=, )|(?<=\())"
        self.rx_stricts = re.compile(B1 + "(" + esc(self.stricts) + ")" + B2 + ctx_after) if self.stricts else None
        self.rx_stricts2 = re.compile(ctx_before + "(" + esc(self.stricts) + ")" + B2) if self.stricts else None
        self.rx_mails = re.compile("(" + esc(self.courriels) + ")") if self.courriels else None
        # tous les noms, pour la vérification finale
        allnames = set(self.complets) | set(self.noms) | set(self.courriels)
        # contrôle plus large que le remplacement : un nom collé à un trait d'union (« Nom-Nom ») est aussi signalé
        self.rx_check = re.compile(r"(?<![\w’'])(" + esc(sorted(allnames, key=len, reverse=True)) + r")(?![\w’'])")
        self.rx_check_strict = re.compile(B1 + "(" + esc(self.stricts) + ")" + B2 + r"(?=,? [A-ZÀ-Ý]{1,3}(?:\.|,|\b)| et (?:al|coll)| &)") if self.stricts else None

    # ----- repérage dans le texte -----
    def _num(self, name):
        if name not in self.index:
            self.index[name] = len(self.index)
        return self.index[name]

    def _tokenize(self, text):
        """Remplace les noms d'un segment de texte brut par des jetons ⟦nNN⟧."""
        def rep(m):
            return PLACE.format(self._num(htmlmod.unescape(m.group(1))))
        if self.rx_mails:
            text = self.rx_mails.sub(rep, text)
        if self.rx_complets:
            text = self.rx_complets.sub(rep, text)
        if self.rx_noms:
            text = self.rx_noms.sub(rep, text)
        if self.rx_stricts:
            text = self.rx_stricts.sub(rep, text)
            text = self.rx_stricts2.sub(rep, text)
        return text

    def mask_html(self, doc):
        """Parcourt le HTML, remplace les noms dans les nœuds texte (hors script/style),
        en choisissant la variante de police d'après les balises englobantes."""
        out = []
        stack = []
        pos = 0
        tag_rx = re.compile(r"<(/?)([a-zA-Z0-9]+)([^>]*)>|<!--.*?-->", re.S)
        skip_until = None
        variant_sel = {k: v[1] for k, v in VARIANTS.items() if v[1]}
        sel_tags = {k: set(s.replace(".", " .").split(",")) for k, s in variant_sel.items()}

        def variant_for(stack):
            for tagname, cls in reversed(stack):
                for k, sels in sel_tags.items():
                    for s in sels:
                        s = s.strip()
                        if s.startswith("."):
                            if s[1:] in cls:
                                return k
                        elif " " in s:  # sélecteur composé "pager strong"
                            pass
                        elif s == tagname:
                            return k
            return "r"

        def emit_text(t, stack):
            if PLACE[0] in t or not (self.rx_complets or self.rx_noms):
                pass
            t2 = self._tokenize(t)
            if t2 == t:
                return t
            var = variant_for(stack)

            def tok(m):
                n = int(m.group(1))
                self.used.setdefault(n, set()).add(var)
                extra = "" if var == "r" else " v" + var
                return f'<span class="nm n{n}{extra}" role="img" aria-label="nom"></span>'
            return re.sub(r"⟦n(\d+)⟧", tok, t2)

        for m in tag_rx.finditer(doc):
            text = doc[pos:m.start()]
            if skip_until is None:
                out.append(emit_text(text, stack))
            else:
                out.append(text)
            out.append(m.group(0))
            pos = m.end()
            if m.group(0).startswith("<!--"):
                continue
            closing, name, attrs = m.group(1), m.group(2).lower(), m.group(3)
            if skip_until:
                if closing and name == skip_until:
                    skip_until = None
                continue
            if name in ("script", "style", "title"):
                skip_until = name
                continue
            if closing:
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i][0] == name:
                        del stack[i:]
                        break
            elif not attrs.rstrip().endswith("/") and name not in ("br", "img", "input", "meta", "link", "hr", "path", "circle", "rect", "line", "polygon"):
                cm = re.search(r'class="([^"]*)"', attrs)
                stack.append((name, set(cm.group(1).split()) if cm else set()))
        out.append(doc[pos:] if skip_until else emit_text(doc[pos:], stack))
        return "".join(out)

    # ----- vérification -----
    def leftovers(self, doc):
        """Noms de la liste encore présents dans le document complet (texte ET attributs)."""
        found = set(m.group(1) for m in self.rx_check.finditer(doc))
        if self.rx_check_strict:
            found |= set(m.group(1) for m in self.rx_check_strict.finditer(doc))
        return sorted(found)

    def name_in_url(self, url):
        """Vrai si une adresse (lien, courriel) contient un nom de la liste, quelle que soit la casse."""
        flat = re.sub(r"[_\-+.%0-9]+", " ", url).lower()
        for n in self.noms + self.complets:
            if len(n) < 4:
                continue
            if re.search(r"(?<![a-z])" + re.escape(n.lower().replace("-", " ")) + r"(?![a-z])", flat):
                return True
        return False

    def unlisted_citations(self, doc):
        """Noms probables (style « Nom, X. », « Nom XY, », « Nom et al. ») absents de la liste."""
        text = re.sub(r"<script[^>]*>.*?</script>", " ", doc, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = htmlmod.unescape(text)
        W = r"[A-ZÀ-Ýž][a-zà-ÿž'’\-]+(?:-[A-ZÀ-Ý][a-zà-ÿ'’\-]+)?"
        cands = set()
        for m in re.finditer(W + r"(?=, [A-ZÀ-Ý]\.)", text):
            cands.add(m.group(0))
        for m in re.finditer(W + r"(?= et (?:al|coll)\.)", text):
            cands.add(m.group(0))
        for m in re.finditer(W + r"(?= (?:[A-Z]\.?){1,3}(?:,|;| et al| \((?:19|20)\d\d))", text):
            cands.add(m.group(0))
        ok = {"Fiche", "Europe", "Triple", "Health", "Source", "Sources", "Vol", "Med", "Direct", "Open", "Press", "Scale", "Index", "Tool", "Inventory", "Survey", "Measure", "Assessment", "Burnout", "Parental", "Version", "Edition", "Journal", "Frontiers", "Psychology", "Science", "Affective", "Child", "Abuse", "Neglect", "Sex", "Roles", "Current", "Directions", "Clinical", "Psychological", "Psychotherapy", "Psychosomatics", "Psychoneuroendocrinology", "Note", "Voir", "Vancouver", "Lire", "Tome", "Chapitre", "Canada", "France", "Belgique", "Québec", "Paris", "London", "New", "York", "Mind", "Garden", "Free", "Simon", "Schuster", "Stanford", "Hennepin", "Mayo", "Johns", "Hopkins", "Groupe", "Ohio", "State", "University", "Rasch", "Fiche", "Mini-Z", "Manual", "Manuel", "Figure", "Tableau", "Point", "Pour", "Exemple", "Item", "Items", "Items"}
        res = set()
        for c in cands:
            if c in ok:
                continue
            if self.rx_check.fullmatch(c) or any(c in x for x in self.complets) or c in self.stricts:
                continue
            res.add(c)
        return sorted(res)

    # ----- génération des tracés -----
    def _font(self, key):
        if key not in self._fonts:
            try:
                from fontTools.ttLib import TTFont
                from fontTools.pens.svgPathPen import SVGPathPen
                from fontTools.pens.transformPen import TransformPen
            except ImportError:
                raise SystemExit("[build] fonttools manquant : pip install fonttools brotli (en dehors du dépôt)")
            f = TTFont(os.path.join(FONT_DIR, VARIANTS[key][0]))
            self._fonts[key] = f
        return self._fonts[key]

    def _path(self, key, text):
        """Tracé SVG du texte dans la police de la variante, en unités de police (y vers le bas)."""
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        font = self._font(key)
        gs = font.getGlyphSet()
        cmap = font.getBestCmap()
        hmtx = font["hmtx"]
        upm = font["head"].unitsPerEm
        kern = self._kern_table(key)
        x = 0
        sc = 500.0 / upm  # tracés ramenés à 500 unités par em : moins de chiffres, précision suffisante
        pen = SVGPathPen(gs, ntos=lambda v: str(int(round(v))))
        prev = None
        for ch in text:
            if ch == " " or ch == " ":
                x += hmtx[cmap.get(" ")][0] if " " in cmap else upm * 0.25
                prev = None
                continue
            gname = cmap.get(ord(ch))
            if gname is None:  # lettre absente de la police (ex. ž) : lettre de base sans signe diacritique
                import unicodedata
                base = unicodedata.normalize("NFKD", ch)[0]
                gname = cmap.get(ord(base))
            if gname is None:
                raise SystemExit(f"[build] caractère « {ch} » absent de {VARIANTS[key][0]} pour « {text} »")
            if prev is not None:
                x += kern.get((prev, gname), 0)
            tp = TransformPen(pen, (sc, 0, 0, -sc, x * sc, 0))
            gs[gname].draw(tp)
            x += hmtx[gname][0]
            prev = gname
        asc = font["hhea"].ascent * sc
        desc = font["hhea"].descent * sc
        return pen.getCommands(), x * sc, asc, desc, 500.0

    def _kern_table(self, key):
        """Crénage simple (table kern ou paires GPOS format 1) : améliore l'alignement visuel."""
        font = self._font(key)
        attr = "_kern_" + key
        if hasattr(self, attr):
            return getattr(self, attr)
        table = {}
        try:
            if "kern" in font:
                for st in font["kern"].kernTables:
                    table.update(st.kernTable)
            elif "GPOS" in font:
                gpos = font["GPOS"].table
                for lk in gpos.LookupList.Lookup:
                    if lk.LookupType != 2:
                        continue
                    for st in lk.SubTable:
                        if st.Format != 1:
                            continue
                        cov = st.Coverage.glyphs
                        for i, ps in enumerate(st.PairSet):
                            for pvr in ps.PairValueRecord:
                                v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                                if v:
                                    table[(cov[i], pvr.SecondGlyph)] = v
        except Exception:
            table = {}
        setattr(self, attr, table)
        return table

    def css_for(self, used_numbers=None):
        """CSS des noms utilisés : une règle par nom et par variante."""
        rules = []
        names_by_num = {n: name for name, n in self.index.items()}
        nums = sorted(used_numbers if used_numbers is not None else self.used.keys())
        for n in nums:
            name = names_by_num[n]
            for var in sorted(self.used.get(n, {"r"})):
                k = (name, var)
                if k not in self._cache:
                    d, w, asc, desc, upm = self._path(var, name)
                    h = asc - desc
                    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 {-asc} {int(round(w))} {h}'><path d='{d}'/></svg>"
                    svg = svg.replace("#", "%23").replace("<", "%3C").replace(">", "%3E").replace('"', "'")
                    self._cache[k] = (svg, w / upm, h / upm, desc / upm)
                svg, wem, hem, vem = self._cache[k]
                sel = f".n{n}" if var == "r" else f".n{n}.v{var}"
                rules.append(f'{sel}{{width:{wem:.3f}em;height:{hem:.3f}em;vertical-align:{vem:.3f}em;--m:url("data:image/svg+xml,{svg}")}}')
        return "\n".join(rules)


BASE_CSS = (".nm{display:inline-block;background:currentColor;-webkit-mask-image:var(--m);mask-image:var(--m);"
            "-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;"
            "-webkit-mask-position:center;mask-position:center;user-select:none;-webkit-user-select:none;pointer-events:none;"
            "white-space:nowrap;line-height:1;}\n"
            "@media print{.nm{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}")
