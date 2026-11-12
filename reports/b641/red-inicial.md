# Prueba roja inicial

Antes de modificar producción, `node --test tests/b641-isopropenyl.test.mjs` falló con el mismo resultado para el fixture original y una copia con IDs permutados, enlaces invertidos y geometría rotada. En ambas ejecuciones la salida ES era `2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona` y EN `2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one`, frente a los prefijos sistemáticos exigidos. El fixture de entrada es `tests/fixtures/b50-pubchem-rings.json`, CID 7439, SMILES `CC1=CCC(CC1=O)C(=C)C`.

Análisis estructural reproducible del fixture original (IDs del importador): anillo numerado `[7,2,3,4,5,6]`; enlace carbonilo `7=8`; doble enlace del anillo `2=3`; metilo `2–1`; unión de rama `5–9`; rama `10=9–11`. El recorrido original partía de 9 y elegía `[9,10]` por su doble enlace, dejando 11 como metilo en posición 1. La prueba actual comprueba el resultado después de la corrección y vuelve a permutar esos identificadores.
