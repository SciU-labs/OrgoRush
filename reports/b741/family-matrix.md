# B7.4.1 — muestra transversal inicial

## Etapa C

La batería `tests/b741-pedagogy.test.mjs` reutiliza los 31 registros de esta medición: cuando existe una prueba FULL, comprueba que los destinos del razonamiento pertenecen al grafo y que los tramos con offset coinciden con el nombre activo. Los casos sin prueba FULL se mantienen como frontera y no se cuentan como explicaciones FULL. Se añaden comprobaciones detalladas de las cuatro estructuras reportadas, un nitrilo y una cetona cíclica. La batería no demuestra que todas las familias PARTIAL tengan una explicación completa.

31 grafos, medidos por el motor local antes del cambio de presentación. FULL significa reconciliación para el nombre exacto; PARTIAL significa que esta medición no obtuvo una prueba completa; UNSUPPORTED indica ausencia de nombre local. Estas observaciones no verifican la interfaz ni certifican PIN. Grafos, análisis, regiones, fragmentos y numeración calculados están en [transversal-baseline.json](transversal-baseline.json).

| Familia | SMILES | Español | Inglés | Estado ES |
|---|---|---|---|---|
| alkane | `CCCC` | butano | butane | PARTIAL |
| branched alkane | `CC(C)CC` | 2-metilbutano | 2-methylbutane | PARTIAL |
| alkene | `CC=CC` | but-2-eno | but-2-ene | PARTIAL |
| alkyne | `CC#CC` | but-2-ino | but-2-yne | PARTIAL |
| alcohol | `CCCO` | propan-1-ol | propan-1-ol | PARTIAL |
| ether | `CCOCC` | etoxietano | ethoxyethane | PARTIAL |
| aldehyde | `CCC=O` | propanal | propanal | FULL |
| ketone | `CC(=O)CC` | butan-2-ona | butan-2-one | PARTIAL |
| acid | `CCC(=O)O` | ácido propanoico | propanoic acid | PARTIAL |
| ester | `CC(=O)OC` | etanoato de metilo | methyl ethanoate | PARTIAL |
| amine | `CCN` | etanamina | ethanamine | PARTIAL |
| amide | `CC(=O)N` | etanamida | ethanamide | PARTIAL |
| nitrile | `CCC#N` | propanonitrilo | propanenitrile | PARTIAL |
| halide | `CCCCl` | 1-cloropropano | 1-chloropropane | PARTIAL |
| nitro | `Cc1ccccc1[N+](=O)[O-]` | 1-metil-2-nitrobenceno | 1-methyl-2-nitrobenzene | FULL |
| cycloalkane | `C1CCCCC1` | ciclohexano | cyclohexane | PARTIAL |
| cycloalkene | `C1=CCCCC1` | ciclohex-1-eno | cyclohex-1-ene | PARTIAL |
| aromatic prefixes | `Cc1ccc(Cl)cc1` | 1-cloro-4-metilbenceno | 1-chloro-4-methylbenzene | FULL |
| benzamide | `NC(=O)c1ccccc1` | benzamida | benzamide | FULL |
| N-alkyl benzamide | `CCNC(=O)c1c(Br)cc(C)cc1` | 2-bromo-N-etil-4-metilbenzamida | 2-bromo-N-ethyl-4-methylbenzamide | FULL |
| N,N-dialkyl benzamide | `CCN(CC)C(=O)c1cc(F)cc(F)c1` | N,N-dietil-3,5-difluorobenzamida | N,N-diethyl-3,5-difluorobenzamide | FULL |
| N-benzyl benzamide | `O=C(NCc1ccccc1)c1ccccc1` | N-bencilbenzamida | N-benzylbenzamide | FULL |
| N-alkyl N-benzyl benzamide | `CN(Cc1ccccc1)C(=O)c1ccccc1` | N-bencil-N-metilbenzamida | N-benzyl-N-methylbenzamide | FULL |
| aromatic ester | `COC(=O)c1cc(Br)c(OC)cc1` | 3-bromo-4-metoxibenzoato de metilo | methyl 3-bromo-4-methoxybenzoate | FULL |
| aromatic nitrile | `N#Cc1ccc(F)c(F)c1` | 3,4-difluorobenzonitrilo | 3,4-difluorobenzonitrile | FULL |
| aromatic aldehyde | `CCOc1c(Cl)cc(Cl)cc1C=O` | 3,5-dicloro-2-etoxibenzaldehído | 3,5-dichloro-2-ethoxybenzaldehyde | FULL |
| cyclic ketone | `O=C1CCC(C)CC1` | 4-metilciclohexanona | 4-methylcyclohexanone | FULL |
| heterocycle | `n1ccccc1` | piridina | pyridine | PARTIAL |
| N-aryl boundary | `CCN(c1ccccc1)C(=O)c1ccccc1` | — | — | UNSUPPORTED |
| N,N-dibenzyl boundary | `O=C(N(Cc1ccccc1)Cc1ccccc1)c1ccccc1` | — | — | UNSUPPORTED |
| aromatic multi-prefix | `Cc1cc(C)c([N+](=O)[O-])c(C)c1[N+](=O)[O-]` | 1,3,5-trimetil-2,4-dinitrobenceno | 1,3,5-trimethyl-2,4-dinitrobenzene | PARTIAL |

## Etapa E — medición final

La medición posterior reutiliza los 31 grafos originales; FULL indica reconciliación del nombre exacto y PARTIAL ausencia de esa prueba. OPSIN compara conectividad completa mediante OpenChemLib, compartido con la aplicación. Los resultados no certifican PIN. [Datos completos](stage-e-matrix.json) · [Auditoría PARTIAL del modelo](stage-e-partial.json).

| Familia | Nombre ES | Estado ES | Nombre EN | Estado EN | OPSIN EN |
|---|---|---|---|---|---|
| alkane | butano | PARTIAL | butane | PARTIAL | EQUIVALENT |
| branched alkane | 2-metilbutano | PARTIAL | 2-methylbutane | PARTIAL | EQUIVALENT |
| alkene | but-2-eno | PARTIAL | but-2-ene | PARTIAL | EQUIVALENT |
| alkyne | but-2-ino | PARTIAL | but-2-yne | PARTIAL | EQUIVALENT |
| alcohol | propan-1-ol | PARTIAL | propan-1-ol | PARTIAL | EQUIVALENT |
| ether | etoxietano | PARTIAL | ethoxyethane | PARTIAL | EQUIVALENT |
| aldehyde | propanal | FULL | propanal | FULL | EQUIVALENT |
| ketone | butan-2-ona | PARTIAL | butan-2-one | PARTIAL | EQUIVALENT |
| acid | ácido propanoico | PARTIAL | propanoic acid | FULL | EQUIVALENT |
| ester | etanoato de metilo | PARTIAL | methyl ethanoate | PARTIAL | EQUIVALENT |
| amine | etanamina | PARTIAL | ethanamine | PARTIAL | EQUIVALENT |
| amide | etanamida | PARTIAL | ethanamide | FULL | EQUIVALENT |
| nitrile | propanonitrilo | PARTIAL | propanenitrile | PARTIAL | EQUIVALENT |
| halide | 1-cloropropano | PARTIAL | 1-chloropropane | PARTIAL | EQUIVALENT |
| nitro | 1-metil-2-nitrobenceno | FULL | 1-methyl-2-nitrobenzene | FULL | EQUIVALENT |
| cycloalkane | ciclohexano | PARTIAL | cyclohexane | PARTIAL | EQUIVALENT |
| cycloalkene | ciclohex-1-eno | PARTIAL | cyclohex-1-ene | PARTIAL | EQUIVALENT |
| aromatic prefixes | 1-cloro-4-metilbenceno | FULL | 1-chloro-4-methylbenzene | FULL | EQUIVALENT |
| benzamide | benzamida | FULL | benzamide | FULL | EQUIVALENT |
| N-alkyl benzamide | 2-bromo-N-etil-4-metilbenzamida | FULL | 2-bromo-N-ethyl-4-methylbenzamide | FULL | EQUIVALENT |
| N,N-dialkyl benzamide | N,N-dietil-3,5-difluorobenzamida | FULL | N,N-diethyl-3,5-difluorobenzamide | FULL | EQUIVALENT |
| N-benzyl benzamide | N-bencilbenzamida | FULL | N-benzylbenzamide | FULL | EQUIVALENT |
| N-alkyl N-benzyl benzamide | N-bencil-N-metilbenzamida | FULL | N-benzyl-N-methylbenzamide | FULL | EQUIVALENT |
| aromatic ester | 3-bromo-4-metoxibenzoato de metilo | FULL | methyl 3-bromo-4-methoxybenzoate | FULL | EQUIVALENT |
| aromatic nitrile | 3,4-difluorobenzonitrilo | FULL | 3,4-difluorobenzonitrile | FULL | EQUIVALENT |
| aromatic aldehyde | 3,5-dicloro-2-etoxibenzaldehído | FULL | 3,5-dichloro-2-ethoxybenzaldehyde | FULL | EQUIVALENT |
| cyclic ketone | 4-metilciclohexanona | FULL | 4-methylcyclohexanone | FULL | EQUIVALENT |
| heterocycle | piridina | PARTIAL | pyridine | PARTIAL | EQUIVALENT |
| N-aryl boundary | — | UNSUPPORTED | — | UNSUPPORTED | NO-NAME |
| N,N-dibenzyl boundary | — | UNSUPPORTED | — | UNSUPPORTED | NO-NAME |
| aromatic multi-prefix | 1,3,5-trimetil-2,4-dinitrobenceno | PARTIAL | 1,3,5-trimethyl-2,4-dinitrobenzene | PARTIAL | EQUIVALENT |
