# ClipForge

A minimal YouTube-video preview and short-clip export app.

## Current features
- YouTube URL validation and embedded preview (does not download/rip YouTube streams).
- Upload an authorized source video (MP4, MOV, WEBM, MKV or M4V, up to 150 MB).
- Batch cut 1–5 consecutive segments, select length/start point and crop to vertical, square or landscape.
- Download generated MP4s in a ZIP; temporary files are removed after about 30 minutes.

## Run
```sh
npm install
PORT=8080 npm start
```

The app binds to `0.0.0.0:8080`. At the root of a BasicDeploy deployment, the existing parent `/app/index.html` is served (if present) and ClipForge is at `/clips`.

## Limitations
This initial version cuts consecutive segments; AI highlight detection, automatic speech-to-text captions and direct YouTube source extraction are not implemented. The upload must be a source file you have the right to edit.
