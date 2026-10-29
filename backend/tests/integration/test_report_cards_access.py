"""Bulletins : visibilité pour la famille, pour l'administration, et sécurité de l'aperçu PDF.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_report_cards_access
"""

import unittest

from sqlalchemy import text

from tests.integration.support import (
    ADMIN, GUARDIAN_ONE_CHILD, GUARDIAN_TWO_CHILDREN, STUDENT, TEACHER, ApiTestCase,
)


class ReportCardTests(ApiTestCase):
    def children(self, matricule):
        return self.data(self.client(matricule).get("/guardian/children"))

    def validated_ids(self, student_id):
        return {
            str(row[0]) for row in self.db.execute(
                text(
                    """SELECT rc.id FROM report_cards rc
                       JOIN student_enrollments e ON e.id = rc.student_enrollment_id
                       WHERE e.student_id = :s AND rc.validated_at IS NOT NULL"""
                ),
                {"s": student_id},
            )
        }

    def test_a_family_only_sees_validated_report_cards_of_its_own_children(self):
        http = self.client(GUARDIAN_TWO_CHILDREN)
        for child in self.children(GUARDIAN_TWO_CHILDREN):
            listed = {item["id"] for item in self.data(http.get(f"/guardian/children/{child['id']}/report-cards"))}
            self.assertEqual(listed, self.validated_ids(child["id"]), child["first_name"])

    def test_a_draft_report_card_is_hidden_from_the_family(self):
        draft = self.db.execute(
            text(
                """SELECT rc.id, e.student_id FROM report_cards rc
                   JOIN student_enrollments e ON e.id = rc.student_enrollment_id
                   JOIN student_guardians sg ON sg.student_id = e.student_id
                   JOIN guardians g ON g.id = sg.guardian_id
                   JOIN accounts a ON a.id = g.account_id AND a.registration_number = :m
                   WHERE rc.validated_at IS NULL LIMIT 1"""
            ),
            {"m": GUARDIAN_TWO_CHILDREN},
        ).mappings().first()
        if draft is None:
            self.skipTest("Aucun bulletin non validé pour les enfants de p000002.")
        response = self.client(GUARDIAN_TWO_CHILDREN).get(
            f"/guardian/children/{draft['student_id']}/report-cards/{draft['id']}"
        )
        self.assertEqual(response.status_code, 404)

    def test_a_report_card_of_another_family_is_not_reachable(self):
        foreign_child = self.children(GUARDIAN_TWO_CHILDREN)[0]["id"]
        http = self.client(GUARDIAN_ONE_CHILD)
        self.assertEqual(http.get(f"/guardian/children/{foreign_child}/report-cards").status_code, 404)
        for report_card in self.validated_ids(foreign_child):
            self.assertEqual(
                http.get(f"/guardian/children/{foreign_child}/report-cards/{report_card}").status_code, 404
            )

    def test_the_administration_sees_every_report_card_including_drafts(self):
        listed = self.data(self.client(ADMIN).get("/report-cards"))
        self.assertTrue(listed, "aucun bulletin dans la liste admin")
        self.assertTrue(any(item["validated_at"] is None for item in listed), "aucun brouillon visible de l'admin")
        any_id = listed[0]["id"]
        self.assertEqual(self.client(ADMIN).get(f"/report-cards/{any_id}").status_code, 200)

    def test_staff_other_than_admin_and_students_cannot_open_report_cards(self):
        some = self.data(self.client(ADMIN).get("/report-cards"))[0]["id"]
        for matricule in (TEACHER, STUDENT):
            http = self.client(matricule)
            self.assertEqual(http.get("/report-cards").status_code, 403)
            self.assertEqual(http.get(f"/report-cards/{some}").status_code, 403)

    def test_pdf_preview_is_reserved_to_the_administration(self):
        some = self.data(self.client(ADMIN).get("/report-cards"))[0]["id"]
        for matricule in (TEACHER, STUDENT, GUARDIAN_TWO_CHILDREN):
            self.assertEqual(self.client(matricule).post(f"/report-cards/{some}/test-pdf").status_code, 403, matricule)
        self.assertEqual(self.client().post(f"/report-cards/{some}/test-pdf").status_code, 401)

    def _preview(self, urlopen_side_effect=None, pdf=b"%PDF-1.4 test"):
        from unittest.mock import MagicMock, patch

        some = self.data(self.client(ADMIN).get("/report-cards"))[0]["id"]
        fake = MagicMock()
        fake.__enter__.return_value.headers.get_content_type.return_value = "application/pdf"
        fake.__enter__.return_value.read.return_value = pdf
        with patch("app.services.latex_report_card_service.urlopen", side_effect=urlopen_side_effect, return_value=fake) as mocked:
            response = self.client(ADMIN).post(f"/report-cards/{some}/test-pdf")
        return response, mocked

    def test_pdf_preview_returns_a_pdf_when_the_remote_service_answers(self):
        response, _ = self._preview()
        self.assertEqual(response.status_code, 200, response.text[:200])
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertEqual(response.headers["content-type"], "application/pdf")

    def test_pdf_preview_reports_a_timeout_cleanly_instead_of_crashing(self):
        response, _ = self._preview(urlopen_side_effect=TimeoutError("délai dépassé"))
        self.assertEqual(response.status_code, 503, response.text[:200])
        self.assertNotIn("Traceback", response.text)

    @unittest.expectedFailure
    def test_pdf_preview_must_not_send_personal_data_to_a_third_party_service(self):
        # À CORRIGER : l'aperçu envoie le bulletin complet (nom, matricule, notes) à LaTeX.Online
        # dans l'URL. Quand la compilation sera locale, retirer `expectedFailure`.
        response, mocked = self._preview()
        sent_url = str(mocked.call_args.args[0]).lower()
        listed = self.data(self.client(ADMIN).get("/report-cards"))[0]
        self.assertNotIn(listed["registration_number"].lower(), sent_url)
        self.assertNotIn(listed["student_name"].split()[0].lower(), sent_url)
