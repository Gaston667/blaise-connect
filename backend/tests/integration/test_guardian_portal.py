"""Portail responsable légal : un parent ne voit que ses enfants, jamais ceux des autres.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_guardian_portal
"""

from sqlalchemy import text

from tests.integration.support import (
    ADMIN, GUARDIAN_ONE_CHILD, GUARDIAN_TWO_CHILDREN, STUDENT, ApiTestCase,
)

CHILD_ENDPOINTS = [
    "", "/grades", "/grades/summary", "/attendance", "/timetable", "/report-cards",
    "/record", "/documents",
]


class GuardianPortalTests(ApiTestCase):
    def children(self, matricule):
        return self.data(self.client(matricule).get("/guardian/children"))

    def test_a_parent_with_two_children_sees_both_and_only_them(self):
        children = self.children(GUARDIAN_TWO_CHILDREN)
        self.assertEqual(sorted(c["first_name"] for c in children), ["Abdoulaye", "Hawa"])
        linked = {
            str(row[0]) for row in self.db.execute(
                text(
                    """SELECT sg.student_id FROM student_guardians sg
                       JOIN guardians g ON g.id = sg.guardian_id
                       JOIN accounts a ON a.id = g.account_id
                       WHERE a.registration_number = :m"""
                ),
                {"m": GUARDIAN_TWO_CHILDREN},
            )
        }
        self.assertEqual({c["id"] for c in children}, linked)

    def test_a_parent_with_one_child_sees_only_that_child(self):
        children = self.children(GUARDIAN_ONE_CHILD)
        self.assertEqual([c["first_name"] for c in children], ["Mohamed"])

    def test_a_parent_can_read_every_screen_of_their_own_child(self):
        http = self.client(GUARDIAN_TWO_CHILDREN)
        for child in self.children(GUARDIAN_TWO_CHILDREN):
            for suffix in CHILD_ENDPOINTS:
                status = http.get(f"/guardian/children/{child['id']}{suffix}").status_code
                self.assertEqual(status, 200, f"{child['first_name']}{suffix} -> {status}")

    def test_a_child_of_another_family_is_not_reachable_and_looks_non_existent(self):
        foreign = self.children(GUARDIAN_TWO_CHILDREN)[0]["id"]
        http = self.client(GUARDIAN_ONE_CHILD)
        for suffix in CHILD_ENDPOINTS:
            status = http.get(f"/guardian/children/{foreign}{suffix}").status_code
            self.assertEqual(status, 404, f"enfant d'une autre famille{suffix} -> {status}")
        unknown = http.get("/guardian/children/00000000-0000-0000-0000-000000000000").status_code
        self.assertEqual(unknown, 404, "un élève inexistant et un élève non rattaché doivent avoir la même réponse")

    def test_an_archived_child_disappears_from_the_portal(self):
        child = self.children(GUARDIAN_ONE_CHILD)[0]
        self.db.execute(
            text("UPDATE students SET status = 'ARCHIVED', archived_at = now() WHERE id = :id"),
            {"id": child["id"]},
        )
        # le compte lié doit aussi être archivé pour respecter la règle de la base
        self.db.execute(
            text(
                """UPDATE accounts SET is_active = false, archived_at = now()
                   WHERE id = (SELECT account_id FROM students WHERE id = :id)"""
            ),
            {"id": child["id"]},
        )
        self.assertEqual(self.children(GUARDIAN_ONE_CHILD), [])

    def test_a_parent_cannot_use_student_or_staff_routes_and_vice_versa(self):
        parent = self.client(GUARDIAN_TWO_CHILDREN)
        self.assertEqual(parent.get("/students/me").status_code, 403)
        self.assertEqual(parent.get("/students/").status_code, 403)
        for matricule in (STUDENT, ADMIN):
            self.assertEqual(self.client(matricule).get("/guardian/children").status_code, 403)

    def test_a_parent_cannot_justify_the_absence_of_another_family(self):
        foreign_child = self.children(GUARDIAN_TWO_CHILDREN)[0]
        record = self.db.execute(
            text(
                """SELECT r.id FROM attendance_records r
                   JOIN student_enrollments e ON e.id = r.student_enrollment_id
                   WHERE e.student_id = :s LIMIT 1"""
            ),
            {"s": foreign_child["id"]},
        ).scalar_one_or_none()
        if record is None:
            self.skipTest("Aucune absence enregistrée pour cet élève.")
        response = self.client(GUARDIAN_ONE_CHILD).post(
            f"/guardian/children/{foreign_child['id']}/attendance/{record}/justification",
            data={"reason": "Tentative d'une autre famille"},
        )
        self.assertEqual(response.status_code, 404)


class GuardianChildRecordTests(ApiTestCase):
    """Dossier de l'enfant : informations et documents, strictement limités à la famille."""

    def setUp(self):
        super().setUp()
        self.parent = self.client(GUARDIAN_TWO_CHILDREN)
        self.child = self.data(self.parent.get("/guardian/children"))[0]

    def add_document(self, title):
        return self.db.execute(
            text(
                """
                WITH document AS (
                    INSERT INTO documents (document_type_id, title, storage_path, original_filename,
                                           mime_type, size_bytes, sha256, uploaded_by_account_id)
                    SELECT dt.id, :title, 'accounts/test/documents/' || gen_random_uuid(), 'acte.pdf',
                           'application/pdf', 10, repeat('a', 64),
                           (SELECT id FROM accounts WHERE registration_number = :admin)
                    FROM document_types dt WHERE dt.code = 'ADMINISTRATIVE'
                    RETURNING id
                )
                INSERT INTO document_links (document_id, entity_type, entity_id)
                SELECT id, 'STUDENT', :student FROM document
                RETURNING document_id
                """
            ),
            {"title": title, "admin": ADMIN, "student": self.child["id"]},
        ).scalar_one()

    def test_the_record_shows_identity_but_never_medical_information(self):
        record = self.data(self.parent.get(f"/guardian/children/{self.child['id']}/record"))
        self.assertEqual(record["first_name"], self.child["first_name"])
        self.assertIn("birth_date", record)
        self.assertNotIn("medical_condition", record)
        self.assertNotIn("photo_path", record)

    def test_a_document_of_the_child_is_listed_without_internal_details(self):
        self.add_document("Acte de naissance")
        documents = self.data(self.parent.get(f"/guardian/children/{self.child['id']}/documents"))
        found = next(item for item in documents if item["title"] == "Acte de naissance")
        self.assertEqual(found["original_filename"], "acte.pdf")
        for hidden in ("sha256", "uploaded_by_account_id", "uploaded_by_registration_number", "storage_path"):
            self.assertNotIn(hidden, found)

    def test_another_family_cannot_list_or_download_the_documents(self):
        document_id = self.add_document("Certificat médical")
        stranger = self.client(GUARDIAN_ONE_CHILD)
        base = f"/guardian/children/{self.child['id']}"
        self.assertEqual(stranger.get(f"{base}/documents").status_code, 404)
        self.assertEqual(stranger.get(f"{base}/documents/{document_id}/content").status_code, 404)

    def test_a_document_of_another_child_is_not_reachable_through_my_child(self):
        other = self.data(self.parent.get("/guardian/children"))[1]
        document_id = self.add_document("Certificat médical")
        response = self.parent.get(f"/guardian/children/{other['id']}/documents/{document_id}/content")
        self.assertEqual(response.status_code, 404)
