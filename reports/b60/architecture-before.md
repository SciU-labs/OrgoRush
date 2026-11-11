# B6.0 — estado y dependencias antes de modificar el motor

La ejecución comenzó con ocho módulos modificados (`page`, adapter, functional-groups,
name-fragments, visual-targets, systematic-family-grammar, validated-name-derivation,
verified-structural-reasoning) y cinco pruebas sin seguimiento (B5.2–B5.5 y E2E B5.2).
No hay AGENTS.md en el repositorio. Se preservan estos cambios. Los hashes iniciales
están en preexisting-files.json; protected-files.json protege corpus y baselines.

La referencia histórica B5.4 de 14 FULL ya no describe el árbol recibido:
initial.json mide 16 FULL, 12 PARTIAL y 2 UNSUPPORTED sobre los nombres locales
actuales ES/EN. B5.5 ya reconstruye español de aldehído y éster. Las 55 pruebas
focalizadas B5.0, B5.0.3, B5.2, B5.3, B5.4 y B5.5 pasan antes de intervenir.

## Flujo real

* page.tsx analiza el grafo y genera nombres; evaluate.mjs expone esos mismos
  generadores y mapas activos para auditoría, sin ser un oráculo independiente.
* iupac-name-normalization.ts traduce la presentación y el acceso a OPSIN;
  no proporciona evidencia de equivalencia ni autoridad PIN.
* systematic-family-grammar.ts interpreta tramos literales del nombre y produce
  FamilyGraph: grafo nuevo, componentes, padre, función y permisos de simetría.
  iupac1979-name-structure.ts aporta fragmentos químicos acotados bilingües.
* validated-name-derivation.ts incluye otras gramáticas históricas, invoca la
  gramática adicional y reconcilia el grafo reconstruido con el original.
* structural-derivation.ts valida valencias, normaliza aromaticidad con OCL y
  enumera isomorfismos, comparando elementos, cargas, H implícitos, adyacencias
  y órdenes. Los metadatos rings del editor no deciden identidad. La búsqueda
  acotada y la estereoquímica no soportada fallan de forma conservadora.
* derivation-consistency.ts vincula prueba y perfil activo. La compatibilidad
  histórica con ciertas presentaciones localizadas permanece separada de las
  nuevas derivaciones directas del nombre ES/EN.
* reasoning-derivation-adapter.ts proyecta componentes FULL a pasos y controles;
  verified-structural-reasoning.ts explica sus hechos. name-fragments,
  functional-groups y visual-targets mantienen también el razonamiento local
  anterior y el respaldo PARTIAL. No se deben duplicar reglas químicas allí.
* page.tsx consume los mapas de la prueba para numeración, color y selección.
  useReasoningVisualInteraction invalida selecciones por nombre, idioma y grafo;
  cambiar idioma no requiere regenerar la geometría molecular.

## Ampliación acotada

FamilyGraph ya es una representación composicional común. Se extenderá con
evidencia normativa y candidatos de numeración, manteniendo el grafo independiente
del análisis generador. Un descriptor compartido del padre aromático permite
agregar anilina, benzamida y benzonitrilo sin tres verificadores. Los alicíclicos
compartirán construcción de ciclo, sufijo prioritario, comparación de ambos
sentidos y fragmentos de rama. La numeración interna estará en un ámbito distinto.
FULL seguirá exigiendo gramática exacta, reglas verificadas y correspondencia
completa; preferred seguirá siendo false. No se modificará el generador ni sus
bloqueos. Ninguna regla usará CID, InChIKey o una fórmula como atajo de aceptación.
