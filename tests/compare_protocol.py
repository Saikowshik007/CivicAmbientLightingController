"""Compare actual Java encoder output with the earlier APK-derived Python reference."""
import json
import sys
from pathlib import Path
import ambient_protocol_reference as reference

vectors=json.loads(Path(sys.argv[1]).read_text())
for item in vectors:
    values=item['input']
    if item['family']=='brightness': expected=reference.brightness(*values)
    elif item['family']=='colors':
        expected=reference.colors(*[tuple((c >> shift) & 255 for shift in (16,8,0)) for c in values])
    elif item['family']=='modes': expected=reference.rgb_modes(*values)
    elif item['family']=='flow': expected=reference.flow(*values)
    else: raise AssertionError(item)
    assert expected.hex().upper()==item['hex'],item
print(f'PASS: {len(vectors):,} Java packets match the APK-derived Python reference')
