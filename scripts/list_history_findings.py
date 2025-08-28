import json
j = json.load(open('detect-secrets-output.json'))
res = j.get('results', {})
for k in sorted(res.keys()):
    kl = k.lower()
    if '.history' in kl or 'firebase-config' in kl:
        print(k, len(res[k]))
