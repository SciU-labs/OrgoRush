# Matriz cíclica IUPAC 1979 — AUDIT-003

Generada por `node scripts/audit-iupac79-cyclic-003.mjs`. El JSON adjunto conserva el grafo y las cinco observaciones por estructura.

| ID / familia | SMILES / fórmula / topología | Referencia ES / EN | Regla | Generado ES / EN | Resultado |
| --- | --- | --- | --- | --- | --- |
| mono-3 (A) | C1CC1 · C3H6 · monocyclic · rango 1 | ciclopropano / cyclopropane | A-11.1 | ciclopropano / cyclopropane | PASS |
| mono-4 (A) | C1CCC1 · C4H8 · monocyclic · rango 1 | ciclobutano / cyclobutane | A-11.1 | ciclobutano / cyclobutane | PASS |
| mono-5 (A) | C1CCCC1 · C5H10 · monocyclic · rango 1 | ciclopentano / cyclopentane | A-11.1 | ciclopentano / cyclopentane | PASS |
| mono-6 (A) | C1CCCCC1 · C6H12 · monocyclic · rango 1 | ciclohexano / cyclohexane | A-11.1 | ciclohexano / cyclohexane | PASS |
| mono-7 (A) | C1CCCCCC1 · C7H14 · monocyclic · rango 1 | cicloheptano / cycloheptane | A-11.1 | cicloheptano / cycloheptane | PASS |
| mono-8 (A) | C1CCCCCCC1 · C8H16 · monocyclic · rango 1 | ciclooctano / cyclooctane | A-11.1 | ciclooctano / cyclooctane | PASS |
| mono-12 (A) | C1CCCCCCCCCCC1 · C12H24 · monocyclic · rango 1 | ciclododecano / cyclododecane | A-11.1 | ciclododecano / cyclododecane | PASS |
| mono-ene (A) | C1CC=CCC1 · C6H10 · monocyclic · rango 1 | 1-ciclohexeno / 1-cyclohexene | A-11.3; A-3.3 | 1-ciclohexeno / 1-cyclohexene | PASS |
| mono-diene (A) | C1C=CC=CC1 · C6H8 · monocyclic · rango 1 | 1,3-ciclohexadieno / 1,3-cyclohexadiene | A-11.3; A-3.3 | 1,3-ciclohexadieno / 1,3-cyclohexadiene | PASS |
| mono-yne (A) | C1CCC#CCCC1 · C8H12 · monocyclic · rango 1 | 1-ciclooctino / 1-cyclooctyne | A-11.3; A-3.3 | 1-ciclooctino / 1-cyclooctyne | PASS |
| mono-methyl-ene (A) | CC1=CCCCC1 · C7H12 · monocyclic · rango 1 | 1-metil-1-ciclohexeno / 1-methyl-1-cyclohexene | A-11.3; A-2.2; A-61 | 1-metil-1-ciclohexeno / 1-methyl-1-cyclohexene | PASS |
| mono-dimethyl (A) | CC1CC(C)CCC1 · C8H16 · monocyclic · rango 1 | 1,3-dimetilciclohexano / 1,3-dimethylcyclohexane | A-11.1; A-2.2; A-61 | 1,3-dimetilciclohexano / 1,3-dimethylcyclohexane | PASS |
| naphthalene (B) | c1ccc(cccc2)c2c1 · C10H8 · ortho-fused · rango 2 | naftaleno / naphthalene | A-21.1(3); A-22 | naftaleno / naphthalene | PASS |
| anthracene (B) | c(cc1)cc2c1cc(cccc1)c1c2 · C14H10 · ortho-fused · rango 3 | antraceno / anthracene | A-21.1(13); A-22.5 | antraceno / anthracene | PASS |
| phenanthrene (B) | c1ccc2c3ccccc3ccc2c1 · C14H10 · ortho-fused · rango 3 | fenantreno / phenanthrene | A-21.1(12); A-22.5 | fenantreno / phenanthrene | PASS |
| azulene (B) | c1cc2cccccc-2c1 · C10H8 · ortho-fused · rango 2 | azuleno / azulene | A-21.1(4); A-22 | azuleno / azulene | PASS |
| dihydronaphthalene (B) | C1c2ccccc2CC=C1 · C10H10 · ortho-fused · rango 2 | 1,4-dihidronaftaleno / 1,4-dihydronaphthalene | A-23.1–2 | 1,4-dihidronaftaleno / 1,4-dihydronaphthalene | PASS |
| tetralin (B) | C1Cc2ccccc2CC1 · C10H12 · ortho-fused · rango 2 | 1,2,3,4-tetrahidronaftaleno / 1,2,3,4-tetrahydronaphthalene | A-23.1–2 | - / - | UNSUPPORTED |
| pyrene (B) | c1cc(ccc2ccc3)c4c2c3ccc4c1 · C16H10 · ortho-peri-fused · rango 4 | pireno / pyrene | A-21.1(18); A-22 | - / - | UNSUPPORTED |
| perhydropyrene (B) | C(CC1CCC2CCC3)CC4C1C2C3CC4 · C16H26 · ortho-peri-fused · rango 4 | perhidropireno / perhydropyrene | A-23.2; A-32 non-Hamiltonian boundary pending | - / - | UNSUPPORTED |
| linear-tricyclic (B) | C(CC1)CC2C1CC(CCCC1)C1C2 · C14H24 · ortho-fused · rango 3 | triciclo[8.4.0.0^{3,8}]tetradecano / tricyclo[8.4.0.0^{3,8}]tetradecane | A-32.11–31 | triciclo[8.4.0.0^{3,8}]tetradecano / tricyclo[8.4.0.0^{3,8}]tetradecane | PASS |
| angular-tricyclic (B) | C(CC1)CC2C1C(CCCC1)C1CC2 · C14H24 · ortho-fused · rango 3 | triciclo[8.4.0.0^{2,7}]tetradecano / tricyclo[8.4.0.0^{2,7}]tetradecane | A-32.11–31 | triciclo[8.4.0.0^{2,7}]tetradecano / tricyclo[8.4.0.0^{2,7}]tetradecane | PASS |
| capture-C17H28 (B) | C(C1)CC(C2)C1CC1C2CC(CCCC2)C2C1 · C17H28 · ortho-fused · rango 4 | tetraciclo[8.7.0.0^{3,8}.0^{12,16}]heptadecano / tetracyclo[8.7.0.0^{3,8}.0^{12,16}]heptadecane | A-32.11–31 | tetraciclo[8.7.0.0^{3,8}.0^{12,16}]heptadecano / tetracyclo[8.7.0.0^{3,8}.0^{12,16}]heptadecane | PASS |
| star-tetracyclic (B) | C(CC1)CC2C1C(CCCC1)C1C1C2CCCC1 · C18H30 · ortho-fused · rango 4 | tetraciclo[12.4.0.0^{2,7}.0^{8,13}]octadecano / tetracyclo[12.4.0.0^{2,7}.0^{8,13}]octadecane | A-32.11–31 | tetraciclo[12.4.0.0^{2,7}.0^{8,13}]octadecano / tetracyclo[12.4.0.0^{2,7}.0^{8,13}]octadecane | PASS |
| adamantane (C) | C(C(C1)C2)C3CC2CC1C3 · C10H16 · bridged · rango 3 | triciclo[3.3.1.1^{3,7}]decano / tricyclo[3.3.1.1^{3,7}]decane | A-32; positive secondary bridge numbering pending | - / - | UNSUPPORTED |
| dispiro (D) | C(C1)C11CC2(CC2)C1 · C8H12 · spiro · rango 3 | diespiro[2.1.2.1]octano / dispiro[2.1.2.1]octane | A-41.6 | - / - | UNSUPPORTED |
| mixed-spiro (D) | C(CC1)CC11c2ccccc2CC1 · C13H16 · spiro · rango 3 | espiro[ciclopentano-1,1'-indano] / spiro[cyclopentane-1,1'-indane] | A-41.4; A-23 | - / - | UNSUPPORTED |
| biphenyl (E) | c(cc1)ccc1-c1ccccc1 · C12H10 · linked · rango 2 | bifenilo / biphenyl | A-52.4 | bifenilo / biphenyl | PASS |
| bicyclohexyl (E) | C(CC1)CCC1C1CCCCC1 · C12H22 · linked · rango 2 | 1,1'-biciclohexilo / 1,1'-bicyclohexyl | A-52.1–2 | 1,1'-biciclohexilo / 1,1'-bicyclohexyl | PASS |
| mixed-linked (E) | C(CC1)CC1C1CCCCC1 · C11H20 · linked · rango 2 | ciclopentilciclohexano / cyclopentylcyclohexane | A-53.1–2 | ciclopentilciclohexano / cyclopentylcyclohexane | PASS |
| cyclohexylbenzene (E) | C(CC1)CCC1c1ccccc1 · C12H16 · linked · rango 2 | ciclohexilbenceno / cyclohexylbenzene | A-53.2(c) | ciclohexilbenceno / cyclohexylbenzene | PASS |
| phenylcycloheptane (E) | C(CCC1)CCC1c1ccccc1 · C13H18 · linked · rango 2 | fenilcicloheptano / phenylcycloheptane | A-53.2(b) | fenilcicloheptano / phenylcycloheptane | PASS |
| terphenyl (E) | c(cc1)ccc1-c(cc1)ccc1-c1ccccc1 · C18H14 · linked · rango 3 | 1,1':4',1''-terfenilo / 1,1':4',1''-terphenyl | A-54.1–3 | - / - | UNSUPPORTED |
| pyrrole (F) | c1c[nH]cc1 · C4H5N · monocyclic · rango 1 | pirrol / pyrrole | B-2.11(12) | pirrol / pyrrole | PASS |
| furan (F) | c1c[o]cc1 · C4H4O · monocyclic · rango 1 | furano / furan | B-2.11(5) | furano / furan | PASS |
| thiophene (F) | c1c[s]cc1 · C4H4S · monocyclic · rango 1 | tiofeno / thiophene | B-2.11(1) | tiofeno / thiophene | PASS |
| pyridine (F) | c1ccncc1 · C5H5N · monocyclic · rango 1 | piridina / pyridine | B-2.11(15) | piridina / pyridine | PASS |
| oxirane (F) | C1OC1 · C2H4O · monocyclic · rango 1 | oxirano / oxirane | B-1.1; Table B-II | oxirano / oxirane | PASS |
| aziridine (F) | C1NC1 · C2H5N · monocyclic · rango 1 | aziridina / aziridine | B-1.1; Table B-II | aziridina / aziridine | PASS |
| oxetane (F) | C1COC1 · C3H6O · monocyclic · rango 1 | oxetano / oxetane | B-1.1; Table B-II | oxetano / oxetane | PASS |
| azetidine (F) | C1CNC1 · C3H7N · monocyclic · rango 1 | azetidina / azetidine | B-1.1; Table B-II | azetidina / azetidine | PASS |
| pyrrolidine (F) | C1CNCC1 · C4H9N · monocyclic · rango 1 | pirrolidina / pyrrolidine | B-2.12(3) | pirrolidina / pyrrolidine | PASS |
| tetrahydrofuran (F) | C1COCC1 · C4H8O · monocyclic · rango 1 | tetrahidrofurano / tetrahydrofuran | B-1.2; B-2.11(5) | tetrahidrofurano / tetrahydrofuran | PASS |
| dioxolane (F) | C1OCOC1 · C3H6O2 · monocyclic · rango 1 | 1,3-dioxolano / 1,3-dioxolane | B-1.1,1.3,1.52 | 1,3-dioxolano / 1,3-dioxolane | PASS |
| piperidine (F) | C1CCNCC1 · C5H11N · monocyclic · rango 1 | piperidina / piperidine | B-2.12(9) | piperidina / piperidine | PASS |
| tetrahydropyran (F) | C1CCOCC1 · C5H10O · monocyclic · rango 1 | tetrahidropirano / tetrahydropyran | B-1.2; B-2.11(6) | tetrahidropirano / tetrahydropyran | PASS |
| morpholine (F) | C1NCCOC1 · C4H9NO · monocyclic · rango 1 | morfolina / morpholine | B-2.12(14) | morfolina / morpholine | PASS |
| dioxane (F) | C1OCCOC1 · C4H8O2 · monocyclic · rango 1 | 1,4-dioxano / 1,4-dioxane | B-1.1,1.3,1.52 | 1,4-dioxano / 1,4-dioxane | PASS |
| indole (F) | c1c[nH]c2ccccc12 · C8H7N · ortho-fused · rango 2 | indol / indole | B-2.11(22); B-3 | - / - | UNSUPPORTED |
| quinoline (F) | c1cc2cccnc2cc1 · C9H7N · ortho-fused · rango 2 | quinolina / quinoline | B-2.11(27); B-3 | - / - | UNSUPPORTED |
| quinuclidine (F) | C(C1)C2CCN1CC2 · C7H13N · bridged · rango 2 | quinuclidina / quinuclidine | B-2.12(13); B-14 | - / - | UNSUPPORTED |
| oxaspiro (F) | C(C1)COC11CCCCC1 · C9H16O · spiro · rango 2 | 1-oxaespiro[4.5]decano / 1-oxaspiro[4.5]decane | B-10.1 | - / - | UNSUPPORTED |
| dihydrofuran (F) | C1C=COC1 · C4H6O · monocyclic · rango 1 | 2,3-dihidrofurano / 2,3-dihydrofuran | B-1.2 | - / - | UNSUPPORTED |
| methylcyclohexane (G) | CC1CCCCC1 · C7H14 · monocyclic · rango 1 | metilciclohexano / methylcyclohexane | A-11; A-2; A-61 | metilciclohexano / methylcyclohexane | PASS |
| ethylcyclohexane (G) | CCC1CCCCC1 · C8H16 · monocyclic · rango 1 | etilciclohexano / ethylcyclohexane | A-61.4 | etilciclohexano / ethylcyclohexane | PASS |
| chlorocyclohexane (G) | ClC1CCCCC1 · C6H11Cl · monocyclic · rango 1 | clorociclohexano / chlorocyclohexane | A-11; C-102 | clorociclohexano / chlorocyclohexane | PASS |
| methylhalocycle (G) | CC(CC1)CCC1Br · C7H13Br · monocyclic · rango 1 | 1-bromo-4-metilciclohexano / 1-bromo-4-methylcyclohexane | A-2.2; C-102 | 1-bromo-4-metilciclohexano / 1-bromo-4-methylcyclohexane | PASS |
| cyclohexanol (G) | OC1CCCCC1 · C6H12O · monocyclic · rango 1 | ciclohexanol / cyclohexanol | C-201.1 | ciclohexanol / cyclohexanol | PASS |
| cyclohexanone (G) | O=C1CCCCC1 · C6H10O · monocyclic · rango 1 | ciclohexanona / cyclohexanone | C-314.1 | ciclohexanona / cyclohexanone | PASS |
| enone (G) | O=C1C=CCCC1 · C6H8O · monocyclic · rango 1 | 2-ciclohexenona / 2-cyclohexenone | A-11.3; C-314.1 | 2-ciclohexenona / 2-cyclohexenone | PASS |
| ringacid (G) | OC(C1CCCCC1)=O · C7H12O2 · monocyclic · rango 1 | ácido ciclohexanocarboxílico / cyclohexanecarboxylic acid | C-401.2 | ácido ciclohexanocarboxílico / cyclohexanecarboxylic acid | PASS |
| ringaldehyde (G) | O=CC1CCCCC1 · C7H12O · monocyclic · rango 1 | ciclohexanocarbaldehído / cyclohexanecarbaldehyde | C-304.1 | ciclohexanocarbaldehído / cyclohexanecarbaldehyde | PASS |
| ringnitrile (G) | N#CC1CCCCC1 · C7H11N · monocyclic · rango 1 | ciclohexanocarbonitrilo / cyclohexanecarbonitrile | C-832.2 | ciclohexanocarbonitrilo / cyclohexanecarbonitrile | PASS |
| ringamide (G) | NC(C1CCCCC1)=O · C7H13NO · monocyclic · rango 1 | ciclohexanocarboxamida / cyclohexanecarboxamide | C-822.1; Table C-III | ciclohexanocarboxamida / cyclohexanecarboxamide | PASS |
| ringamine (G) | NC1CCCCC1 · C6H13N · monocyclic · rango 1 | ciclohexanamina / cyclohexanamine | C-812.1(a–b) | ciclohexanamina / cyclohexanamine | PASS |
| methyldecalin (G) | CC1CC(CCCC2)C2CC1 · C11H20 · ortho-fused · rango 2 | 3-metilbiciclo[4.4.0]decano / 3-methylbicyclo[4.4.0]decane | A-31.1–2; A-2 | - / 3-methylbicyclo[4.4.0]decane | UNSUPPORTED |
| theta-1-1-0 (B) | C1C2C1C2 · C4H6 · ortho-fused · rango 2 | biciclo[1.1.0]butano / bicyclo[1.1.0]butane | A-31.1–2 | biciclo[1.1.0]butano / bicyclo[1.1.0]butane | PASS |
| theta-1-1-1 (C) | C1C2CC1C2 · C5H8 · bridged · rango 2 | biciclo[1.1.1]pentano / bicyclo[1.1.1]pentane | A-31.1–2 | biciclo[1.1.1]pentano / bicyclo[1.1.1]pentane | PASS |
| theta-2-1-0 (B) | C1C2C1CC2 · C5H8 · ortho-fused · rango 2 | biciclo[2.1.0]pentano / bicyclo[2.1.0]pentane | A-31.1–2 | biciclo[2.1.0]pentano / bicyclo[2.1.0]pentane | PASS |
| theta-2-1-1 (C) | C1C2CCC1C2 · C6H10 · bridged · rango 2 | biciclo[2.1.1]hexano / bicyclo[2.1.1]hexane | A-31.1–2 | biciclo[2.1.1]hexano / bicyclo[2.1.1]hexane | PASS |
| theta-2-2-0 (B) | C(C1)C2C1CC2 · C6H10 · ortho-fused · rango 2 | biciclo[2.2.0]hexano / bicyclo[2.2.0]hexane | A-31.1–2 | biciclo[2.2.0]hexano / bicyclo[2.2.0]hexane | PASS |
| theta-2-2-1 (C) | C(C1)C2CC1CC2 · C7H12 · bridged · rango 2 | biciclo[2.2.1]heptano / bicyclo[2.2.1]heptane | A-31.1–2 | biciclo[2.2.1]heptano / bicyclo[2.2.1]heptane | PASS |
| theta-2-2-2 (C) | C(C1)C2CCC1CC2 · C8H14 · bridged · rango 2 | biciclo[2.2.2]octano / bicyclo[2.2.2]octane | A-31.1–2 | biciclo[2.2.2]octano / bicyclo[2.2.2]octane | PASS |
| theta-3-1-0 (B) | C1C2C1CCC2 · C6H10 · ortho-fused · rango 2 | biciclo[3.1.0]hexano / bicyclo[3.1.0]hexane | A-31.1–2 | biciclo[3.1.0]hexano / bicyclo[3.1.0]hexane | PASS |
| theta-3-1-1 (C) | C1C2CCCC1C2 · C7H12 · bridged · rango 2 | biciclo[3.1.1]heptano / bicyclo[3.1.1]heptane | A-31.1–2 | biciclo[3.1.1]heptano / bicyclo[3.1.1]heptane | PASS |
| theta-3-2-0 (B) | C(C1)C2C1CCC2 · C7H12 · ortho-fused · rango 2 | biciclo[3.2.0]heptano / bicyclo[3.2.0]heptane | A-31.1–2 | biciclo[3.2.0]heptano / bicyclo[3.2.0]heptane | PASS |
| theta-3-2-1 (C) | C(C1)C2CCCC1C2 · C8H14 · bridged · rango 2 | biciclo[3.2.1]octano / bicyclo[3.2.1]octane | A-31.1–2 | biciclo[3.2.1]octano / bicyclo[3.2.1]octane | PASS |
| theta-3-2-2 (C) | C(C1)C2CCCC1CC2 · C9H16 · bridged · rango 2 | biciclo[3.2.2]nonano / bicyclo[3.2.2]nonane | A-31.1–2 | biciclo[3.2.2]nonano / bicyclo[3.2.2]nonane | PASS |
| theta-3-3-0 (B) | C(C1)CC2C1CCC2 · C8H14 · ortho-fused · rango 2 | biciclo[3.3.0]octano / bicyclo[3.3.0]octane | A-31.1–2 | biciclo[3.3.0]octano / bicyclo[3.3.0]octane | PASS |
| theta-3-3-1 (C) | C(C1)CC2CC1CCC2 · C9H16 · bridged · rango 2 | biciclo[3.3.1]nonano / bicyclo[3.3.1]nonane | A-31.1–2 | biciclo[3.3.1]nonano / bicyclo[3.3.1]nonane | PASS |
| theta-3-3-2 (C) | C(C1)CC2CCC1CCC2 · C10H18 · bridged · rango 2 | biciclo[3.3.2]decano / bicyclo[3.3.2]decane | A-31.1–2 | biciclo[3.3.2]decano / bicyclo[3.3.2]decane | PASS |
| theta-4-1-0 (B) | C1C2C1CCCC2 · C7H12 · ortho-fused · rango 2 | biciclo[4.1.0]heptano / bicyclo[4.1.0]heptane | A-31.1–2 | biciclo[4.1.0]heptano / bicyclo[4.1.0]heptane | PASS |
| theta-4-1-1 (C) | C1C2CCCCC1C2 · C8H14 · bridged · rango 2 | biciclo[4.1.1]octano / bicyclo[4.1.1]octane | A-31.1–2 | biciclo[4.1.1]octano / bicyclo[4.1.1]octane | PASS |
| theta-4-2-0 (B) | C(C1)C2C1CCCC2 · C8H14 · ortho-fused · rango 2 | biciclo[4.2.0]octano / bicyclo[4.2.0]octane | A-31.1–2 | biciclo[4.2.0]octano / bicyclo[4.2.0]octane | PASS |
| theta-4-2-1 (C) | C(C1)C2CCCCC1C2 · C9H16 · bridged · rango 2 | biciclo[4.2.1]nonano / bicyclo[4.2.1]nonane | A-31.1–2 | biciclo[4.2.1]nonano / bicyclo[4.2.1]nonane | PASS |
| theta-4-2-2 (C) | C(C1)C2CCCCC1CC2 · C10H18 · bridged · rango 2 | biciclo[4.2.2]decano / bicyclo[4.2.2]decane | A-31.1–2 | biciclo[4.2.2]decano / bicyclo[4.2.2]decane | PASS |
| theta-4-3-0 (B) | C(C1)CC2C1CCCC2 · C9H16 · ortho-fused · rango 2 | biciclo[4.3.0]nonano / bicyclo[4.3.0]nonane | A-31.1–2 | biciclo[4.3.0]nonano / bicyclo[4.3.0]nonane | PASS |
| theta-4-3-1 (C) | C(C1)CC2CCCCC1C2 · C10H18 · bridged · rango 2 | biciclo[4.3.1]decano / bicyclo[4.3.1]decane | A-31.1–2 | biciclo[4.3.1]decano / bicyclo[4.3.1]decane | PASS |
| theta-4-3-2 (C) | C(C1)CC2CCCCC1CC2 · C11H20 · bridged · rango 2 | biciclo[4.3.2]undecano / bicyclo[4.3.2]undecane | A-31.1–2 | biciclo[4.3.2]undecano / bicyclo[4.3.2]undecane | PASS |
| theta-4-4-0 (B) | C(CC1)CC2C1CCCC2 · C10H18 · ortho-fused · rango 2 | biciclo[4.4.0]decano / bicyclo[4.4.0]decane | A-31.1–2 | biciclo[4.4.0]decano / bicyclo[4.4.0]decane | PASS |
| theta-4-4-1 (C) | C(CC1)CC2CC1CCCC2 · C11H20 · bridged · rango 2 | biciclo[4.4.1]undecano / bicyclo[4.4.1]undecane | A-31.1–2 | biciclo[4.4.1]undecano / bicyclo[4.4.1]undecane | PASS |
| theta-4-4-2 (C) | C(CC1)CC2CCC1CCCC2 · C12H22 · bridged · rango 2 | biciclo[4.4.2]dodecano / bicyclo[4.4.2]dodecane | A-31.1–2 | biciclo[4.4.2]dodecano / bicyclo[4.4.2]dodecane | PASS |
| spiro-2-2 (D) | C(C1)C11CC1 · C5H8 · spiro · rango 2 | espiro[2.2]pentano / spiro[2.2]pentane | A-41.1–2 | espiro[2.2]pentano / spiro[2.2]pentane | PASS |
| spiro-2-3 (D) | C(C1)C11CCC1 · C6H10 · spiro · rango 2 | espiro[2.3]hexano / spiro[2.3]hexane | A-41.1–2 | espiro[2.3]hexano / spiro[2.3]hexane | PASS |
| spiro-2-4 (D) | C(C1)C11CCCC1 · C7H12 · spiro · rango 2 | espiro[2.4]heptano / spiro[2.4]heptane | A-41.1–2 | espiro[2.4]heptano / spiro[2.4]heptane | PASS |
| spiro-2-5 (D) | C(C1)C11CCCCC1 · C8H14 · spiro · rango 2 | espiro[2.5]octano / spiro[2.5]octane | A-41.1–2 | espiro[2.5]octano / spiro[2.5]octane | PASS |
| spiro-2-6 (D) | C(C1)C11CCCCCC1 · C9H16 · spiro · rango 2 | espiro[2.6]nonano / spiro[2.6]nonane | A-41.1–2 | espiro[2.6]nonano / spiro[2.6]nonane | PASS |
| spiro-2-7 (D) | C(C1)C11CCCCCCC1 · C10H18 · spiro · rango 2 | espiro[2.7]decano / spiro[2.7]decane | A-41.1–2 | espiro[2.7]decano / spiro[2.7]decane | PASS |
| spiro-3-3 (D) | C(C1)CC11CCC1 · C7H12 · spiro · rango 2 | espiro[3.3]heptano / spiro[3.3]heptane | A-41.1–2 | espiro[3.3]heptano / spiro[3.3]heptane | PASS |
| spiro-3-4 (D) | C(C1)CC11CCCC1 · C8H14 · spiro · rango 2 | espiro[3.4]octano / spiro[3.4]octane | A-41.1–2 | espiro[3.4]octano / spiro[3.4]octane | PASS |
| spiro-3-5 (D) | C(C1)CC11CCCCC1 · C9H16 · spiro · rango 2 | espiro[3.5]nonano / spiro[3.5]nonane | A-41.1–2 | espiro[3.5]nonano / spiro[3.5]nonane | PASS |
| spiro-3-6 (D) | C(C1)CC11CCCCCC1 · C10H18 · spiro · rango 2 | espiro[3.6]decano / spiro[3.6]decane | A-41.1–2 | espiro[3.6]decano / spiro[3.6]decane | PASS |
| spiro-3-7 (D) | C(C1)CC11CCCCCCC1 · C11H20 · spiro · rango 2 | espiro[3.7]undecano / spiro[3.7]undecane | A-41.1–2 | espiro[3.7]undecano / spiro[3.7]undecane | PASS |
| spiro-4-4 (D) | C(CC1)CC11CCCC1 · C9H16 · spiro · rango 2 | espiro[4.4]nonano / spiro[4.4]nonane | A-41.1–2 | espiro[4.4]nonano / spiro[4.4]nonane | PASS |
| spiro-4-5 (D) | C(CC1)CC11CCCCC1 · C10H18 · spiro · rango 2 | espiro[4.5]decano / spiro[4.5]decane | A-41.1–2 | espiro[4.5]decano / spiro[4.5]decane | PASS |
| spiro-4-6 (D) | C(CC1)CC11CCCCCC1 · C11H20 · spiro · rango 2 | espiro[4.6]undecano / spiro[4.6]undecane | A-41.1–2 | espiro[4.6]undecano / spiro[4.6]undecane | PASS |
| spiro-4-7 (D) | C(CC1)CC11CCCCCCC1 · C12H22 · spiro · rango 2 | espiro[4.7]dodecano / spiro[4.7]dodecane | A-41.1–2 | espiro[4.7]dodecano / spiro[4.7]dodecane | PASS |
| spiro-5-5 (D) | C(CC1)CCC11CCCCC1 · C11H20 · spiro · rango 2 | espiro[5.5]undecano / spiro[5.5]undecane | A-41.1–2 | espiro[5.5]undecano / spiro[5.5]undecane | PASS |
| spiro-5-6 (D) | C(CC1)CCC11CCCCCC1 · C12H22 · spiro · rango 2 | espiro[5.6]dodecano / spiro[5.6]dodecane | A-41.1–2 | espiro[5.6]dodecano / spiro[5.6]dodecane | PASS |
| spiro-5-7 (D) | C(CC1)CCC11CCCCCCC1 · C13H24 · spiro · rango 2 | espiro[5.7]tridecano / spiro[5.7]tridecane | A-41.1–2 | espiro[5.7]tridecano / spiro[5.7]tridecane | PASS |
| spiro-6-6 (D) | C(CCC1)CCC11CCCCCC1 · C13H24 · spiro · rango 2 | espiro[6.6]tridecano / spiro[6.6]tridecane | A-41.1–2 | espiro[6.6]tridecano / spiro[6.6]tridecane | PASS |
| spiro-6-7 (D) | C(CCC1)CCC11CCCCCCC1 · C14H26 · spiro · rango 2 | espiro[6.7]tetradecano / spiro[6.7]tetradecane | A-41.1–2 | espiro[6.7]tetradecano / spiro[6.7]tetradecane | PASS |
| spiro-7-7 (D) | C(CCC1)CCCC11CCCCCCC1 · C15H28 · spiro · rango 2 | espiro[7.7]pentadecano / spiro[7.7]pentadecane | A-41.1–2 | espiro[7.7]pentadecano / spiro[7.7]pentadecane | PASS |
