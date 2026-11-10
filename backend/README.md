# Here & Now — GPT backend on your Mac

Your existing **public GitHub Pages frontend** stays on GitHub. The OpenAI API key is **never** deployed to GitHub. This little server runs only on your Mac, and Cloudflare Quick Tunnel gives your phone an HTTPS route to it.

## One-time setup

1. Install **Node.js 22 or later** (Homebrew: `brew install node`) and `cloudflared` (Homebrew: `brew install cloudflared`). You do not have to use Git.
2. Download `setup-mac.sh` from [this repository](https://github.com/Joar-Rinaldo-Roos/skane-green-access/blob/main/backend/setup-mac.sh). Review it, then run `bash ~/Downloads/setup-mac.sh` (adjust the filename if Safari renamed it). This creates `~/HereNowBackend`.
3. Run `openssl rand -hex 24` in Terminal to make a strong random token.
4. Run `open -e ~/HereNowBackend/.env` and replace the example values with:
   - Your own OpenAI project API key from [OpenAI Platform](https://platform.openai.com/api-keys).
   - The random personal access token from step 3. Keep this token separate from your API key.
   - Leave `ALLOWED_ORIGIN` as `https://joar-rinaldo-roos.github.io`.
5. In **Terminal window 1**:
   ```sh
   cd ~/HereNowBackend
   npm start
   ```
   The backend will listen at `http://127.0.0.1:8787` **only on your Mac**.
6. In **Terminal window 2**:
   ```sh
   cloudflared tunnel --url http://localhost:8787
   ```
   Cloudflare prints a random HTTPS URL similar to `https://example.trycloudflare.com`.
7. Open [Here & Now](https://joar-rinaldo-roos.github.io/skane-green-access/) on your phone. Under **Ask Here & Now → Connect to Mac**, enter the **HTTPS tunnel URL** and the random **access token**, not your OpenAI key. Tap **Connect**, then choose **Find me** and ask a question.

**Keep both Terminal windows open and prevent your Mac from sleeping** during testing. Quick Tunnel URLs change when the tunnel is restarted. Copy the new URL into the website if it changes.

## Updates without git pull

Most frontend/UI/content changes continue to publish on GitHub Pages automatically, exactly as before. Your Mac server can stay running unchanged.

If backend code changes, simply download and run the updated `setup-mac.sh` again. It updates `server.mjs` and preserves `~/HereNowBackend/.env`. Restart `npm start` afterward. You don't need a Git clone or git pull.

## Security and costs

- Never add `.env` or any key/token to GitHub, ChatGPT messages, screenshots, JavaScript or the browser's API key field. The website asks only for the **separate random access token**.
- The server listens only on `127.0.0.1`. It allows browser requests only from your GitHub Pages origin, requires the token on every GPT question, limits requests to 30/hour and 80/day, and accepts a small request body. These are abuse controls, **not a guaranteed dollar-spending cap**.
- Cloudflare Quick Tunnels are temporary and public URLs. The token protects requests; anyone who obtains both URL and token can submit paid requests. For longer-term use, use stronger authentication and a named tunnel.
- The frontend saves the tunnel URL in localStorage and the separate access token in the current tab's sessionStorage (so it survives normal page refreshes). Do not use a shared/untrusted browser for this prototype.
- OpenAI Responses API requests set `store:false`. User questions, approximate coordinates and selected data are sent from your phone through the tunnel to your Mac, then to OpenAI. When web search is enabled, OpenAI can retrieve web information. No GPS coordinates are printed to the Mac Terminal by our backend.
- Your ChatGPT Plus subscription is **separate** from OpenAI API billing. Check usage and set project budgets at [OpenAI Platform](https://platform.openai.com/settings/organization/billing/overview). Disable optional web search with `ENABLE_WEB_SEARCH=0` in `.env` to reduce usage costs.

## Troubleshooting

- `npm start` complains about missing key: check `~/HereNowBackend/.env`.
- `cloudflared: command not found`: `brew install cloudflared`.
- Browser says backend unavailable: keep both Terminal windows running, copy the CURRENT `trycloudflare.com` URL, tap **Connect** again.
- Browser says 401: the access token in your phone doesn't match `HERE_NOW_ACCESS_TOKEN` on your Mac.
- Browser says 502: check your Mac Terminal. Your OpenAI API key/project billing or model access might need attention.
- `curl http://127.0.0.1:8787/health` on the Mac should return a small JSON status.

The default model is `gpt-5.4-mini`. Edit `OPENAI_MODEL` in `.env` if your project has access to a different model. Web-search calls may be charged separately.
