var NazoftFileFormats = (() => {
  const encoder = new TextEncoder();
  const textBytes = value => encoder.encode(String(value));
  const concatBytes = parts => {
    let length = parts.reduce((total, part) => total + part.length, 0), output = new Uint8Array(length), offset = 0;
    parts.forEach(part => { output.set(part, offset); offset += part.length; });
    return output;
  };
  const xml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const columnName = index => { let name = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name; return name; };
  const safeSheetName = (name, used) => {
    let base = String(name || 'Report').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Report', candidate = base, suffix = 1;
    while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 28)} ${++suffix}`;
    used.add(candidate.toLowerCase());
    return candidate;
  };
  const crcTable = (() => {
    let table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let value = n; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; table[n] = value >>> 0; }
    return table;
  })();
  const crc32 = bytes => { let crc = 0xffffffff; for (let byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  const u16 = value => new Uint8Array([value & 255, value >>> 8 & 255]);
  const u32 = value => new Uint8Array([value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]);
  function zipStore(files) {
    let localParts = [], centralParts = [], offset = 0;
    files.forEach(file => {
      let name = textBytes(file.name), data = file.data instanceof Uint8Array ? file.data : textBytes(file.data), crc = crc32(data);
      let local = concatBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
      localParts.push(local);
      centralParts.push(concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
      offset += local.length;
    });
    let central = concatBytes(centralParts), end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)]);
    return concatBytes([...localParts, central, end]);
  }
  function worksheetXml(sheet) {
    let rows = Array.isArray(sheet.rows) ? sheet.rows : [], colCount = Math.max(1, ...rows.map(row => row.cells?.length || 0));
    let widths = Array.from({ length: colCount }, (_, index) => Math.min(45, Math.max(12, ...rows.map(row => String(row.cells?.[index] ?? '').length + 2))));
    let styleIds = { blank: 0, title: 1, section: 2, header: 3, meta: 4, data: 5 };
    let body = rows.map((row, rowIndex) => {
      let cells = (row.cells || []).map((value, columnIndex) => {
        let address = `${columnName(columnIndex)}${rowIndex + 1}`, style = styleIds[row.kind] ?? 0;
        if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${address}" s="${style}"><v>${value}</v></c>`;
        return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}"${row.kind === 'title' ? ' ht="28" customHeight="1"' : ''}>${cells}</row>`;
    }).join('');
    let headerIndex = rows.findIndex(row => row.kind === 'header');
    let freezeAt = headerIndex >= 0 ? headerIndex + 1 : Math.min(5, rows.length);
    let freeze = rows.length > freezeAt ? `<pane ySplit="${freezeAt}" topLeftCell="A${freezeAt + 1}" activePane="bottomLeft" state="frozen"/>` : '';
    let autoFilter = headerIndex >= 0 ? `<autoFilter ref="A${headerIndex + 1}:${columnName(colCount - 1)}${Math.max(headerIndex + 1, rows.length)}"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${autoFilter}</worksheet>`;
  }
  function createXlsxWorkbook(sheets) {
    let used = new Set(), normalized = (sheets || []).map(sheet => ({ ...sheet, safeName: safeSheetName(sheet.name, used) }));
    let files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${normalized.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Nazoft CRM</dc:creator><cp:lastModifiedBy>Nazoft CRM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Nazoft CRM</Application><Company>Nazoft</Company></Properties>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((sheet, index) => `<sheet name="${xml(sheet.safeName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets><calcPr calcId="191029"/></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="17"/><name val="Aptos Display"/></font><font><b/><color rgb="FF315FAE"/><sz val="12"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4776D0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF4FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE3E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    normalized.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: worksheetXml(sheet) }));
    return zipStore(files);
  }
  const ascii = value => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '-');
  const pdfText = value => ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const dataUrlBytes = dataUrl => {
    let base64 = String(dataUrl || '').split(',')[1] || '', binary = atob(base64), bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };
  function createPdfReport(sheets, title, branding = {}) {
    let logo = branding?.dataUrl?.startsWith('data:image/jpeg') ? { bytes: dataUrlBytes(branding.dataUrl), width: Number(branding.width) || 400, height: Number(branding.height) || 140 } : null;
    let pages = [], commands, pageNumber = 0, y = 760;
    function newPage() {
      pageNumber++; commands = ['0.278 0.463 0.816 rg 0 800 595 42 re f'];
      if (logo) {
        let drawHeight = 25, drawWidth = Math.min(70, drawHeight * logo.width / logo.height);
        commands.push(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight} 34 808 cm /Logo Do Q`);
        commands.push(`BT /F2 13 Tf 1 1 1 rg ${42 + drawWidth} 816 Td (${pdfText(branding.companyName || 'CRM Report')}) Tj ET`);
      } else commands.push('BT /F2 18 Tf 1 1 1 rg 34 815 Td (Nazoft CRM) Tj ET');
      commands.push(`BT /F1 9 Tf 0.40 0.45 0.55 rg 34 24 Td (${pdfText(`Generated ${new Date().toLocaleString()} - Page ${pageNumber}`)}) Tj ET`);
      pages.push(commands); y = 770;
    }
    function ensure(space = 24) { if (y - space < 52) newPage(); }
    function text(value, x, size = 10, bold = false, color = '0.10 0.14 0.21') { commands.push(`BT /F${bold ? '2' : '1'} ${size} Tf ${color} rg ${x} ${y} Td (${pdfText(value)}) Tj ET`); }
    newPage(); text(title, 34, 16, true); y -= 28;
    (sheets || []).forEach((sheet, sheetIndex) => {
      if (sheetIndex) { ensure(52); y -= 12; }
      ensure(38); text(sheet.name, 34, 14, true, '0.19 0.37 0.68'); y -= 23;
      (sheet.rows || []).forEach(row => {
        if (row.kind === 'title' || row.kind === 'meta') return;
        if (row.kind === 'blank') { y -= 8; return; }
        ensure(row.kind === 'section' ? 32 : 24);
        let count = Math.max(1, row.cells.length), columnWidth = 527 / count;
        if (row.kind === 'section') { commands.push(`0.93 0.96 1 rg 32 ${y - 6} 531 22 re f`); text(row.cells[0], 39, 11, true, '0.19 0.37 0.68'); y -= 28; return; }
        if (row.kind === 'header') commands.push(`0.19 0.37 0.68 rg 32 ${y - 7} 531 23 re f`);
        row.cells.forEach((cell, index) => { let limit = Math.max(7, Math.floor(columnWidth / 5.4) - 1), value = ascii(cell), shown = value.length > limit ? `${value.slice(0, limit - 1)}...` : value; text(shown, 38 + index * columnWidth, row.kind === 'header' ? 8.5 : 8, row.kind === 'header', row.kind === 'header' ? '1 1 1' : '0.10 0.14 0.21'); });
        y -= 22; if (row.kind === 'data') commands.push(`0.88 0.91 0.95 RG 32 ${y + 14} m 563 ${y + 14} l S`);
      });
    });
    let objects = [null], kids = [], imageId = logo ? 5 : 0, firstPageId = logo ? 6 : 5;
    objects[1] = textBytes('<< /Type /Catalog /Pages 2 0 R >>');
    objects[3] = textBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects[4] = textBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    if (logo) objects[imageId] = concatBytes([textBytes(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`), logo.bytes, textBytes('\nendstream')]);
    pages.forEach((page, index) => {
      let pageId = firstPageId + index * 2, contentId = pageId + 1, stream = textBytes(page.join('\n'));
      kids.push(`${pageId} 0 R`);
      objects[pageId] = textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${logo ? ` /XObject << /Logo ${imageId} 0 R >>` : ''} >> /Contents ${contentId} 0 R >>`);
      objects[contentId] = concatBytes([textBytes(`<< /Length ${stream.length} >>\nstream\n`), stream, textBytes('\nendstream')]);
    });
    objects[2] = textBytes(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
    let parts = [textBytes('%PDF-1.4\n%Nazoft\n')], offsets = [0], cursor = parts[0].length;
    for (let id = 1; id < objects.length; id++) { offsets[id] = cursor; let part = concatBytes([textBytes(`${id} 0 obj\n`), objects[id], textBytes('\nendobj\n')]); parts.push(part); cursor += part.length; }
    let xref = cursor, footer = `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    parts.push(textBytes(footer));
    return concatBytes(parts);
  }
  return { createXlsxWorkbook, createPdfReport };
})();
if (typeof window !== 'undefined') window.NazoftFileFormats = NazoftFileFormats;
