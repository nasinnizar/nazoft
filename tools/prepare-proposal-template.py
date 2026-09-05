"""One-time sanitization. Requires PyMuPDF; never serve the original client PDF."""
import sys
from pathlib import Path
import fitz

source, target = sys.argv[1:3]
doc = fitz.open(source)
cover = doc[0]
for block in cover.get_text('dict')['blocks']:
    for line in block.get('lines', []):
        for span in line['spans']:
            cover.add_redact_annot(span['bbox'], fill=False)
cover.apply_redactions(images=0, graphics=0)
width, height = doc[5].rect.width, doc[5].rect.height
doc.delete_page(5)
doc.new_page(pno=5, width=width, height=height)
doc.set_metadata({})
doc.del_xml_metadata()
Path(target).parent.mkdir(parents=True, exist_ok=True)
doc.save(target, garbage=4, deflate=True)
