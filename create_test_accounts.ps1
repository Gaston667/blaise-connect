# Script de création de 20 comptes de test pour BlaiseConnect
# À exécuter depuis le dossier contenant docker-compose.yml

$dbUser = "dialloa"
$dbName = "blaise_connect"
$defaultPassword = "test@1234"

# Génère 20 comptes : 10 ADMIN (préfixe a), 10 TEACHER (préfixe e)
$accounts = @()
for ($i = 1; $i -le 10; $i++) {
    $matricule = "a{0:D6}" -f (100 + $i)
    $accounts += [PSCustomObject]@{ Matricule = $matricule; Role = "ADMIN" }
}
for ($i = 1; $i -le 10; $i++) {
    $matricule = "e{0:D6}" -f (100 + $i)
    $accounts += [PSCustomObject]@{ Matricule = $matricule; Role = "TEACHER" }
}

Write-Host "Génération du hash du mot de passe commun ('$defaultPassword')..." -ForegroundColor Cyan
$hash = docker compose exec -T backend python -c "from app.core.security import hash_password; print(hash_password('$defaultPassword'))"

if (-not $hash) {
    Write-Host "Erreur : impossible de générer le hash. Vérifie que le conteneur backend tourne." -ForegroundColor Red
    exit 1
}

Write-Host "Création des 20 comptes..." -ForegroundColor Cyan

foreach ($account in $accounts) {
    $matricule = $account.Matricule
    $role = $account.Role

    $sql = "INSERT INTO accounts (registration_number, password_hash, role) VALUES ('$matricule', '$hash', '$role') ON CONFLICT (registration_number) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true, archived_at = NULL;"

    docker compose exec -T postgres psql -U $dbUser -d $dbName -c "$sql" | Out-Null
    Write-Host "  Créé : $matricule ($role)" -ForegroundColor Green
}

Write-Host ""
Write-Host "20 comptes créés avec le mot de passe '$defaultPassword'." -ForegroundColor Yellow
Write-Host "Vérification :" -ForegroundColor Cyan
docker compose exec -T postgres psql -U $dbUser -d $dbName -c "SELECT registration_number, role, is_active FROM accounts ORDER BY registration_number;"