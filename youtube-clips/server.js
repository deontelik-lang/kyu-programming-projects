"use strict";
const express = require("express");
const multer = require("multer");
const ffmpegPath = require("ffmpeg-static");
const archiver = require("archiver");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const APP_DIR = __dirname;
const PARENT_DIR = path.resolve(APP_DIR, "..");
const TEMP_DIR = "/tmp/clipforge";
const UPLOAD_DIR = path.join(TEMP_DIR, "uploads");
const OUTPUT_DIR = path.join(TEMP_DIR, "outputs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const jobs = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(function(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.get("/health", function(req, res) {
  res.json({ ok: true, app: "ClipForge", ffmpeg: Boolean(ffmpegPath), youtubeSource: true });
});
app.get(["/clips", "/clips/"], function(req, res) {
  res.sendFile(path.join(APP_DIR, "index.html"));
});
app.get("/", function(req, res) {
  const existingPage = path.join(PARENT_DIR, "index.html");
  if (fs.existsSync(existingPage)) return res.sendFile(existingPage);
  return res.redirect("/clips");
});
app.get("/api/download/:jobId", function(req, res) {
  const id = req.params.jobId;
  if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).send("Invalid download link.");
  const job = jobs.get(id);
  if (!job || !fs.existsSync(job.zipPath)) return res.status(404).send("This clip pack has expired. Please generate it again.");
  res.download(job.zipPath, "clipforge-" + job.count + "-clips.zip");
});
const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 8);
    cb(null, crypto.randomBytes(16).toString("hex") + (ext || ".video"));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: function(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".mp4", ".mov", ".webm", ".mkv", ".m4v"];
    if (!allowed.includes(ext)) return cb(new Error("Please upload an MP4, MOV, WEBM, MKV or M4V file."));
    cb(null, true);
  }
});
function runFfmpeg(args, timeout) {
  return new Promise(function(resolve, reject) {
    execFile(ffmpegPath, args, { timeout: timeout || 240000, maxBuffer: 2 * 1024 * 1024 }, function(err, stdout, stderr) {
      if (err) {
        const detail = String(stderr || err.message || "").slice(-1400);
        return reject(new Error(detail || "FFmpeg couldn't read this video. Try exporting it as MP4."));
      }
      resolve({ stdout, stderr });
    });
  });
}
function runYtDlp(args) {
  return new Promise(function(resolve, reject) {
    execFile("python3", ["-m", "yt_dlp"].concat(args), { timeout: 180000, maxBuffer: 2 * 1024 * 1024 }, function(err, stdout, stderr) {
      if (err) {
        const msg = String(stderr || err.message || "");
        if (/Sign in to confirm|age-restricted|private video|Video unavailable|HTTP Error 403|not available/i.test(msg)) {
          return reject(new Error("This video cannot be accessed by the server. Try a public video you own or export your video from YouTube Studio and upload the file."));
        }
        if (/max-filesize|larger than/i.test(msg)) return reject(new Error("The source video exceeds the 150 MB processing limit. Upload a shorter or smaller authorized video file."));
        return reject(new Error("Couldn't fetch this YouTube video. It may be private, restricted, blocked, or temporarily unavailable. Try uploading your original video file instead."));
      }
      resolve({ stdout, stderr });
    });
  });
}
function zipFiles(entries, zipPath) {
  return new Promise(function(resolve, reject) {
    const out = fs.createWriteStream(zipPath);
    const zip = archiver("zip", { zlib: { level: 3 } });
    out.on("close", resolve);
    out.on("error", reject);
    zip.on("error", reject);
    zip.pipe(out);
    entries.forEach(function(item) { zip.file(item.path, { name: item.name }); });
    zip.finalize().catch(reject);
  });
}
function validateSettings(body) {
  const start = Number(body.start);
  const duration = Number(body.duration);
  const count = Number(body.count);
  const ratio = String(body.ratio || "vertical");
  if (!Number.isFinite(start) || start < 0 || start > 7200 ||
      ![15, 30, 45, 60].includes(duration) || !Number.isInteger(count) || count < 1 || count > 5 ||
      start + duration * count > 7200 || !["vertical", "square", "landscape"].includes(ratio)) {
    throw new Error("Please check the start time and clip settings.");
  }
  return { start, duration, count, ratio };
}
async function renderClipPack(filePath, settings, cleanupPaths) {
  const id = crypto.randomBytes(16).toString("hex");
  const entries = [];
  const dimensions = settings.ratio === "vertical" ? "720:1280" : (settings.ratio === "square" ? "1080:1080" : "1280:720");
  const filter = "scale=" + dimensions + ":force_original_aspect_ratio=increase,crop=" + dimensions;
  try {
    for (let i = 0; i < settings.count; i++) {
      const outPath = path.join(OUTPUT_DIR, id + "-clip-" + String(i + 1).padStart(2, "0") + ".mp4");
      const at = settings.start + i * settings.duration;
      const args = ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(at), "-i", filePath,
        "-t", String(settings.duration), "-vf", filter, "-c:v", "libx264", "-preset", "ultrafast",
        "-crf", "25", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-max_muxing_queue_size", "512", outPath];
      await runFfmpeg(args);
      const stat = fs.statSync(outPath);
      if (!stat.size) throw new Error("A clip was empty. Check the start point and source video length.");
      entries.push({ path: outPath, name: "ClipForge-clip-" + String(i + 1).padStart(2, "0") + ".mp4" });
    }
    const zipPath = path.join(OUTPUT_DIR, id + ".zip");
    await zipFiles(entries, zipPath);
    jobs.set(id, { zipPath, count: settings.count, createdAt: Date.now(), files: entries.map(function(x){return x.path;}) });
    setTimeout(function() {
      const job = jobs.get(id);
      if (job) {
        jobs.delete(id);
        fs.rm(job.zipPath, { force: true }, function(){});
        job.files.forEach(function(p){ fs.rm(p, { force: true }, function(){}); });
      }
      cleanupPaths.forEach(function(p){ fs.rm(p, { force: true }, function(){}); });
    }, 30 * 60 * 1000).unref();
    return { ok: true, count: settings.count, downloadUrl: "/api/download/" + id };
  } catch (error) {
    entries.forEach(function(item){ fs.rm(item.path, { force: true }, function(){}); });
    cleanupPaths.forEach(function(p){ fs.rm(p, { force: true }, function(){}); });
    throw error;
  }
}
app.post("/api/generate", function(req, res, next) {
  upload.single("video")(req, res, function(err) {
    if (err) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ ok: false, error: err.message || "Upload failed." });
    }
    next();
  });
}, async function(req, res) {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: "Choose a video file or paste a YouTube link." });
  let settings;
  try { settings = validateSettings(req.body); }
  catch (e) { fs.rm(file.path, { force: true }, function(){}); return res.status(400).json({ ok: false, error: e.message }); }
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    fs.rm(file.path, { force: true }, function(){});
    return res.status(503).json({ ok: false, error: "The video processor isn't available on this server yet." });
  }
  try {
    const result = await renderClipPack(file.path, settings, [file.path]);
    return res.json(result);
  } catch (error) {
    const message = String(error && error.message || "Video processing failed.");
    console.error("Clip render failed:", message.slice(-1000));
    const friendly = message.includes("Invalid data") || message.includes("moov atom not found")
      ? "This file could not be read as a video. Try exporting or converting it to MP4 first."
      : (message.includes("timed out") ? "This clip took too long to render on the free server. Try a shorter or smaller source video." : "Could not render the clip batch. Try a shorter MP4 or move the start time earlier.");
    return res.status(422).json({ ok: false, error: friendly });
  }
});
async function lumiRequest(url, options) {
  const key = process.env.LUMICLIP_API_KEY;
  if (!key) {
    const e = new Error("ClipForge needs its LumiClip API key before AI clipping can run. Add LUMICLIP_API_KEY to the BasicDeploy container environment, then restart the app.");
    e.statusCode = 503;
    throw e;
  }
  const controller = new AbortController();
  const timer = setTimeout(function(){controller.abort();}, 25000);
  try {
    const response = await fetch(url, {
      method: (options && options.method) || "GET",
      headers: Object.assign({ "Authorization": "Bearer " + key, "Accept": "application/json" }, options && options.headers || {}),
      body: options && options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
    if (!response.ok) {
      console.error("LumiClip API error:", response.status, JSON.stringify(data).slice(0, 500));
      const err = new Error(response.status === 401 || response.status === 403
        ? "The LumiClip API key was rejected. Check the key in BasicDeploy environment settings."
        : (response.status === 429 ? "LumiClip has rate-limited this request or the available credits are exhausted. Check your LumiClip account usage."
        : "LumiClip could not start or retrieve this job. Please try again shortly."));
      err.statusCode = response.status === 429 ? 429 : 502;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
app.post("/api/generate-youtube", async function(req, res) {
  const rawUrl = String((req.body && req.body.url) || "").trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch (e) { return res.status(400).json({ ok: false, error: "Paste a valid YouTube video link." }); }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (!["https:", "http:"].includes(parsed.protocol) || !["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
    return res.status(400).json({ ok: false, error: "For safety, this source field accepts YouTube links only." });
  }
  const videoId = host === "youtu.be" ? parsed.pathname.split("/").filter(Boolean)[0] : (parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).slice(-1)[0]);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return res.status(400).json({ ok: false, error: "Paste a direct link to one YouTube video, not a playlist or channel." });
  if (req.body && req.body.rightsConfirmed !== true) return res.status(400).json({ ok: false, error: "Please confirm you own this video or have permission to process it." });
  const start = Number(req.body.start);
  const duration = Number(req.body.duration);
  const count = Number(req.body.count);
  if (!Number.isFinite(start) || start < 0 || start > 7200 || ![15,30,45,60].includes(duration) || !Number.isInteger(count) || count < 1 || count > 5) {
    return res.status(400).json({ ok: false, error: "Please check your start time and clip settings." });
  }
  if (!process.env.LUMICLIP_API_KEY) {
    return res.status(503).json({ ok: false, error: "AI clipping is integrated, but it needs your LumiClip API key. Add LUMICLIP_API_KEY in BasicDeploy container environment settings, then restart the app." });
  }
  try {
    const payload = { url: "https://www.youtube.com/watch?v=" + videoId };
    if (start > 0) payload.start_time = start;
    payload.end_time = start + duration * count;
    const data = await lumiRequest("https://api.lumiclip.ai/api/v1/clips/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const projectId = data.project_id || data.id;
    if (!projectId || !/^[A-Za-z0-9_-]{8,100}$/.test(String(projectId))) {
      console.error("Unexpected LumiClip response:", JSON.stringify(data).slice(0, 800));
      return res.status(502).json({ ok: false, error: "The AI clipping service returned an unexpected response. Please try again." });
    }
    return res.status(202).json({ ok: true, provider: "lumiclip", projectId, status: data.status || "processing", message: data.message || "AI is finding highlights, reframing clips and adding captions." });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ ok: false, error: error.message || "Could not start AI clip generation." });
  }
});
app.get("/api/lumiclip/projects/:projectId", async function(req, res) {
  const id = String(req.params.projectId || "");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return res.status(400).json({ ok: false, error: "Invalid project ID." });
  try {
    const data = await lumiRequest("https://api.lumiclip.ai/api/v1/projects/" + encodeURIComponent(id));
    const clips = Array.isArray(data.clips) ? data.clips.map(function(c) {
      return {
        id: c.id,
        title: c.title || "AI clip",
        duration: c.duration,
        score: c.score,
        reason: c.reason,
        thumbnail_url: c.thumbnail_url,
        download_url: c.download_url || c.video_url || null,
        clip_status: c.clip_status || c.status || "processing"
      };
    }) : [];
    return res.json({ ok: true, id: data.id || id, status: data.status || "processing", step: data.step || "", message: data.message || "", clips });
  } catch (error) {
    return res.status(error.statusCode || 502).json({ ok: false, error: error.message || "Couldn't check AI clipping progress." });
  }
});
app.use(function(err, req, res, next) {
  console.error("Request error:", String(err && err.message || err).slice(0, 500));
  if (res.headersSent) return next(err);
  const isUploadSize = err && err.code === "LIMIT_FILE_SIZE";
  res.status(isUploadSize ? 413 : 400).json({ ok: false, error: isUploadSize ? "Video is too large. The maximum upload size is 150 MB." : (err.message || "Request failed.") });
});
app.listen(PORT, "0.0.0.0", function() {
  console.log("ClipForge listening on 0.0.0.0:" + PORT);
});
