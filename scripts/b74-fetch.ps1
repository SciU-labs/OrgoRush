$names = @('N-benzyl-N-methylbenzamide','N-benzyl-N-ethylbenzamide','N-benzyl-N-propylbenzamide','N-benzyl-4-chloro-N-methylbenzamide','N-benzyl-2-chloro-N-methylbenzamide','N-benzyl-3-chloro-N-methylbenzamide','N-benzyl-4-fluoro-N-methylbenzamide','N-benzyl-2-fluoro-N-methylbenzamide','N-benzyl-3-fluoro-N-methylbenzamide','N-benzyl-4-methoxy-N-methylbenzamide','N-benzyl-3-methoxy-N-methylbenzamide','N-benzyl-2-methoxy-N-methylbenzamide','N-benzyl-4-bromo-N-methylbenzamide','N-benzyl-4-methyl-N-methylbenzamide','N-benzyl-N-ethyl-4-methoxybenzamide','N-benzyl-N-ethyl-4-chlorobenzamide','N-benzyl-N-ethyl-4-fluorobenzamide','N-ethyl-N-phenylbenzamide','N,N-dibenzylbenzamide','N-benzylbenzamide','N-methylbenzamide','N-ethyl-N-methylbenzamide','N-benzyl-N-methyl-2-phenylacetamide')
New-Item -ItemType Directory -Force reports/b74/receipts | Out-Null
foreach ($name in $names) {
  $url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + [uri]::EscapeDataString($name) + '/property/MolecularFormula,CanonicalSMILES,InChIKey/JSON'
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) "reports/b74/receipts/$name.json"), $response.Content, [System.Text.UTF8Encoding]::new($false))
    Write-Output "$name OK"
  } catch { Write-Output "$name FAILED" }
}
