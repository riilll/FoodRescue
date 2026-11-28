import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-green-600 text-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">FoodRescue</Link>
        <div className="flex items-center gap-4">
          {!user && (
            <>
              <Link to="/">Katalog</Link>
              <Link to="/login">Login</Link>
              <Link to="/register">Daftar</Link>
            </>
          )}
          {user?.role === 'mahasiswa' && (
            <>
              <Link to="/">Katalog</Link>
              <Link to="/pesanan">Pesanan Saya</Link>
              <span className="text-sm">
                {user.nama} · Rp {Number(user.saldo || 0).toLocaleString('id-ID')}
              </span>
              <button onClick={handleLogout} className="bg-white text-green-700 rounded-lg px-3 py-1 font-semibold">
                Logout
              </button>
            </>
          )}
          {user?.role === 'mitra' && (
            <>
              <Link to="/mitra">Dashboard Mitra</Link>
              <span className="text-sm">{user.nama}</span>
              <button onClick={handleLogout} className="bg-white text-green-700 rounded-lg px-3 py-1 font-semibold">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar