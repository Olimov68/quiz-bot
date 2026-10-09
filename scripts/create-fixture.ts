import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

async function createDocxFixture() {
  const zip = new JSZip();

  // Create a minimal 1x1 transparent PNG image
  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  zip.file('word/media/image1.png', dummyPng);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  zip.file('_rels/.rels', rootRelsXml);

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
  zip.file('word/_rels/document.xml.rels', docRelsXml);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <!-- Savol 1: Informatika va Dasturlash -->
    <w:p><w:r><w:t>1. Python dasturlash tilini kim yaratgan?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A) Dennis Ritchie</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) James Gosling</w:t></w:r></w:p>
    <w:p><w:r><w:t>*C) Guido van Rossum</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) Bjarne Stroustrup</w:t></w:r></w:p>
    <w:p><w:r><w:t>Izoh: Guido van Rossum 1991-yilda Python tilini ochiq e'lon qilgan.</w:t></w:r></w:p>

    <!-- Savol 2: Geografiya (Suffix Answer) -->
    <w:p><w:r><w:t>2. O‘zbekiston Respublikasining poytaxti qaysi shahar?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A) Samarqand</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) Toshkent</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) Buxoro</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) Xiva</w:t></w:r></w:p>
    <w:p><w:r><w:t>Javob: B</w:t></w:r></w:p>

    <!-- Savol 3: Matematika (OMML formula) -->
    <w:p>
      <w:r><w:t>3. Tenglamaning ildizlarini toping: </w:t></w:r>
      <m:oMath>
        <m:sSup>
          <m:e><m:r><m:t>x</m:t></m:r></m:e>
          <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
        </m:sSup>
        <m:r><m:t> - 9 = 0</m:t></m:r>
      </m:oMath>
    </w:p>
    <w:p><w:r><w:t>A) x = 3</w:t></w:r></w:p>
    <w:p><w:r><w:t>*B) x = ±3</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) x = -3</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) x = 9</w:t></w:r></w:p>

    <!-- Savol 4: Kimyo (Reaksiya tenglamasi) -->
    <w:p><w:r><w:t>4. Metanning to‘liq yonish reaksiyasini ko‘rsating: CH₄ + 2O₂ → ?</w:t></w:r></w:p>
    <w:p><w:r><w:t>*A) CO₂ + 2H₂O</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) CO + H₂</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) C + 2H₂O</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) H₂CO₃</w:t></w:r></w:p>

    <!-- Savol 5: Rasmli savol -->
    <w:p>
      <w:r><w:t>5. Quyidagi rasmda qanday geometrik figura tasvirlangan?</w:t></w:r>
      <w:drawing>
        <a:blip r:embed="rId2"/>
      </w:drawing>
    </w:p>
    <w:p><w:r><w:t>A) Doira</w:t></w:r></w:p>
    <w:p><w:r><w:t>*B) Kvadrat</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) Uchburchak</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) Trapetsiya</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  zip.file('word/document.xml', documentXml);

  const outDir = path.resolve('./docs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'namuna_test.docx');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outPath, buffer);

  console.log(`✅ Word test namunasi yaratildi: ${outPath} (${buffer.length} bayt)`);
}

createDocxFixture().catch(console.error);
