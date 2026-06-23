export type ClientRosterItem = {
  name: string
  active: boolean
  clickupFolderId: string | null
  statusReason: string | null
}

const inactiveWithoutDocumentedReason = "Inativo no roster oficial; motivo ainda não documentado."

// Fonte: clientes/_config/briefing-clientes-ativos.yaml do repositório LUQZ.
// Não inclui entradas explicitamente internas ou marcadas como não clientes.
export const CLIENT_ROSTER: ClientRosterItem[] = [
  { name: "Apex Trade", active: true, clickupFolderId: "901316650777", statusReason: null },
  { name: "ARP Gov", active: true, clickupFolderId: "90134282514", statusReason: null },
  { name: "Bambole Escola e Recreacao", active: true, clickupFolderId: "901317860752", statusReason: null },
  { name: "Camera Play Produtora", active: true, clickupFolderId: "901316760945", statusReason: null },
  { name: "Camilla Rentroia", active: true, clickupFolderId: "901317806474", statusReason: null },
  { name: "Deposito Santa Helena", active: true, clickupFolderId: "901317617481", statusReason: null },
  { name: "Dr Haroldo Freire", active: true, clickupFolderId: "901311385546", statusReason: null },
  { name: "Dr Joao Paulo", active: true, clickupFolderId: "90133070416", statusReason: null },
  { name: "Dr Thiago Conde Moura", active: true, clickupFolderId: "901314214389", statusReason: null },
  { name: "Dra Ludmila Vieira Borges", active: true, clickupFolderId: "901314046960", statusReason: null },
  { name: "Dra Rachel Avila", active: true, clickupFolderId: "90130764722", statusReason: null },
  { name: "Laisa Inacio de Oliveira", active: false, clickupFolderId: "901317780987", statusReason: "Cliente saiu; desativado em 26/05/2026." },
  { name: "Leao Group - Emirados Arabes", active: true, clickupFolderId: "901315718673", statusReason: null },
  { name: "Marcio Caramuru", active: true, clickupFolderId: "901317860579", statusReason: null },
  { name: "Mayara Cancela", active: true, clickupFolderId: "90132606534", statusReason: null },
  { name: "Mister Cont", active: true, clickupFolderId: "901311020852", statusReason: null },
  { name: "Natrilhas", active: true, clickupFolderId: "90136041739", statusReason: null },
  { name: "Pablo Magela", active: true, clickupFolderId: "901317934201", statusReason: null },
  { name: "Peixoto e Gomes", active: true, clickupFolderId: "901313147805", statusReason: null },
  { name: "Porto Pedras", active: true, clickupFolderId: "90133722446", statusReason: null },
  { name: "Ranigami", active: true, clickupFolderId: "901313663207", statusReason: null },
  { name: "RHLovers", active: true, clickupFolderId: "90130764608", statusReason: null },
  { name: "RR GUINDASTE", active: true, clickupFolderId: "901313584057", statusReason: null },
  { name: "identifique", active: true, clickupFolderId: "90134977714", statusReason: null },
  { name: "Adriana Glamour Emporium", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "camisetando", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Dr Cassio Goulart", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Dr Marcelo Almeida", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Dr Robson Miranda Costa", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Dra Renata Congro", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Leao Group - Estados Unidos", active: true, clickupFolderId: "901315718678", statusReason: null },
  { name: "SEVIRA", active: true, clickupFolderId: "901317972841", statusReason: null },
  { name: "Meu Imovel", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Rijeero", active: false, clickupFolderId: null, statusReason: inactiveWithoutDocumentedReason },
  { name: "Soul Artsy", active: true, clickupFolderId: "90133247746", statusReason: null },
]
