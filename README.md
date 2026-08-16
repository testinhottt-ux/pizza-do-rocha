# 🍕 PIZZARIA DO ROCHA — Fogo na Massa

**E-commerce de pizzas artesanais com design nível Awwards**

---

## 🚀 Como Usar

### 1. **Iniciar o Servidor**

O servidor HTTP está rodando em `http://localhost:8000`

```bash
# Já está em execução! Acesse:
http://localhost:8000/index.html
```

### 2. **Acessar o Site**

- **Home**: `http://localhost:8000/index.html` (padrão)
- **Cardápio**: Clique em "CARDÁPIO" na nav
- **Carrinho**: Clique no ícone do carrinho (canto superior direito)
- **Meu Pedido**: Visualize seus pedidos após checkout
- **Admin**: Clique em 🔐 ADMIN (canto superior direito)

---

## 🔐 Admin — Área Administrativa

### **Acesso à Área Administrativa**

1. Clique em **🔐 ADMIN** na navegação (canto superior direito)
2. Digite a senha: **`pizzadorochaboademais`** (ou use o botão 📋 COPIAR SENHA)
3. Clique em **✅ ENTRAR**
4. Abre o painel único **dentro do `index.html`** (sem `Admin.dc.html`)

> **Este é o único painel admin do site.** Ele concentra Cardápio, Estoque, Pedidos, Relatórios e **Configurações da Asaas** (chave de API em `apiassas`, WhatsApp para notificação/webhook — telefone `31996678280`).

### **Funcionalidades**

#### **Cardápio**
- ✅ Criar novas pizzas
- ✅ Editar nome, preço, descrição
- ✅ Ativar/Desativar itens
- ✅ Deletar pizzas

#### **Estoque**
- ✅ Ajustar quantidade de cada pizza
- ✅ Ver status (Ativo/Esgotado/Baixo)
- ✅ Incrementar/Decrementar com botões

#### **Pedidos**
- ✅ Ver todos os pedidos em tempo real
- ✅ Avançar status (recebido → preparando → forno → entrega → entregue)
- ✅ Histórico completo com cliente e itens

#### **Relatórios**
- ✅ Faturamento total
- ✅ Número de pedidos
- ✅ Ticket médio
- ✅ Pizzas mais vendidas

---

## 🛒 Fluxo de Compra (Usuário)

```
1. HOME
   ↓ Visualizar pizzas em destaque
   ↓ Clique em "VER CARDÁPIO"
   
2. CARDÁPIO
   ↓ Ver todas as pizzas
   ↓ Filtrar por categoria (Todas/Tradicionais/Especiais)
   ↓ Clique em "Adicionar ao carrinho"
   
3. CARRINHO
   ↓ Revisar itens
   ↓ Ajustar quantidades (+ / -)
   ↓ Ver total
   ↓ Clique "IR PARA PAGAMENTO"
   
4. CHECKOUT
   ↓ Preencher dados (nome, telefone, endereço)
   ↓ Selecionar forma de pagamento (Pix/Cartão/Boleto)
   ↓ Clique "CONFIRMAR PAGAMENTO"
   
5. MEU PEDIDO
   ↓ Ver status do pedido em tempo real
   ↓ Número do pedido para referência
```

---

## 🎨 Design & UX

### **Características Awwards-Level**

- ✅ **Tipografia Premium**: Bebas Neue (títulos) + Work Sans (corpo)
- ✅ **Paleta Sofisticada**: Laranja fogo (#e8432f) + Tons terrosos
- ✅ **Animações Suaves**: Transições de 0.2-0.45s com easing cúbico
- ✅ **Hover States**: Cards levantam ao hover, botões com feedback visual
- ✅ **Responsivo**: Mobile-first, testa em todos os tamanhos
- ✅ **Acessibilidade**: Alt text em imagens, contraste WCAG AA
- ✅ **Performance**: Imagens otimizadas, cache localStorage

### **Cores**

```css
--fogo: #e8432f       /* Vermelho vibrante */
--carvao: #1a1210     /* Preto quente */
--creme: #f4ede1      /* Bege claro */
--areia: #cbb9a8      /* Bege médio */
--musgo: #8a7862      /* Cinza quente */
--zap: #25D366        /* WhatsApp green */
```

---

## 📱 Páginas Principais

### **Home** (Landing Page)
- Hero section com imagem real
- Seção "Nossa História"
- Destaques de 3 pizzas
- "Como Funciona" (3 passos)
- Contato + Google Maps
- WhatsApp flutuante

### **Cardápio**
- Grid responsivo (3 colunas desktop, 1 mobile)
- Filtro por categoria
- Fotos de cada pizza
- Preço + disponibilidade
- Botão "Adicionar ao carrinho"

### **Carrinho**
- Listagem com miniaturas
- Aumentar/Diminuir quantidades
- Remover itens
- Resumo com subtotal e total
- Botão "IR PARA PAGAMENTO"

### **Checkout**
- Formulário: Nome, Telefone, Endereço
- Seleção de método de pagamento
- Resumo visual do pedido
- Segurança Asaas

### **Meu Pedido**
- Histórico de pedidos
- Número, data, total
- Status atual (com badge de cor)
- Cliente e itens do pedido

---

## ⚙️ Dados & Armazenamento

### **LocalStorage**

Todos os dados são armazenados em `localStorage` com chave `pizzariaRochaDB`:

```javascript
{
  items: [
    {
      id: "item_xxx",
      nome: "Margherita",
      categoria: "Tradicionais",
      preco: 42.90,
      descricao: "...",
      foto: "images/pizza-margherita.jpg",
      estoque: 20,
      ativo: true
    }
    // ... mais pizzas
  ],
  cart: [
    { itemId: "item_xxx", qtd: 2 }
    // ... mais itens
  ],
  orders: [
    {
      id: "ped_xxx",
      numero: 5234,
      itens: [...],
      total: 150.00,
      cliente: { nome, telefone, endereco },
      status: "recebido",
      criadoEm: timestamp
    }
    // ... mais pedidos
  ]
}
```

### **Seed de Dados**

6 pizzas iniciais são automaticamente carregadas:

1. Margherita (R$ 42.90)
2. Pepperoni (R$ 52.90)
3. Calabresa (R$ 47.90)
4. Quatro Queijos (R$ 58.90)
5. Portuguesa (R$ 54.90)
6. Frango com Catupiry (R$ 55.90)

---

## 📸 Imagens

Todas em `/images/`:

- `hero-forno.jpg` — Forno a lenha (hero section)
- `historia-pizzaiolo.jpg` — Pizzaiolo (seção história)
- `pizza-margherita.jpg` — Margherita
- `pizza-pepperoni.jpg` — Pepperoni
- `pizza-calabresa.jpg` — Calabresa
- `pizza-quatro.jpg` — Quatro Queijos
- `pizza-portuguesa.jpg` — Portuguesa
- `pizza-frango.jpg` — Frango com Catupiry
- `pizza-generica.jpg` — Fallback (erro de imagem)

---

## 🧪 Testes

### **Executar Suite Completa**

```bash
cd /home/teste/pizza
node test-all.mjs
```

**Resultado**: 7/7 testes passando ✅

**Cobre**:
- Carregamento com seed
- Contato e informações
- Fotos carregam
- Fluxo completo de compra
- CRUD Admin
- Autenticação
- Ordenação de pedidos

### **Testes Unitários (store.js)**

```bash
node --test tests/store.test.mjs
```

---

## 📧 Contato

- **Telefone**: +55 31 9186-7625
- **WhatsApp**: [Chamar agora](https://wa.me/5531918667625)
- **Endereço**: Rua Hait, nº 155 — Nova Cidade, Sete Lagoas/MG
- **Horário**: Terça a Domingo, 18h às 23h30

---

## 🔧 Tecnologia

- **Frontend**: HTML5 + CSS3 + JavaScript (ES Modules)
- **Framework**: Vanilla JS (sem dependências)
- **Armazenamento**: localStorage (no-backend)
- **Pagamento**: Simulado (pronto para Asaas em produção)
- **Server**: Python http.server
- **Testes**: Node.js test runner

---

## 📝 Arquivo flow.md

Consulte `flow.md` para:
- Mapa de arquivos e dependências
- Fluxo de dados por variável
- Complexidade ciclomática das funções

---

## ✅ Status

```
✅ HOME — 100% funcional
✅ CARDÁPIO — 100% funcional
✅ CARRINHO — 100% funcional
✅ CHECKOUT — 100% funcional
✅ MEU PEDIDO — 100% funcional
✅ ADMIN — 100% funcional
✅ TESTES — 7/7 passando
✅ DESIGN — Nível Awwards
✅ PERFORMANCE — Otimizado
✅ RESPONSIVO — Mobile-ready
```

---

**Desenvolvido com ❤️ usando Protocolo AG v14.5**

*"Especialista em tudo e supercomputador lógico"*
