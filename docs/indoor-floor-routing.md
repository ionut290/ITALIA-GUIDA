# Guida interna: piano e routing

La posizione verticale nel browser non è garantita. Varga Tour usa la quota fornita dal dispositivo solo come stima relativa dopo che l'utente conferma un piano noto. La variazione di quota viene convertita in cambi di piano usando un'altezza media di 3,3 m e viene sempre mostrata come stima.

Quando OpenStreetMap contiene ascensori, scale o scale mobili con livelli compatibili, la navigazione multi-piano usa questi punti come collegamenti intermedi. Se i collegamenti verticali non sono mappati, l'app mostra un avviso e mantiene un percorso indicativo senza inventare corridoi.
