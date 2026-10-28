# MeteoSwiss Pollen

## Présentation

Cette intégration amène dans Gladys les **pollens mesurés chaque heure par MétéoSuisse**, l’Office fédéral de météorologie et de climatologie. Elle suit une à trois stations de son réseau national de mesure des pollens. Pour le **noisetier**, l’**aulne**, le **frêne**, le **bouleau**, le **hêtre**, le **chêne** et les **graminées**, vous avez le nombre de pollens de la dernière heure (pollens par m³ d’air) et un niveau, de nul à très fort. Chaque station devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Les 15 stations qui publient en temps réel : Basel, Bern, Buchs SG, Davos, Genève, La Chaux-de-Fonds, Lausanne, Locarno, Lugano, Luzern, Münsterlingen, Neuchâtel, Payerne, Sion et Zürich. Ce sont des **mesures, pas une prévision**. MétéoSuisse ne publie pas l’ambroisie, l’armoise ni le plantain en temps réel : ils ne sont donc pas disponibles.

Les données sont des **données publiques ouvertes** de MétéoSuisse : aucun compte ni clé n’est nécessaire. Source : MétéoSuisse. Cette intégration communautaire n’est pas affiliée à MétéoSuisse.

C’est une intégration **cloud** : elle lit les fichiers de chaque station sur `data.geo.admin.ch` toutes les 20 minutes. Elle envoie des requêtes conditionnelles : un fichier inchangé ne coûte presque rien. Elle garde les 48 dernières heures dans `/data`, si bien qu’un redémarrage ne perd rien.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys.

## Configuration

| Champ                | Quoi choisir                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Station 1            | La station pollinique la plus proche de chez vous, parmi les 15. Obligatoire.                  |
| Station 2, Station 3 | D’autres stations (une résidence secondaire, le travail). Facultatif.                          |
| Langue des textes    | Noms des appareils, pollen principal, résumés des scènes. Automatique : votre tableau de bord. |

Enregistrez : l’état en haut de la page affiche chaque station, son niveau actuel et l’heure de la prochaine lecture. **Lire maintenant** relit tout de suite (pas de nouvelle lecture dans les deux minutes si les données sont fraîches). **Diagnostic** écrit l’état de l’intégration dans l’onglet Journaux.

## Utilisation

### Appareils

Dans l’onglet **Découverte**, créez l’appareil « Pollens … » de chaque station. Il compte 16 fonctionnalités :

- le **niveau de pollens** actuel, de 0 à 4 : le plus haut des sept pollens ;
- pour chaque pollen, le **nombre de la dernière heure**, en pollens par m³ ;
- pour chaque pollen, son **niveau**, calculé sur la moyenne des dernières 24 heures ;
- le **pollen principal** en texte, par exemple « Bouleau : fort (120/m³) ».

Les niveaux suivent les classes de charge pollinique de MétéoSuisse : 0 nul, 1 faible, 2 moyen, 3 fort, 4 très fort. MétéoSuisse les définit pour la moyenne d’une journée. L’intégration les applique à la moyenne des dernières 24 heures (il faut au moins 18 heures mesurées), si bien que le niveau suit les mesures au fil de la journée.

| Pollen (pollens/m³) | Faible | Moyen  | Fort    | Très fort |
| ------------------- | ------ | ------ | ------- | --------- |
| Noisetier, aulne    | 1–10   | 11–69  | 70–249  | ≥ 250     |
| Frêne               | 1–10   | 11–99  | 100–349 | ≥ 350     |
| Bouleau             | 1–10   | 11–69  | 70–299  | ≥ 300     |
| Hêtre, chêne        | 1–49   | 50–129 | 130–399 | ≥ 400     |
| Graminées           | 1–19   | 20–49  | 50–149  | ≥ 150     |

Gladys n’a pas d’unité pour les pollens : les nombres et les niveaux s’affichent sans unité. Les heures de MétéoSuisse sont en UTC et marquent la fin de l’heure mesurée.

### Widgets du tableau de bord

![Le widget Station pollinique avec les sept pollens d’une station, et le graphique Pollens, 48 dernières h (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-meteoswiss-pollen/main/docs/assets/widgets.fr.png)

- **Station pollinique** : les sept pollens, chacun avec son niveau en badge et son nombre sur la dernière heure et sur 24 heures. En dessous : le niveau global, le pollen principal, l’heure de la mesure et la source.
- **Pollens, 48 dernières h** : le graphique des nombres horaires des 48 dernières heures, pour les quatre pollens au plus fort pic. Hors saison, un texte indique qu’aucun pollen n’a été mesuré.

Choisissez la station dans les réglages du widget (vide : la première).

### Scènes

Le déclencheur **MétéoSuisse : alerte pollens** se déclenche quand un pollen atteint « Moyen » ou plus à une station, ou remonte le même jour. Il se déclenche au plus une fois par niveau, station, pollen et jour. La première lecture d’une station sert de référence et ne déclenche rien. Vous pouvez filtrer par station, pollen et niveau (« Fort » et « Très fort » pour la plupart des allergiques). Il fournit une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs : pollen, niveau, moyenne sur 24 heures, dernière heure et heure de la mesure.

L’action **MétéoSuisse : lire les pollens** renvoie le niveau, le pollen principal, un résumé, et le nombre et le niveau de chaque pollen d’une station. Mettez-les dans un message ou testez-les dans une condition.

Exemples :

- Quand le bouleau est fort à Bern → envoyer `{{triggerEvent.data.summary}}` et couper la ventilation des chambres.
- Chaque matin à 7 h → lire les pollens et envoyer le résumé avec la météo.
- Quand les graminées sont très fortes → rappeler de fermer les fenêtres avant de partir.

### Transport

Cloud uniquement : les données viennent de `data.geo.admin.ch`, la plateforme de données ouvertes de la Confédération. Seules les demandes des fichiers des stations quittent votre réseau. Rien n’est envoyé sur votre maison.

## Dépannage

- **« sans nouvelle mesure »** : la station n’a rien publié depuis six heures (maintenance, panne d’appareil). Ses valeurs ne sont plus mises à jour jusqu’à son retour.
- **L’heure de la mesure a une ou deux heures de retard** : le serveur de la Confédération peut garder les fichiers en cache jusqu’à deux heures. C’est normal.
- **Tous les niveaux restent à 0** : hors saison pollinique (à peu près d’octobre à janvier), c’est normal.
- **« MétéoSuisse est injoignable »** ou **« refuse les requêtes »** : l’intégration réessaie après 5, 10, 20 puis 40 minutes, puis reprend son rythme habituel.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes qui commencent par « Pollen diagnostic » dans l’onglet Journaux. Mettez-les dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.
