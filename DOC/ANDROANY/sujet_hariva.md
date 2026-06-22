dans la liste modifié, ajouter liste annulé (annulation), en bas 
on peut retablir l'annulation , et le supercost correspondat revient , avec le meme rang ,sa meme place (c important)
(l'etat terminé revient) 
on recalcule



créer un nouveau paramètre, plafond de réouverture 
(en pourcentage )
pas d'interface
mettre dans SQlite

à chaque reouverture , on calcule la somme de plafond en haut
ex : j'ai supercost 100 et plafond 20% 
veut dire , cout réouverture obtenu doit pas dépasser 20%

si obtenu selon calcule est superieur à 20% , on prend 20%
si c'est inférieur à 20% , ca passe 

 règle : supercost et total réouveture de ticket doit pas dépasser 20% (paramètre)


 calcul de réouverture normal et les modes changent pas  , mais si ca dépasse plafond ,on bloque 

paramètre: plafond(general)


