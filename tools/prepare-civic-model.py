"""Convert the downloaded CC-BY Civic GLB's legacy spec/gloss materials to core glTF PBR.
Usage: python tools/prepare-civic-model.py path/to/honda_civic_2022_free_download.glb
Geometry, topology, embedded images and node transforms remain unchanged.
"""
import json, struct, sys
from pathlib import Path
source=Path(sys.argv[1]); data=source.read_bytes()
magic,version,length=struct.unpack_from('<III',data)
if magic!=0x46546c67 or version!=2 or length!=len(data): raise ValueError('Expected a valid glTF 2 GLB')
size,kind=struct.unpack_from('<II',data,12)
if kind!=0x4e4f534a: raise ValueError('Missing JSON chunk')
doc=json.loads(data[20:20+size]);tail=data[20+size:]
for material in doc.get('materials',[]):
 legacy=material.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
 if legacy:
  pbr={'baseColorFactor':legacy.get('diffuseFactor',[1,1,1,1]),'metallicFactor':.72 if 'Aluminium' in material.get('name','') else 0,'roughnessFactor':max(.18,1-legacy.get('glossinessFactor',1)*.78)}
  if 'diffuseTexture' in legacy:pbr['baseColorTexture']=legacy['diffuseTexture']
  material['pbrMetallicRoughness']=pbr
for key in ['extensionsUsed','extensionsRequired']:
 if key in doc:doc[key]=[x for x in doc[key] if x!='KHR_materials_pbrSpecularGlossiness']
doc.setdefault('asset',{})['extras']={'credit':'Honda Civic 2022 (Free Download) by Ricy / ngon_3d, CC BY 4.0','source':'https://sketchfab.com/3d-models/honda-civic-2022-free-download-d5ca29a5d2f341b691118ffb5560b19b','modification':'Specular/glossiness converted to approximate metallic/roughness PBR for Three.js r170.'}
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',magic,version,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),kind)+encoded+tail
output=Path(__file__).resolve().parent.parent/'app/src/main/assets/models/civic-2022.glb';output.write_bytes(result)
print(f'Prepared {output.name}: {len(result)} bytes')
