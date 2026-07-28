# ============================================================
# Script de création d'élèves complets (compte + profil + inscription)
# ============================================================

# --- Configuration ---
$apiBase = "http://127.0.0.1:8000"
$classId = "196dddd2-9afa-47b1-8f99-bc89395d8b44"   # 6ème A
$enrollmentStartDate = "2027-09-01"                  # doit être dans les bornes de l'année scolaire

# --- 1. Connexion admin (réutilise cookies.txt / login.json déjà en place) ---
Write-Host "Connexion admin..." -ForegroundColor Cyan
curl.exe -s -c cookies.txt -H "Content-Type: application/json" --data-binary "@login.json" "$apiBase/auth/login" | Out-Null

# --- 2. Liste des élèves à créer ---
# Modifiez / ajoutez des entrées ici. registration_number doit suivre ^[aeup][0-9]{6}$
$students = @(
    @{
        registration_number = "e000010"
        password             = "Eleve@1234"
        first_name           = "Awa"
        last_name            = "Barry"
        birth_date           = "2011-03-14"
        gender               = "F"
        email                = "awa.barry@email.com"
        phone                = "+224 624 55 66 77"
        address              = "Quartier Matam, Conakry"
        admission_date       = "2026-07-27"
    },
    @{
        registration_number = "e000011"
        password             = "Eleve@1234"
        first_name           = "Ibrahima"
        last_name            = "Camara"
        birth_date           = "2010-11-02"
        gender               = "M"
        email                = "ibrahima.camara@email.com"
        phone                = "+224 625 66 77 88"
        address              = "Quartier Coronthie, Conakry"
        admission_date       = "2026-07-27"
    }
)

foreach ($s in $students) {
    Write-Host "`n--- Création de $($s.first_name) $($s.last_name) ---" -ForegroundColor Yellow

    # a) Créer le compte via l'API
    $accountPayload = @{
        registration_number = $s.registration_number
        password             = $s.password
        role                 = "STUDENT"
    } | ConvertTo-Json

    $accountPayload | Out-File -Encoding utf8 -NoNewline "tmp_account.json"

    $accountResponse = curl.exe -s -b cookies.txt -H "Content-Type: application/json" --data-binary "@tmp_account.json" "$apiBase/accounts"
    $account = $accountResponse | ConvertFrom-Json

    if (-not $account.id) {
        Write-Host "Échec de création du compte pour $($s.registration_number) :" -ForegroundColor Red
        Write-Host $accountResponse
        continue
    }

    $accountId = $account.id
    Write-Host "Compte créé : $accountId"

    # b) Insérer dans students (SQL direct, car pas encore d'endpoint POST /students)
    $insertStudentSql = @"
INSERT INTO students (account_id, first_name, last_name, birth_date, gender, email, phone, address, admission_date)
VALUES ('$accountId', '$($s.first_name)', '$($s.last_name)', '$($s.birth_date)', '$($s.gender)', '$($s.email)', '$($s.phone)', '$($s.address)', '$($s.admission_date)')
RETURNING id;
"@

    $studentResult = docker compose exec -T postgres psql -U dialloa -d blaise_connect -t -c "$insertStudentSql"
    $studentId = ($studentResult | Select-String -Pattern '[0-9a-f-]{36}').Matches.Value

    if (-not $studentId) {
        Write-Host "Échec de création du profil élève pour $($s.first_name) $($s.last_name)" -ForegroundColor Red
        continue
    }

    Write-Host "Élève créé : $studentId"

    # c) Inscrire l'élève dans la classe
    $insertEnrollmentSql = "INSERT INTO student_enrollments (student_id, class_id, start_date) VALUES ('$studentId', '$classId', '$enrollmentStartDate');"
    docker compose exec -T postgres psql -U dialloa -d blaise_connect -c "$insertEnrollmentSql" | Out-Null

    Write-Host "Inscrit dans la classe $classId" -ForegroundColor Green
}

Remove-Item "tmp_account.json" -ErrorAction SilentlyContinue
Write-Host "`nTerminé." -ForegroundColor Cyan