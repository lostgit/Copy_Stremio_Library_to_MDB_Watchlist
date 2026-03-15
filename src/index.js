const Parser = {
  process(stremioExport) {
    // Use modern syntax: nullish coalescing and optional chaining
    const media = stremioExport?.library ?? (Array.isArray(stremioExport) ? stremioExport : []);

    if (!media?.length) {
      return { 
        movies: ["Invalid Input"], 
        shows: ["Invalid Input"], 
        notProcessed: [{ name: "Invalid Input", id: "N/A" }] 
      };
    }

    const movies = [];
    const shows = [];
    const notProcessed = [];
    
    media.forEach(item => {
      const data = item.d ?? item;
      if (typeof data !== 'object' || data === null) return;

      const isMovie = data.type === 'movie';
      const isShow = data.type === 'tv' || data.type === 'series';
      
      const imdb = data._id?.match(/tt\d+/)?.[0] ?? data.poster?.match(/tt\d+/)?.[0];
      const tmdbRaw = data._id?.match(/(?:tmdb:|ctmdb\.)(\d+)/)?.[1];
      
      if ((isMovie || isShow) && (imdb || tmdbRaw)) {
        const entry = { title: data.name ?? "Unknown" };
        if (imdb) entry.imdb = imdb;
        if (tmdbRaw) entry.tmdb = tmdbRaw;
        
        isMovie ? movies.push(entry) : isShow ? shows.push(entry) : null;
      } else {
        notProcessed.push({ name: data.name ?? "Unknown", id: data._id ?? "N/A" });
      }
    });
    
    return { 
      movies: movies.length ? movies : ["Invalid Input"], 
      shows: shows.length ? shows : ["Invalid Input"],
      notProcessed: notProcessed.length ? notProcessed : [{ name: "Invalid Input", id: "N/A" }]
    };
  }
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response(getHtml(), { headers: { 'Content-Type': 'text/html' } });

    if (url.pathname === '/process' && request.method === 'POST') {
      const stremioExport = await request.json();
      return new Response(JSON.stringify(Parser.process(stremioExport)), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/mdblist' && request.method === 'POST') {
      const apiKey = url.searchParams.get('apikey');
      const mdbPayload = await request.text();
      const mdbResponse = await fetch(`https://api.mdblist.com/watchlist/items/add?apikey=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: mdbPayload
      });
      const data = await mdbResponse.text();
      return new Response(JSON.stringify({ status: mdbResponse.status, body: data }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  }
};

function getHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Add Stremio Library to MDB</title>
    <style>
        body { font-family: ui-sans-serif, system-ui; background: #f8fafc; padding: 20px; color: #1e293b; }
        .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 900px; margin: auto; border: 1px solid #e2e8f0; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
        .tab-btn { padding: 10px 20px; cursor: pointer; border: 1px solid #cbd5e1; background: white; border-radius: 6px; }
        .tab-btn.active { background: #334155; color: white; border-color: #334155; }
        .arrow { font-size: 24px; color: #64748b; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        textarea { width: 100%; height: 200px; font-family: monospace; font-size: 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; margin-top: 5px; }
        .btn { padding: 10px 16px; cursor: pointer; border-radius: 6px; border: none; font-weight: 600; color: white; }
        .btn-green { background: #16a34a; }
        .btn-blue { background: #2563eb; }
        .btn:disabled { background: #94a3b8; }
        h3 { font-size: 11px; text-transform: uppercase; color: #64748b; margin: 20px 0 8px 0; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Add Stremio Library to MDB</h2>
        <div class="tabs">
            <button class="tab-btn active" onclick="showTab(event, 'stremio')">Stremio Library</button>
            <div class="arrow">&rArr;</div>
            <button class="tab-btn" onclick="showTab(event, 'mdb')">MDB Watchlist</button>
        </div>

        <div id="stremio" class="tab-content active">
            <input type="file" id="fileInput">
            <button class="btn btn-green" id="processBtn">Upload Stremio Json</button>
            <h3>Parsed movies and shows to add to MDB. Review then enter your API Key on the MDB Watchlist tab</h3>
            <textarea id="mdbListJson"></textarea>
            <h3>Missing or invalid TMDB/IMDB ID</h3>
            <textarea id="notProcessed" readonly></textarea>
        </div>

        <div id="mdb" class="tab-content">
            <input type="password" id="apiKey" placeholder="MDBList API Key" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; width: 100%; box-sizing:border-box;">
            <button class="btn btn-blue" id="syncBtn" style="margin-top:10px; width:100%">Add to MDB Watchlist</button>
            <div id="progress" style="margin-top:10px; font-weight:bold;"></div>
            <div id="results" style="display:none">
                <h3>MDB Status Code</h3>
                <div id="statusCode" style="font-weight:bold; margin-bottom: 20px;"></div>
                <h3>Response</h3>
                <textarea id="mdbResponse" readonly></textarea>
            </div>
        </div>
    </div>
    <script>
        function showTab(evt, tab) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tab).classList.add('active');
            evt.currentTarget.classList.add('active');
        }
        document.getElementById('processBtn').onclick = async () => {
            const file = document.getElementById('fileInput').files[0];
            if(!file) return alert("Select a file first");
            const text = await file.text();
            const res = await fetch('/process', { method: 'POST', body: text });
            const data = await res.json();
            document.getElementById('mdbListJson').value = JSON.stringify({ movies: data.movies, shows: data.shows }, null, 2);
            document.getElementById('notProcessed').value = JSON.stringify(data.notProcessed, null, 2);
        };
        document.getElementById('syncBtn').onclick = async () => {
            const btn = document.getElementById('syncBtn');
            const prog = document.getElementById('progress');
            const resDiv = document.getElementById('results');
            btn.disabled = true;
            prog.innerText = "Waiting for MDB...";
            const res = await fetch('/mdblist?apikey=' + document.getElementById('apiKey').value, { 
                method: 'POST', 
                body: document.getElementById('mdbListJson').value 
            });
            const data = await res.json();
            prog.innerText = "";
            resDiv.style.display = 'block';
            document.getElementById('statusCode').innerText = data.status;
            let bodyText = data.body;
            try { bodyText = JSON.stringify(JSON.parse(data.body), null, 2); } catch(e) {}
            document.getElementById('mdbResponse').value = bodyText;
            btn.disabled = false;
        };
    </script>
</body>
</html>`;
}