const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Generating types...');
  const output = execSync('.\\node_modules\\.bin\\supabase gen types typescript --project-id xsudvlajbzzngeecppqt', { encoding: 'utf8' });
  fs.writeFileSync('types/supabase.ts', output, 'utf8');
  console.log('Types generated successfully in types/supabase.ts');
} catch (error) {
  console.error('Error generating types:', error.message);
}
