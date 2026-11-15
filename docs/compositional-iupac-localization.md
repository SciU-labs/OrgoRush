# Localización composicional de nombres IUPAC externos

## Alcance actual

OrgoRush puede localizar, mediante reglas composicionales limitadas, nombres sistemáticos externos en estas familias:

- Alcanos, alquenos y alquinos de cadena, con sustituyentes y localizadores reconocidos por la gramática.
- Alcoholes, aldehídos y cetonas; también algunos progenitores cíclicos sencillos.
- Ácidos carboxílicos y sus combinaciones verificadas con sustituyentes.
- Ésteres, incluidas las formas reordenadas «…oato de alquilo».
- Amidas con sustitución sobre nitrógeno.
- Nitrilos.
- Aminas y anilinas, incluidas algunas sustituciones múltiples.
- Progenitores aromáticos de benceno y fenol, más sustituyentes ramificados, insaturados y arilo contemplados por las pruebas del localizador.
- Descriptores R/S y E/Z explícitos en el progenitor para las construcciones probadas.

Esta lista describe la cobertura de la gramática ejercitada, no una afirmación de que todo nombre de esas familias esté admitido. Las construcciones desconocidas o ambiguas se dejan sin localizar.

## Identidad, traducción y validación

La identidad estructural de PubChem se valida por separado de la traducción. Cuando la ruta composicional externa requiere evidencia del proveedor, el SMILES isomérico debe corresponder a la estructura activa del canvas. Ese cotejo confirma la identidad asociada al registro; por sí solo no demuestra que una traducción sea químicamente correcta.

La traducción se genera con reglas de progenitores, sufijos, prefijos, sustituyentes y localizadores. El nombre español debe normalizarse de vuelta al nombre inglés fuente sin cambiar esos componentes. Los ácidos que puede construir el motor local también se comprueban contra el grafo reconstruido. Las demás familias que el constructor local aún no puede verificar requieren la evidencia estructural externa correspondiente.

Las pruebas contrastan 56 nombres positivos con el corpus de referencia y recibos OPSIN congelados, incluidas sus estructuras isoméricas. El corpus total contiene 69 casos: los otros 13 se rechazan de forma segura. Este porcentaje mide únicamente ese corpus.

PubChem puede proporcionar un nombre sistemático, pero esta traducción no determina si ese nombre es el PIN (Preferred IUPAC Name). La interfaz declara que la condición de PIN preferido no se ha verificado.

## Límites conocidos

- No se cubren todas las familias funcionales ni todas las reglas de nomenclatura, variantes de progenitor o sustituyentes.
- Los estereodescriptores anidados dentro de sustituyentes complejos no forman parte de la gramática actual. Los descriptores top-level explícitos se conservan y se comprueban en los casos incluidos.
- Heterociclos fusionados no cubiertos, sistemas puenteados o policíclicos, sales y otras especies con cargas, azufre fuera de la valencia admitida y compuestos con fósforo quedan fuera del adaptador estructural actual.
- Cuatro estructuras representables por el adaptador —purina, quinolina, indol y tioamida del corpus de límites— siguen rechazándose: todavía no hay para ellas una traducción española independiente, revisada y cubierta por reglas verificables.
- Si no se puede demostrar el alcance gramatical o la equivalencia, se conserva el nombre externo sin presentarlo como traducción española verificada.

La localización no modifica la estructura ni la serialización SMILES.
