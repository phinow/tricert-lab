"""Copy the Intersection questions from parts2/questions-*.json into scenarioBank in tricert-content.ts."""
import json, glob, os, re
here = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(here, '..', '..', 'lib', 'tricert-content.ts')
items = []
for path in sorted(glob.glob(os.path.join(here, 'parts2', 'questions-*.json'))):
    items += [q for q in json.load(open(path, encoding='utf-8'))['items'] if q.get('certification') == 'Intersection']
items.sort(key=lambda q: q['id'])
src = open(target, encoding='utf-8').read()
start = src.index('export const scenarioBank: ScenarioQuestion[] = [')
end = src.index('export function questionsForDeliverable')
block = 'export const scenarioBank: ScenarioQuestion[] = ' + json.dumps(items, ensure_ascii=False, indent=2) + ';\n\n'
open(target, 'w', encoding='utf-8').write(src[:start] + block + src[end:])
print(f'{len(items)} scenario questions written')
