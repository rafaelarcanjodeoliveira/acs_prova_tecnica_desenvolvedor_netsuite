# 🧠 Prova Técnica – Desenvolvedor NetSuite

Repositório contendo o projeto SDF com os campos, registros, workflows e scripts desenvolvidos para os requisitos técnicos da prova.

---

## 🧩 Requisito 01 – Validação de Campos em Transações (Invoice)

### **Contexto**
O cliente realiza transações do tipo **Recebimento (Invoice)**.  
É necessário validar informações com base nos parâmetros definidos no **Customer** e na **Subsidiária**, garantindo consistência antes de salvar o registro.

---

### **Abordagem Técnica Adotada**
Implementação via **Workflow** sobre o registro **Invoice**, com validações executadas em **Before Submit**.  
Essa abordagem cobre 100% das regras declaradas, reduz complexidade e evita uso de governança.

> **Observação (WorkflowAction Script):**
> Além do Workflow, também criei um **WorkflowAction Script** para demonstrar que a solução também pode ser feita através de script e implementar como ação diretamente no fluxo.
> Esse script é identificado no projeto como `acs_wfa_requisito_1.js`.

---

### **Ajustes e Criações**
- **Renomeação:**  
  `custbody_tst_sem_codigo` → `custrecord_tst_sem_codigo` (campo criado para o registro Subsidiária)

- **Campos de apoio (Transaction Body):**
  - `custbody_tst_codigo` → tipo *Checkbox*  
  - `custbody_tst_codigo_promocional` → tipo *Texto*

---

### **Lógica**
1. Se `custrecord_tst_sem_codigo` na subsidiária estiver **falso**, salvar sem validações.  
2. Se **verdadeiro**, validar `custentity_tst_banco` e `custentity_tst_codigo` no cliente.  
3. Se o registro do banco possuir `custrecord_banco_codpromo`, copiar o código do cliente para o campo `custbody_tst_codigo_promocional` e marcar `custbody_tst_codigo = T`.

---

### **Motivo da Escolha**
- **Workflow preferido:** evita código desnecessário e consumo de governança.
- **Governança zero:** workflow não consome unidades de execução.
- **Extensibilidade:** possibilidade de incorporar WorkflowAction Script para cenários avançados.

---

### **Evidências**
- Workflow XML: `ACS | WF Requisito 1`
- Campos customizados incluídos no projeto SDF

---

## ✅ Requisito 02 – Tela de Aprovação (Suitelet)

### **Contexto**
Criação de uma tela para aprovar registros do tipo `customrecord_tst_aprovacao`.

- **GET:** listar até 100 pendentes (`status = 1`)
- **POST:** aprovar marcados (`status = 2`) e rejeitar não marcados (`status = 3`)

---

### **Abordagem Técnica Adotada**
- **Suitelet 2.1 (GET/POST)**
  - GET: carrega até 100 pendentes, exibe sublista com checkbox e hidden field de controle de IDs.
  - POST: reconcilia marcados x não marcados e atualiza via `record.submitFields`.
- **Parâmetros configuráveis:**
  - Status pendente, aprovado e rejeitado (evita valores fixos).

---

### **Boas Práticas**
- Uso de `record.submitFields`: atualização pontual, baixo custo de governança.
- Revalidação de status antes de atualizar (evita tocar em registros já processados).
- Suitelet projetado para escalabilidade:
  - Caso o volume cresça, o POST delegaria para um **Map/Reduce**.

---

### **Evidências**
- Script: `acs_sl_requisito_2.js`
- Campos: `custrecord_apr_status`, `custrecord_apr_desc`
- Custom Record: `customrecord_tst_aprovacao`

---

## 📬 Requisito 03 – Processamento em Massa com Envio de E-mails

### **Contexto**
O cliente precisa enviar **resumos mensais** para fornecedores (Vendor), agrupando **Vendor Bills** por **localidade**.

Regras:
- Status = “Paid”
- Mês anterior (baseado em `trandate`)
- Agrupar por Vendor + Location
- Enviar **um e-mail por grupo** com totais somados

---

### **Abordagem Técnica Adotada**
- **Script Map/Reduce (2.1):**
  - **getInputData:** busca Vendor Bills pagos do mês anterior.
  - **map:** agrupa por `vendorId|locationId`.
  - **reduce:** soma totais, monta HTML, e envia 1 e-mail por grupo.

- **Template de e-mail híbrido (melhor prática para este caso):**
  - `render.mergeEmail(templateId, { entity: vendor, recipient: vendor })`
  - Substituição de placeholders:
    - `{{vendorName}}`
    - `{{locationName}}`
    - `{{period}}`
    - `{{rows}}`
    - `{{total}}`

- **Parâmetros do script:**
  - `custscript_r3_sender`
  - `custscript_r3_template_file`

---

### **Motivo da Escolha**
- **Map/Reduce:** indicado para grandes volumes e agregações.
- **mergeEmail:** mantém layout gerenciado por usuários de negócio.
- **Parametrização:** IDs e e-mails configuráveis (portabilidade).

---

### **Evidências**
- Script: `acs_mr_requisito_3.js`
- Template nativo de e-mail com placeholders
- Parâmetros configurados no Deployment

---

## 🧾 Itens do Pacote SDF

| Item | Tipo | Descrição |
|------|------|-----------|
| `acs_wf_requisito_1.xml` | Workflow | Validação Invoice |
| `acs_wfa_requisito_1.js` | WorkflowAction | Lógica adicional |
| `acs_sl_requisito_2.js` | Suitelet | Tela de aprovação |
| `acs_mr_requisito_3.js` | Map/Reduce | Resumo e envio de e-mails |
| `readme.md` | Documentação | Este arquivo |
| Campos e registros customizados | SDF | Custom Records e Fields utilizados |

---

## ✅ Testes Recomendados

| Requisito | Cenário | Resultado Esperado |
|------------|----------|--------------------|
| 1 | Subsidiária com “Sem Código” = F | Invoice salva normalmente |
| 1 | Subsidiária “Sem Código” = T + Cliente sem Banco | Bloqueia salvamento |
| 1 | Banco com codpromo + Cliente com código | Copia código e marca checkbox |
| 2 | 100 pendentes | Exibe corretamente |
| 2 | POST com aprovações parciais | Atualiza apenas pendentes |
| 3 | Vendor com 2 Locations | Envia 2 e-mails distintos |
| 3 | Mês anterior sem dados | Não envia nada |

---

## 👤 Autor
**Rafael Arcanjo de Oliveira**  
Desenvolvedor NetSuite  
📧 rafael9559@hotmail.com  

---
