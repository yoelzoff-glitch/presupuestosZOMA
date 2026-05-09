
import fs from 'fs';

const content = fs.readFileSync('c:/Users/Nailen/Desktop/Proyectos/presupuesto-app/app/(app)/pedidos/[id]/page.tsx', 'utf8');

function countTags(text, openTag, closeTag) {
    const openCount = (text.match(new RegExp(openTag, 'g')) || []).length;
    const closeCount = (text.match(new RegExp(closeTag, 'g')) || []).length;
    return { openCount, closeCount };
}

console.log('divs:', countTags(content, '<div', '</div>'));
console.log('sections:', countTags(content, '<section', '</section>'));
console.log('fragments:', countTags(content, '<>', '</>'));
console.log('braces:', countTags(content, '{', '}'));
