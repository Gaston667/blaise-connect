import { writeFileSync } from 'node:fs'

const output = 'frontend/public/documents/fiche-inscription-2026-2027.pdf'
const objects = []
const add = (value) => (objects.push(value), objects.length)
const escapePdf = (value) => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')

const lines = []
const text = (x, y, value, size = 10, font = 'F1', color = '0.03 0.28 0.65') => {
  lines.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`)
}
const line = (x1, y1, x2, y2, width = 1) => lines.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`)
const box = (x, y, width, height, fill = null) => {
  if (fill) lines.push(`${fill} rg ${x} ${y} ${width} ${height} re f`)
  lines.push(`0.65 0.7 0.78 RG 0.7 w ${x} ${y} ${width} ${height} re S`)
}
const section = (y, title) => {
  lines.push(`0.03 0.28 0.65 rg 48 ${y} 499 24 re f`)
  text(60, y + 7, title, 12, 'F2', '1 1 1')
}

// A4 portrait in points, designed to be printed and filled out by hand.
lines.push('0.03 0.28 0.65 rg 0 0 595 842 re f')
lines.push('1 1 1 rg 28 28 539 786 re f')
lines.push('0.03 0.28 0.65 rg 48 742 499 54 re f')
text(70, 773, 'ECOLE ALEF-BLAISE PASCAL DE KAMSAR', 16, 'F2', '1 1 1')
text(70, 753, 'FICHE D’INSCRIPTION - ANNEE SCOLAIRE 2026-2027', 11, 'F2', '1 1 1')
text(48, 716, 'Cette fiche est à remplir lisiblement, puis à remettre à l’établissement avec les pièces demandées.', 9)

section(670, '1. Informations de l’élève')
const studentFields = [
  ['Nom', 48, 632, 238], ['Prénom(s)', 309, 632, 238],
  ['Date de naissance', 48, 580, 238], ['Lieu de naissance', 309, 580, 238],
  ['Sexe :  Masculin [ ]    Féminin [ ]', 48, 528, 238], ['Classe demandée', 309, 528, 238],
]
for (const [label, x, y, width] of studentFields) { text(x, y + 34, label, 9, 'F2'); box(x, y, width, 28) }

section(470, '2. Responsable légal / parent')
const guardianFields = [
  ['Nom et prénom', 48, 432, 238], ['Lien de parenté', 309, 432, 238],
  ['Téléphone', 48, 380, 238], ['Adresse e-mail', 309, 380, 238],
  ['Profession', 48, 328, 238], ['Adresse', 309, 328, 238],
]
for (const [label, x, y, width] of guardianFields) { text(x, y + 34, label, 9, 'F2'); box(x, y, width, 28) }

section(270, '3. Scolarité précédente')
text(48, 248, 'Dernier établissement fréquenté', 9, 'F2'); box(48, 214, 499, 28)
text(48, 196, 'Dernière classe suivie', 9, 'F2'); box(48, 162, 238, 28)
text(309, 196, 'Année scolaire', 9, 'F2'); box(309, 162, 238, 28)

section(104, '4. Déclaration')
text(48, 83, 'Je certifie exacts les renseignements fournis dans cette fiche.', 9)
text(48, 62, 'Fait à Kamsar, le : ____ / ____ / ________', 9)
text(340, 62, 'Signature du responsable légal :', 9)
line(340, 45, 547, 45)

const content = lines.join('\n')
const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
const stream = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
const page = add(`<< /Type /Page /Parent 5 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${stream} 0 R >>`)
const pages = add('<< /Type /Pages /Kids [4 0 R] /Count 1 >>')
const catalog = add('<< /Type /Catalog /Pages 5 0 R >>')

let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
const offsets = [0]
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'))
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
})
const startXref = Buffer.byteLength(pdf, 'latin1')
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`

writeFileSync(output, Buffer.from(pdf, 'latin1'))
