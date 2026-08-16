# ERROR.md — Known Issues & Recovery Strategies

**Projeto**: Pizzaria do Rocha v2.3.1  
**Data**: 2026-08-06  
**Protocol**: AG2 v14.5 — Error tracking + recovery patterns  
**Last Updated**: Production ready

---

## 📋 KNOWN ISSUES

### 🚨 CRITICAL SECURITY ISSUE (NEW - v2.3.2)

#### Issue #0: API Key Exposed in Version Control

**Severity**: 🔴 **CRITICAL**

**Problem**:
- Arquivo `apiassas` contém API key em texto plano
- Arquivo provavelmente no git (histórico acessível)
- API key type: PRODUCTION (`$aact_prod_...`)
- Chave pode estar comprometida

**Location**: `/home/teste/pizza/apiassas`

**Immediate Actions Required**:
1. **REVOKE THIS API KEY IMMEDIATELY**
   ```bash
   # Logar no Asaas dashboard
   # Settings → API Keys → Delete the exposed key
   ```

2. **Generate NEW API KEY**
   - Crie nova chave no Asaas dashboard
   - NÃO commit novamente em arquivo de texto plano

3. **MOVE TO ENVIRONMENT VARIABLES**
   - Criar arquivo `.env` (adicionar ao .gitignore)
   - Importar chave do ambiente em `asaas-config.js`
   ```javascript
   const apiKey = process.env.ASAAS_API_KEY || localStorage.getItem('asaasApiKey');
   ```

4. **IMPLEMENT BACKEND**
   - Criar servidor Node.js/Express
   - Manter API key APENAS no servidor
   - Frontend faz request ao backend
   - Backend valida e passa para Asaas

**Recovery Strategy**:
```javascript
// ❌ NEVER DO THIS (current):
const API_KEY = fs.readFileSync('./apiassas').trim();

// ✅ DO THIS INSTEAD:
const API_KEY = process.env.ASAAS_API_KEY;
if (!API_KEY) {
  console.error('FATAL: ASAAS_API_KEY not set in environment');
  process.exit(1);
}
```

---

### Category: ASAAS INTEGRATION

#### Issue #1: API Key Missing (High Priority)

**Problem**:
- Admin não inseriu API Key na aba Configurações
- User tenta fazer checkout → mensagem "Configure Asaas primeiro"
- Fluxo interrompido

**Error Message**:
```
❌ Admin: Configure Asaas primeiro em ⚙️ Configurações
```

**Root Cause**:
- `AsaasConfig.isConfigured()` retorna false quando `apiKey` vazio

**Current Handling**:
```javascript
if (!asaasConfig.isConfigured) {
  showToast('❌ Admin: Configure Asaas primeiro...');
  return;
}
```

**Recovery Strategy**:
1. **Immediate**: Mostrar modal educativo
   ```javascript
   showEducationalModal('Asaas não configurado', 
     'Admin: clique em ⚙️ Configurações e adicione sua API Key do Asaas');
   ```

2. **Admin UX**: Destacar aba "⚙️ Configurações" com badge 🔴
   ```javascript
   if (!AsaasConfig.isConfigured()) {
     document.getElementById('tabConfiguracoes').style.background = 'rgba(244,67,54,0.2)';
   }
   ```

3. **Fallback**: Permitir checkout sem pagamento online (desativar Asaas)
   - Botão "Pagar na entrega" always available
   - Asaas opcional, não bloqueante

**Prevention**:
- Verificar config na carga da página (init)
- Alert admin se não configurado
- Validar ao salvar (não apenas ao testar)

---

#### Issue #2: Invalid API Key Format (Medium Priority)

**Problem**:
- Admin cola API Key incorreta (p.ex. chave expirada, formato errado)
- Teste de conexão falha
- User fica confuso com erro técnico

**Error Message**:
```
❌ Asaas conectado com sucesso! [AINDA mostra mesmo se falhar]
```

**Root Cause**:
- Em sandbox mode, `validarConexao()` sempre retorna true
- Não faz validação real de API Key
- Confiança falsa

**Current Handling**:
```javascript
if (config.isSandbox) {
  return { valid: true, message: '✅ Conexão OK', status: 'VALID' };
}
```

**Recovery Strategy**:
1. **Short-term** (v2.3.2):
   - Adicionar validação format: API Key deve começar com `$aact_`
   ```javascript
   if (!config.apiKey.startsWith('$aact_')) {
     return { valid: false, message: '❌ API Key inválida (debe começar com $aact_)' };
   }
   ```

2. **Medium-term** (v2.4):
   - Em produção, fazer chamada real: GET /accounts (requer API Key válida)
   - Mock em sandbox, real em production

3. **UX Improvement**:
   - Mostrar link "Obtenha API Key em dashboard.asaas.com"
   - Copiar/colar helper: button "📋 Copiar"

**Prevention**:
- Validar ao salvar, não só ao testar
- Mostrar préview: "API: ***xxxxx" (últimos 5 caracteres)
- Aviso se não passou no teste

---

#### Issue #3: WhatsApp Number Validation (Low Priority)

**Problem**:
- Admin entra WhatsApp com formatação (ex: "(31) 99667-8280")
- Sistema espera apenas números
- Notificação falha silenciosamente

**Error Message**:
```
(Silencioso — WhatsApp não enviado)
```

**Root Cause**:
- Regex não stripa caracteres especiais
- Validação aceita, mas Twilio/Meta API rejeita

**Current Handling**:
```javascript
if (!/^\d{10,15}$/.test(whatsapp)) {
  showToast('❌ WhatsApp deve conter apenas números!');
  return;
}
```

**Recovery Strategy**:
1. **Auto-cleanup**: Strip formatação automaticamente
   ```javascript
   const cleanWhatsapp = whatsapp.replace(/\D/g, '');
   if (cleanWhatsapp.length < 10) {
     showToast('❌ WhatsApp muito curto');
     return;
   }
   ```

2. **Feedback**: Mostrar número limpo no input
   ```javascript
   document.getElementById('whatsappNotif').value = cleanWhatsapp;
   ```

3. **Hint**: "Ex: 31996678280 (11 dígitos, Brasil)"

**Prevention**:
- Input type="tel" + maxlength="15"
- Real-time cleanup as user types
- Display cleaned version

---

### Category: PAYMENT FLOW

#### Issue #4: Payment Modal Stuck (High Priority)

**Problem**:
- User clica "CONFIRMAR PAGAMENTO"
- Modal abre, mas nunca fecha
- User pode estar esperando indefinidamente

**Error Message**:
```
(Modal fica aberto, não responde)
```

**Root Cause**:
- `confirmarPagamentoSim()` pode não disparar callback
- Network timeout em validarConexao()
- Modal não tem timeout automático

**Current Handling**:
```javascript
// Sem timeout automático
// Modal fecha só quando user clica ✅ ou ❌
```

**Recovery Strategy**:
1. **Timeout Automático** (v2.3.2):
   ```javascript
   setTimeout(() => {
     if (document.querySelector('.modal.active')) {
       console.warn('⏰ Modal timeout 30s, force-closing');
       document.querySelector('.modal').remove();
       showToast('⏰ Timeout — tente novamente');
     }
   }, 30000);
   ```

2. **Disabled Button Prevention**:
   ```javascript
   btn.disabled = true;
   setTimeout(() => btn.disabled = false, 500);
   ```

3. **Keyboard Escape**:
   ```javascript
   document.addEventListener('keydown', (e) => {
     if (e.key === 'Escape' && document.querySelector('.modal.active')) {
       document.querySelector('.modal').remove();
     }
   });
   ```

**Prevention**:
- Adicionar cancel button sempre visible
- Timeout visual (progress bar 30s)
- Retry logic após timeout

---

#### Issue #5: Order Number Collision (Low Priority)

**Problem**:
- 2 users simultâneos → mesmo order número (random)
- Confusão em histórico de pedidos

**Error Message**:
```
(Silencioso — pedidos duplicados)
```

**Root Cause**:
```javascript
const numero = Math.floor(Math.random() * 100000);
// Can collide: P(collision) ≈ n²/(2*100000)
```

**Current Handling**:
```javascript
// Nenhum check para duplicação
```

**Recovery Strategy**:
1. **Use Timestamp + Random** (v2.3.2):
   ```javascript
   const numero = parseInt(Date.now().toString().slice(-5)) + Math.floor(Math.random() * 1000);
   // Much lower collision risk
   ```

2. **Deduplicate on Save**:
   ```javascript
   while (orders.find(o => o.numero === numero)) {
     numero++;
   }
   ```

3. **UUID fallback**:
   ```javascript
   const numero = Math.random().toString(36).substring(7).toUpperCase();
   // Quasi-unique, human-readable
   ```

**Prevention**:
- Nunca confiar em random puro
- Sempre verificar duplicação antes de salvar

---

### Category: LOCAL STORAGE

#### Issue #6: Storage Quota Exceeded (Medium Priority)

**Problem**:
- localStorage acumula logs + payments + orders
- Atinge limite (~5MB browser)
- New data não salva, erros silenciosos

**Error Message**:
```
QuotaExceededError: DOM Exception 22
```

**Root Cause**:
- `asaasLogs[]` pode crescer ilimitadamente
- Sem cleanup automático de dados antigos
- Sem monitoring

**Current Handling**:
```javascript
// AUTO-CLEANUP (já implementado em v2.3.1)
if (logs.length > 100) logs.shift(); // Keep last 100
```

**Recovery Strategy**:
1. **Already Implemented**: Auto-rotate logs (max 100)
2. **Monitor** (v2.3.2):
   ```javascript
   function checkStorageUsage() {
     const estimate = navigator.storage?.estimate?.();
     const usage = estimate.usage / estimate.quota;
     if (usage > 0.8) {
       Logger.log('WARN', 'ADMIN', 'Storage usage high: ' + (usage*100).toFixed(1) + '%');
       // Trigger cleanup
       AsaasConfig.clearOldLogs(7 * 24 * 60 * 60 * 1000); // > 7 days
     }
   }
   ```

3. **Export + Archive**:
   ```javascript
   function exportData() {
     const data = {
       config: AsaasConfig.getConfig(),
       payments: AsaasConfig.getPayments(),
       orders: store.getOrders()
     };
     downloadJSON(data, 'pizzaria-backup.json');
   }
   ```

**Prevention**:
- Cleanup agendado (weekly)
- User warning @ 80% quota
- Clear old data on demand

---

#### Issue #7: Corrupted localStorage (Low Priority)

**Problem**:
- Browser storage corrompida (crash, sync issues)
- JSON.parse() falha
- App não inicia

**Error Message**:
```
Uncaught SyntaxError: Unexpected token < in JSON at position 0
```

**Root Cause**:
- localStorage data não-JSON (ex: HTML error page)
- Browser sync issue
- Manual edit de storage

**Current Handling**:
```javascript
try {
  return JSON.parse(stored);
} catch (err) {
  Logger.log('ERROR', 'ADMIN', 'Failed to parse config', { error: err.message });
  return DEFAULT_CONFIG;
}
```

**Recovery Strategy**:
1. **Graceful Fallback**: Return DEFAULT_CONFIG se parse falha ✅
2. **Backup Recovery** (v2.3.2):
   ```javascript
   function recoverStorage() {
     const backup = sessionStorage.getItem('pizzariaBackup');
     if (backup && isValidJSON(backup)) {
       localStorage.setItem(ASAAS_CONFIG_KEY, backup);
       return JSON.parse(backup);
     }
     // Else: use DEFAULT and warn
     Logger.log('WARN', 'ADMIN', 'Storage corrupted, using defaults');
     return DEFAULT_CONFIG;
   }
   ```

3. **Backup Strategy**: SessionStorage mirror
   ```javascript
   // Save copy to sessionStorage (survives page reload)
   sessionStorage.setItem('pizzariaBackup', JSON.stringify(config));
   ```

**Prevention**:
- Validate JSON antes de parse
- Redundant backup in sessionStorage
- Clear cache button for users

---

### Category: WHATSAPP NOTIFICATIONS

#### Issue #8: WhatsApp Send Fails Silently (High Priority)

**Problem**:
- Order criada com sucesso
- WhatsApp não chega ao cliente
- Cliente não recebe confirmação

**Error Message**:
```
(Silencioso — usuário pensa que não foi criado)
```

**Root Cause**:
- Twilio rate limit
- Número inválido
- API key expirada
- Network timeout

**Current Handling**:
```javascript
async enviarWhatsApp(whatsapp, pedido, status) {
  try {
    console.log(`📱 WhatsApp [${whatsapp}]...`);
    return { sent: true };
  } catch (err) {
    Logger.log('WARN', 'WHATSAPP', 'Failed to send', { error: err.message });
    return { sent: false, fallback: 'SMS' };
  }
}
```

**Recovery Strategy**:
1. **Graceful Fallback** (v2.3.2):
   ```javascript
   async notifyClient(clientPhone, message) {
     try {
       return await enviarWhatsApp(clientPhone, message);
     } catch (err1) {
       try {
         console.log('WhatsApp falhou, tentando SMS...');
         return await enviarSMS(clientPhone, message);
       } catch (err2) {
         console.log('SMS falhou, tentando email...');
         return await enviarEmail(clientEmail, message);
       }
     }
   }
   ```

2. **Retry Logic**:
   ```javascript
   async sendWithRetry(send, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await send();
       } catch (err) {
         if (i === maxRetries - 1) throw err;
         await sleep((i + 1) * 1000); // Exponential backoff
       }
     }
   }
   ```

3. **Queue Async** (v2.4):
   - Bull queue para notificações
   - Retry automático 5x
   - DLQ para failures

**Prevention**:
- Validar número antes de enviar
- Testar conexão antes de checkout
- Log cada tentativa (para debug)
- Notificar admin se falhar

---

#### Issue #9: Duplicate WhatsApp Messages (Low Priority)

**Problem**:
- Client recebe mesma mensagem 2-3x
- Webhook retry automático do Asaas
- Confusão

**Error Message**:
```
(Múltiplas mensagens com mesmo orderID)
```

**Root Cause**:
- Webhook deduplication não implementado
- Asaas retenta webhook 3x se timeout
- Sistema processa todas

**Current Handling**:
```javascript
// Deduplication já implementado em WebhookVerifier
isDuplicate(eventId) {
  if (logs[eventId]) return true;
  logs[eventId] = now;
  return false;
}
```

**Recovery Strategy**:
- Já implementado em v2.3.1 ✅

**Prevention**:
- Usar event ID como chave
- 5-min sliding window (TTL)
- Log cada webhook

---

## 🛡️ ERROR RECOVERY PATTERNS

### Pattern #1: Graceful Degradation Chain

```
Primary → Fallback1 → Fallback2 → Safe Default
  ↓         ↓          ↓           ↓
WhatsApp  SMS        Email      Toast + Log
(Twilio)  (Twilio)   (Sendgrid) (No action)
```

**Implementação**:
```javascript
async notifyWithFallback(data) {
  const result = await chain(
    () => sendWhatsApp(data),
    () => sendSMS(data),
    () => sendEmail(data),
    () => ({ success: false, logged: true })
  );
  
  if (!result.success) {
    Logger.log('WARN', 'NOTIFY', 'All channels failed');
  }
  
  return result;
}
```

---

### Pattern #2: Retry with Exponential Backoff

```
Attempt 1  →  fail  →  wait 1s   →  Attempt 2
  ↓             ↓         ↓           ↓
T0          T0 + 0      T0 + 1      T0 + 1

Attempt 2  →  fail  →  wait 2s   →  Attempt 3
  ↓             ↓         ↓           ↓
T0+1       T0+1        T0+3       T0 + 3

Attempt 3  →  fail  →  wait 4s   →  Abort
  ↓             ↓         ↓           ↓
T0+3       T0+3        T0+7       Give up
```

**Implementação**:
```javascript
async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = baseDelay * Math.pow(2, i);
      Logger.log('WARN', 'RETRY', `Attempt ${i+1} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}
```

---

### Pattern #3: Circuit Breaker

```
[CLOSED]  →  request fails 5x  →  [OPEN]
  ↓                                  ↓
Allow all                          Block for 60s
                                     ↓
                              After 60s: [HALF-OPEN]
                                     ↓
                            Try 1 request
                           ↙              ↘
                       success         failure
                           ↓              ↓
                       [CLOSED]        [OPEN]
```

**Implementação** (v2.4):
```javascript
class CircuitBreaker {
  state = 'CLOSED'; // CLOSED | OPEN | HALF-OPEN
  failCount = 0;
  lastFailTime = null;
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > 60000) {
        this.state = 'HALF-OPEN';
      } else {
        throw new Error('Circuit open');
      }
    }
    
    try {
      const result = await fn();
      if (this.state === 'HALF-OPEN') {
        this.state = 'CLOSED';
        this.failCount = 0;
      }
      return result;
    } catch (err) {
      this.failCount++;
      this.lastFailTime = Date.now();
      if (this.failCount >= 5) {
        this.state = 'OPEN';
      }
      throw err;
    }
  }
}
```

---

## 🧪 ERROR TESTING

### Test Cases

```javascript
// Test #1: Missing API Key
test('pagamento falha se Asaas não configurado', () => {
  localStorage.removeItem('pizzariaAsaasConfig');
  expect(() => confirmarPagamento()).toThrow('Configure Asaas');
});

// Test #2: Invalid WhatsApp
test('salvar config rejeita WhatsApp inválido', () => {
  const result = saveAsaasConfig('key', 'abc');
  expect(result.error).toContain('WhatsApp');
});

// Test #3: Retry logic
test('pagamento retenta 3x em timeout', async () => {
  let attempts = 0;
  await retryWithBackoff(() => {
    attempts++;
    if (attempts < 3) throw new Error('Timeout');
  });
  expect(attempts).toBe(3);
});

// Test #4: Storage corruption
test('app recupera de localStorage corrupto', () => {
  localStorage.setItem(ASAAS_CONFIG_KEY, '{invalid json');
  const config = AsaasConfig.getConfig();
  expect(config).toEqual(DEFAULT_CONFIG);
});

// Test #5: Webhook dedup
test('webhook duplicado é ignorado', () => {
  expect(WebhookVerifier.isDuplicate('evt_123')).toBe(false);
  expect(WebhookVerifier.isDuplicate('evt_123')).toBe(true);
});
```

---

## 📞 SUPPORT & ESCALATION

### When to Escalate

| Issue | Severity | Action | Owner |
|-------|----------|--------|-------|
| Payment stuck | CRITICAL | Restart browser + retry | Customer |
| WhatsApp not sent | HIGH | Check number + retry | Admin |
| Config won't save | HIGH | Clear cache + try again | Admin |
| Storage full | MEDIUM | Export data + clear logs | Admin |
| Unknown error | MEDIUM | Check console logs | Developer |

### Admin Troubleshooting Checklist

- [ ] Abrir "⚙️ Configurações"
- [ ] Verificar "🧪 Testar Conexão" status
- [ ] Checar "Logs" para erros
- [ ] Limpar cache: DevTools → Application → Clear storage
- [ ] Recarregar página (Ctrl+R)
- [ ] Verificar se WhatsApp está no formato correto
- [ ] Confirmar API Key no dashboard Asaas

---

**Status**: ✅ Production Ready | Continuous monitoring active

## Registro 2026-08-08 — Ajuste da propaganda
- Resolvido: seed antigo permanecia no `localStorage`; corrigido com `MENU_VERSION` e migração automática.
- Resolvido: testes esperavam 6 pizzas, telefone e endereço antigos; contrato atualizado para os dados da propaganda.
- Prevenção: endereço não é preenchido por inferência quando não aparece na arte original.
- Verificação: `npm test` passou com 7/7 testes.
- Correção de escopo: o design original foi restaurado do backup e os produtos reais permanecem com estoque livre inicial de 999.
- Ajuste visual: hero “FOGO NA MASSA.” restaurado e imagem do panfleto removida da seção final.

## Registro 2026-08-09 — Migração InfinitePay + bloqueio de deploy GCP

### Issue #10: Deploy GCP bloqueado — contas de faturamento FECHADAS
**Severidade**: 🔴 bloqueante para o Slice 5 (deploy online)

**Sintomas encontrados (em ordem)**
```
gcloud services enable compute.googleapis.com
→ FAILED_PRECONDITION: Billing account for project '773816284515' is not found.

gcloud beta billing accounts list
→ PERMISSION_DENIED: Cloud Billing API has not been used in project ...
```
Console do Google também emitiu um pedido de papel:
```
testinhottt@gmail.com está solicitando roles/resourcemanager.projectMover
em gen-lang-client-0862641257
link: console.cloud.google.com/iam-admin/troubleshooter/summary
      ;permissions=resourcemanager.projects.get;token=AZRajuVZojb24dC_2AniUgmGgSdA_qo_
      G5zLAU0IqVzwaWqb1tOzF2b294vTmNJ9KPoGXxvpoZ-UBSPUZGnhGBtZ_2JT6itK5Xl6NQxCRv_2Yzle
      rtBaWkobTqxrOsS3N4U8yk2SFh0LxkRzLq-eLfcr6e7eRx_dBpGmPlVqfgQ
      ?utm_campaign=role_request&utm_source=cloud_console
```

**Causa-raiz confirmada** (não é falta de permissão):
```
gcloud beta billing accounts list
011F87-F8E38B-E72159  Minha conta de faturamento 1  open=False
014673-1AD687-65353E  Minha conta de faturamento    open=False
```
As DUAS contas de faturamento da conta Google estão **fechadas/encerradas**.
Um projeto sem billing aberto não pode ativar `compute.googleapis.com`,
mesmo para recursos do Always Free (e2-micro). O pedido de `projectMover`
é apenas ruído do console tentando mover o projeto para outra hierarquia —
conceder esse papel NÃO resolve o problema.

**Fatos adicionais**
- `gcloud projects describe gen-lang-client-0862641257` → sem `parent`
  (projeto standalone, criado pelo AI Studio; não há organização bloqueando).
- Nenhum dos 12 projetos da conta tem billing habilitado
  (`billingEnabled=False` em `tribal-jigsaw-459200-h1` e no projeto alvo).

**Correções possíveis**
1. Reabrir/criar conta de faturamento em `console.cloud.google.com/billing`
   com cartão de crédito válido (verificação ~R$5, estornada), depois
   vincular ao projeto e reexecutar `vps/create-instance-rest.sh`.
2. Alternativa sem cartão: deploy em Render/Koyeb (free tier hiberna em 15 min).
3. Alternativa com cartão porém mais recursos: Oracle Cloud Always Free (ARM 4 OCPU).

**Prevenção**
- Antes de planejar deploy em qualquer nuvem, validar primeiro:
  `gcloud beta billing accounts list` → conferir `open=True`.
  Nunca assumir que "free tier" dispensa conta de faturamento ativa.

### Issue #11: Chaves Asaas versionadas em texto plano (herdado do Issue #0)
- Os arquivos `apiassas`, `asaas-config.js`, `api-asaas.mjs` e as chaves
  em `server-config.json` foram **removidos** na migração para InfinitePay.
- ⚠️ Pendente do usuário: **revogar as chaves antigas no painel Asaas** —
  a remoção do arquivo não invalida a credencial já exposta.
- Prevenção adotada: InfinitePay lê tudo de env
  (`INFINITEPAY_HANDLE`, `INFINITEPAY_REDIRECT_URL`, `INFINITEPAY_WEBHOOK_URL`).

## Registro 2026-08-09 — Crash do servidor por URL malformada

### Issue #12: `ERR_INVALID_URL` derruba o processo inteiro (CRÍTICO)

**Sintoma**
Site online cai sozinho depois de algum tempo. O tunnel Cloudflare passa a
responder `Unable to reach the origin service ... dial tcp 127.0.0.1:3000:
connect: connection refused` e o `cloudflared` encerra com
`no more connections active and exiting`.

**Stack real capturado** (`LOGS/server-online.log`)
```
TypeError: Invalid URL
    at new URL (node:internal/url:840:25)
    at Server.<anonymous> (file:///home/teste/pizza/server.mjs:...)
  code: 'ERR_INVALID_URL',
  input: '//',
  base: 'http://treatments-jumping-satisfy-ben.trycloudflare.com'
```

**Causa raiz**
No `http.createServer` o parse era feito sem proteção:
```js
const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
```
Um request com path `//` (enviado por crawlers, scanners e pelo próprio
tunnel) faz o WHATWG URL interpretar `//` como início de *authority* vazia →
`TypeError`. Como a exceção era **síncrona dentro do callback do servidor**,
não havia `catch` algum: o Node derruba o processo inteiro. Um único request
malformado de qualquer pessoa na internet = **DoS trivial**.

**Correção aplicada** (2026-08-09, `server.mjs`)
```js
let caminho = '/';
try {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  caminho = u.pathname;
} catch {
  log('WARN', 'SERVER', 'Request com URL inválida', { url: String(req.url).slice(0, 200) });
}
```
Degradação graciosa: URL inválida vira `/` e o request é logado, sem matar o processo.

**Verificação**
- `curl http://localhost:3000//` → HTTP 200 (antes: processo morria)
- Servidor continua vivo após o request malformado → HTTP 200
- Pelo endereço público: `/`, `//`, `/ad`, `/api/config` → todos 200
- `npm test` 8/8 e `node test-server.mjs` todos verdes

**Prevenção**
- Nunca chamar `new URL()` com entrada de rede sem `try/catch`.
- Todo callback **síncrono** de `http.createServer` deve ser à prova de exceção:
  o `.catch()` das rotas async não protege o parse feito antes dele.
- Ao subir o site, testar sempre os paths hostis: `//`, `/%`, `/../`, `/\`.

