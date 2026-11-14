"""Vérifie un PDF produit par l'auto-test d'export de Phénix CV (CI Windows).

Usage : python scripts/check-pdf.py <fichier.pdf> <méthode attendue : webview2|edge|chrome>

Contrôles : une seule page A4, texte attendu extractible, toutes les polices embarquées,
journal d'export (<fichier.pdf>.json) indiquant la méthode attendue.
"""
import json
import sys

from pypdf import PdfReader

EMBED_KEYS = ("/FontFile", "/FontFile2", "/FontFile3")


def font_is_embedded(font) -> bool:
    font = font.get_object()
    subtype = font.get("/Subtype")
    if subtype == "/Type3":  # glyphes dessinés dans le PDF : autonome
        return True
    if subtype == "/Type0":
        descendants = font["/DescendantFonts"]
        return all(font_is_embedded(d) for d in descendants)
    descriptor = font.get("/FontDescriptor")
    if descriptor is None:
        return False
    descriptor = descriptor.get_object()
    return any(k in descriptor for k in EMBED_KEYS)


def main() -> int:
    pdf_path, expected = sys.argv[1], sys.argv[2]
    errors: list[str] = []
    reader = PdfReader(pdf_path)

    if len(reader.pages) != 1:
        errors.append(f"{len(reader.pages)} page(s) au lieu d'une")
    page = reader.pages[0]
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    if abs(width - 595.3) > 3 or abs(height - 841.9) > 3:
        errors.append(f"format {width:.1f}x{height:.1f} pt au lieu de A4 (595x842)")

    text = (page.extract_text() or "").lower()
    for expected_text in ("camille martin", "assistante commerciale", "expérience professionnelle", "fond coloré"):
        if expected_text not in text:
            errors.append(f"texte absent : « {expected_text} »")

    fonts = page.get("/Resources", {}).get("/Font", {})
    if not fonts:
        errors.append("aucune police dans le PDF")
    for name, font in fonts.items():
        if not font_is_embedded(font):
            errors.append(f"police non embarquée : {name} ({font.get_object().get('/BaseFont')})")

    with open(pdf_path + ".json", encoding="utf-8") as handle:
        journal = json.load(handle)
    if journal.get("finalMethod") != expected:
        errors.append(f"méthode utilisée : {journal.get('finalMethod')} (attendue : {expected}) ; essais : {journal.get('attempts')}")

    names = [str(f.get_object().get("/BaseFont")) for f in fonts.values()]
    print(f"{pdf_path} : {len(reader.pages)} page, {width:.0f}x{height:.0f} pt, polices {names}, méthode {journal.get('finalMethod')}")
    for err in errors:
        print(f"ERREUR : {err}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
