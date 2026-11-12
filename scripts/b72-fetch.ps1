$names = @('N-benzylbenzamide','N-benzyl-2-methylbenzamide','N-benzyl-3-methylbenzamide','N-benzyl-4-methylbenzamide','N-benzyl-2-methoxybenzamide','N-benzyl-4-methoxybenzamide','N-benzyl-2-fluorobenzamide','N-benzyl-4-fluorobenzamide','N-benzyl-2-chlorobenzamide','N-benzyl-4-chlorobenzamide','N-benzyl-4-bromobenzamide','N-benzyl-4-iodobenzamide','N-phenylbenzamide','N-phenethylbenzamide','N,N-dibenzylbenzamide','N-phenyl-2-phenylacetamide')
New-Item -ItemType Directory -Force reports/b72/receipts | Out-Null
foreach ($name in $names) {
  $url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + [uri]::EscapeDataString($name) + '/property/MolecularFormula,CanonicalSMILES,InChIKey/JSON'
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) "reports/b72/receipts/$name.json"), $response.Content, [System.Text.UTF8Encoding]::new($false))
    Write-Output "$name OK"
  } catch { Write-Output "$name FAILED $($_.Exception.Message)" }
}
