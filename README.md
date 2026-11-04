# AIMAIL

Client mail de bureau (Linux, macOS, Windows) construit autour d'un assistant IA qui lit, classe, répond et retrouve l'information dans l'ensemble de vos boîtes. Fonctionne avec un modèle local (Ollama) ou une API (Claude, OpenAI). Toutes les données restent sur votre ordinateur.

## Fonctionnalités

**Courrier**
- Multi-comptes IMAP/SMTP : OVH, Gmail (OAuth), Outlook / Microsoft 365 (OAuth), iCloud, serveur personnalisé.
- Réception instantanée (IMAP IDLE), synchronisation complète de l'historique, brouillons synchronisés.
- Fils de discussion en chronologie, dossiers (création, renommage, glisser-déposer, ordre manuel, groupes), sélection multiple, lasso, raccourcis clavier, palette de commandes (`⌘K`).
- Signatures HTML fidèles (éditeur WYSIWYG + mode code, 3 modèles, import Thunderbird), images redimensionnées automatiquement.
- Confirmation avant envoi (destinataires, objet, pièces jointes, avertissements), délai d'annulation optionnel.
- Expéditeurs bloqués : un message signalé comme indésirable bloque son expéditeur, dont les prochains messages vont directement dans Indésirables. Vidage automatique des Indésirables et de la Corbeille, réglable par compte.

**Assistant IA**
- Réponse proposée à l'ouverture d'un message (optionnel), retouche d'un passage sélectionné, vérification des faits, résumé, mémoire longue des fils.
- Classement automatique (urgent / action / information / newsletter / spam).
- Détection des événements décrits dans un mail (rendez-vous, convocations) et ajout à l'agenda ; cartes d'invitation `.ics` (Accepter / Peut-être / Refuser).
- **Conversation sur toute la boîte** : questions en langage naturel (« quelle est la date d'audience dans lettre24 ? », « tous les mails de Garcia », « quand ai-je reçu le devis piscine ? ») avec statut en temps réel, cartes cliquables des messages utilisés dans une colonne de navigation, questions de suite, demandes de précision, correction orthographique, historique des conversations.
- Sources externes consultables par l'assistant : fichiers (PDF, Word, Markdown, CSV…), pages web, API (avec authentification), rattachées à un ou plusieurs comptes.
- Les PDF, Word, textes et messages joints (`.eml`) sont extraits et indexés ; la recherche plein texte couvre corps, objet, expéditeurs, dossiers et pièces jointes.

**Contacts et agenda**
- Contacts : import CSV / vCard / LDIF / Thunderbird (abook.sqlite, .mab) / Outlook CSV, export CSV + vCard, synchronisation Google, collecte automatique des adresses (comme Thunderbird), autocomplétion.
- Agenda : local, Google, Microsoft 365 (Graph), CalDAV (iCloud, OVH, Nextcloud…), agendas partagés, vues Mois / Semaine / Agenda, récurrences, invités, autocomplétion des adresses (BAN + OpenStreetMap).

**Sauvegarde et import**
- Export / import complet chiffré (AES-256-GCM, phrase secrète) : comptes et mots de passe, signatures, réglages, instructions et clés IA, sources, contacts, agendas et événements.
- Import des comptes et carnets depuis un profil Thunderbird ; ajout rapide depuis Outlook par adresse.

## Pile technique

Electron 33 · electron-vite · React 18 · TypeScript · Zustand · Framer Motion · TipTap · SQLite (better-sqlite3, WAL, FTS5) · imapflow · nodemailer · mailparser · pdf-parse · mammoth.

```
src/
  main/            processus principal (Node)
    db/            SQLite, migrations 0001 → 0017, dépôts
    sync/          ImapSyncEngine (IDLE), SyncManager, Threader, Indexer, Janitor
    smtp/          envoi, MIME, brouillons, boîte d'envoi
    ai/            AiService (recherche, passages, modes), PromptBuilder, providers, sources, classement
    auth/          identifiants (safeStorage), OAuth Google / Microsoft / Graph
    attachments/   extraction de texte (PDF, Word, .eml…)
    backup/        sauvegarde chiffrée, import Thunderbird
    calendar/      iCal, Google, Microsoft Graph, CalDAV, géocodage
    contacts/      import / export / Google
    ipc/           handlers IPC
  shared/          types partagés main ↔ renderer
  preload/         contextBridge
  renderer/src/    React : stores, features (inbox, thread, compose, ai, settings, contacts, calendar), layout, design-system
```

## Installation

Prérequis : Node 20+, npm. Pour l'IA locale : [Ollama](https://ollama.com) ≥ 0.8 (`ollama pull mistral-nemo` recommandé pour le français ; `llama3.2:3b` fonctionne mais est moins fiable).

```bash
cp .env.example .env     # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MS_CLIENT_ID (OAuth, facultatif hors Gmail/Microsoft)
npm install
npm run dev              # sans accélération GPU sous Linux ; MAIL_GPU=1 npm run dev pour l'activer
```

Autres commandes : `npm run typecheck`, `npm test`, `npm run build`, `npm run dist` (paquet installable), `npm run dist:mac`.

### OAuth

- **Google** : projet Google Cloud, écran de consentement, identifiant OAuth « application de bureau », API Gmail + People + Calendar activées.
- **Microsoft** : inscription d'application Azure (compte personnel + professionnel), redirection `http://localhost`, permissions déléguées `IMAP.AccessAsUser.All`, `SMTP.Send`, `offline_access`, `User.Read`, et pour l'agenda `Calendars.ReadWrite`, `Calendars.ReadWrite.Shared` (jeton séparé, autorisé au premier ajout d'agenda).

## Installer AIMAIL

Les installeurs se trouvent dans la [page des releases](https://github.com/Rbtsv2/AIMAIL/releases) ou dans `dist/` après un build (section suivante).

**Windows 10 / 11**
1. Télécharger `AIMAIL-Setup-<version>.exe` et le lancer.
2. L'installeur n'est pas signé : SmartScreen affiche « Windows a protégé votre ordinateur » → *Informations complémentaires* → *Exécuter quand même*.
3. Choisir le dossier d'installation (par défaut `%LOCALAPPDATA%\Programs\AIMAIL`) ; un raccourci est créé sur le bureau et dans le menu Démarrer.
4. Données : `%APPDATA%\AIMAIL\`. Désinstallation : Paramètres → Applications → AIMAIL.

**macOS 12+ (Intel ou Apple Silicon)**
1. Télécharger le `.dmg` correspondant à la machine (`-arm64` pour M1/M2/M3/M4, `-x64` pour Intel) et l'ouvrir.
2. Glisser **AIMAIL** dans *Applications*.
3. Au premier lancement, si l'app n'est pas notarisée : clic droit sur l'app → *Ouvrir* → *Ouvrir* (ou Réglages Système → Confidentialité et sécurité → *Ouvrir quand même*).
4. Données : `~/Library/Application Support/AIMAIL/`. Désinstallation : supprimer l'app des *Applications*.

**Linux — Debian, Ubuntu, Mint**
```bash
sudo apt install ./aimail_<version>_amd64.deb
```
Lancer **AIMAIL** depuis le menu, ou `aimail` dans un terminal. Désinstallation : `sudo apt remove aimail`.

**Linux — Fedora, openSUSE, RHEL**
```bash
sudo dnf install ./aimail-<version>.x86_64.rpm      # ou : sudo zypper install ./aimail-<version>.x86_64.rpm
```

**Linux — toute distribution (AppImage, sans installation)**
```bash
chmod +x AIMAIL-<version>.AppImage
./AIMAIL-<version>.AppImage
```
Pour l'intégrer au menu, installer `appimaged` ou AppImageLauncher. Si l'AppImage refuse de démarrer sur une distribution récente : `./AIMAIL-<version>.AppImage --no-sandbox` (ou installer `libfuse2`).

Données sous Linux : `~/.config/AIMAIL/` (identifiants dans le trousseau du système via `libsecret` ; sur un bureau sans trousseau, installer `gnome-keyring` ou `kwallet`).

**Première ouverture**
1. Ajouter un compte : Gmail et Microsoft par OAuth, les autres par adresse + mot de passe (OVH, iCloud, serveur IMAP personnalisé) ; un profil Thunderbird peut aussi être importé.
2. Réglages → Assistant : choisir Ollama (local, aucune donnée envoyée) ou une clé API Claude / OpenAI. Avec Ollama : `ollama pull mistral-nemo` au préalable.
3. Laisser la synchronisation initiale et l'indexation du contenu se faire en arrière-plan ; la conversation sur la boîte devient plus complète au fil de l'indexation.

## Fabriquer les installeurs

Trois scripts, un par plateforme, qui vérifient les prérequis, réparent les droits laissés par un ancien build Docker et affichent le chemin des paquets produits dans `dist/`.

```bash
npm run build:win      # dist/AIMAIL-Setup-<version>.exe       (Docker + Wine sur Linux/macOS, natif sous Windows)
npm run build:linux    # dist/AIMAIL-<version>.AppImage, aimail_<version>_amd64.deb, aimail-<version>.x86_64.rpm
npm run build:mac      # dist/AIMAIL-<version>-arm64.dmg et -x64.dmg (natif sur macOS, sinon via GitHub Actions)
```

| Plateforme | Depuis Linux | Prérequis |
|---|---|---|
| Windows | oui, via Docker (`electronuserland/builder:wine`) | Docker ; `resources/icon.ico` (facultatif) |
| Linux | oui, natif (bascule sur Docker si `fakeroot` ou `rpmbuild` manquent) | `resources/icon.png` ≥ 512 px ; ImageMagick conseillé pour les icônes |
| macOS | non — un `.dmg` ne se fabrique que sur macOS | sur Mac : Xcode CLT ; depuis Linux : CLI `gh` connectée (`gh auth login`), le script lance le workflow et télécharge les `.dmg` |

Options : `--no-cache` (réinstaller les dépendances), `--native` (Windows : build local avec Wine), `--docker` (Linux : forcer Docker), `--appimage` / `--deb` / `--rpm` (Linux : un seul format).

Icône Windows à partir du PNG : `convert resources/icon.png -define icon:auto-resize=256,128,64,48,32,16 resources/icon.ico`.

**Signature.** Les paquets ne sont pas signés par défaut : Windows affiche SmartScreen (« Informations complémentaires → Exécuter quand même ») et macOS demande « Ouvrir quand même ». Pour signer : Windows → certificat de code dans `CSC_LINK` / `CSC_KEY_PASSWORD` ; macOS → certificat Developer ID (`CSC_LINK`, `CSC_KEY_PASSWORD`) et notarisation avec `APPLE_ID`, `APPLE_APP_PASSWORD`, `APPLE_TEAM_ID`.

**Mises à jour automatiques.** Les versions installées vérifient les Releases GitHub au démarrage puis toutes les 6 h (Réglages → Général pour forcer ou désactiver), téléchargent la mise à jour en arrière-plan et l'installent au redémarrage. Prérequis : des releases publiées avec les fichiers `latest*.yml` générés par electron-builder — le workflow le fait à chaque tag — et un dépôt **public** (ou un dépôt public dédié aux releases), car electron-updater ne peut pas s'authentifier sur un dépôt privé depuis le poste des utilisateurs.

**GitHub Actions.** `.github/workflows/build.yml` construit les trois plateformes, manuellement depuis l'onglet Actions ou à chaque tag `v*` (`git tag v0.1.0 && git push origin v0.1.0`), et attache les installeurs à la Release. Secrets à renseigner dans le dépôt : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MS_CLIENT_ID`.

## Données

- Base et pièces jointes : `~/.config/AIMAIL/` (Linux), `~/Library/Application Support/AIMAIL/` (macOS), `%APPDATA%\AIMAIL\` (Windows).
- Identifiants et jetons : chiffrés par le trousseau du système (`safeStorage`).
- Rien ne quitte la machine sauf vers les serveurs mail, les fournisseurs IA que vous configurez, et les services d'adresses (BAN, OpenStreetMap) lors de la saisie d'un lieu.

## Fonctionnement de la recherche IA

1. Extraction des mots-clés de la question (mots vides filtrés, correction orthographique par le vocabulaire réel de la boîte, priorité aux références et noms).
2. Détection d'un dossier cité (« dans lettre24 ») → lecture à la demande de ses messages, recherche restreinte.
3. Requêtes FTS5 combinées (dossier pondéré), tri par pertinence ou par date selon la question (dernier / premier / prochain / « quand ai-je reçu »).
4. Détermination du mode : date, montant, général, liste, message le plus récent/ancien, question de suite.
5. Extraction déterministe des passages candidats (phrases datées, chiffrées ou cumulant les mots de la question), puis micro-question fermée au modèle : « lequel répond ? ».
6. Rédaction de la réponse à partir du seul passage retenu (sans outils ni historique), cartes des messages utilisés.
7. Sans résultat : correction proposée, pistes proches (dossiers, expéditeurs) ou questions pour affiner (période, interlocuteur, compte).

Le terminal de développement trace chaque étape (`[ai]`, `[diag]`, `[index]`, `[janitor]`, `[spam]`).

## Licence

Propriétaire - CHILLOUTNETWORKS.