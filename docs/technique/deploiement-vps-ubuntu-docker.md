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
```

Lancer ensuite les services de production :

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

## 7. Vérifications après déploiement

1. Ouvrir `https://portail.blaiseconnect.fr` et vérifier le cadenas HTTPS.
2. Vérifier que PostgreSQL et le backend sont `healthy` avec `docker compose ps`.
3. Créer le premier administrateur réel ; aucune donnée fictive ne doit être présente en production.
4. Mettre en place et tester les sauvegardes de PostgreSQL et du volume `account_storage`.

## Note de sécurité

Le groupe `docker` donne un contrôle étendu sur le serveur. Son usage est accepté ici car `ubuntu` est le compte administrateur du VPS. Aucun mot de passe, secret ou fichier `.env` de production ne doit être commité dans Git.
