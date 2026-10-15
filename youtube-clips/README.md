# ClipForge

A BasicDeploy-hosted video clip creator with YouTube preview, authorized YouTube source fetching, and uploaded-file processing.

## Features
- Preview direct YouTube links in an embedded player.
- Where accessible and authorized, paste a YouTube video link and let the server fetch the source for processing.
- Alternatively upload an original video (MP4, MOV, WEBM, MKV or M4V; maximum 150 MB).
- Cut 1–5 consecutive segments of 15, 30, 45 or 60 seconds from a chosen start time.
- Crop clips to vertical (9:16), square (1:1) or landscape (16:9).
- Download generated MP4 clips together in a ZIP archive.
- Temporary processing files and download packs are removed after about 30 minutes.

## Run
```sh
npm install
python3 -m pip install yt-dlp
PORT=8080 npm start
```

The app binds to `0.0.0.0:8080`. On the current BasicDeploy container, the existing project at `/app/index.html` is served at the root and ClipForge is at `/clips`.

## Important limitations
- YouTube source access depends on video availability, regional restrictions, sign-in/age restrictions and YouTube changes. For videos you own, YouTube Studio export then upload is the most reliable fallback.
- Only process videos you own or have permission to download and edit.
- This version cuts consecutive time segments. AI semantic highlight detection, automatic transcription, animated captions and face-aware reframing are not implemented yet.
- Free-container sleep/CPU/memory limits may affect processing time and continuous availability.
