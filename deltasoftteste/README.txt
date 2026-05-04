DeltaSoft - Sistema de Gestão de Viagens Corporativas
======================================================

COMO USAR:
1. Abra o arquivo index.html no navegador
2. Use um dos usuários de teste abaixo para fazer login

USUÁRIOS DE TESTE:
- Admin: admin@teste.com / 123
- Financeiro: fin@teste.com / 123  
- Técnico: tec@teste.com / 123

FUNCIONALIDADES IMPLEMENTADAS:

✅ Gastos lançados: Só soma o valor da viagem que está em aberto
✅ Cartão em uso: Financeiro não pode disponibilizar cartão já utilizado
✅ Finalizar viagem: Gera PDF com todas as descrições e fotos dos gastos
✅ Termo legal: Inclui cláusulas de responsabilidade e armazenamento por 30 dias
✅ Assinatura eletrônica: Usuário e financeiro assinam digitalmente
✅ Gastos obrigatórios: Todos os campos devem ser preenchidos (comprovante obrigatório)
✅ Sem campo de observações: Removido conforme solicitado
✅ Recusa com justificativa: Financeiro deve informar motivo ao recusar viagem

TECNOLOGIAS UTILIZADAS:
- HTML5, CSS3, JavaScript
- jsPDF para geração de PDFs
- Signature Pad para assinatura eletrônica
- LocalStorage para persistência dos dados

ARQUIVOS DO SISTEMA:
- index.html (estrutura da aplicação)
- style.css (estilos e responsividade)
- app.js (toda a lógica do sistema)
- README.txt (este arquivo)