$names = @('N,N-dimethylbenzamide','N,N-diethylbenzamide','N-ethyl-N-methylbenzamide','N,N-dimethyl-4-methylbenzamide','N,N-dimethyl-4-chlorobenzamide','N,N-dimethyl-2-methylbenzamide','N,N-dimethyl-3-methylbenzamide','N,N-dimethyl-2-methoxybenzamide','N,N-dimethyl-4-methoxybenzamide','N,N-diethyl-4-methylbenzamide','N,N-diethyl-4-chlorobenzamide','N,N-dimethyl-2-fluorobenzamide','N,N-dimethyl-4-fluorobenzamide','N,N-dimethyl-4-bromobenzamide','N-ethyl-N-methyl-4-methoxybenzamide','N-benzyl-N-methylbenzamide','N,N-dibenzylbenzamide','N,N-dimethyl-4-iodobenzamide')
New-Item -ItemType Directory -Force reports/b73/receipts | Out-Null
foreach ($name in $names) {
  $url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + [uri]::EscapeDataString($name) + '/property/MolecularFormula,CanonicalSMILES,InChIKey/JSON'
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) "reports/b73/receipts/$name.json"), $response.Content, [System.Text.UTF8Encoding]::new($false))
    Write-Output "$name OK"
  } catch { Write-Output "$name FAILED $($_.Exception.Message)" }
}
