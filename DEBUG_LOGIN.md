# 🔐 DEBUGAR LOGIN ADMIN

Se não está conseguindo entrar no painel administrativo, siga este guia.

## 1️⃣ Verificar Console do Navegador

**Abra F12** (ou Ctrl+Shift+I) e vá na aba **"Console"**

Quando você tenta fazer login, você verá logs como:

```
🔐 Tentativa de login:
   Digitado (raw): "pizzadorochaboademais"
   Trimmed: "pizzadorochaboademais"
   Comprimento: 23
   Esperado: "pizzadorochaboademais"
   Comprimento esperado: 23
   Validação: true
✅ Autenticação bem-sucedida!
✅ Modal fechado
🚀 Navegando para admin...
🎨 Renderizando cardápio admin...
✅ Cardápio renderizado
```

## 2️⃣ Problemas Comuns

### ❌ Erro: "Senha incorreta! Tente novamente."

**Causa:** Espaços extras ou caracteres diferentes

**Solução:**
1. Use o botão **📋 COPIAR SENHA** (insere automaticamente)
2. OU clique no ícone **👁️** para verificar o que está digitando
3. Certifique-se de não ter espaços no início/fim

### ❌ Erro: "Campo de senha não encontrado!"

**Causa:** HTML corrompido ou modal não está carregando

**Solução:**
1. Recarregue a página (F5)
2. Verifique se o modal aparece ao clicar em "🔐 ADMIN"

### ❌ Erro: "Store não carregado!"

**Causa:** JavaScript do servidor não carregou corretamente

**Solução:**
1. Abra DevTools → Network
2. Procure por `store.js` e veja se tem status 200
3. Recarregue a página (Ctrl+F5)

### ❌ Erro: "Função checkAdminPass não existe!"

**Causa:** store.js corrompido ou não carregado

**Solução:**
1. Verifique se `store.js` está no servidor
2. Recarregue a página (Ctrl+F5)

## 3️⃣ Senha Correta

A senha é exatamente:

```
pizzadorochaboademais
```

**Caracteres:**
- Comprimento: 23 caracteres
- Sem espaços
- Sem caracteres especiais
- Tudo em minúsculo

## 4️⃣ Botão Mostrar Senha (👁️)

Para verificar se está digitando corretamente:

1. Clique no ícone **👁️** ao lado do campo de entrada
2. A senha se torna visível
3. Clique novamente para ocultar

## 5️⃣ Se Ainda Não Funcionar

1. Copie os logs do console (F12 → Console)
2. Verifique:
   - A senha digitada vs. esperada são iguais?
   - O comprimento é 23?
   - A validação é `true` ou `false`?

## 6️⃣ Teste Rápido

Abra o console (F12) e digite:

```javascript
// Testar a senha
console.log(store.checkAdminPass('pizzadorochaboademais'));
```

Se retornar `true`, a senha está correta e o problema é no fluxo de login.

---

**Tudo ok! Pronto para usar! 🎉**
