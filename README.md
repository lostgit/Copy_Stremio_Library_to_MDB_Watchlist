# Copy Stremio Library to MDB Watchlist

A simple Cloudflare worker that takes a json export of your Stremio account and copy the media library (movies and shows) to MDB Watchlist.

MDB APIKEY IS NOT SAVED. It is transient per http request only. 

## Input Json File: 
- Stremio library backup from Stremthru Sidekick

- Alternatively, Stremio account export. Note that Stremio export may fail to create clean library entries.

## Output: 
Valid movies and shows from Stremio export are copied to the MDB Watchlist associated with the MDB API key. 