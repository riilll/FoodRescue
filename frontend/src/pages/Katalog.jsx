import { useEffect, useState } from 'react'
import api from '../api/client'
import ItemCard from '../components/ItemCard'

const PAKAI_MOCK = true // ganti ke false kalau backend sudah jalan

function buatMock() {
  const nanti = (jam) => new Date(Date.now() + jam * 3600000).toISOString()
  return [
    { id_sesi: 1, nama_produk: 'Croissant Butter Malam', nama_mitra: 'Warung Senja Kopi', alamat: 'Jl. Teuku Nyak Arief', harga_flash: 8000, stok_tersedia: 5, selesai_pada: nanti(2) },
    { id_sesi: 2, nama_produk: 'Nasi Ayam Geprek', nama_mitra: 'Dapur Kampus', alamat: 'Jl. Tgk Chik Pante Kulu', harga_flash: 10000, stok_tersedia: 2, selesai_pada: nanti(1) },
    { id_sesi: 3, nama_produk: 'Roti Sobek Cokelat', nama_mitra: 'Bakery Darussalam', alamat: 'Darussalam', harga_flash: 6000, stok_tersedia: 8, selesai_pada: nanti(3) },
  ]
}

function Katalog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function muat() {
      try {
        if (PAKAI_MOCK) {
          setItems(buatMock())
        } else {
          const res = await api.get('/flash-sales')
          setItems(res.data.data)
        }
        setError('')
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat katalog. Coba lagi.')
      } finally {
        setLoading(false)
      }
    }
    muat()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Katalog Flash Sale</h1>
      {loading && <p>Memuat...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500">Belum ada flash sale aktif saat ini.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id_sesi} item={item} />
        ))}
      </div>
    </div>
  )
}

export default Katalog