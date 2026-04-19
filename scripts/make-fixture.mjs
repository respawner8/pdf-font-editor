import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';

const doc = await PDFDocument.create();
const page = doc.addPage([400, 200]);
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello World', { x: 50, y: 150, size: 24, font, color: rgb(0, 0, 0) });
page.drawText('Editable text', { x: 50, y: 100, size: 18, font, color: rgb(0, 0, 0) });
fs.writeFileSync('test/fixtures/hello.pdf', await doc.save());
console.log('fixture written');
