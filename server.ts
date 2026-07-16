/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

function extractAppsScriptError(html: string): string {
  // 1. Try matching class/id errorMessage
  const match = html.match(/<(?:div|span|p|td)[^>]*(?:class|id)=["']?errorMessage["']?[^>]*>([\s\S]*?)<\/(?:div|span|p|td)>/i);
  if (match) {
    return match[1].replace(/<[^>]+>/g, "").trim();
  }
  
  // 2. Alternative: match anything with errorMessage in class/id without strict tags
  const altMatch = html.match(/(?:class|id)=["']?errorMessage["']?[^>]*>([\s\S]*?)<\//i);
  if (altMatch) {
    return altMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // 3. Fallback: clean HTML body to extract error message
  try {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    
    // Remove style and script tags and their content
    let cleaned = bodyContent
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
      
    // Strip all HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, " ");
    
    // Unescape common HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
      
    // Get non-empty lines
    const lines = cleaned
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.includes("body {") && !line.includes(".errorMessage"));
      
    if (lines.length > 0) {
      // Find a line containing common error indicators
      const errorLine = lines.find(l => 
        l.toLowerCase().includes("error") || 
        l.toLowerCase().includes("exception") || 
        l.toLowerCase().includes("gagal") ||
        l.toLowerCase().includes("failed") ||
        l.toLowerCase().includes("cannot read") ||
        l.toLowerCase().includes("not defined") ||
        l.toLowerCase().includes("is not a function")
      );
      if (errorLine) return errorLine;
      
      // Otherwise, return the first non-empty lines joined
      return lines.slice(0, 2).join(" | ");
    }
  } catch (e) {
    // Ignore error in fallback parsing
  }
  
  return "";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON and URL encoded payloads up to 10MB (for bulk transaction syncing)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Sync Proxy GET Endpoint
  app.get("/api/sync-proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      const action = req.query.action as string;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: "Missing 'url' query parameter" });
      }

      // Safe URL parsing & trimming to prevent formatting issues
      const trimmedUrl = targetUrl.trim();
      let finalUrl = trimmedUrl;
      try {
        const urlObj = new URL(trimmedUrl);
        if (action) {
          urlObj.searchParams.set("action", action);
        }
        finalUrl = urlObj.toString();
      } catch (urlErr) {
        console.error("[Proxy GET URL Parse Error]", urlErr);
        return res.status(400).json({ success: false, error: "Format URL yang dimasukkan tidak valid." });
      }

      console.log(`[Proxy GET] Requesting target: ${finalUrl}`);

      // We inject realistic browser headers to bypass Google's automated script/bot detection block
      const response = await fetch(finalUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });

      console.log(`[Proxy GET Response] Status: ${response.status}, Final URL after redirects: ${response.url}`);

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: `Gagal memuat data dari Apps Script (HTTP ${response.status})`
        });
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const trimmedText = text.trim();

      const isRedirectToLogin = 
        response.url.includes("accounts.google.com") || 
        response.url.includes("ServiceLogin") ||
        response.url.includes("signin") ||
        trimmedText.includes("ServiceLogin") || 
        trimmedText.includes("accounts.google.com") || 
        trimmedText.includes("sign-in") || 
        trimmedText.includes("identifierId") ||
        trimmedText.includes("Google Accounts") ||
        trimmedText.includes("Sign in - Google Accounts");

      const isScriptExecutionError = 
        trimmedText.includes("class=\"errorMessage\"") || 
        trimmedText.includes("class='errorMessage'") || 
        trimmedText.includes("class=errorMessage") || 
        trimmedText.includes("errorMessage") ||
        trimmedText.includes("<title>Salah</title>") ||
        trimmedText.includes("<title>Error</title>");

      if (
        contentType.includes("text/html") ||
        trimmedText.startsWith("<!DOCTYPE") ||
        trimmedText.startsWith("<html") ||
        trimmedText.includes("<script") ||
        isRedirectToLogin ||
        isScriptExecutionError
      ) {
        console.warn(`[Proxy GET Warning] Received HTML from target instead of JSON. Final URL: ${response.url}. First 300 chars: ${trimmedText.substring(0, 300)}`);
        
        let customError = "Google Apps Script mengembalikan halaman HTML/Login, bukan data JSON.";
        
        // Detailed analysis of why we got HTML
        if (isRedirectToLogin) {
          customError = "Keamanan Google memblokir akses otomatis (menerima halaman Google Login). Hal ini karena server kami mengakses Web App Anda secara anonim.\n\nMeskipun Anda merasa sudah mengaturnya ke 'Anyone' (Siapa saja), perubahan tersebut BELUM AKTIF di URL /exec Anda.\n\nSOLUSI WAJIB:\n1. Buka editor Google Apps Script Anda.\n2. Klik tombol 'Deploy' (Terapkan) di kanan atas, lalu pilih 'Manage Deployments' (Kelola penerapan).\n3. Klik ikon PENSIL (Edit) pada baris active deployment Anda.\n4. Di dropdown 'Version' (Versi), Anda HARUS/WAJIB memilih 'New version' (Versi baru). (Catatan: Jika Anda tidak memilih 'New version', Google TIDAK akan pernah memperbarui izin akses URL Anda!).\n5. Pastikan 'Execute as' diatur ke 'Me' (Saya) dan 'Who has access' diatur ke 'Anyone' (Siapa saja).\n6. Klik 'Deploy'.";
        } else if (isScriptExecutionError) {
          const errorDetail = extractAppsScriptError(trimmedText);
          
          customError = `Google Apps Script Anda berhasil dihubungi, tetapi mengalami ERROR EKSEKUSI (Runtime Error) di server Google:\n\n❌ ${errorDetail || "Ada masalah eksekusi kode di dalam script Anda."}\n\nSOLUSI TERBAIK:\n1. Buka halaman ini lagi dan salin versi terbaru dari kode Apps Script pada tab "Panduan" (kami telah memperbarui kode agar otomatis membuat spreadsheet baru jika dijalankan secara standalone).\n2. Buka editor Google Apps Script Anda, hapus semua kode lama, lalu tempel kode baru tersebut.\n3. Klik tombol 'Run' (Jalankan) sekali secara manual untuk menyetujui izin Google Sheets di akun Anda.\n4. Simpan dan terapkan ulang (Deploy > Manage Deployments > Edit > Version: New Version > Deploy).`;
        } else if (trimmedText.includes("Authorization Required") || trimmedText.includes("has not been authorized")) {
          customError = "Google memerlukan Otorisasi Izin Akses. Silakan buka editor Apps Script, lalu klik tombol 'Run' (Jalankan) sekali secara manual untuk menyetujui izin Google Sheets di akun Anda.";
        } else if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
          customError = "Anda memasukkan URL Google Sheet, bukan URL Web App Apps Script. Silakan masukkan URL Web App yang berakhiran dengan /exec.";
        } else if (trimmedUrl.includes("/dev")) {
          customError = "Anda menggunakan URL Developer (/dev). URL /dev memerlukan login pemilik akun Google dan tidak bisa diakses oleh aplikasi ini. Silakan deploy sebagai Web App dan gunakan URL berakhiran /exec.";
        }

        return res.status(400).json({
          success: false,
          error: customError
        });
      }

      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Format data yang diterima dari Google Apps Script tidak valid (bukan JSON)."
        });
      }
    } catch (err: any) {
      console.error("[Proxy GET Error]", err);
      return res.status(500).json({ success: false, error: err.message || "Internal server error during proxy fetch" });
    }
  });

  // API Sync Proxy POST Endpoint
  app.post("/api/sync-proxy", async (req, res) => {
    try {
      const { url, payload } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: "Missing 'url' in request body" });
      }

      const trimmedUrl = url.trim();
      let finalUrl = trimmedUrl;
      try {
        const urlObj = new URL(trimmedUrl);
        finalUrl = urlObj.toString();
      } catch (urlErr) {
        console.error("[Proxy POST URL Parse Error]", urlErr);
        return res.status(400).json({ success: false, error: "Format URL yang dimasukkan tidak valid." });
      }

      console.log(`[Proxy POST] Requesting target: ${finalUrl}`);

      const response = await fetch(finalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        body: JSON.stringify(payload),
      });

      console.log(`[Proxy POST Response] Status: ${response.status}, Final URL after redirects: ${response.url}`);

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: `Gagal mengirim data ke Apps Script (HTTP ${response.status})`
        });
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const trimmedText = text.trim();

      const isRedirectToLogin = 
        response.url.includes("accounts.google.com") || 
        response.url.includes("ServiceLogin") ||
        response.url.includes("signin") ||
        trimmedText.includes("ServiceLogin") || 
        trimmedText.includes("accounts.google.com") || 
        trimmedText.includes("sign-in") || 
        trimmedText.includes("identifierId") ||
        trimmedText.includes("Google Accounts") ||
        trimmedText.includes("Sign in - Google Accounts");

      const isScriptExecutionError = 
        trimmedText.includes("class=\"errorMessage\"") || 
        trimmedText.includes("class='errorMessage'") || 
        trimmedText.includes("class=errorMessage") || 
        trimmedText.includes("errorMessage") ||
        trimmedText.includes("<title>Salah</title>") ||
        trimmedText.includes("<title>Error</title>");

      if (
        contentType.includes("text/html") ||
        trimmedText.startsWith("<!DOCTYPE") ||
        trimmedText.startsWith("<html") ||
        trimmedText.includes("<script") ||
        isRedirectToLogin ||
        isScriptExecutionError
      ) {
        console.warn(`[Proxy POST Warning] Received HTML from target instead of JSON. Final URL: ${response.url}. First 300 chars: ${trimmedText.substring(0, 300)}`);
        
        let customError = "Google Apps Script mengembalikan halaman HTML/Login, bukan data JSON.";
        
        if (isRedirectToLogin) {
          customError = "Keamanan Google memblokir akses sinkronisasi (menerima halaman Google Login). Hal ini karena server kami mengakses Web App Anda secara anonim.\n\nMeskipun Anda merasa sudah mengaturnya ke 'Anyone' (Siapa saja), perubahan tersebut BELUM AKTIF di URL /exec Anda.\n\nSOLUSI WAJIB:\n1. Buka editor Google Apps Script Anda.\n2. Klik tombol 'Deploy' (Terapkan) di kanan atas, lalu pilih 'Manage Deployments' (Kelola penerapan).\n3. Klik ikon PENSIL (Edit) pada baris active deployment Anda.\n4. Di dropdown 'Version' (Versi), Anda HARUS/WAJIB memilih 'New version' (Versi baru). (Catatan: Jika Anda tidak memilih 'New version', Google TIDAK akan pernah memperbarui izin akses URL Anda!).\n5. Pastikan 'Execute as' diatur ke 'Me' (Saya) dan 'Who has access' diatur ke 'Anyone' (Siapa saja).\n6. Klik 'Deploy'.";
        } else if (isScriptExecutionError) {
          const errorDetail = extractAppsScriptError(trimmedText);
          
          customError = `Google Apps Script Anda berhasil dihubungi, tetapi mengalami ERROR EKSEKUSI (Runtime Error) di server Google:\n\n❌ ${errorDetail || "Ada masalah eksekusi kode di dalam script Anda."}\n\nSOLUSI TERBAIK:\n1. Buka halaman ini lagi dan salin versi terbaru dari kode Apps Script pada tab "Panduan" (kami telah memperbarui kode agar otomatis membuat spreadsheet baru jika dijalankan secara standalone).\n2. Buka editor Google Apps Script Anda, hapus semua kode lama, lalu tempel kode baru tersebut.\n3. Klik tombol 'Run' (Jalankan) sekali secara manual untuk menyetujui izin Google Sheets di akun Anda.\n4. Simpan dan terapkan ulang (Deploy > Manage Deployments > Edit > Version: New Version > Deploy).`;
        } else if (trimmedText.includes("Authorization Required") || trimmedText.includes("has not been authorized")) {
          customError = "Google memerlukan Otorisasi Izin Akses. Silakan buka editor Apps Script, lalu klik tombol 'Run' (Jalankan) sekali secara manual untuk menyetujui izin Google Sheets di akun Anda.";
        } else if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
          customError = "Anda memasukkan URL Google Sheet, bukan URL Web App Apps Script. Silakan masukkan URL Web App yang berakhiran dengan /exec.";
        } else if (trimmedUrl.includes("/dev")) {
          customError = "Anda menggunakan URL Developer (/dev). URL /dev memerlukan login pemilik akun Google dan tidak didukung. Silakan gunakan URL berakhiran /exec.";
        }

        return res.status(400).json({
          success: false,
          error: customError
        });
      }

      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
        return res.status(400).json({
          success: false,
          error: "Format data yang diterima dari Google Apps Script tidak valid (bukan JSON)."
        });
      }
    } catch (err: any) {
      console.error("[Proxy POST Error]", err);
      return res.status(500).json({ success: false, error: err.message || "Internal server error during proxy post" });
    }
  });

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
