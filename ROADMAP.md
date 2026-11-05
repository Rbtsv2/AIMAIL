# AIMAIL — Feuille de route

État au 5 novembre 2026 (v0.2.0). Les blocs sont classés par priorité d'usage ; à l'intérieur, les points les plus utiles en premier.

## Fait (v0.1 → v0.2)

- Multi-comptes IMAP/SMTP (OVH, Gmail et Microsoft en OAuth), synchro de tous les dossiers, dossiers déplaçables, création/suppression.
- Assistant IA local (Ollama) ou API (Anthropic, OpenAI) : réponses, résumés, reformulation, classification, conversation sur les messages, sources documentaires, mémoire des fils anciens.
- Réponses préparées en arrière-plan avec hub « À répondre » (cartes/liste, ignorées, répondues), signature visible, retouche par sélection.
- Instructions par compte et par tâche, consignes de base éditables.
- Règles de tri (conditions → actions), portée Réception / Indésirables, rétention par dossier, création depuis un mail.
- Indésirables : expéditeurs bloqués, déplacement du passé, signalement au serveur (`$Junk` / `$NotJunk`).
- Recherche plein texte avec opérateurs et filtres, correction orthographique.
- Agenda (Google + local, récurrences, invitations reçues), contacts (Google, collecte automatique).
- Signatures HTML (éditeur visuel + HTML), modèles, aperçu fidèle.
- Préchargement des corps de messages, connexion IMAP dédiée à la lecture.
- Vidage automatique Indésirables/Corbeille, sauvegarde/restauration, mises à jour automatiques, builds Windows/macOS/Linux via GitHub Actions.

## Fiabilité du quotidien

- [ ] Notifications système à la réception (prévu ; à vérifier sur chaque OS) et badge de non-lus sur l'icône.
- [ ] Recherche sur le serveur pour les messages non synchronisés (IMAP SEARCH) ; synchro partielle des très gros dossiers (N derniers mois, puis à la demande).
- [ ] Mode hors-ligne propre : file d'envoi persistante avec reprise, actions en attente (déplacement, suppression, drapeaux) rejouées à la reconnexion.
- [ ] Gestion des conflits IMAP (message déplacé depuis le téléphone pendant une action locale).
- [ ] Filtres côté serveur (Sieve/ManageSieve) générés depuis les règles et les expéditeurs bloqués, pour que le tri se fasse avant la livraison, téléphone compris.
- [ ] Tests unitaires sur les parties critiques : iCal/récurrences, règles, parsing des réponses IA, extraction des pièces jointes, construction MIME.
- [ ] Journal des opérations consultable dans l'app (ce qui a été déplacé, par quelle règle, quand).

## Composition

- [ ] Pièces jointes par glisser-déposer et collage d'images dans l'éditeur, aperçu avant envoi, compression d'images optionnelle.
- [ ] Modèles de réponses (réponses rapides) et programmation d'envoi (« envoyer lundi 9 h »).
- [ ] Vérification avant envoi : destinataire oublié, « ci-joint » sans pièce (fait), objet vide (fait), « Répondre à tous » involontaire, destinataire externe au domaine.
- [ ] Annuler l'envoi pendant quelques secondes.
- [ ] Accusés de lecture et priorité.
- [ ] Mise en forme avancée dans l'éditeur : tableaux, listes imbriquées, blocs de code, liens avec aperçu.

## Assistant IA

- [ ] Résumé quotidien / hebdomadaire (« qu'est-ce qui s'est passé depuis hier ») ; détection des mails sans réponse de ma part depuis N jours.
- [ ] Extraction automatique de tâches et d'échéances vers une liste « À faire » liée à l'agenda.
- [ ] Traduction à la volée des mails reçus et des réponses.
- [ ] Pièces jointes dans les réponses préparées (joindre un document des Sources).
- [ ] Choix du modèle par tâche (petit modèle pour classer, gros pour rédiger) ; suivi du coût pour les API payantes.
- [ ] Apprentissage des corrections : quand une réponse préparée est modifiée avant envoi, mémoriser le style (longueur, formules) par correspondant.
- [ ] Questions à l'utilisateur quand une décision est attendue (« accepter ce devis ? ») avant de rédiger, avec réponse en un clic.

## Contacts et agenda

- [ ] Fiche contact enrichie : historique des échanges, dernière réponse, notes, pièces jointes échangées.
- [ ] Rappels d'événements (notification N minutes avant), invitations sortantes avec `.ics`, fuseaux horaires.
- [ ] Synchro CardDAV / CalDAV (iCloud, Nextcloud, Infomaniak) en plus de Google.
- [ ] Prise de rendez-vous depuis un mail (proposition de créneaux insérés dans la réponse).

## Organisation

- [ ] Étiquettes multiples par message (en plus des dossiers), vue « Suivis » enrichie.
- [ ] Relances automatiques (« me rappeler si pas de réponse sous 3 jours ») et vue des mails en attente de réponse de l'autre côté.
- [ ] Conversations groupées par correspondant (vue « personne »).
- [ ] Archivage automatique des newsletters lues ; désinscription en un clic via `List-Unsubscribe`.
- [ ] Reporter un mail (« snooze ») à une date donnée.

## Métier : domiciliation.express

Module pour les agences utilisatrices du SaaS, afin qu'AIMAIL soit leur client mail de travail.

- [ ] Connecteur (Réglages → Connecteurs) : clé API d'agence, rattachement d'un compte mail à une agence.
- [ ] Synchro des contacts : sociétés domiciliées et interlocuteurs importés avec l'étiquette *Domicilié · <agence>* et lien vers la fiche ; adresses collectées côté AIMAIL remontées en suggestion. Rafraîchissement périodique + webhook.
- [ ] Bandeau client sous l'en-tête d'un mail venant d'un domicilié : statut du contrat, échéance, courriers en attente de retrait, impayés.
- [ ] Actions rapides : notifier un courrier reçu, envoyer le scan, marquer le courrier retiré, ouvrir le dossier — journalisées dans la timeline du client.
- [ ] Contexte client (contrat, courriers, historique) injecté dans les réponses préparées ; détection des demandes de résiliation / changement d'adresse → action à valider dans le SaaS.
- [ ] Règles proposées automatiquement : un dossier par domicilié ou par agence, classement, rétention.
- [ ] Notifications sortantes du SaaS (courrier reçu, relance de paiement) envoyées via AIMAIL avec les modèles IA.
- Côté SaaS (Cloud Functions) : `GET /clients`, `GET /clients/:id`, `POST /clients/:id/mail-events`, `POST /mails/:id/notify`, webhook `client.updated`, clés d'API par agence avec scopes.

## Marketing : Brevo et modèles IA

- [ ] Réglages → Marketing : clé API Brevo, expéditeur vérifié, listes par défaut.
- [ ] Synchro des listes et contacts Brevo avec les contacts AIMAIL (consentement et désinscriptions respectés).
- [ ] Campagnes depuis l'app : objet, destinataires (liste Brevo ou sélection), aperçu, envoi test, programmation, envoi par l'API Brevo (délivrabilité, désabonnement légal, statistiques).
- [ ] Tableau de bord par campagne : envoyés, ouverts, cliqués, désinscrits, rebonds.
- [ ] Envois transactionnels via templates Brevo depuis une règle ou une réponse.
- [ ] Générateur de modèles IA : objectif, ton, cible → HTML responsive compatible messageries (tables, styles en ligne, mode sombre sûr), en-tête, blocs texte/image, boutons d'action (lien, prise de rendez-vous, réponse « intéressé / pas intéressé » remontée dans AIMAIL).
- [ ] Éditeur de modèle : blocs réordonnables, variables Brevo (`{{contact.PRENOM}}`), palette et logo tirés des signatures, aperçu mobile/desktop, variantes A/B.
- [ ] Bibliothèque de modèles (nouveauté, relance, newsletter, invitation, enquête), exportables vers Brevo.
- [ ] Garde-fous : mentions légales et lien de désabonnement imposés, vérification des liens, score anti-spam avant envoi.

## Sécurité et compte

- [ ] Chiffrement de la base locale au repos (clé dans le trousseau système), verrouillage de l'app.
- [ ] Lecture des signatures S/MIME et PGP ; alertes d'authentification (SPF/DKIM/DMARC échoués) sur les mails suspects, détection d'usurpation du nom d'affichage.
- [ ] Protection contre le suivi : images distantes bloquées par défaut (fait), nettoyage des liens de suivi.
- [ ] Mots de passe d'application guidés pour Gmail/iCloud quand OAuth n'est pas disponible.

## Distribution et support

- [ ] Signature des binaires (Windows Authenticode, macOS notarisation), auto-update vérifiée en conditions réelles, écran « Quoi de neuf » après mise à jour.
- [ ] Identifiants OAuth incorporés au build via les secrets GitHub (fait), vérification de l'écran de consentement Google (mode test → production).
- [ ] Import depuis Outlook (PST), Thunderbird et Apple Mail ; export en `.eml` / `.mbox`.
- [ ] Diagnostic exportable (journal, versions, état des comptes) pour le support.
- [ ] Site de présentation et documentation utilisateur.

## Interface

- [ ] Raccourcis clavier complets et personnalisables, palette de commandes.
- [ ] Vue à trois colonnes redimensionnables mémorisées, mode compact.
- [ ] Thèmes supplémentaires et police personnalisable.
- [ ] Accessibilité : navigation clavier complète, lecteurs d'écran, contrastes.
- [ ] Traductions de l'interface (anglais d'abord).

## Après

- Application mobile compagnon (lecture, réponses préparées à valider).
- Partage de boîte entre plusieurs utilisateurs d'une agence (assignation, notes internes).
- Connecteurs supplémentaires : Qonto/Stripe (rapprochement des factures reçues), Yousign (statut des signatures), Google Drive/Nextcloud (pièces jointes).