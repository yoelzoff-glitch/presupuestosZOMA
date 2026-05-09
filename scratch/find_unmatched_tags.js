const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Nailen\\Desktop\\Proyectos\\presupuesto-app\\app\\(app)\\pedidos\\[id]\\page.tsx', 'utf8');

const tags = [];
const regex = /<(\/?[a-zA-Z0-9]+)(?=[^>]*>)/g;
let match;

while ((match = regex.exec(content)) !== null) {
  const tagName = match[1];
  if (tagName.startsWith('/')) {
    const closing = tagName.substring(1);
    const last = tags.pop();
    if (last !== closing) {
      console.log(`Error: Se esperaba cerrar ${last} pero se encontró /${closing}`);
      tags.push(last); // Re-insert to keep tracking
    }
  } else {
    // Ignore self-closing tags if we can detect them easily, 
    // but the regex above captures the start of any tag.
    // We'll just filter out common self-closing ones for simplicity.
    if (!['img', 'br', 'hr', 'input', 'Link', 'ArrowLeft', 'CalendarDays', 'CheckCircle2', 'Clock3', 'DollarSign', 'FileText', 'Hash', 'Loader2', 'MapPin', 'Package', 'ReceiptText', 'Tag', 'User', 'XCircle', 'Wallet', 'InfoCard', 'ClientData', 'MiniData', 'StatusBadge'].includes(tagName)) {
        tags.push(tagName);
    }
  }
}

console.log('Etiquetas abiertas al final:', tags);
