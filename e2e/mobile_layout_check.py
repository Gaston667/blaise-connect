"""Contrôle automatique de l'affichage sur téléphone, pour chaque rôle et chaque page du menu.

Vérifie, sur des écrans de 360 et 390 px de large :
  - aucun défilement horizontal (la page ne dépasse pas de l'écran) ;
  - aucune erreur JavaScript ni réponse serveur 5xx ;
  - des zones à toucher d'au moins 40 px (boutons, liens, champs).
Vérifie aussi l'emploi du temps (vue jour, onglets des jours, navigation par semaine)
pour l'élève, le parent et l'enseignant.

Prérequis : application démarrée (docker compose up), `pip install playwright`,
navigateur Edge ou Chrome installé.

    python e2e/mobile_layout_check.py                    # http://localhost:5173
    python e2e/mobile_layout_check.py http://10.0.0.5:5173
Code de sortie : 0 si tout est bon, 1 sinon.
"""

import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:5173"
PASSWORD = "Password123!"
ROLES = [("admin", "a000001"), ("enseignant", "e000001"), ("élève", "u000003"), ("parent", "p000002")]
WIDTHS = (360, 390)
MIN_TARGET = 40

MEASURE = """
() => {
  const vw = document.documentElement.clientWidth;
  const result = {overflow: document.documentElement.scrollWidth - vw, small: []};
  const seen = new Set();
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    if (el.closest('[aria-hidden=true]')) continue;
    if (r.height < %d || r.width < %d) {
      const label = (el.innerText || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 24);
      const key = (el.className || el.tagName).toString().slice(0, 40) + '|' + label;
      if (!seen.has(key) && result.small.length < 6) { seen.add(key); result.small.push(key + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
    }
  }
  return result;
}
""" % (MIN_TARGET, MIN_TARGET)


def login(page, user):
    page.goto(BASE)
    page.wait_for_selector("input[name=connexionRegistrationNumber]")
    page.fill("input[name=connexionRegistrationNumber]", user)
    page.fill("input[name=connexionPassword]", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_selector(".layout-header", timeout=20000)
    page.wait_for_timeout(1500)


def open_menu(page):
    if not page.locator(".layout-sidebar-open").count():
        page.click(".layout-menu-button")
        page.wait_for_timeout(350)


def page_keys(page):
    open_menu(page)
    for toggle in page.locator(".layout-navigation-group-toggle").all():
        if toggle.get_attribute("aria-expanded") == "false":
            toggle.click()
            page.wait_for_timeout(200)
    keys = page.eval_on_selector_all("[data-page]", "els => els.map(e => e.dataset.page)")
    return list(dict.fromkeys(keys))


def main():
    failures = []
    checked = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        for width in WIDTHS:
            for role, user in ROLES:
                context = browser.new_context(
                    viewport={"width": width, "height": 844}, device_scale_factor=1.5,
                    is_mobile=True, has_touch=True, locale="fr-FR",
                )
                page = context.new_page()
                problems = []
                page.on("pageerror", lambda e: problems.append(f"erreur JavaScript : {str(e)[:100]}"))
                page.on("response", lambda r: problems.append(f"réponse {r.status} : {r.url[-60:]}") if r.status >= 500 else None)
                login(page, user)
                keys = page_keys(page)
                page.reload()
                page.wait_for_selector(".layout-header")
                for key in keys:
                    open_menu(page)
                    for toggle in page.locator(".layout-navigation-group-toggle").all():
                        if toggle.get_attribute("aria-expanded") == "false":
                            toggle.click()
                    button = page.locator(f"[data-page='{key}']").first
                    if not button.count() or button.is_disabled():
                        continue  # ex. « Bulletins » grisé
                    button.click()
                    page.wait_for_timeout(1800)
                    measure = page.evaluate(MEASURE)
                    checked += 1
                    label = f"{width}px · {role} · {key}"
                    if measure["overflow"] > 0:
                        failures.append(f"{label} : la page dépasse de {measure['overflow']} px")
                    if measure["small"]:
                        failures.append(f"{label} : zones trop petites : {measure['small']}")
                    for problem in problems:
                        failures.append(f"{label} : {problem}")
                    problems.clear()
                context.close()

        # ---- emploi du temps : vue jour et navigation par semaine
        for role, user, key in (("élève", "u000003", "student-timetable"), ("parent", "p000002", "student-timetable"),
                                ("enseignant", "e000001", "teacher-timetable")):
            context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="fr-FR")
            page = context.new_page()
            login(page, user)
            open_menu(page)
            page.locator(f"[data-page='{key}']").first.click()
            page.wait_for_selector(".stp-week-nav", timeout=10000)
            label = f"emploi du temps · {role}"
            if page.locator(".stp-day-tab").count() < 5:
                failures.append(f"{label} : les onglets des jours sont absents")
            first_range = page.locator(".stp-week-nav__range").inner_text()
            page.get_by_label("Semaine suivante").click()
            page.wait_for_timeout(300)
            if page.locator(".stp-week-nav__range").inner_text() == first_range:
                failures.append(f"{label} : « semaine suivante » ne change pas la semaine")
            for _ in range(80):
                page.get_by_label("Semaine précédente").click()
            if not page.locator(".stp-empty").count():
                failures.append(f"{label} : une semaine hors période devrait afficher « Aucun cours cette semaine »")
            page.get_by_role("button", name="Aujourd’hui").click()
            if page.locator(".stp-day-agenda__row, .stp-day-agenda__group").count() == 0:
                failures.append(f"{label} : aucun cours affiché pour la semaine courante")
            checked += 1
            context.close()
        browser.close()

    print(f"{checked} contrôles effectués.")
    if failures:
        print(f"{len(failures)} problème(s) :")
        for failure in failures:
            print(" -", failure)
        return 1
    print("Tout est bon : aucun dépassement, aucune erreur, zones tactiles correctes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
