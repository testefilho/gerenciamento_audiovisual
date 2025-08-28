import json
j = json.load(open('detect-secrets-output.json'))
res = j.get('results', {})
history = 0
firebase = 0
other = 0
files = []
for k,v in res.items():
    cnt = len(v)
    files.append((k,cnt))
    kl = k.lower()
    if '.history' in kl:
        history += cnt
    elif 'firebase-config' in kl:
        firebase += cnt
    else:
        other += cnt
print('counts:', {'history':history,'firebase':firebase,'other':other,'total':history+firebase+other})
print('\nTop 30 files by count:')
for k,c in sorted(files, key=lambda x: -x[1])[:30]:
    print(c,k)
