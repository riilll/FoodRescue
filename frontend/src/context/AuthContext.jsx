import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function bacaUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(bacaUser)

  function simpanLogin(token, dataUser) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(dataUser))
    setUser(dataUser)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, simpanLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}