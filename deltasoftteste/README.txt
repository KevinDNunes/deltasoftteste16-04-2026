📊 DeltaSoft - Sistema de Gestão de Viagens Corporativas
Sistema completo para gerenciamento de viagens corporativas com fluxos separados para Administrador, Financeiro e Técnicos/Representantes, incluindo aprovações, assinaturas digitais, geração de PDFs e gestão de cartões corporativos.

🚀 Funcionalidades
👑 Administrador
Gerenciar usuários (criar, editar permissões)

Visualizar CNPJs das empresas

Acompanhamento financeiro geral

Reset de dados de teste

Visão completa do sistema

💰 Financeiro
Aprovar ou recusar solicitações de viagem (com justificativa obrigatória na recusa)

Definir forma de pagamento (Cartão, Dinheiro ou Misto)

Gerenciar cartões corporativos (CRUD completo)

Aprovar ou recusar pedidos de recursos extras

Aprovar ou recusar pedidos de cancelamento de viagem

Anexar termos assinados e liberar viagens

Assinar termo final eletronicamente

Visualizar histórico e documentos

🔧 Técnico / Representante
Solicitar nova viagem

Acompanhar status da viagem

Lançar gastos com comprovantes obrigatórios

Solicitar recursos extras

Pedir dias adicionais

Solicitar cancelamento de viagem (somente se nenhum gasto foi lançado)

Assinar termo final eletronicamente

Visualizar histórico pessoal

📋 Fluxo Completo da Viagem
text
1. Técnico solicita viagem (status: pendente)
                    ↓
2. Financeiro analisa e aprova (com cartão/dinheiro/misto)
   - Gera termo de liberação automaticamente
   - Status: aguardando_assinatura
                    ↓
3. Financeiro anexa termo assinado fisicamente
   - Status: aprovada
   - Prazo de acerto: 3 dias úteis após fim da viagem
                    ↓
4. Técnico lança gastos (com comprovantes obrigatórios)
   - Status: em_andamento
                    ↓
5. Técnico finaliza viagem e assina termo final
   - Status: aguardando_assinatura_financeiro
                    ↓
6. Financeiro assina termo final
   - Gera PDF final com todas as informações e comprovantes
   - Status: finalizada
🔄 Fluxo de Cancelamento
text
1. Técnico solicita cancelamento (somente se não há gastos)
   - Informa motivo obrigatório
   - Status: cancelamento_solicitado
                    ↓
2. Financeiro analisa o pedido
   - Aprova: status vira cancelada, cartão é liberado
   - Recusa: status volta para aprovada/em_andamento
❌ Fluxo de Recusa
text
1. Financeiro recusa solicitação de viagem
   - Informa motivo obrigatório
   - Status: recusada
   - Técnico vê o motivo pelo ícone 📄
👥 Usuários de Teste
Perfil	E-mail	Senha
Administrador	admin@teste.com	123
Financeiro	fin@teste.com	123
Técnico	tec@teste.com	123
🗂️ Estrutura de Dados
Usuário
javascript
{
  id, name, email, password, role, photo, cpf
}
Viagem
javascript
{
  id, userId, company, city, serviceLocation,
  startDate, endDate, plannedAmount,
  paymentType, cardAmount, cashAmount, cardId, cardInUse,
  expenses[], extraFunds[],
  status, accountabilityDeadline,
  extensionRequestedUntil, extensionApprovedUntil,
  releaseTermFile, releaseTermGeneratedFile, releaseTermPhotoFile,
  finalTermFile, finalReportFile,
  userSignature, userSignatureDate,
  financeSignature, financeSignatureDate,
  cancellationReason, cancellationRequestedAt, cancellationApprovedAt,
  rejectionReason
}
Cartão
javascript
{
  id, company, holderName, brand, last4, expiry, limit, active
}
Empresa
javascript
{
  id, name, cnpj
}
Documento
javascript
{
  id, userId, tripId, title, type, fileName, fileData, docDate, snapshotHtml
}
🎨 Status possíveis das viagens
Status	Descrição
pendente	Aguardando análise do financeiro
aguardando_assinatura	Aguardando anexo do termo assinado
aprovada	Viagem liberada, pode lançar gastos
em_andamento	Viagem em andamento, gastos sendo lançados
aguardando_acerto	Técnico finalizou, aguardando financeiro
aguardando_assinatura_financeiro	Aguardando assinatura do financeiro
cancelamento_solicitado	Aguardando aprovação do cancelamento
cancelada	Viagem cancelada
finalizada	Processo concluído
recusada	Solicitação recusada (com motivo)
📄 Documentos Gerados
Documento	Quando é gerado	Quem assina
Termo de liberação	Financeiro aprova viagem	Financeiro (físico) + Técnico (físico)
Termo final de prestação de contas	Técnico finaliza viagem	Técnico (digital)
Termo final assinado	Financeiro assina	Financeiro (digital) + Técnico (digital)
Todos os PDFs são armazenados no localStorage e ficam disponíveis na aba PDFs para download.