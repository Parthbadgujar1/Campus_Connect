import { zip } from './zip.js';

// Downloadable reports (survey results, feedback) in four formats from one description:
//   xlsx - Excel workbook, one sheet per section
//   docx - Word document with headings, paragraphs and tables
//   pdf  - A4 PDF with the same content (standard Helvetica; characters outside Latin-1 are
//          shown as "?", so names in other scripts are best read in the xlsx/docx versions)
//   csv  - the first table only, for spreadsheets and scripts
// Everything is generated in memory; reports are capped by the callers (a few thousand rows).

export type Cell = string | number | boolean | null | undefined;

export interface ReportSection {
  heading: string;
  /** Short paragraphs shown above the table. */
  lines?: string[];
  columns?: string[];
  rows?: Cell[][];
}

export interface Report {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
}

export type ReportFormat = 'xlsx' | 'docx' | 'pdf' | 'csv';

export const REPORT_TYPES: Record<ReportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8',
};

// Remove characters that XML 1.0 forbids (control characters other than tab/newline).
const xmlSafe = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
const esc = (s: string) => xmlSafe(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (c: Cell) => (c === null || c === undefined ? '' : typeof c === 'boolean' ? (c ? 'Yes' : 'No') : String(c));

export function renderReport(report: Report, format: ReportFormat): Buffer {
  switch (format) {
    case 'xlsx':
      return xlsx(report);
    case 'docx':
      return docx(report);
    case 'pdf':
      return pdf(report);
    case 'csv':
      return csv(report);
  }
}

// ---------------------------------------------------------------- CSV
function csv(report: Report): Buffer {
  const section = report.sections.find((s) => s.columns?.length) ?? { heading: report.title, columns: [], rows: [] };
  const cell = (c: Cell) => {
    let v = text(c);
    // Spreadsheet formula injection: a leading = + - @ is made literal.
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [section.columns ?? [], ...(section.rows ?? [])].map((r) => r.map(cell).join(','));
  // A byte-order mark makes Excel read the file as UTF-8.
  return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8');
}

// ---------------------------------------------------------------- XLSX
function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetXml(section: ReportSection): string {
  const rows: Cell[][] = [];
  rows.push([section.heading]);
  for (const line of section.lines ?? []) rows.push([line]);
  if (section.lines?.length) rows.push([]);
  const headerRow = section.columns?.length ? rows.length : -1;
  if (section.columns?.length) rows.push(section.columns);
  rows.push(...(section.rows ?? []));
  const widths = new Map<number, number>();
  const body = rows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          const ref = `${columnName(ci)}${ri + 1}`;
          const style = ri === 0 ? ' s="1"' : ri === headerRow ? ' s="2"' : '';
          if (ri > 0) widths.set(ci, Math.min(60, Math.max(widths.get(ci) ?? 8, text(c).length + 2)));
          if (typeof c === 'number' && Number.isFinite(c)) return `<c r="${ref}"${style}><v>${c}</v></c>`;
          const v = text(c);
          return v ? `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>` : '';
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  const cols = widths.size ? `<cols>${[...widths.entries()].sort((a, b) => a[0] - b[0]).map(([i, w]) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const freeze = headerRow >= 0 ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow + 1}" topLeftCell="A${headerRow + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function xlsx(report: Report): Buffer {
  const sections = report.sections.length ? report.sections : [{ heading: report.title }];
  const used = new Set<string>();
  const names = sections.map((s, i) => {
    // Sheet names: max 31 characters, no []:*?/\ and unique.
    let n = s.heading.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || `Sheet ${i + 1}`;
    while (used.has(n.toLowerCase())) n = `${n.slice(0, 26)} ${i + 1}`;
    used.add(n.toLowerCase());
    return n;
  });
  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sections.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    },
    { name: 'docProps/core.xml', data: coreProps(report.title) },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sections.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sections.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      // 0 default, 1 title (bold 14), 2 table header (bold, light fill).
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8ECF7"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf fontId="2" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    },
    ...sections.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return zip(files);
}

function coreProps(title: string): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>CampusConnect</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
}

// ---------------------------------------------------------------- DOCX
function docx(report: Report): Buffer {
  const p = (t: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const cell = (t: string, header: boolean) =>
    `<w:tc><w:tcPr>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="E8ECF7"/>' : ''}</w:tcPr><w:p><w:r>${header ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p></w:tc>`;
  const table = (columns: string[], rows: Cell[][]) =>
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="BFC7DA"/>`).join('')}</w:tblBorders></w:tblPr>` +
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns.map((c) => cell(c, true)).join('')}</w:tr>` +
    rows.map((r) => `<w:tr>${columns.map((_, i) => cell(text(r[i]), false)).join('')}</w:tr>`).join('') +
    `</w:tbl><w:p/>`;
  const body = [
    p(report.title, 'Title'),
    report.subtitle ? p(report.subtitle, 'Subtitle') : '',
    ...report.sections.map((s) => [p(s.heading, 'Heading1'), ...(s.lines ?? []).map((l) => p(l)), s.columns?.length ? table(s.columns, s.rows ?? []) : ''].join('')),
  ].join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1F2A44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="5B6478"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2B3A67"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  return zip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    },
    { name: 'docProps/core.xml', data: coreProps(report.title) },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
  ]);
}

// ---------------------------------------------------------------- PDF
// Helvetica glyph widths (1/1000 em) for ASCII 32-126, used to wrap text and fit table cells.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const widthOf = (s: string, size: number) => [...s].reduce((w, ch) => w + (HELV[ch.charCodeAt(0) - 32] ?? 556), 0) * (size / 1000);

/** Latin-1 only (the standard PDF fonts' WinAnsi range); anything else becomes "?". */
const latin1 = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'Rs ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const pdfStr = (s: string) => `(${latin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;

function wrap(s: string, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of latin1(s).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next, size) <= max) line = next;
      else {
        if (line) out.push(line);
        // A single word longer than the line is cut.
        let w = word;
        while (widthOf(w, size) > max) {
          let cut = w.length;
          while (cut > 1 && widthOf(w.slice(0, cut), size) > max) cut--;
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function pdf(report: Report): Buffer {
  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;
  const newPage = () => {
    if (ops.length) pages.push(ops.join('\n'));
    ops = [];
    y = H - M;
  };
  const ensure = (h: number) => {
    if (y - h < M) newPage();
  };
  const textAt = (x: number, yy: number, s: string, size: number, bold = false, color = '0.12 0.16 0.27') => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfStr(s)} Tj ET`);
  };
  const para = (s: string, size: number, bold = false, color?: string, gap = 4) => {
    for (const line of wrap(s, size, W - 2 * M)) {
      ensure(size + 2);
      y -= size + 2;
      textAt(M, y, line, size, bold, color);
    }
    y -= gap;
  };

  para(report.title, 20, true, '0.12 0.16 0.27', 6);
  if (report.subtitle) para(report.subtitle, 10, false, '0.36 0.39 0.47', 10);
  for (const section of report.sections) {
    ensure(40);
    y -= 8;
    para(section.heading, 14, true, '0.17 0.23 0.40', 4);
    for (const l of section.lines ?? []) para(l, 10, false, '0.2 0.22 0.3', 2);
    if (!section.columns?.length) continue;
    y -= 4;
    const cols = section.columns;
    const rows = section.rows ?? [];
    // Column widths follow the content, within the page width.
    const natural = cols.map((c, i) => Math.max(widthOf(latin1(c), 9) + 10, ...rows.slice(0, 200).map((r) => Math.min(220, widthOf(latin1(text(r[i])), 9) + 10))));
    const total = natural.reduce((a, b) => a + b, 0);
    const widths = natural.map((w) => (w / total) * (W - 2 * M));
    const drawRow = (cells: string[], header: boolean) => {
      const lines = cells.map((c, i) => wrap(c, 9, widths[i]! - 8));
      const h = Math.max(...lines.map((l) => l.length)) * 11 + 6;
      if (y - h < M) {
        newPage();
        if (!header) drawRow(cols, true);
      }
      let x = M;
      if (header) ops.push(`0.91 0.93 0.97 rg ${M} ${(y - h).toFixed(2)} ${(W - 2 * M).toFixed(2)} ${h.toFixed(2)} re f`);
      ops.push(`0.75 0.78 0.85 RG 0.5 w ${M} ${(y - h).toFixed(2)} m ${(W - M).toFixed(2)} ${(y - h).toFixed(2)} l S`);
      lines.forEach((cellLines, i) => {
        cellLines.forEach((line, li) => textAt(x + 4, y - 11 - li * 11, line, 9, header));
        x += widths[i]!;
      });
      y -= h;
    };
    drawRow(cols, true);
    for (const r of rows) drawRow(cols.map((_, i) => text(r[i])), false);
    y -= 8;
  }
  newPage();

  // Assemble the file: catalog, page tree, two fonts, then one page + content stream per page.
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length;
  const catalog = add('');
  const tree = add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  pages.forEach((content, i) => {
    const footer = `BT /F1 8 Tf 0.5 0.5 0.55 rg ${M} 24 Td ${pdfStr(`${report.title}  -  page ${i + 1} of ${pages.length}`)} Tj ET`;
    const stream = Buffer.from(`${content}\n${footer}`, 'latin1');
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfStr(report.title)} /Producer (CampusConnect) >>`);

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
