"""Création interactive et unique du premier administrateur BlaiseConnect."""

from __future__ import annotations

from datetime import date
from getpass import getpass

from pydantic import SecretStr, ValidationError
from sqlalchemy import select, text

from app.core.database import session_factory
from app.models.account import Account
from app.schemas.account_complete_create import AccountCompleteCreate
from app.schemas.account_profile_create import AccountProfileCreate
from app.services.account_service import create_account_with_profile


def prompt_required(label: str) -> str:
    """Demande une valeur non vide dans le terminal."""

    while True:
        value = input(f"{label} : ").strip()
        if value:
            return value
        print("Ce champ est obligatoire.")


def prompt_date(label: str) -> date:
    """Demande une date au format ISO stable YYYY-MM-DD."""

    while True:
        raw_value = prompt_required(f"{label} (AAAA-MM-JJ)")
        try:
            return date.fromisoformat(raw_value)
        except ValueError:
            print("Format invalide. Exemple attendu : 2026-08-27.")


def prompt_password() -> SecretStr:
    """Demande deux fois un mot de passe sans l'afficher."""

    while True:
        password = getpass("Mot de passe : ")
        confirmation = getpass("Confirmer le mot de passe : ")

        if password != confirmation:
            print("Les deux mots de passe sont différents.")
            continue
        if len(password) < 8:
            print("Le mot de passe doit contenir au moins 8 caractères.")
            continue
        return SecretStr(password)


def build_initial_admin_data() -> AccountCompleteCreate:
    """Collecte et valide les données nécessaires au premier administrateur."""

    print("\nCréation du premier administrateur BlaiseConnect.")
    print("Le matricule doit respecter le format a suivi de six chiffres.\n")

    return AccountCompleteCreate(
        registration_number=prompt_required("Matricule"),
        password=prompt_password(),
        role="ADMIN",
        profile=AccountProfileCreate(
            first_name=prompt_required("Prénom"),
            last_name=prompt_required("Nom"),
            gender=prompt_required("Sexe"),
            nationality=prompt_required("Nationalité"),
            email=prompt_required("E-mail"),
            phone=prompt_required("Téléphone international"),
            address=prompt_required("Adresse"),
            hire_date=prompt_date("Date d'embauche"),
            job_title=prompt_required("Fonction"),
        ),
    )


def main() -> None:
    """Crée le premier administrateur une seule fois, de manière interactive."""

    try:
        with session_factory() as database_session:
            lock_acquired = database_session.execute(
                text(
                    "SELECT pg_try_advisory_lock("
                    "hashtext('blaiseconnect_initial_admin')"
                    ")"
                )
            ).scalar_one()
            if not lock_acquired:
                print("Initialisation déjà en cours dans un autre terminal.")
                return

            administrator_id = database_session.execute(
                select(Account.id).where(Account.role == "ADMIN").limit(1)
            ).scalar_one_or_none()
            if administrator_id is not None:
                print("Initialisation refusée : un administrateur existe déjà.")
                return

            creation_data = build_initial_admin_data()
            account, _profile = create_account_with_profile(
                db=database_session,
                creation_data=creation_data,
            )
            database_session.execute(
                text(
                    "SELECT pg_advisory_unlock("
                    "hashtext('blaiseconnect_initial_admin')"
                    ")"
                )
            )
    except (KeyboardInterrupt, EOFError):
        print("\nInitialisation annulée : aucune donnée n'a été créée.")
    except ValidationError as error:
        print(f"Données invalides : {error}")
    except Exception as error:
        print(f"Échec de l'initialisation : {error}")
    else:
        print("\nAdministrateur créé avec succès.")
        print(f"Matricule généré : {account.registration_number}")
        print("Conservez ce matricule : il ne sera pas affiché à nouveau.")


if __name__ == "__main__":
    main()
