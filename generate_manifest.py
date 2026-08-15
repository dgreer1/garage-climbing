#!/usr/bin/env python3
import os
import json

ROOT = os.path.dirname(__file__)
WWW = os.path.join(ROOT, 'www')

climbs = []
for grade in sorted(os.listdir(WWW)):
    grade_dir = os.path.join(WWW, grade)
    if not os.path.isdir(grade_dir):
        continue
    for fname in sorted(os.listdir(grade_dir)):
        if not (fname.lower().endswith('.png') or fname.lower().endswith('.jpg') or fname.lower().endswith('.jpeg') or fname.lower().endswith('.webp')):
            continue
        name = os.path.splitext(fname)[0]
        # Replace underscores with spaces
        display_name = name.replace('_', ' ')
        # path relative to where index.html will live; we keep assets under www/
        relative_path = os.path.join('www', grade, fname).replace('\\', '/')
        climbs.append({
            'name': display_name,
            'grade': grade,
            'file': fname,
            'path': relative_path
        })

out = {'climbs': climbs}
with open(os.path.join(WWW, 'climbs.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(climbs)} climbs to www/climbs.json")
