import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'

function Register() {
  const [form, setForm] = useState({
    nama: '', email: '', password: '', no_hp: '', role: 'mahasiswa',
    nama_mitra: '', alamat: '', jam_tutup: '21:00',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function ubah(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { nama: form.nama, email: form.email, password: form.password, no_hp: form.no_hp, role: form.role }
      if (form.role === 'mitra') {
        body.nama_mitra = form.nama_mitra
        body.alamat = form.alamat
        body.jam_tutup = form.jam_tutup
      }
      await api.post('/auth/register', body)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  const input = 'border rounded-lg px-3 py-2'

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Daftar</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 flex flex-col gap-3">
        <select name="role" value={form.role} onChange={ubah} className={input}>
          <option value="mahasiswa">Mahasiswa (pembeli)</option>
          <option value="mitra">Mitra Restoran</option>
        </select>
        <input name="nama" placeholder="Nama" value={form.nama} onChange={ubah} required className={input} />
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={ubah} required className={input} />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={ubah} required className={input} />
        <input name="no_hp" placeholder="No HP" value={form.no_hp} onChange={ubah} required className={input} />
        {form.role === 'mitra' && (
          <>
            <input name="nama_mitra" placeholder="Nama restoran" value={form.nama_mitra} onChange={ubah} required className={input} />
            <input name="alamat" placeholder="Alamat" value={form.alamat} onChange={ubah} required className={input} />
            <label className="text-sm">Jam tutup
              <input name="jam_tutup" type="time" value={form.jam_tutup} onChange={ubah} required className={input + ' w-full mt-1'} />
            </label>
          </>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white rounded-lg py-2 hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
        <p className="text-sm text-center">
          Sudah punya akun? <Link to="/login" className="text-green-600 font-semibold">Login</Link>
        </p>
      </form>
    </div>
  )
}

export default Register