const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function test() {
    console.log('Testing Supabase Login & Stats...');
    const env = fs.readFileSync('.env.local', 'utf8').split('\n');
    let url = '';
    let key = '';
    
    for (const line of env) {
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
    }
    
    if (!url || !key) {
        console.error('Missing env vars');
        return;
    }
    
    const supabase = createClient(url, key);
    
    // We need user credentials. Since I don't have them, I will just call the API directly with a fake token to see what error it returns.
    console.log('Calling stats API with empty token...');
    const res = await fetch('http://localhost:3000/api/v1/stats', {
        headers: { 'Authorization': 'Bearer asdf' }
    });
    
    console.log('Stats Response:', res.status, await res.text());
}

test();
