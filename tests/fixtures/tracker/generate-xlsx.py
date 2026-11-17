"""Classeurs d'essai pour l'import du suivi (personne fictive : Camille Martin).

Régénérer : python3 generate-xlsx.py (openpyxl), puis, pour la version LibreOffice :
soffice --headless --convert-to xlsx --outdir libreoffice suivi-camille.xlsx
"""
from datetime import date
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "Candidatures 2026"
ws.append(["Entreprise", "Poste", "Statut", "Date d'envoi", "Salaire brut annuel", "Remarques"])
rows = [
    ("Laiterie du Val", "Assistante ADV", "Postulé", date(2026, 3, 12), 30000, "Relancer fin mars\nPoste en CDI"),
    ("Atelier Dupré & fils", "Assistante commerciale", "Entretien", date(2026, 3, 19), None, None),
    ("Biscuiterie des Monts", "Assistante administrative", "Refusé", date(2026, 2, 3), "=29000+1500", "Réponse par e-mail"),
]
for r in rows:
    ws.append(list(r))
for cell in ws["D"][1:]:
    cell.number_format = "dd/mm/yyyy"

old = wb.create_sheet("2025")
old.append(["Entreprise", "Poste", "Statut"])
old.append(["Coopérative du Lac", "Commerciale sédentaire", "Sans réponse"])

hidden = wb.create_sheet("Brouillon")
hidden.append(["Ne pas importer"])
hidden.sheet_state = "hidden"

wb.save("suivi-camille.xlsx")
