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

## 6. Suite prévue avant le déploiement

1. Ajouter une clé SSH au compte `ubuntu`, puis vérifier la connexion par clé avant de désactiver l'authentification par mot de passe.
2. Configurer dans OVH un enregistrement DNS `A` pour `alef.blaiseconnect.fr` vers l'adresse publique du VPS, une fois le domaine actif.
3. Copier le dépôt sur le VPS et créer un fichier `.env` de production non versionné.
4. Lancer le Compose de production ; seul Caddy exposera les ports 80 et 443.
5. Vérifier HTTPS, les sauvegardes PostgreSQL et la création sécurisée du premier administrateur.

## Note de sécurité

Le groupe `docker` donne un contrôle étendu sur le serveur. Son usage est accepté ici car `ubuntu` est le compte administrateur du VPS. Aucun mot de passe, secret ou fichier `.env` de production ne doit être commité dans Git.
