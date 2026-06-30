# modules/

All feature functionality lives here as a vertical slice:
`modules/<name>/<name>.{types,repository,service,routes,validation}.ts`
plus an `index.ts` barrel. See `modules/stations` for the reference
structure.

Implemented: stations, media, playlists, podcasts, settings.

Not yet built (added when their functionality is actually migrated, not
before): news, live, users, auth, automation.
