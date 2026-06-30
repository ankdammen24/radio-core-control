# modules/

All feature functionality lives here as a vertical slice:
`modules/<name>/<name>.{types,repository,service,routes}.ts` plus an
`index.ts` barrel. See `modules/stations` for the reference implementation —
copy that structure when building the next module.

Planned modules (not yet created — added when their functionality is built,
not before): playlists, media, podcasts, news, live, users, auth, settings,
automation.
