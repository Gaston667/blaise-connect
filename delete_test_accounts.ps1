# Script de suppression des 20 comptes de test créés pour BlaiseConnect
# À exécuter depuis le dossier contenant docker-compose.yml

$dbUser = "dialloa"
$dbName = "blaise_connect"

# Même liste que le script de création
$matricules = @()
for ($i = 1; $i -le 10; $i++) {
    $matricules += "a{0:D6}" -f (100 + $i)
}
for ($i = 1; $i -le 10; $i++) {
    $matricules += "e{0:D6}" -f (100 + $i)
}

Write-Host "Suppression des 20 comptes de test..." -ForegroundColor Cyan

foreach ($matricule in $matricules) {
    $sql = "DELETE FROM accounts WHERE registration_number = '$matricule';"
    docker compose exec -T postgres psql -U $dbUser -d $dbName -c "$sql" | Out-Null
    Write-Host "  Supprimé : $matricule" -ForegroundColor Green
}

Write-Host ""
Write-Host "Suppression terminée." -ForegroundColor Yellow
Write-Host "Vérification :" -ForegroundColor Cyan
docker compose exec -T postgres psql -U $dbUser -d $dbName -c "SELECT registration_number, role, is_active FROM accounts ORDER BY registration_number;"