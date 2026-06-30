import { redirect } from "next/navigation"

// Projetos vivem dentro do cliente. Não há lista global solta.
export default function ProjetosRedirect() {
  redirect("/clientes")
}
