# BDR Flow Pro

Espace Sales tout-en-un pour BDR / SDR : suivi des rendez-vous, pipeline de leads, primes & commissions, notes, contacts, dashboards et administration multi-environnements.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173

## Compte de démonstration

- **Mail** : owen.mb.pro@gmail.com (ou pseudo `OwenMtp`)
- **Mot de passe** : `demo1234`
- Environnement : **PeopleSpheres** → espace **Owen Mrani Bonnier** (code `1205`)

## Fonctionnalités

- **Connexion** : email/pseudo + mot de passe, création de compte, accès bloqué sans login. Le compte d'Owen a le rôle Fondateur + Portail Développeur (accès à tous les environnements).
- **Environnements & sous-environnements** : multi-environnements avec logo, code PIN à 4 chiffres, espaces collaborateurs indépendants (chaque nouvel espace démarre vide).
- **Dashboard** : RDV pris / réalisés (graphiques avec timelines dont dates personnalisées début/fin), bulles MQL (bleu) / SQL (rouge) / Primes du mois (vert, mois courant + mois suivant) / Revenu primes total (jaune), signatures 🏆, opportunités en cours/perdues, provenances, postes avec %, jauges de performance roses (RDV pris et réalisés vs moyenne hebdo/mensuelle), taux de conversion, drill-down « Détails » partout, widgets réorganisables/masquables/redimensionnables.
- **Mes Rendez-vous** : tableau complet (phase, opportunité, entreprise, effectif, contacts multiples, LinkedIn, secteur, dates, provenance, notes), sous-RDV repliés sous le RDV parent, formulaire avec champs configurables, filtres et tris complets, automatisations (Perdue→KO, Gagnée→SQL, Signée→Signée, date de passage en SQL demandée automatiquement, opportunité « En cours » à la création, contacts envoyés vers Mes contacts), confirmation avant suppression.
- **Leads** : kanban par statut d'opportunité (mis à jour avec les statuts personnalisés), drag & drop qui change la phase, timeline de vie du lead (« Actif depuis X jours », détail des phases).
- **Primes & Commissions** : barème éditable (catégories en colonnes, min/max collaborateurs, montant, lead source), prime déclenchée par la date de passage en SQL, payée le mois courant si ≤ 15 sinon le mois suivant, reporting avec classement, tableau de suivi graphique, répartition sources × tranches d'effectif.
- **Mes notes** : notes avec dossiers, épinglage, templates CRUD, filtres (date/phase/opportunité), archivage, export Word/PDF, « Créer un RDV » qui pré-remplit le formulaire de Mes Rendez-vous.
- **Mes contacts** : alimenté automatiquement par les RDV, recherche, import/export CSV (tout ou sélection).
- **Administration** : rôles Fondateur / Administrateur / Manager / Membre avec hiérarchie, gestion des utilisateurs (mail, pseudo, mot de passe, Id), équipes dépliables, accès aux briques par cases à cocher.
- **KPI Entreprise** (managers) : tableurs croisant les métriques de plusieurs profils avec filtres.
- **Paramètres** : 10 thèmes + 10 ambiances animées, widgets dashboard, gestion des environnements, intégrations HubSpot / LinkedIn, profil avec photo.
- **Extras** : organigramme par service avec photos, assistant IA (création de RDV/notes/primes par commande), dashboard personnalisé généré par prompt.

Les données sont persistées dans le `localStorage` du navigateur (par environnement et par espace collaborateur).
