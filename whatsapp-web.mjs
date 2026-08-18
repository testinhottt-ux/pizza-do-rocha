// whatsapp-web.mjs — WhatsApp real via Baileys (pareado com o celular do dono)
// O aparelho configurado na área administrativa é usado como "conta de envio".
// Pareamento por CÓDIGO (camada compatível com WhatsApp Web):
//   1) Dono informa o número do celular dele no admin → gera um código.
//   2) No celular: WhatsApp → Aparelhos conectados → Conectar aparelho → digite o código.
//   3) A sessão fica persistida em wa-session/ e reconecta sozinha no boot.
// Dependências: @whiskeysockets/baileys (npm).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, 'wa-session');
const HIST_FILE = path.join(__dirname, 'LOGS', 'mensagens-enviadas.json');
const HIST_MAX = 500;          // mantém o arquivo enxuto

let sock = null;
let sessionReady = false;
let connected = false;
let ownerJid = null;
let lastPairCode = null;
let lastError = null;
let connectPromise = null;
let reconnectTimer = null;
let pausarReconexao = false;   // true durante o pareamento: NÃO reconectar sozinho
let qrAtual = null;            // QR string do pareamento (para exibir na tela)

function log(msg, data = {}) {
  console.log(`[${new Date().toISOString()}] [WHATSAPP-WEB] ${msg}`,
    Object.keys(data).length ? JSON.stringify(data) : '');
}

// ── Histórico de mensagens enviadas (para o painel do dono ver o que saiu) ──
function lerHistorico() {
  try {
    const arr = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function registrarHistorico(entry) {
  try {
    const lista = lerHistorico();
    lista.push(entry);
    const corte = lista.slice(-HIST_MAX);
    fs.mkdirSync(path.dirname(HIST_FILE), { recursive: true });
    fs.writeFileSync(HIST_FILE, JSON.stringify(corte, null, 2));
  } catch (e) { log('WARN', 'Falha ao salvar histórico de mensagem', { error: e.message }); }
}
// Retorna as mensagens mais recentes primeiro.
export function getHistoricoMensagens(limite = 100) {
  const lista = lerHistorico();
  return lista.slice(-limite).reverse();
}

function limparNumero(n) {
  let d = String(n || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('55')) d = '55' + d;
  return d;
}

function numeroParaJid(numero) {
  const d = limparNumero(numero);
  return d ? d + '@s.whatsapp.net' : null;
}

// Resolve o JID real registrado no WhatsApp consultando o servidor (resolve variação do 9º dígito no Brasil)
async function resolverJid(numero) {
  const d = limparNumero(numero);
  if (!d) return null;
  const jidPadrao = d + '@s.whatsapp.net';
  if (sock && sessionReady) {
    try {
      const variantes = [jidPadrao];
      if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
        const ddd = d.slice(2, 4);
        const resto = d.slice(4);
        if (d.length === 13 && resto.startsWith('9')) {
          variantes.push('55' + ddd + resto.slice(1) + '@s.whatsapp.net'); // remove o 9 (ex: 553191867625)
        } else if (d.length === 12) {
          variantes.push('55' + ddd + '9' + resto + '@s.whatsapp.net'); // adiciona o 9 (ex: 5531991867625)
        }
      }
      for (const v of variantes) {
        const res = await sock.onWhatsApp(v);
        if (Array.isArray(res) && res.length > 0 && res[0]?.exists && res[0]?.jid) {
          log('DEBUG', 'JID resolvido com sucesso via onWhatsApp', { original: numero, jid: res[0].jid });
          return res[0].jid;
        }
      }
    } catch (err) {
      log('WARN', 'Falha ao consultar onWhatsApp, usando fallback padrão', { error: err.message });
    }
  }
  return jidPadrao;
}

function formatarCode(raw) {
  const s = String(raw || '').replace(/\s+/g, '').replace(/-/g, '');
  if (!s) return null;
  return s;
}

async function conectar() {
  if (connectPromise) return connectPromise;
  if (sock) return sock;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  connectPromise = (async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      if (state.creds?.me && state.creds.registered !== true) {
        state.creds.registered = true;
      }
      if (state.creds?.me?.id) {
        ownerJid = state.creds.me.id.split(':')[0] + '@s.whatsapp.net';
      }
      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        qrTimeout: 180000, // 3 minutos
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 60000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      sock.ev.on('creds.update', (creds) => {
        if (creds?.me) {
          creds.registered = true;
          ownerJid = creds.me.id.split(':')[0] + '@s.whatsapp.net';
        }
        log('DEBUG', 'Credenciais atualizadas pelo WhatsApp', { registered: creds?.registered, me: !!creds?.me });
        saveCreds(creds);
      });
      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;
        if (qr) {
          qrAtual = qr;
          lastError = null;
          log('INFO', 'Novo QR Code gerado pelo WhatsApp:');
          try { qrcodeTerminal.generate(qr, { small: true }); } catch {}
        }
        if (isNewLogin) log('INFO', 'Novo login autorizado no WhatsApp!');
        if (connection === 'connecting') {
          log('INFO', 'Conectando ao WebSocket do WhatsApp...');
        } else if (connection === 'open') {
          sessionReady = true; connected = true; lastError = null; qrAtual = null;
          pausarReconexao = false;
          ownerJid = sock?.user?.id?.split(':')[0]
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
            : ownerJid;
          log('INFO', '✅ CONEXÃO ESTABELECIDA E DISPOSITIVO PAREADO!', ownerJid ? { user: ownerJid } : {});
        } else if (connection === 'close') {
          sessionReady = false; connected = false;
          const status = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.lastServerStatusCode || 500;
          lastError = lastDisconnect?.error?.message || 'Conexão fechada';
          log('WARN', 'Conexão fechada', { error: lastError, status, pausarReconexao });
          sock = null; connectPromise = null;
          if (status === 515) {
            log('INFO', '🔄 Stream restart (515) recebido do WhatsApp. Concluindo pareamento e reconectando imediatamente...');
            reconnectTimer = setTimeout(conectar, 800);
          } else {
            // Reconecta automaticamente preservando a sessão salva (nunca apaga creds sem ação do usuário)
            const delay = (status === 401 || status === 403) ? 8000 : 3000;
            reconnectTimer = setTimeout(conectar, delay);
          }
        }
      });
      return sock;
    } catch (err) {
      lastError = err.message;
      log('ERROR', 'Falha ao conectar', { error: err.message });
      sock = null; connectPromise = null;
      throw err;
    }
  })();
  return connectPromise;
}

export function iniciarBackground() { conectar().catch(() => {}); }

// Prepara o fluxo de QR para o pareamento, de forma IDEMPOTENTE.
export function prepararQr() {
  if (ownerJid) return;                 // já pareado
  if (sock || connectPromise || lastPairCode) return;   // conexão/QR já em andamento — não mexer
  conectar().catch(() => {});
}

export function getStatus() {
  let savedPhone = null;
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf8'));
    if (creds?.me?.id) savedPhone = creds.me.id.split(':')[0].replace(/\D/g, '');
  } catch {}
  const phone = ownerJid ? ownerJid.split('@')[0] : savedPhone;
  return {
    ativo: !!sock && sessionReady,
    pareado: Boolean(phone),
    ownerPhone: phone,
    pairCode: lastPairCode,
    error: lastError ? String(lastError) : null,
    chave: Boolean(phone),
    qr: qrAtual,
  };
}

// Solicita um código de pareamento (o dono digita no celular dele).
// Uma sessão com registered:false é lixo de um pareamento que nunca foi concluído.
// Ela faz o WhatsApp derrubar a conexão, então precisa ser descartada antes de tentar de novo.
function sessaoIncompleta() {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf8'));
    return creds.registered !== true;
  } catch { return false; }
}

export function limparSessao() {
  try { sock?.end?.(new Error('reset')); } catch {}
  sock = null; connectPromise = null; sessionReady = false; connected = false; ownerJid = null;
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR + '.bak', { recursive: true, force: true });
      fs.renameSync(SESSION_DIR, SESSION_DIR + '.bak');  // guarda a anterior por segurança
    }
  } catch (e) { log('WARN', 'Falha ao limpar sessão', { error: e.message }); }
  log('INFO', 'Sessão do WhatsApp reiniciada');
}

// O WebSocket precisa estar aberto antes de pedir o código, senão vem "Connection Closed".
function esperarSocketAberto(timeoutMs = 20000) {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    (function checar() {
      const estado = sock?.ws?.socket?.readyState ?? sock?.ws?.readyState;
      if (estado === 1 || estado === 'open') return resolve(true);
      if (Date.now() - inicio > timeoutMs) return reject(new Error('Tempo esgotado ao abrir conexão com o WhatsApp'));
      setTimeout(checar, 250);
    })();
  });
}

export async function gerarCodigoPareamento(cellphone) {
  const raw = String(cellphone || '').replace(/\D/g, '');
  if (raw.length < 10 || raw.length > 15) return { ok: false, error: 'Número inválido (informe DDI 55 + DDD + 9 dígitos)' };
  const cel = limparNumero(raw);

  limparSessao();
  pausarReconexao = true;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      await conectar();
      await esperarSocketAberto();
      await new Promise(r => setTimeout(r, 1500)); // o handshake precisa assentar
      const rawCode = await sock.requestPairingCode(cel);
      lastPairCode = formatarCode(rawCode);
      lastError = null;
      log('INFO', 'Código de pareamento gerado', { phone: cel, tentativa });
      return { ok: true, code: lastPairCode, phone: cel };
    } catch (err) {
      lastError = err.message;
      log('WARN', 'Falha ao gerar código', { tentativa, error: err.message });
      if (tentativa === 3) return { ok: false, error: err.message };
      await new Promise(r => setTimeout(r, 1000 * tentativa)); // backoff
    }
  }
  return { ok: false, error: lastError || 'Falha desconhecida' };
}

// Envia uma mensagem de texto para qualquer número (comprador ou dono).
// tag: rótulo opcional p/ o histórico (ex.: 'novo-pedido', 'pagamento', 'status').
export async function enviarMensagem(numero, texto, tag = '') {
  if (!ownerJid) {
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf8'));
      if (creds?.me?.id) ownerJid = creds.me.id.split(':')[0] + '@s.whatsapp.net';
    } catch {}
  }
  if (!ownerJid) {
    const e = new Error('WhatsApp não pareado. Pare o aparelho do dono no painel.');
    e.code = 'NOT_PAIRED';
    throw e;
  }
  if (!sock || !sessionReady) {
    await conectar();
    await esperarSocketAberto(8000).catch(() => {});
  }
  if (!sock) {
    const e = new Error('Conexão com WhatsApp indisponível no momento.');
    e.code = 'NOT_CONNECTED';
    throw e;
  }
  const jid = await resolverJid(numero);
  if (!jid) throw new Error('Número inválido');
  await sock.sendMessage(jid, { text: String(texto) });
  log('INFO', 'Mensagem enviada', { to: numero, jid, len: String(texto).length });
  registrarHistorico({
    ts: Date.now(),
    para: limparNumero(numero),
    texto: String(texto),
    tag: String(tag || ''),
    status: 'enviada',
    erro: null,
  });
  return { ok: true, to: numero };
}

// Envia mensagem e, se ainda não pareado ou sem conexão ativa, retorna { notPaired: true } sem lançar.
export async function enviarSeguro(numero, texto, tag = '') {
  try { return await enviarMensagem(numero, texto, tag); }
  catch (err) {
    const isNotPaired = err.code === 'NOT_PAIRED' || err.code === 'NOT_CONNECTED' || !sessionReady || !sock;
    registrarHistorico({
      ts: Date.now(),
      para: limparNumero(numero),
      texto: String(texto),
      tag: String(tag || ''),
      status: isNotPaired ? 'nao-pareado' : 'falhou',
      erro: err.message,
    });
    return { ok: false, notPaired: isNotPaired, error: err.message };
  }
}

export function getPairCode() { return lastPairCode; }