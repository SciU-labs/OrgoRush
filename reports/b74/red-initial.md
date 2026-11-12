# Prueba roja B7.4

Antes de editar producción, `reconcileSystematicName` devolvió `null` tanto para `N-bencil-N-metilbenzamida` como para `N-benzyl-N-methylbenzamide` frente al grafo `CN(CC1=CC=CC=C1)C(=O)C2=CC=CC=C2`. La [prueba roja](red-initial.log) exigía reconstruir y asignar por separado las dos ramas, los dos enlaces N–C y el anillo fenilo del bencilo. El resultado completo del generador se conserva en [baseline.json](baseline.json).

La expectativa se limita al grafo neutro admitido con un metilo y un bencilo sin sustituir; no presupone que otras N-arilamidas o N,N-dibencilamidas deban obtener FULL.
