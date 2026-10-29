# Préparation du VPS Ubuntu pour BlaiseConnect

Ce guide décrit les actions réalisées pour préparer le VPS de production avant le déploiement de BlaiseConnect. Les commandes sont à exécuter avec l'utilisateur Ubuntu fourni par OVH.

## 1. Première connexion SSH

Depuis PowerShell sur le poste local :

```powershell
ssh ubuntu@ADRESSE_IP_DU_VPS
```

Lors de la première connexion, SSH demande de confirmer l'empreinte du serveur. Répondre `yes` uniquement après avoir vérifié que l'adresse IP est bien celle du VPS OVH. Cette empreinte est ensuite conservée dans `known_hosts` afin de détecter un éventuel changement suspect de serveur.

Le compte `ubuntu` peut administrer le serveur avec `sudo`. Il n'est pas nécessaire de se connecter directement avec `root`.

## 2. Mise à jour du système

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

Après le redémarrage, se reconnecter en SSH. Cette étape applique les correctifs de sécurité et charge un nouveau noyau lorsqu'il est disponible.

## 3. Pare-feu minimal

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Les ports autorisés ont les rôles suivants :

- `22` : administration SSH ;
- `80` : accès HTTP et validation initiale du certificat HTTPS ;
- `443` : accès HTTPS à BlaiseConnect.

PostgreSQL, FastAPI et pgAdmin ne doivent pas être exposés publiquement.

## 4. Ajout du dépôt officiel Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

La clé `docker.asc` permet à APT de vérifier l'authenticité des paquets Docker. Elle est publique ; le droit de lecture est nécessaire pour qu'APT puisse l'utiliser.

Créer ensuite la source APT Docker :

```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

Cette configuration utilise la version stable de Docker correspondant automatiquement à la version Ubuntu et à l'architecture du VPS.

## 5. Installation de Docker et Docker Compose

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Docker est installé depuis son dépôt officiel, et non via Snap ni avec le paquet Ubuntu `docker.io`.

Ajouter ensuite l'utilisateur Ubuntu au groupe Docker :

```bash
sudo usermod -aG docker ubuntu
exit
```

La déconnexion est indispensable pour que le nouveau groupe soit pris en compte. Se reconnecter ensuite :

```powershell
ssh ubuntu@ADRESSE_IP_DU_VPS
```

Vérifier l'installation :

```bash
docker --version
docker compose version
docker run hello-world
```

Enfin, si le système a signalé un nouveau noyau, redémarrer le VPS :

```bash
sudo reboot
```

## 6. Déploiement de BlaiseConnect

Le domaine de production retenu est `portail.blaiseconnect.fr`. Dans la zone DNS
principale de `blaiseconnect.fr`, son enregistrement `A` doit cibler l'adresse
publique du VPS.

Sur le VPS, récupérer la branche `main`, créer le fichier `.env` à partir de
`.env.production.example` et y renseigner les secrets réels, sans jamais le
committer.

```bash
cd /opt/blaiseconnect
git switch main
git pull origin main
cp .env.production.example .env
vim .env
chmod 600 .env
```

Le droit `600` signifie que seul l'utilisateur `ubuntu` peut lire ou modifier
ce fichier. Ne jamais afficher son contenu dans une capture d'écran, un ticket,
un message ou la sortie de `docker compose config`.

## 7. Appliquer une migration sur une base déjà en service

Les fichiers montés dans `/docker-entrypoint-initdb.d` ne sont exécutés que
lors de la création d'une **nouvelle** base PostgreSQL. Sur le VPS existant,
une nouvelle migration doit être appliquée manuellement, une seule fois et dans
l'ordre de son numéro.

Appliquer une migration lorsqu'une nouvelle version de `main` apporte un fichier
dans `database/migration/` qui n'a jamais été appliqué sur le VPS. Toujours
tester d'abord sur une base de développement, puis faire une sauvegarde avant
toute migration de production.

```bash
cd /opt/blaiseconnect
git switch main
git pull origin main

# Sauvegarde obligatoire avant une évolution de schéma.
./infrastructure/scripts/backup_blaiseconnect.sh

# Charge les noms de base et d'utilisateur sans afficher leurs valeurs.
set -a
source .env
set +a

# Exemple : appliquer 009, puis 010, 011 et 012 exactement une fois chacun.
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" < database/migration/009_administrator_optional_job_title.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" < database/migration/010_subject_session_length.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" < database/migration/011_special_courses_student_schedule.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" < database/migration/012_locked_timetable_slots.sql
```

Si une commande échoue, s'arrêter immédiatement : ne pas appliquer les suivantes
et ne pas relancer au hasard celle qui a échoué. Conserver le message d'erreur,
vérifier la cause, puis reprendre uniquement avec une procédure validée. Une
migration déjà appliquée ne doit jamais être rejouée ou modifiée.

Lancer ensuite les services de production après les migrations :

```bash
docker compose up -d --build --remove-orphans
docker compose ps
```

`--remove-orphans` supprime les anciens conteneurs du même projet qui ne sont
plus déclarés dans le fichier Compose. Cette option est utile après un changement
de branche ou une modification des services ; elle ne supprime pas les volumes
PostgreSQL ni les documents.

Seul Caddy expose les ports `80` et `443`. Il redirige HTTP vers HTTPS et obtient
automatiquement le certificat Let's Encrypt lorsque le DNS est correctement
propagé. Vérifier le résultat :

```bash
docker compose logs frontend --tail=40
```

Le journal doit contenir `certificate obtained successfully`.

## 8. Vérifications après déploiement

1. Ouvrir `https://portail.blaiseconnect.fr` et vérifier le cadenas HTTPS.
2. Vérifier que PostgreSQL et le backend sont `healthy` avec `docker compose ps`.
3. Créer le premier administrateur réel ; aucune donnée fictive ne doit être présente en production.
4. Mettre en place et tester les sauvegardes de PostgreSQL et du volume `account_storage`.

## 9. Recréer ou mettre à jour les conteneurs sans perdre les données

Les données ne sont pas dans les conteneurs : elles sont conservées dans les
volumes Docker `postgres_data` (base PostgreSQL) et `account_storage`
(photos, justificatifs, documents et bulletins).

Pour mettre à jour l'application ou reconstruire les images sans toucher aux
données, utiliser simplement :

```bash
cd /opt/blaiseconnect
git pull origin main
docker compose up -d --build --remove-orphans
docker compose ps
```

Cette commande peut remplacer les conteneurs frontend et backend ; les volumes
nommés restent en place. Si seul un redémarrage est nécessaire :

```bash
docker compose restart
```

Ne jamais utiliser les commandes suivantes sans vouloir perdre des données :

```bash
# À NE PAS lancer en production sans procédure de restauration validée.
docker compose down -v
docker volume rm blaiseconnect_postgres_data
docker volume rm blaiseconnect_account_storage
```

`docker compose down` sans `-v` conserve normalement les volumes, mais
`up -d --build --remove-orphans` est préférable pour un déploiement courant.

## 10. Sauvegardes : installation, contrôle et restauration

Le système de sauvegarde existant enregistre deux éléments hors du dépôt Git,
dans `/opt/blaiseconnect-backups/` :

- `database/` : export PostgreSQL au format `.dump` ;
- `storage/` : archive des photos et documents privés au format `.tar.gz`.

Chaque fichier reçoit une empreinte `.sha256`. Le script conserve les quatorze
derniers jours et protège les nouveaux fichiers avec des droits privés.

### Installer et lancer une première sauvegarde

```bash
sudo install -d -o ubuntu -g ubuntu -m 700 \
  /opt/blaiseconnect-backups \
  /opt/blaiseconnect-backups/database \
  /opt/blaiseconnect-backups/storage

cd /opt/blaiseconnect
chmod +x infrastructure/scripts/backup_blaiseconnect.sh
chmod +x infrastructure/scripts/restore_blaiseconnect.sh
./infrastructure/scripts/backup_blaiseconnect.sh
```

Contrôler ensuite que les deux types de fichiers existent :

```bash
ls -lh /opt/blaiseconnect-backups/database
ls -lh /opt/blaiseconnect-backups/storage
```

### Planifier chaque nuit à 02:00 UTC

Le VPS utilise UTC : cela correspond à 03:00 en France pendant l'heure d'hiver
et à 04:00 pendant l'heure d'été. Cette heure UTC évite que le changement
d'heure déclenche deux sauvegardes locales à la même heure.

```bash
crontab -e
```

Ajouter cette ligne :

```cron
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * /opt/blaiseconnect/infrastructure/scripts/backup_blaiseconnect.sh >> /opt/blaiseconnect-backups/backup.log 2>&1
```

Puis vérifier régulièrement :

```bash
crontab -l
tail -n 30 /opt/blaiseconnect-backups/backup.log
```

Ces sauvegardes sont sur le même VPS : elles protègent d'une erreur applicative
ou d'une mauvaise manipulation, mais pas de la perte complète du serveur. Une
copie chiffrée vers un autre serveur ou un stockage cloud est nécessaire pour
une protection complète.

La restauration remplace les données actuelles. Elle vérifie les empreintes et
demande d'écrire `RESTAURER` avant de continuer. La tester d'abord sur une
machine de test :

```bash
./infrastructure/scripts/restore_blaiseconnect.sh all \
  /opt/blaiseconnect-backups/database/postgres_DATE.dump \
  /opt/blaiseconnect-backups/storage/account_storage_DATE.tar.gz
```

## 11. Réagir à un incident de sécurité ou une cyberattaque

En cas de doute sérieux (connexion inconnue, fichiers modifiés, comportement
anormal, alerte OVH), ne pas effacer les traces et ne pas redémarrer au hasard.

1. Conserver l'accès SSH et isoler temporairement le site public :

   ```bash
   sudo ufw insert 1 deny 80/tcp
   sudo ufw insert 1 deny 443/tcp
   sudo ufw status numbered
   ```

2. Noter la date, les symptômes, les comptes concernés, puis conserver les logs :

   ```bash
   cd /opt/blaiseconnect
   docker compose ps
   umask 077
   docker compose logs --since 24h > /opt/blaiseconnect-backups/incident-$(date +%F-%H%M).log
   ```

3. Prévenir la personne responsable de l'établissement. Si des données
   personnelles peuvent avoir été consultées, documenter l'incident et demander
   un avis juridique/administratif avant toute communication externe.

4. Depuis un poste sûr, changer les mots de passe du VPS, GitHub, PostgreSQL,
   pgAdmin et la valeur `SECRET_KEY` dans `.env`. Changer `SECRET_KEY` force la
   déconnexion de toutes les sessions, ce qui est attendu après un incident.

5. Vérifier les comptes, les clés SSH, les règles UFW, les mises à jour système
   et les derniers déploiements. Restaurer une sauvegarde connue comme saine
   uniquement si les données ou la machine sont compromises.

6. Quand la cause est corrigée, redéployer, relancer les contrôles de sécurité
   depuis le PC du développeur, puis retirer les deux règles de blocage UFW après
   vérification de leur numéro avec `sudo ufw status numbered`. Utiliser ensuite
   `sudo ufw delete NUMERO` avec le numéro réellement affiché, jamais un numéro
   supposé.

## Note de sécurité

Le groupe `docker` donne un contrôle étendu sur le serveur. Son usage est accepté ici car `ubuntu` est le compte administrateur du VPS. Aucun mot de passe, secret ou fichier `.env` de production ne doit être commité dans Git.
