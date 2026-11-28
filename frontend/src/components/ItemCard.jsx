import Countdown from './Countdown'

function ItemCard({ item }) {
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
      <button className="mt-2 bg-green-600 text-white rounded-lg py-2 hover:bg-green-700">
        Beli
      </button>
    </div>
  )
}

export default ItemCard