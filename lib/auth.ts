import { SessionOptions } from "iron-session"

export interface SessionData {
  userId: string
  name: string
  email: string
  role: "ADMIN" | "OPERADOR" | "CLIENTE"
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "luqz_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  },
}
