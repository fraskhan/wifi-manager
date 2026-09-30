import { Router } from 'express';
import crypto from 'node:crypto';
import config from '../config.js';
import { query } from '../db.js';
import { createSession } from '../services/networkService.js';

const router = Router();

/**
 * openNDS Forwarding Authentication Service (FAS) endpoint.
 *
 * OpenWrt config (conceptually):
 *   uci set opennds.faskey="<OPENNDS_FAS_KEY>"
 *   uci set opennds.fas_secure_enabled='1'
 *   uci set opennds.fasport='443'
 *   uci set opennds.fasremoteip='<your-server-ip>'
 *   uci set opennds.faspath='/api/fas'
 *   uci set opennds.fasurl='https://api.yourdomain.com/api/fas'
 *
 * Flow: client joins Wi-Fi -> openNDS holds them captive -> redirects the
 * client's browser to this endpoint -> we register a pending session and
 * bounce the browser to the portal page. After the customer logs in and has
 * an ACTIVE subscription, the portal calls /api/network/connect-session and
 * then redirects the device back to the gateway auth URL built here.
 */

function fasCryptoKey() {
  // openNDS encrypts with AES-256-CBC; derive the 32-byte key from faskey.
  return crypto.createHash('sha256').update(config.openndsFasKey).digest();
}

function decryptFas(fasB64, ivB64) {
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(fasB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', fasCryptoKey(), iv);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return Object.fromEntries(new URLSearchParams(plain));
}

function encryptForTest(params, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(new URLSearchParams(params).toString()), cipher.final()]);
}

/** Build the URL that releases the device back through the gateway. */
export function buildGatewayAuthUrl(payload) {
  const addr = payload.gatewayaddress;
  const authdir = payload.authdir || '/opennds_auth/';
  if (!addr) return null;
  const base = addr.startsWith('http') ? addr : `http://${addr}`;
  const tok = payload.tok || payload.token || '';
  const redir = payload.originurl || payload.redir || '';
  const sep = authdir.includes('?') ? '&' : '?';
  const dir = authdir.endsWith('/') ? authdir : `${authdir}/`;
  return `${base}${dir}${sep}tok=${encodeURIComponent(tok)}&redir=${encodeURIComponent(redir)}`;
}

async function handleFasParams(payload, res) {
  const session = await createSession({
    mac: payload.clientmac || payload.mac || null,
    ip: payload.clientip || payload.ip || null,
    gateway: payload.gatewayname || payload.gatewayaddress || null,
  });
  const authUrl = buildGatewayAuthUrl(payload);
  await query('UPDATE network_sessions SET fas_payload = $2, auth_url = $3 WHERE id = $1', [
    session.id, JSON.stringify(payload), authUrl,
  ]);
  res.redirect(`${config.portalBaseUrl}/portal?session=${session.token}`);
}

router.get('/', async (req, res, next) => {
  try {
    if (req.query.fas && req.query.iv) {
      if (!config.openndsFasKey) throw new Error('OPENNDS_FAS_KEY not configured');
      return await handleFasParams(decryptFas(req.query.fas, req.query.iv), res);
    }
    // fas_secure_enable=0 → plaintext params
    if (Object.keys(req.query).length) return await handleFasParams(req.query, res);
    res.status(400).json({ error: 'Missing openNDS parameters' });
  } catch (e) { next(e); }
});

/** Dev helper: mint a fas+iv pair like openNDS would send (tests our decryption). */
router.get('/test-vector', (req, res, next) => {
  try {
    const payload = {
      gatewayaddress: req.query.gatewayaddress || '10.1.0.1:2050',
      gatewayname: 'MyWiFi-Gateway',
      clientip: '10.1.0.123',
      clientmac: 'aa:bb:cc:dd:ee:ff',
      authdir: '/opennds_auth/',
      originurl: 'http://example.com/',
      tok: crypto.randomBytes(8).toString('hex'),
    };
    if (!config.openndsFasKey) {
      return res.json({ mode: 'plaintext', url: `/api/fas?${new URLSearchParams(payload)}` });
    }
    const iv = crypto.randomBytes(16);
    const enc = encryptForTest(payload, fasCryptoKey(), iv);
    const url = `/api/fas?fas=${encodeURIComponent(enc.toString('base64'))}&iv=${encodeURIComponent(iv.toString('base64'))}`;
    res.json({ mode: 'aes-256-cbc', url });
  } catch (e) { next(e); }
});

export default router;
