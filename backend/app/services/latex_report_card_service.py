"""Génération de PDF de test via le compilateur distant LaTeX.Online."""

from __future__ import annotations

import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from app.core.exceptions import AppError, ErrorCodes


LATEX_ONLINE_URL = os.getenv(
    "LATEX_ONLINE_URL",
    "https://latexonline.cc",
).rstrip("/")


def escape_latex(value: object | None) -> str:
    """Échappe une donnée métier avant son insertion dans un document LaTeX."""

    text_value = str(value) if value not in (None, "") else "---"
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
        "—": "---",
        "–": "--",
        "°": r"$^\circ$",
        "’": "'",
        "“": "\"",
        "”": "\"",
        "…": "...",
    }
    return "".join(replacements.get(character, character) for character in text_value)


def build_report_card_latex(report_card: dict) -> str:
    """Construit le source LaTeX d'un bulletin paysage à partir de son instantané."""

    subject_rows = "\n".join(
        " & ".join(
            (
                str(index),
                escape_latex(subject["subject_name"]),
                escape_latex(subject["applied_coefficient"]),
                escape_latex(subject["subject_average"]),
                escape_latex(subject["class_average"]),
                escape_latex(subject["highest_average"]),
                escape_latex(subject["lowest_average"]),
                escape_latex(subject["teacher_comment"]),
            )
        ) + r" \\ \hline"
        for index, subject in enumerate(report_card["subjects"], start=1)
    ) or r"\multicolumn{8}{|c|}{Aucune matière disponible.} \\ \hline"

    return rf"""
\documentclass[a4paper,landscape,8pt]{{article}}
\usepackage[margin=10mm]{{geometry}}
\usepackage[T1]{{fontenc}}
\usepackage[utf8]{{inputenc}}
\usepackage[french]{{babel}}
\usepackage[table]{{xcolor}}
\usepackage{{array}}
\pagestyle{{empty}}
\renewcommand{{\arraystretch}}{{1.15}}
\begin{{document}}
\begin{{center}}
\fbox{{\parbox{{0.92\textwidth}}{{\centering\scriptsize ESPACE RÉSERVÉ POUR L'EN-TÊTE DE L'ÉTABLISSEMENT\\Logo, nom, adresse et contacts}}}}\\[4mm]
{{\Large\textbf{{BULLETIN SCOLAIRE}}}}\\[2mm]
Année scolaire : \textbf{{{escape_latex(report_card['school_year_name'])}}}
\end{{center}}
\noindent
\begin{{minipage}}[t]{{0.48\textwidth}}
\textbf{{Élève :}} {escape_latex(report_card['student_name'])}\\
\textbf{{Matricule :}} {escape_latex(report_card['registration_number'])}\\
\textbf{{Classe :}} {escape_latex(report_card['class_name'])}\\
\textbf{{Né(e) le :}} {escape_latex(report_card['birth_date'])}\\
\textbf{{Effectif de la classe :}} {escape_latex(report_card['class_student_count'])}
\end{{minipage}}
\begin{{minipage}}[t]{{0.48\textwidth}}
\textbf{{Période :}} {escape_latex(report_card['reporting_period_name'])}\\
\textbf{{Du :}} {escape_latex(report_card['period_start_date'])}\\
\textbf{{Au :}} {escape_latex(report_card['period_end_date'])}
\end{{minipage}}
\vspace{{4mm}}
\begin{{center}}
\scriptsize
\begin{{tabular}}{{|c|p{{3.2cm}}|c|c|c|c|c|p{{5.4cm}}|}}
\hline
\rowcolor{{blue!70}}\color{{white}}\textbf{{N.}} & \color{{white}}\textbf{{Matières}} & \color{{white}}\textbf{{Coef.}} & \color{{white}}\textbf{{Élève}} & \color{{white}}\textbf{{Classe}} & \color{{white}}\textbf{{+}} & \color{{white}}\textbf{{-}} & \color{{white}}\textbf{{Appréciations}} \\ \hline
{subject_rows}
\end{{tabular}}
\end{{center}}
\vspace{{3mm}}
\noindent
\begin{{tabular}}{{|p{{4.4cm}}|p{{3.2cm}}|p{{4.6cm}}|p{{4.6cm}}|}}
\hline
\textbf{{MOYENNE GÉNÉRALE}} & \textbf{{RANG}} & \textbf{{ABSENCES \& RETARDS}} & \textbf{{DÉCISION}} \\ 
{escape_latex(report_card['general_average'])} /20 & {escape_latex(report_card['class_rank'])} / {escape_latex(report_card['class_student_count'])} & Justifiées : {escape_latex(report_card['justified_absence_count'])}\\Non justifiées : {escape_latex(report_card['unjustified_absence_count'])}\\Retards : {escape_latex(report_card['late_minutes'])} min & {escape_latex(report_card['status'])} \\ \hline
\end{{tabular}}
\vfill
\noindent
\begin{{tabular}}{{p{{0.31\textwidth}}p{{0.31\textwidth}}p{{0.31\textwidth}}}}
\textbf{{Professeur principal}} & \textbf{{CPE}} & \textbf{{Chef d'établissement}}\\[14mm]
Signature & Signature & Signature
\end{{tabular}}
\end{{document}}
"""


def compile_report_card_preview(report_card: dict) -> bytes:
    """Envoie le LaTeX à LaTeX.Online et retourne le PDF de test reçu."""

    latex_source = build_report_card_latex(report_card)
    query = urlencode(
        {
            "text": latex_source,
            "command": "pdflatex",
            "force": "true",
        }
    )
    request_url = f"{LATEX_ONLINE_URL}/compile?{query}"

    try:
        with urlopen(request_url, timeout=30) as response:
            content_type = response.headers.get_content_type()
            pdf_content = response.read()
    except HTTPError as error:
        error_details = error.read().decode("utf-8", errors="replace")
        error_details = re.sub(r"\s+", " ", error_details).strip()
        error_suffix = (
            f" Détail : {error_details[:240]}"
            if error_details
            else ""
        )
        raise AppError(
            code=ErrorCodes.LATEX_COMPILATION_FAILED,
            message=(
                "La compilation LaTeX a échoué sur le service distant "
                f"(HTTP {error.code}).{error_suffix}"
            ),
            status_code=502,
        ) from error
    except URLError as error:
        raise AppError(
            code=ErrorCodes.LATEX_REMOTE_UNAVAILABLE,
            message="Le service distant de génération PDF est indisponible.",
            status_code=503,
        ) from error

    if content_type != "application/pdf" or not pdf_content.startswith(b"%PDF"):
        raise AppError(
            code=ErrorCodes.LATEX_COMPILATION_FAILED,
            message="Le service distant n'a pas retourné un fichier PDF valide.",
            status_code=502,
        )

    return pdf_content
