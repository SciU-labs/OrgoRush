# AUD-NOM-007 — cobertura Legacy de alcanos acíclicos

## Reproducción previa al cambio

Se ejecutó la ruta real de `page.tsx`: importación SMILES, análisis 2013 y Legacy, formateador español IUPAC 1979, generador inglés Legacy y `legacyProfileDisplayName`.

| Estructura | Fórmula | Nombre 2013 ES / EN | Legacy ES antes | Legacy EN antes |
|---|---|---|---|---|
| `C` | C₁H₄ | `metano` / `methane` | `-` (no disponible) | `methane` |
| `CC` | C₂H₆ | `etano` / `ethane` | `-` (no disponible) | `ethane` |
| `CCC` | C₃H₈ | `propano` / `propane` | `-` (no disponible) | `propane` |
| `CCCC` | C₄H₁₀ | `butano` / `butane` | `-` (no disponible) | `butane` |
| `CCCCC` | C₅H₁₂ | `pentano` / `pentane` | `-` (no disponible) | `pentane` |
| `CCCCCC` | C₆H₁₄ | `hexano` / `hexane` | `-` (no disponible) | `hexane` |
| `CCCCCCCCCC` | C₁₀H₂₂ | `decano` / `decane` | `-` (no disponible) | `decane` |
| `CC(C)C` | C₄H₁₀ | `2-metilpropano` / `2-methylpropane` | `2-metilpropano` | `2-methylpropane` |
| `CC(C)CC` | C₅H₁₂ | `2-metilbutano` / `2-methylbutane` | `2-metilbutano` | `2-methylbutane` |
| `CCC(C)CC` | C₆H₁₄ | `3-metilpentano` / `3-methylpentane` | `3-metilpentano` | `3-methylpentane` |
| `CC(C)(C)C` | C₅H₁₂ | `2,2-dimetilpropano` / `2,2-dimethylpropane` | `-` (no disponible) | `2,2-dimethylpropane` |
| C15 lineal | C₁₅H₃₂ | `pentadecano` / `pentadecane` | `-` (no disponible) | `pentadecane` |
| C20 lineal | C₂₀H₄₂ | `icosano` / `icosane` | `-` (no disponible) | `icosane` |
| C30 lineal | C₃₀H₆₂ | `triacontano` / `triacontane` | `-` (no disponible) | `triacontane` |

Los nombres ingleses anteriores se calcularon con la ruta Legacy, no por copia del perfil 2013. En `page.tsx` no había un bloqueo independiente para los alcanos acíclicos: `localSuggestedNameUnavailable` era falso y el nombre inglés se generaba. Para español, el formateador devolvía `-`; `legacyProfileDisplayName` lo convertía en “No disponible para esta estructura”, y el estado `available: false` impedía copiarlo.

## Causa y reparación

`formatIupac1979SpanishName` ejecutaba reglas puntuales, pero no una regla para un nombre de alcano acíclico saturado sin prefijos. La extensión tampoco aceptaba los multiplicadores de sustituyentes, por lo que rechazaba `2,2-dimetilpropano` aunque admitía prefijos metil sencillos.

Se añadió reconocimiento exacto de la forma `raíz admitida + ano`, reutilizando las raíces del proyecto. Para los alcanos ramificados ya contemplados, la validación local de prefijos ahora reconoce los multiplicadores `di`–`deca` y exige que su cantidad coincida con los localizadores escritos. Las formas Legacy ES de estos alcanos pueden ser idénticas a las de 2013, que es correcto para esta familia. No se introdujo un fallback general entre perfiles ni se abrió otra familia.

Los nombres de las cuatro estructuras ramificadas conservan las cadenas padre y localizadores derivados del grafo: propano/C2; butano/C2; pentano/C3; y propano/C2,C2. No se cambió selección de cadena, numeración, reglas de perfil inglés, motor químico ni componentes de interfaz.

## Protección e interacción

La regresión permanente usa moléculas importadas desde sus SMILES y comprueba fórmula y snapshot completo del grafo antes y después del análisis/presentación. Comprueba el análisis activo Legacy, longitud de cadena y localizadores de sustituyentes, nombres 2013 y Legacy ES/EN, disponibilidad de ambos nombres visibles/copiables, destinos de navegación, correspondencia de fragmentos con los átomos del padre y explicación del nombre presentado. También conserva bloqueado `ciclohexano`, que no pertenece a la nueva regla acíclica.

La reparación solo cambia el formateador de nomenclatura; no cambia APIs de generación ni evaluación. Las pruebas de sesión Practice y Exam pasan, y la regresión también verifica que el cálculo de nombres no muta el grafo.

## Validación

Cada proceso de prueba se limitó externamente a 85 segundos y mata el árbol de procesos si alcanza el límite. Las suites que se agruparon en una primera invocación llegaron a ese límite combinado; después se ejecutaron por archivo, cada una dentro del límite, y todas pasaron.

| Prueba | Resultado | Tiempo real |
|---|---:|---:|
| `tests/iupac1979-alkane-coverage.test.mjs` | 2 PASS, 0 FAIL | 21.03 s |
| `tests/nomenclature-conventions.test.mjs` | 16 PASS, 0 FAIL | 0.33 s |
| `tests/legacy-profile-display.test.mjs` | 3 PASS, 0 FAIL | 0.24 s |
| `tests/legacy-english-nomenclature.test.mjs` | 24 PASS, 0 FAIL | 18.87 s |
| `tests/reasoning-name-fragments.test.mjs` | 20 PASS, 0 FAIL | 20.20 s |
| `tests/practice-session.test.mjs` | 12 PASS, 0 FAIL | 20.67 s |
| `tests/exam-session.test.mjs` | 14 PASS, 0 FAIL | 53.45 s |
| `npm run build:pages` | Correcto | 4.73 s |
| `npm run validate:pages` | Correcto; 3 entradas, 6 recursos, base `/Hydrocarbon-Lab/` | — |
| `git diff --check` | Correcto | — |

No se ejecutaron `npm test`, la auditoría de 440 estructuras ni baterías completas.

## Archivos

```text
app/nomenclature-conventions.ts
tests/iupac1979-alkane-coverage.test.mjs
reports/naming-audit/aud-nom-007-legacy-alkanes.md
```
