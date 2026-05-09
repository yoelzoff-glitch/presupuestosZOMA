
import fs from 'fs';

const content = fs.readFileSync('c:/Users/Nailen/Desktop/Proyectos/presupuesto-app/app/(app)/pedidos/[id]/page.tsx', 'utf8');

function checkBalance(text) {
    let braces = 0;
    let parens = 0;
    let curlies = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') curlies++;
        if (text[i] === '}') curlies--;
        if (text[i] === '(') parens++;
        if (text[i] === ')') parens--;
    }
    return { curlies, parens };
}

console.log(checkBalance(content));
