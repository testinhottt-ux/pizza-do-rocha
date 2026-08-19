# 🍕 Pizzaria do Rocha — Arquitetura de Software & Modelagem Visual (Mermaid)

Este documento contém a modelagem arquitetural completa e detalhada do sistema **Pizzaria do Rocha**, utilizando o padrão **C4 Model** e **Mermaid.js**.

---

## 🗺️ 1. C4 Model (Nível 1) — Diagrama de Contexto do Sistema

Representa a visão geral de alto nível dos atores humanos e dos sistemas externos que interagem com a plataforma.

```mermaid
graph TD
    classDef person fill:#d64527,stroke:#fff,stroke-width:2px,color:#fff;
    classDef system fill:#241a17,stroke:#d64527,stroke-width:2px,color:#f4ede1;
    classDef external fill:#1e293b,stroke:#64748b,stroke-width:2px,color:#94a3b8;

    CLIENTE["👤 Cliente / Visitante<br><i>(Navegador Mobile ou Desktop)</i>"]:::person
    DONO["👨‍🍳 Dono / Administrador<br><i>(Gestor da Pizzaria no /ad)</i>"]:::person

    PIZZA_SYS["🍕 Sistema Pizzaria do Rocha<br><i>(E-commerce SPA + Backend Node.js)</i>"]:::system

    INFINITEPAY["💳 Gateway InfinitePay Oficial<br><i>(Processamento Pix e Cartão de Crédito)</i>"]:::external
    WHATSAPP["💬 Infraestrutura WhatsApp<br><i>(Servidores Meta / Disparo via Baileys)</i>"]:::external

    CLIENTE -->|1. Navega no cardápio, monta carrinho e realiza checkout| PIZZA_SYS
    PIZZA_SYS -->|2. Gera cobrança Pix instantânea ou link de Cartão| INFINITEPAY
    CLIENTE -->|3. Efetua pagamento via Pix ou Cartão| INFINITEPAY
    INFINITEPAY -->|4. Notifica liquidação financeira via Webhook| PIZZA_SYS
    PIZZA_SYS -->|5. Dispara comprovante e status do pedido| WHATSAPP
    WHATSAPP -->|6. Entrega recibo no celular do cliente| CLIENTE
    WHATSAPP -->|6. Notifica novo pedido para a cozinha| DONO
    DONO -->|7. Gerencia produtos, estoque e avança status de pedidos| PIZZA_SYS
```

---

## 🏛️ 2. C4 Model (Nível 2) — Diagrama de Contêineres & Estrutura de Armazenamento

Mapeia as fronteiras de execução do software, serviços em background, APIs REST e os arquivos de persistência atômica.

```mermaid
graph TB
    classDef clientSide fill:#2c1b18,stroke:#e05638,stroke-width:2px,color:#f4ede1;
    classDef backend fill:#1f2937,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef storage fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#6ee7b7;
    classDef ext fill:#111827,stroke:#8b5cf6,stroke-width:2px,color:#c4b5fd;

    subgraph CLIENT_TIER["Camada de Apresentação (Frontend SPA)"]
        SPA["index.html (Single Page App)<br><i>(Design Awwwards, Responsivo)</i>"]:::clientSide
        STORE["store.js (Estado Reativo Local)<br><i>(localStorage, Carrinho, Catálogo)</i>"]:::clientSide
        UI["ui.js (Componentes & DOM)<br><i>(Navegação, Rodapé, WhatsApp Link)</i>"]:::clientSide
        SW["sw.js (Service Worker PWA)<br><i>(Network-First, Cache Offline)</i>"]:::clientSide
        SPA <--> STORE
        SPA <--> UI
        SPA <--> SW
    end

    subgraph SERVER_TIER["Camada de Servidor (Backend Node.js ES Modules)"]
        SERVER["server.mjs (Servidor HTTP Nativo)<br><i>(Roteamento, Blindagem, Autenticação)</i>"]:::backend
        INF_CLIENT["infinitepay-client.mjs<br><i>(Integração API InfinitePay)</i>"]:::backend
        WA_BOT["whatsapp-web.mjs<br><i>(Engine Baileys WhatsApp Web)</i>"]:::backend
        SERVER <--> INF_CLIENT
        SERVER <--> WA_BOT
    end

    subgraph STORAGE_TIER["Persistência em Disco (JSON Atômico com Safe Rename)"]
        CARD_JSON["LOGS/cardapio.json<br><i>(Catálogo Centralizado de Produtos)</i>"]:::storage
        PED_JSON["LOGS/pedidos.json<br><i>(Histórico Central de Pedidos)</i>"]:::storage
        CFG_JSON["server-config.json<br><i>(Credenciais & Configurações)</i>"]:::storage
        BUYERS_JSON["LOGS/compradores.json<br><i>(Cache de Sessões de Checkout)</i>"]:::storage
        SERVER --> CARD_JSON
        SERVER --> PED_JSON
        SERVER --> CFG_JSON
        SERVER --> BUYERS_JSON
    end

    subgraph EXTERNAL_TIER["Provedores Externos"]
        INF_API["API InfinitePay Cloud"]:::ext
        WA_NET["Servidores WhatsApp Meta"]:::ext
        INF_CLIENT -->|HTTPS REST| INF_API
        WA_BOT -->|WebSocket Seguro| WA_NET
    end

    SPA -->|Requisições Fetch /api/*| SERVER
```

---

## 🔄 3. Diagrama de Sequência E2E — Fluxo Completo de Compra & Pagamento

Demonstra a ordem temporal exata das trocas de mensagens entre Cliente, Frontend, Backend, InfinitePay e WhatsApp.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Cliente
    participant SPA as 💻 Frontend (SPA)
    participant Server as ⚙️ Backend (server.mjs)
    participant InfinitePay as 💳 InfinitePay
    participant WhatsApp as 💬 WhatsApp Bot (Baileys)
    actor Dono as 👨‍🍳 Dono da Pizzaria

    Cliente->>SPA: Seleciona Pizzas e Bebidas no Cardápio
    Cliente->>SPA: Preenche Dados (Nome, Endereço, Celular, CPF)
    Cliente->>SPA: Clica em "Pagar com Pix" ou "Cartão de Crédito"
    
    SPA->>Server: POST /api/pedidos { cliente, itens, metodo }
    Server->>Server: Valida dados, Mascara CPF e Calcula Total
    Server->>Server: Persiste em LOGS/pedidos.json
    Server-->>SPA: HTTP 201 { pedido: { id, numero, total: 87.97, status: "recebido" } }

    SPA->>Server: POST /api/pagamento { valor, metodo, cpfCnpj, telefone }
    Server->>InfinitePay: Gera Cobrança Pix / Checkout Cartão
    InfinitePay-->>Server: Retorna { paymentId, qrCode, checkoutUrl }
    Server-->>SPA: HTTP 200 { paymentId, checkoutUrl, pixQrCode }
    SPA-->>Cliente: Exibe QR Code Pix / Abre Checkout Seguro

    Cliente->>InfinitePay: Realiza o Pagamento
    InfinitePay->>Server: POST /api/webhook-infinitepay { order_nsu, transaction_nsu, amount }
    
    Server->>Server: Atualiza Pedido para status: "aprovado"
    Server->>WhatsApp: Envia Notificação de Novo Pedido
    WhatsApp-->>Dono: "🍕 NOVO PEDIDO #1070 RECEBIDO! Total: R$ 87,97"
    Server->>WhatsApp: Envia Comprovante e Link de Acompanhamento
    WhatsApp-->>Cliente: "🍕 Seu pedido na Pizzaria do Rocha foi confirmado!"
    
    Cliente->>SPA: Consulta GET /api/pedidos/:id
    SPA-->>Cliente: Exibe tela de Acompanhamento em Tempo Real ("preparando")
```

---

## 🔄 4. Diagrama de Sequência — Sincronização do Cardápio Multi-Clientes

Demonstra como as alterações feitas pelo dono no painel administrativo propagam instantaneamente para todos os visitantes.

```mermaid
sequenceDiagram
    autonumber
    actor Dono as 👨‍🍳 Dono no Painel (/ad)
    participant Server as ⚙️ Backend (server.mjs)
    participant Storage as 📁 LOGS/cardapio.json
    participant ClienteA as 👤 Visitante A (Navegador 1)
    participant ClienteB as 👤 Visitante B (Celular 2)

    Dono->>Server: POST /api/cardapio/item { item: Pizza Nova, headers: x-admin-pass }
    Server->>Server: Autentica credencial de Admin
    Server->>Storage: Grava atômica no cardapio.json
    Server-->>Dono: HTTP 200 { item salvo com sucesso }

    Note over ClienteA,ClienteB: Usuários navegando ou acessando o site
    ClienteA->>Server: GET /api/cardapio
    Server->>Storage: Lê catálogo atualizado
    Server-->>ClienteA: HTTP 200 { items: [..., Pizza Nova] }
    
    ClienteB->>Server: GET /api/cardapio
    Server-->>ClienteB: HTTP 200 { items: [..., Pizza Nova] }
```

---

## ⚙️ 5. Diagrama de Máquina de Estados — Ciclo de Vida dos Pedidos

Mapeia as transições válidas de status de um pedido no restaurante.

```mermaid
stateDiagram-v2
    [*] --> Recebido : Cliente confirma pedido no checkout
    
    Recebido --> Preparando : Dono aceita pedido na cozinha
    Recebido --> Cancelado : Pagamento recusado ou cancelamento
    
    Preparando --> Forno : Pizza montada e levada ao forno
    Forno --> Saiu_Entrega : Embalada e despachada com o entregador
    
    Saiu_Entrega --> Entregue : Cliente recebe a pizza quentinha
    
    Entregue --> [*]
    Cancelado --> [*]
```

---

## 🗄️ 6. Diagrama Entidade-Relacionamento (Modelo de Dados)

Estrutura dos objetos manipulados pelo sistema.

```mermaid
erDiagram
    PEDIDO ||--|{ ITEM_PEDIDO : contem
    PEDIDO ||--o| CLIENTE : pertence
    PEDIDO ||--o| PAGAMENTO : liquidado_por
    CARDAPIO_ITEM ||--o{ ITEM_PEDIDO : referencia

    CLIENTE {
        string nome
        string telefone
        string endereco
        string cpf_mascarado
    }

    PEDIDO {
        string id PK
        int numero
        float total
        string status
        datetime criadoEm
    }

    ITEM_PEDIDO {
        string nome
        int qtd
        float preco
        string observacoes
    }

    CARDAPIO_ITEM {
        string id PK
        string nome
        string categoria
        float preco
        string descricao
        string foto
        int estoque
        boolean ativo
        boolean destaque
    }

    PAGAMENTO {
        string provider
        string paymentId PK
        string metodo
        string status
        float valor
        datetime confirmadoEm
    }
```
