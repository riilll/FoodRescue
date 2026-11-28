import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { simpanLogin } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      simpanLogin(res.data.token, res.data.user)
      navigate(res.data.user.role === 'mitra' ? '/mitra' : '/')
    } catch (err) {
      setError(err.response?.data?.message || 'Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded-lg px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border rounded-lg px-3 py-2"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white rounded-lg py-2 hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Login'}
        </button>
        <p className="text-sm text-center">
          Belum punya akun? <Link to="/register" className="text-green-600 font-semibold">Daftar</Link>
        </p>
      </form>
    </div>
  )
}

export default Login