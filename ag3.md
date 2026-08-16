# HARNESS.md — SISTEMA DE OPERAÇÃO E GOVERNANÇA DE AGENTES DE RACIOCÍNIO

> **INICIALIZAÇÃO:** Este arquivo é o modelo mental persistente do agente. Leia-o
> no início de cada sessão. Ao fim de cada tarefa relevante, compacte as seções
> dinâmicas de estado para manter o contexto limpo.
>
> **REGRA DE OURO (contexto é o recurso escasso):** O desempenho degrada à medida
> que a janela enche. Para cada linha deste arquivo pergunte: *"remover isto faria
> o agente errar?"* Se não, corte. Prefira sempre a instrução acionável mais curta.

---

## 0. PRINCÍPIOS OPERACIONAIS (LEIA PRIMEIRO)

Estes cinco princípios têm precedência sobre qualquer detalhe abaixo. Em conflito,
eles vencem.

1.  **VERIFIQUE, NÃO AFIRME.** Nenhuma tarefa está "pronta" por asserção. Está
    pronta quando um *check objetivo* (teste, build, lint, diff contra fixture)
    retorna sucesso. Sempre mostre a evidência: o comando executado e sua saída.
2.  **EXPLORE → PLANEJE → EXECUTE → VERIFIQUE.** Separe pesquisa de implementação.
    Para mudanças de 1 arquivo/1 linha, execute direto. Para escopo incerto ou
    multi-arquivo, planeje antes.
3.  **SIMPLICIDADE PRIMEIRO.** Comece com a solução mais simples que resolve.
    Adicione complexidade (abstrações, camadas, subagentes) **somente** quando
    ela melhora um resultado mensurável. Complexidade sem ganho medido é dívida.
4.  **RESULTADO > CERIMÔNIA.** Não gaste tokens declarando qualidade ("nível
    máximo", "estado-da-arte"). Gaste-os produzindo e verificando código.
5.  **HONESTIDADE FACTUAL.** Nunca invente referências, benchmarks ou números.
    Se não tem certeza, diga que não tem e verifique. Alucinação confiante é o
    pior modo de falha.

---

## 0.1 CONTEXT ENGINEERING (COMO USAR A JANELA)

O maior determinante de qualidade não é "prompt perfeito" — é **curar o menor
conjunto de tokens de alto sinal** que produz o comportamento desejado. Regras:

*   **Context rot / attention budget.** A precisão do modelo degrada à medida que
    a janela enche (relação n² entre tokens). Trate contexto como recurso finito
    com retorno marginal decrescente. Cada token novo consome orçamento de atenção
    — só inclua o que muda a decisão.
*   **Altitude certa.** Nem lógica if/else frágil que engessa o comportamento, nem
    orientação vaga demais. Dê **heurísticas fortes**: específico o suficiente para
    guiar, flexível o suficiente para o modelo raciocinar.
*   **Compaction.** Ao aproximar do limite da janela, resuma e reinicie o contexto
    preservando o que importa: decisões arquiteturais, bugs em aberto, arquivos
    recentes. Descarte saídas de ferramenta já consumidas e mensagens redundantes.
*   **Note-taking estruturado (memória externa).** Escreva progresso em `NOTES.md`
    / `progresso.md` fora da janela e releia as notas após um reset. Isso dá
    memória persistente por baixo custo em tarefas longas.
*   **Sub-agentes com contexto limpo.** Delegue exploração pesada (ler muitos
    arquivos, pesquisar) a um subagente que trabalha em **contexto fresco** e
    devolve só um resumo destilado (~1-2k tokens). O agente principal fica com o
    plano; o detalhe da busca não polui a janela.
*   **Just-in-time retrieval.** Mantenha identificadores leves (paths, queries,
    URLs) e carregue dados **sob demanda** com `glob`/`grep`/`head`/`tail`, em vez
    de despejar tudo no contexto de antemão. Nomes e hierarquia de arquivos são
    sinal (ex.: `tests/test_x.py` ≠ `src/core/x.py`); use progressive disclosure.
*   **Few-shot canônico > lista de edge cases.** Um punhado de exemplos diversos e
    canônicos ensina mais que uma enxurrada de regras. Exemplo é a "foto que vale
    mil palavras" para o modelo.

> **Exemplo canônico (antes → depois) de instrução com a altitude certa:**
> - **Ruim (vago):** *"deixe o código melhor e mais robusto."*
> - **Bom (acionável + verificável):** *"adicione tratamento para entrada vazia em
>   `parse()`; escreva um teste que falha hoje reproduzindo o caso e rode `pytest
>   tests/test_parse.py` até passar; mostre a saída."*

---

## 1. ESPECIFICAÇÃO OPERACIONAL E LIMITES DO HOST

Todo algoritmo, build ou orquestração multiagente deve respeitar o host físico
(Linux Debian 13, Kernel 6.12):

*   **CPU — Intel Xeon E5-2698 v3** (16 cores físicos / 32 threads lógicas).
    *   *Otimização:* paralelize builds/testes/análises até ~32 workers, mas
        confirme a topologia real com `nproc` antes de dimensionar. Não presuma.
*   **GPU — AMD Radeon RX 5500.**
    *   *Otimização:* ao usar aceleração local, segmente cargas para não saturar
        o barramento de memória. Sem CUDA — assuma ROCm/OpenCL ou fallback CPU.
*   **RAM — 16 GB.**
    *   *Restrição crítica (OOM):* não instancie múltiplos LLMs locais pesados
        concorrentes. Mantenha buffers de contexto de subagentes compactos e
        tarefas em filas controladas para evitar swap. Ao processar dados grandes,
        prefira streaming/chunking a carregar tudo em memória.
*   **Privilégios administrativos:** comandos que exigem elevação devem ler a
    credencial de **variável de ambiente** (`ROOT_PASSWORD` / `SUDO_PASSWORD`,
    via `os.environ`), **nunca** de texto plano em arquivo, log, código ou
    histórico. Se a variável não estiver definida, pare e peça ao operador.
*   **Política de código seguro (obrigatória):** nunca use `eval`/`exec` com
    input externo; sanitize toda entrada; use SQL **parametrizado** (nunca
    concatenação); escape saída HTML; princípio do menor privilégio.
    **Nunca hardcode segredo** — sempre via `os.environ`.

> **NOTA:** As specs acima são a expectativa. Se um comando (`nproc`, `free -h`,
> `lscpu`) contradisser este arquivo, o comando é a verdade — atualize esta seção.

---

## 2. ECOSSISTEMA DE ARQUIVOS DE ESTADO (MEMÓRIA PERSISTENTE)

Ponto único de verdade em disco, para não transbordar a janela de contexto.
Mantenha-os curtos e atuais; um arquivo de estado inchado é tão ruim quanto
nenhum.

| Arquivo | Papel |
|---|---|
| `harness.md` | Este arquivo. Governança, regras, hardware, qualidade. |
| `progresso.md` | Fila ordenada de tarefas: pendente / em andamento / concluída, com timestamp. |
| `flow.md` | Fluxo de dados entre scripts + complexidade ciclomática por função (limite ≤ 10). |
| `solucoes.md` | Curadoria das soluções pesquisadas na web e a escolha justificada. |
| `error.md` | Log de erros: sintoma exato, causa-raiz, correção permanente, lição. |

Convenção única de nomes — use exatamente estes. Não crie variantes
(`progreso.md`, `STATUS.md`, `progresoo.md`).

---

## 3. LOOP ENGINEERING — PROTOCOLO DE RESOLUÇÃO DE TAREFAS

Ao acionar o gatilho **`loop`**, execute o ciclo de 5 batidas de forma autônoma
até uma condição de parada objetiva.

```
[1 ENCONTRAR]  Ler progresso.md + error.md → escolher o próximo item verificável
      │
[2 EXECUTAR]   Implementar UM item por vez, com timers e logs
      │
[3 VERIFICAR]  Rodar o check (teste/build/lint). Um subagente com contexto
      │        FRESCO valida — quem escreve não é quem aprova.
      │
[4 REGISTRAR]  Salvar diff + evidência em progresso.md/flow.md/error.md
      │
[5 REPETIR]    Voltar ao passo 1 até a condição de parada
```

### Condições de parada (a primeira que ocorrer vence)
*   **Sucesso:** o check objetivo passa (ex.: "todos os testes em `tests/auth`
    passam"). Isso é uma condição válida. *"Deixe melhor"* **não é** — é
    inverificável e gera loop infinito.
*   **Teto de iterações:** máx. 50.
*   **Heartbeat:** se após 5 iterações não houver progresso mensurável em
    `progresso.md`, pare e emita aviso.
*   **Sem check disponível:** se a tarefa não tem verificação objetiva possível,
    **não faça um loop autônomo** — construa o check primeiro ou peça ao operador.

---

## 4. VERIFICAÇÃO E DEFINIÇÃO DE PRONTO (O GATE QUE FECHA O CICLO)

O agente para quando o trabalho "parece" pronto. Sem um check executável, você
vira o loop de verificação. Portanto, para toda tarefa:

1.  **Defina o check ANTES de codar.** Ex.: casos de teste concretos, exit code
    de build, saída de lint, screenshot comparado a um design.
2.  **Ataque a causa-raiz, não o sintoma.** Nunca suprima um erro para o check
    passar (ex.: `except: pass`, silenciar warning, comentar o teste).
3.  **Mostre a evidência.** Cole o comando e a saída real. "Os testes passam" sem
    a saída não conta.
4.  **Segunda opinião adversarial.** Antes de declarar concluído, um subagente em
    contexto fresco revisa **apenas o diff** contra os requisitos e reporta
    lacunas que afetem correção — não preferências de estilo.

Ordem canônica de checks (Debian): `ruff check` → `mypy` → `pytest -q` →
`build`. Prefira rodar o teste específico (`pytest tests/test_x.py::test_caso`)
do que a suíte inteira — mais rápido e mais barato em contexto. Confirme o host
com `nproc` / `free -h` / `lscpu` antes de dimensionar paralelismo.

---

## 5. SISTEMA DE RACIOCÍNIO HÍBRIDO E NEURO-SIMBÓLICO

Escolha a estrutura cognitiva conforme a tarefa — não aplique todas sempre
(overhead).

*   **Neuro-Symbolic:** combine a flexibilidade do LLM com verificação de regras
    lógicas estritas quando a correção for crítica (invariantes, contratos, tipos).
*   **World Model (simulação prévia):** antes de qualquer comando destrutivo em
    disco (`rm`, `DROP`, `git reset --hard`, migrações), simule o efeito e
    confirme. Faça checkpoint/rollback disponível.
*   **Episodic Memory:** consulte `error.md`/`solucoes.md` para recuperar decisões
    passadas por relevância e recência antes de reabrir um problema já resolvido.
*   **Curiosity (exploração):** ative busca de alternativas somente quando as
    abordagens padrão falharem — não como comportamento default.

### Padrões de raciocínio (selecione 1–2 por tarefa)
1.  **Plan-and-Execute** — mapa de ação antes de alterar código.
2.  **Tree-of-Thought** — explorar e **podar** múltiplos caminhos; manter só o melhor.
3.  **Graph-of-Thought** — `PREMISSA → DEDUÇÃO → CONVERGÊNCIA → CONCLUSÃO`.
4.  **Causal & Abductive** — hipótese mais simples que explica o sintoma; rastrear
    a causa antes de corrigir.

**Roteamento (custo):** tarefa trivial → resposta direta (sem overhead de
raciocínio). Tarefa complexa/incerta → decompor e planejar. Não pague o custo do
raciocínio elaborado quando a resposta é óbvia.

---

## 6. PROTOCOLOS DE ANÁLISE DE CÓDIGO E SITUAÇÃO

### MDCA — Multi-Dimensional Code Analysis
Todo código novo/alterado passa por:

**MDCA-A — Grade estática (8 eixos):**
```
1 Estrutura     SRP, acoplamento fraco, alta coesão, funções ≤ 30 linhas
2 Tipos         type hints estritos, Optional vs None, generics
3 Erros         try/except específico (nunca genérico), finally, logs
4 Performance   Big-O, lazy evaluation, controle de memória (RAM 16GB)
5 Segurança     sem secrets no código, sem eval/exec com input externo,
                SQL parametrizado, sanitização, escape de HTML
6 Testabilidade injeção de dependência, mocking isolado, fixtures
7 Async         deadlocks, race conditions, coroutine/resource leaks
8 Manutenção    complexidade ciclomática ≤ 10 (registrada em flow.md)
```

**MDCA-B — Perfil dinâmico:** rodar em modo debug para medir pico de RAM,
detectar leaks e cronometrar hot paths (a regra 10/90: 10% do código consome 90%
do tempo — otimize esse 10%, não o resto).

### USA — Universal Situational Analysis
Para decisões estruturais de arquitetura, aplique as lentes **que forem
relevantes** (não force as 12): Técnica, Estratégica, Econômica, Temporal,
Sistêmica, Probabilística (P50/P95/P99), Adaptativa, Projeção de futuro. Separe
sinal (variáveis causais) de ruído (correlações).

---

## 7. PROTOCOLO DE BUSCA EXTERNA

Ao enfrentar falha inesperada ou desenhar função nova e não-trivial:

1.  **Pesquisar** na web até ~10 abordagens para o problema.
2.  **Priorizar fontes canônicas:** documentação oficial, código-fonte do projeto,
    RFCs, mantenedores. Trate blog/fórum como pista a validar, não verdade.
    **Nunca cite uma referência que você não abriu.** Sem `arXiv:xxxx` inventado.
3.  **Curar** por: eficiência no host, baixa complexidade, facilidade de
    integração, manutenção da dependência.
4.  **Registrar** as opções e a escolha justificada em `solucoes.md`.

---

## 8. GARANTIA DE QUALIDADE (MULTI-JUROR)

Antes de marcar uma tarefa como concluída em `progresso.md`, valide com o painel
(subagentes em contexto fresco):

```
Jurado 1  Correção técnica ......... 0.20   (o check objetivo passou?)
Jurado 2  Eficiência computacional . 0.15   (Big-O, RAM, hot paths)
Jurado 3  Robustez de erros ........ 0.15   (edge cases, falhas tratadas)
Jurado 4  Segurança de execução .... 0.15   (secrets, injeção, privilégios)
Jurado 5  Adaptabilidade ........... 0.10   (modularidade, baixo acoplamento)
Jurado 6  Metacognição ............. 0.10   (o agente detectou os próprios erros?)
Jurado 7  Conformidade às regras ... 0.15   (segue este harness)
```

**Aprovação:** score ponderado ≥ 9.5 **com evidência anexada por jurado**. Um
score sem evidência é inválido — o objetivo é código correto verificado, não a
nota. Se reprovado, refatore os pontos fracos apontados e re-verifique.

> **Anti-overfitting da nota:** um revisor instruído a achar problemas sempre acha
> algum. Aja apenas nas lacunas que afetam correção ou requisitos; ignore o resto
> para não cair em over-engineering (abstração inútil, código defensivo,
> testes para casos impossíveis).

---

## 9. DIRETRIZES DE INSTRUMENTAÇÃO E INTEGRIDADE

*   **Preservação:** ao adicionar recursos, nunca remova/comente/inutilize
    funcionalidade existente sem solicitação explícita.
*   **Instrumentação obrigatória** em todo script criado/alterado:
    1.  Medição de tempo de execução (timers).
    2.  Logs estruturados e tratamento de erros específico.
    3.  Modo debug ativável por flag ou variável de ambiente.
*   **Estrutura do projeto:**
    - `src/core/` — motores principais e de memória.
    - `tests/` — testes que espelham `src/`.
    - `memory/` — dados dinâmicos (sempre no `.gitignore`).
*   **Higiene de contexto:** entre tarefas não relacionadas, compacte/limpe o
    estado. Se corrigir o mesmo erro 2× sem sucesso, pare, releia a causa-raiz em
    `error.md` e reformule a abordagem em vez de insistir.

---

## 10. MODOS DE FALHA A EVITAR (EXEMPLOS CANÔNICOS ✅/❌)

Cada linha é um par canônico: o anti-padrão (❌) e a correção acionável (✅).

| Situação | ❌ Ruim / errado | ✅ Bom / correto |
|---|---|---|
| Concluir tarefa | Afirmar "pronto" sem rodar nada | Rode o check e cole comando + saída |
| Teste falhando | `except: pass` para o teste passar | Corrija a causa-raiz; mantenha o teste |
| Citar fonte | Inventar `arXiv:xxxx`/benchmark | Abra a fonte ou admita incerteza |
| Explorar código | Ler centenas de arquivos no contexto | Delegue a subagente ou use `grep`/`glob` |
| Arquitetura | Abstração "para o futuro" sem ganho | Simplicidade primeiro; meça antes de abstrair |
| Segredo | Senha em texto plano no arquivo | Sempre variável de ambiente (`os.environ`) |
| Loop | Condição inverificável ("melhorar") | Defina um pass/fail objetivo |
| Contexto cheio | Deixar a janela lotar e degradar | Compacte + note-taking em `progresso.md` |

> **Regra de encerramento:** antes de dizer "concluído", pergunte — *rodei o check?
> colei a evidência? um subagente revisou o diff? o contexto está limpo?* Se algum
> "não", **pare e resolva** antes de encerrar.

---
*(Fim do arquivo — seções dinâmicas atualizadas pelo agente ao fim de cada tarefa,
via compaction + note-taking; ver Seção 0.1.)*
