import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Countdown from './Countdown'

function pesanError(err) {
  const status = err.response?.status
  const code = err.response?.data?.code
  if (!err.response) return 'Tidak bisa terhubung ke server.'
  if (status === 409 && code === 'ORA-20006') return 'Stok habis, kamu kalah cepat!'
  if (status === 400 && code === 'ORA-20014') return 'Saldo tidak cukup. Isi saldo dulu.'
  return err.response.data?.message || 'Terjadi kesalahan. Coba lagi.'
}

function ItemCard({ item, onNotif, onSelesai }) {
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleBeli() {
    if (!user) return navigate('/login')
    if (user.role !== 'mahasiswa') return onNotif('Hanya akun mahasiswa yang bisa membeli.', 'error')
    setLoading(true)
    try {
      const res = await api.post('/orders', { id_sesi: item.id_sesi, jumlah: 1 })
      onNotif(res.data.message, 'sukses')
      onSelesai()
    } catch (err) {
      onNotif(pesanError(err), 'error')
      onSelesai()
    } finally {
      setLoading(false)
    }
  }

  const habis = item.stok_tersedia <= 0

  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-2">
      <h2 className="text-lg font-bold">{item.nama_produk}</h2>
      <p className="text-sm text-gray-600">{item.nama_mitra}</p>
      <p className="text-xs text-gray-500">{item.alamat}</p>
      <p className="text-2xl font-bold text-green-600">
        Rp {Number(item.harga_flash).toLocaleString('id-ID')}
      </p>
      <div className="flex justify-between text-sm">
        <span>Sisa stok: <b>{item.stok_tersedia}</b></span>
        <Countdown selesai={item.selesai_pada} />
      </div>
      <button
        onClick={handleBeli}
        disabled={loading || habis}
        className="mt-2 bg-green-600 text-white rounded-lg py-2 hover:bg-green-700 disabled:opacity-50"
      >
        {habis ? 'Habis' : loading ? 'Memproses...' : 'Beli'}
      </button>
    </div>
  )
}

export default ItemCard